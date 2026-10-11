"""Reproducible ingestion of the March 2025 educational Polish listings snapshot."""
import csv, io, json, zipfile, pathlib, hashlib, sqlite3, collections, urllib.request, argparse, statistics, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = 'https://github.com/karoljarzabek0/car_dataset_EDA'
URL = 'https://raw.githubusercontent.com/karoljarzabek0/car_dataset_EDA/main/dataset.zip'

def number(value):
    try:
        n = float(value)
        return int(n) if n.is_integer() else n
    except (ValueError, TypeError):
        return None

def string(value):
    return value.strip() if value and value.strip().lower() not in ('nan', 'none', 'null') else None

def boolean(value):
    n = number(value)
    return bool(n) if n in (0, 1) else None

def prepare(limit=12000):
    raw = ROOT / 'data/raw'
    processed = ROOT / 'data/processed'
    raw.mkdir(parents=True, exist_ok=True)
    processed.mkdir(parents=True, exist_ok=True)
    archive = raw / 'dataset.zip'
    if not archive.exists():
        urllib.request.urlretrieve(URL, archive)
    rejected, missing, rows, seen = collections.Counter(), collections.Counter(), [], set()
    total = 0
    with zipfile.ZipFile(archive) as z:
        name = next(n for n in z.namelist() if n.endswith('car_dataset.csv') and not n.startswith('__MACOSX'))
        with z.open(name) as f:
            for item in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig')):
                total += 1
                id = string(item.get('id'))
                if not id or id in seen:
                    rejected['missing_or_duplicate_id'] += 1
                    continue
                seen.add(id)
                price, year = number(item.get('price')), number(item.get('year'))
                if price is None or not 3000 <= price <= 1500000:
                    rejected['price_outside_project_scope'] += 1
                    continue
                if year is None or not 1990 <= year <= 2025:
                    rejected['year_outside_project_scope'] += 1
                    continue
                if not string(item.get('make')) or not string(item.get('model')):
                    rejected['missing_make_or_model'] += 1
                    continue
                row = {'id': id, 'title': string(item.get('title')), 'make': item['make'].strip().lower(), 'model': item['model'].strip(), 'price': price, 'year': year}
                for key, source in {'city':'city','region':'region','fuel':'fuel_type','gearbox':'gearbox','body':'body_type','version':'version'}.items():
                    row[key] = string(item.get(source))
                for key, source, low, high in [('mileage','mileage',0,1000000),('power','engine_power',10,1500),('seats','nr_seats',1,9),('consumption','urban_consumption',1,40)]:
                    val = number(item.get(source))
                    row[key] = val if val is not None and low <= val <= high else None
                row['damaged'] = boolean(item.get('damaged'))
                row['accidentFree'] = boolean(item.get('no_accident'))
                for key, value in row.items():
                    if value is None: missing[key] += 1
                rows.append(row)
    # Listing prices can be down payments, monthly leases or errors. Keep and flag;
    # do not invent a corrected price. Use full-data peers rather than the app sample.
    price_groups = collections.defaultdict(list)
    for row in rows:
        if row['damaged'] is not True:
            price_groups[(row['make'], row['model'], row['year'])].append(row['price'])
    medians = {key: statistics.median(values) for key, values in price_groups.items() if len(values) >= 5}
    flagged = collections.Counter()
    for row in rows:
        ref = medians.get((row['make'], row['model'], row['year']))
        row['qualityFlags'] = []
        if ref and row['price'] < ref * 0.30:
            row['qualityFlags'].append('price_outlier')
            flagged['price_below_30_percent_of_peer_median'] += 1
        if re.search(r'\b(leasing|cesja|rata|wynajem|odstepne|odstępne)\b', row['title'] or '', re.I):
            row['qualityFlags'].append('possible_lease_or_deposit')
            flagged['title_suggests_lease_or_deposit'] += 1
    # Retain a compact, deterministic sample for a portable server. Every row is real.
    ranked = sorted(rows, key=lambda r: hashlib.sha256(r['id'].encode()).hexdigest())
    selected, strata = {}, set()
    for row in ranked:
        key = (row['make'], row['fuel'], row['body'], int(row['price'] // 50000))
        if key not in strata:
            strata.add(key)
            selected[row['id']] = row
            if len(selected) >= limit: break
    for row in ranked:
        if len(selected) >= limit: break
        selected.setdefault(row['id'], row)
    catalog = list(selected.values())
    (ROOT/'data/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    db = sqlite3.connect(processed/'cars.sqlite')
    db.execute('DROP TABLE IF EXISTS cars')
    cols = list(rows[0])
    numeric = {'price','year','mileage','power','seats','consumption','damaged','accidentFree'}
    db.execute('CREATE TABLE cars (' + ','.join('"'+c+'" '+('REAL' if c in numeric else 'TEXT') for c in cols) + ')')
    db.executemany('INSERT INTO cars VALUES ('+','.join('?' for c in cols)+')', [[json.dumps(r[c]) if isinstance(r[c], list) else r[c] for c in cols] for r in rows])
    db.execute('CREATE INDEX cars_filter ON cars(price,year,fuel,gearbox)')
    db.commit()
    db.close()
    report = {'source': SOURCE, 'sourceSnapshot': 'March 2025', 'usage': 'Educational use only, as stated by the dataset author. Historical asking prices; no current availability is implied.', 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'rawRows': total, 'cleanRows': len(rows), 'appRows': len(catalog), 'sampleMethod': 'SHA-256 of offer ID; one record per make/fuel/body/50,000 PLN price band, then hash-order fill.', 'excluded': dict(rejected), 'missingValuesCleanCatalog': dict(missing), 'appMissingValues': {k: sum(r.get(k) is None for r in catalog) for k in cols}, 'makes':len({r['make'] for r in catalog}), 'cities':len({r['city'] for r in catalog if r['city']})}
    report['qualityFlagsFullCatalog'] = dict(flagged)
    report['appQuarantinedPrices'] = sum(bool(r['qualityFlags']) for r in catalog)
    report['priceQualityRule'] = 'Quarantine prices below 30% of the median for the same make/model/year when at least 5 non-damaged peers exist, and titles suggesting lease/deposit. These flags are heuristics, not verified errors; original prices are preserved.'
    (ROOT/'data/report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('rawRows','cleanRows','appRows','excluded','makes','cities')}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=12000)
    prepare(parser.parse_args().limit)
