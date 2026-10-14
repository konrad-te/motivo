export const normalize = (text = '') => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase();
export const emptyPreferences = () => ({ minPrice: null, maxPrice: null, minYear: null, maxMileage: null, minSeats: null, fuel: [], gearbox: null, body: [], make: [], city: null, priority: 'balanced' });
export const FUEL = ['petrol', 'diesel', 'hybrid', 'plugin-hybrid', 'electric', 'petrol-lpg', 'petrol-cng', 'hydrogen', 'ethanol'];
export const BODY = ['compact', 'sedan', 'combi', 'suv', 'minivan', 'coupe', 'cabriolet', 'city-car'];
export const canonicalCategory = value => ({mini:'city-car',cabrio:'cabriolet',hidrogen:'hydrogen',etanol:'ethanol'}[value] || value);
const aliases = [
  ['body', 'suv', /\b(suv|crossover)\b/], ['body', 'combi', /\b(estate|wagon|kombi|combi)\b/],
  ['body', 'compact', /\b(hatchback|compact|kompakt)\b/], ['body', 'sedan', /\b(sedan|saloon)\b/],
  ['body', 'minivan', /\b(minivan|mpv)\b/], ['body', 'coupe', /\bcoupe\b/],
  ['fuel', 'electric', /\b(electric|ev|elektryczny|elektryczne)\b/], ['fuel', 'plugin-hybrid', /\b(phev|plug[ -]?in)\b/],
  ['fuel', 'hybrid', /\b(hybrid|hybryda|hybrydowy)\b/], ['fuel', 'diesel', /\b(diesel|diesla)\b/],
  ['fuel', 'petrol', /\b(petrol|gasoline|benzyna|benzynowy)\b/], ['fuel', 'petrol-lpg', /\blpg\b/],
];
const amount = (s, unit) => Number(s.replace(/[ ,]/g, '')) * (/^(k|tys)/i.test(unit || '') ? 1000 : 1);
const NUM = '(\\d{1,3}(?:[ ,]\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k\\b|tys\\b\\.?|thousand\\b)?';

export function sanitizePreferences(input = {}) {
  const out = emptyPreferences();
  for (const [key, max] of [['minPrice', 1e12], ['maxPrice', 1e12], ['minYear', 1e12], ['maxMileage', 1e12], ['minSeats', 1e12]]) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= max) out[key] = input[key];
  }
  for (const [key, allowed] of [['fuel', FUEL], ['body', BODY]]) out[key] = Array.isArray(input[key]) ? [...new Set(input[key].map(canonicalCategory).filter(v => allowed.includes(v)))].slice(0, 9) : [];
  out.make = Array.isArray(input.make) ? [...new Set(input.make.filter(v => typeof v === 'string').map(normalize))].slice(0, 5) : [];
  out.gearbox = ['automatic', 'manual'].includes(input.gearbox) ? input.gearbox : null;
  out.city = typeof input.city === 'string' && input.city.trim() ? input.city.trim().slice(0, 80) : null;
  out.priority = ['balanced','newer','low-mileage','economy'].includes(input.priority) ? input.priority : 'balanced';
  return out;
}

export function extractBaseline(message, previous = {}, catalog = []) {
  const text = normalize(message);
  const p = sanitizePreferences(previous);
  const unsupported = [];
  // Parse money only in a monetary context; seat counts and kilometre limits aren't budgets.
  const budget = text.match(new RegExp('(?:budget(?: is| of)?|under|up to|below|less than|maximum|max|do|ponizej)\\s*(?:pln\\s*)?' + NUM, 'i'));
  const currency = text.match(new RegExp(NUM + '\\s*(?:pln|zl|zloty|zlotych)\\b', 'i'));
  const shorthand = text.match(new RegExp('\\b' + NUM + '\\s*(?:budget)\\b', 'i'));
  const match = budget || currency || shorthand;
  if (match && !/(?:km|kilomet|miles|seats)/.test(text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 14))) {
    const value = amount(match[1], match[2]);
    if (value >= 0) p.maxPrice = value;
  }
  const range = text.match(new RegExp('(?:between|from|od)\\s*' + NUM + '\\s*(?:and|to|[-–]|do)\\s*' + NUM + '\\s*(?:pln|zl|budget)?', 'i'));
  if (range && amount(range[1], range[2]) >= 1000) { p.minPrice = amount(range[1], range[2]); p.maxPrice = amount(range[3], range[4]); }
  const mileage = text.match(new RegExp('(?:under|below|up to|max(?:imum)?|less than|ponizej|do)\\s*' + NUM + '\\s*(?:km|kilomet)', 'i'));
  if (mileage) p.maxMileage = amount(mileage[1], mileage[2]);
  const seats = text.match(/\b([2-9])\s*[- ]?(?:seats?|seaters?|miejsc)/);
  if (seats) p.minSeats = Number(seats[1]);
  if (/family of (?:six|6)/.test(text)) p.minSeats = 6;
  if (/family of (?:seven|7)/.test(text)) p.minSeats = 7;
  const year = text.match(/(?:from|since|after|newer than|od|rocznik)\s*(20[012]\d|199\d)\b/);
  if (year) p.minYear = Number(year[1]) + (/after|newer than/.test(year[0]) ? 1 : 0);
  if (/\b(automatic|automat|automatyczna)\b/.test(text)) p.gearbox = 'automatic';
  if (/\bmanual\b/.test(text)) p.gearbox = 'manual';
  if (/any (?:gearbox|transmission)/.test(text)) p.gearbox = null;
  for (const key of ['fuel', 'body']) {
    const found = aliases.filter(a => a[0] === key && a[2].test(text) && !new RegExp('(?:no|not|without|bez)\\s+(?:an?\\s+)?' + (key === 'fuel' ? a[1] : a[1])).test(text)).map(a => a[1]);
    if (found.length) p[key] = [...new Set(found)];
  }
  if (p.fuel.includes('plugin-hybrid')) p.fuel = p.fuel.filter(f => f !== 'hybrid');
  if (/any (?:fuel|engine)|dowolne paliwo/.test(text)) p.fuel = [];
  if (/any (?:body|shape|car type)/.test(text)) p.body = [];
  if (/\b(newest|newer|recent|nowszy)\b/.test(text)) p.priority = 'newer';
  if (/low(?:er)? mileage|niski przebieg/.test(text)) p.priority = 'low-mileage';
  if (/\b(cheapest|affordable|tani|najtanszy)\b/.test(text)) p.priority = 'economy';
  const makes = [...new Set(catalog.map(c => c.make))].filter(m => m && new RegExp('\\b' + normalize(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text));
  if (makes.length) p.make = makes;
  if (/any (?:brand|make)/.test(text)) p.make = [];
  const cities = [...new Set(catalog.map(c => c.city).filter(Boolean))].sort((a,b) => b.length-a.length);
  const city = cities.find(c => new RegExp('\\b' + normalize(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\b|$)').test(text));
  if (city) p.city = city;
  if (/anywhere|any (?:city|location)|all (?:of )?poland/.test(text)) p.city = null;
  if (/reliab|niezawod|maintenance|running cost|insurance/.test(text)) unsupported.push('Reliability and ownership costs are not measured in this dataset.');
  if (/boot|trunk|cargo|isofix|crash|safety rating/.test(text)) unsupported.push('Boot space, child-seat fittings and safety ratings are not recorded in this dataset.');
  if (/no diesel|not diesel|without diesel|bez diesla/.test(text)) { p.fuel = FUEL.filter(f => f !== 'diesel'); }
  if (/no electric|not electric/.test(text)) p.fuel = FUEL.filter(f => f !== 'electric');
  if (/\b(new car|brand new|new cars)\b/.test(text)) unsupported.push('The catalog does not reliably identify new versus used offers.');
  return { preferences: sanitizePreferences(p), unsupported, intent: /^(hi|hello|hey|czesc)[!. ]*$/.test(text) ? 'greeting' : 'search' };
}

export function matches(car, rawPreferences) {
  const p = sanitizePreferences(rawPreferences);
  return car.damaged !== true
    && !(car.qualityFlags || []).length
    && (p.minPrice === null || car.price >= p.minPrice)
    && (p.maxPrice === null || car.price <= p.maxPrice)
    && (p.minYear === null || car.year >= p.minYear)
    && (p.maxMileage === null || (car.mileage !== null && car.mileage <= p.maxMileage))
    && (p.minSeats === null || (car.seats !== null && car.seats >= p.minSeats))
    && (!p.fuel.length || p.fuel.includes(canonicalCategory(car.fuel)))
    && (!p.gearbox || car.gearbox === p.gearbox)
    && (!p.body.length || p.body.includes(canonicalCategory(car.body)))
    && (!p.make.length || p.make.includes(normalize(car.make)))
    && (!p.city || normalize(car.city) === normalize(p.city));
}

export function rankCatalog(catalog, preferences) {
  const p = sanitizePreferences(preferences);
  const filtered = catalog.filter(c => matches(c, p));
  // An explicit, inspectable baseline; these are ranking weights, not calibrated probabilities.
  const ranked = filtered.map(car => {
    const age = Math.max(0, 2025 - car.year);
    const miles = car.mileage === null ? 200000 : car.mileage;
    const weights = { balanced: [1.5, 1.5, 0.4], newer: [5, 0.5, 0.1], 'low-mileage': [0.5, 5, 0.1], economy: [0.2, 0.2, 4] }[p.priority];
    const score = -(age * weights[0] + miles/20000 * weights[1] + car.price/10000 * weights[2]);
    return { car, score };
  }).sort((a,b) => b.score - a.score || a.car.id.localeCompare(b.car.id));
  return { ranked, preferences:p, total:filtered.length };
}

export function searchCatalog(catalog, preferences, limit = 3) {
  const {ranked, preferences:p, total} = rankCatalog(catalog, preferences);
  const results = [], seen = new Set();
  for (const item of ranked) {
    const key = item.car.make + ':' + item.car.model;
    if (!seen.has(key)) { seen.add(key); results.push({ ...item.car, rankingScore: Math.round(item.score*100)/100 }); }
    if (results.length >= limit) break;
  }
  return { cars: results, total, preferences: p };
}

export function browseCatalog(catalog, preferences, page = 1, pageSize = 12) {
  const {ranked, preferences:p, total} = rankCatalog(catalog, preferences);
  if(p.priority==='economy') ranked.sort((a,b)=>a.car.price-b.car.price||a.car.id.localeCompare(b.car.id));
  if(p.priority==='newer') ranked.sort((a,b)=>b.car.year-a.car.year||a.car.id.localeCompare(b.car.id));
  if(p.priority==='low-mileage') ranked.sort((a,b)=>(a.car.mileage??Infinity)-(b.car.mileage??Infinity)||a.car.id.localeCompare(b.car.id));
  const size = Math.min(24, Math.max(1, Number.isFinite(pageSize) ? Math.floor(pageSize) : 12));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pages, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
  return {cars:ranked.slice((current-1)*size,current*size).map(({car,score})=>({...car,rankingScore:Math.round(score*100)/100,reasons:recommendationReasons(car,p)})),preferences:p,total,page:current,pages,pageSize:size};
}

export function formatPLN(n) { return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n) + ' PLN'; }
export function recommendationReasons(car, p) {
  const reasons = [];
  if (p.maxPrice) reasons.push(`${formatPLN(car.price)} — within your ${formatPLN(p.maxPrice)} budget`);
  if (p.minSeats) reasons.push(`${car.seats} seats listed`);
  if (p.gearbox) reasons.push(`${car.gearbox === 'automatic' ? 'Automatic' : 'Manual'} transmission`);
  if (p.city) reasons.push(`Listed in ${car.city}`);
  if (p.fuel.length) reasons.push(`${label(car.fuel)} powertrain`);
  if (p.minYear) reasons.push(`${car.year} — meets your minimum year`);
  if (p.maxMileage !== null && car.mileage !== null) reasons.push(`${car.mileage.toLocaleString('en-GB')} km — within your mileage limit`);
  if (!reasons.length) reasons.push(`${car.year} model year`, car.mileage === null ? 'Mileage not provided' : `${car.mileage.toLocaleString('en-GB')} km listed`);
  return reasons.slice(0,4);
}
export const label = (v) => ({ petrol:'Petrol', diesel:'Diesel', hybrid:'Hybrid', 'plugin-hybrid':'Plug-in hybrid', electric:'Electric', 'petrol-lpg':'Petrol / LPG', compact:'Hatchback', combi:'Estate', suv:'SUV', minivan:'Minivan', sedan:'Sedan', 'city-car':'City car', coupe:'Coupé', cabriolet:'Convertible' }[v] || (v ? String(v).charAt(0).toUpperCase()+String(v).slice(1) : 'Not recorded'));

export function buildReply(search, unsupported = [], intent = 'search') {
  if (intent === 'greeting') return 'Hello! Tell me a little about your next car. What is your budget, and how will you use it?';
  if (!search.total) return 'I couldn’t find a car that meets all of these requirements in this catalog. I’ve kept your limits intact. Try a wider budget, another location, or fewer filters.';
  const count = search.total.toLocaleString('en-GB');
  const needBudget = search.preferences.maxPrice === null;
  return `I found ${count} matching historical listings. Here are ${search.cars.length === 1 ? 'one option' : search.cars.length + ' different options'} to explore, ranked for ${ { balanced:'a balance of year, mileage and price', newer:'a newer model year', 'low-mileage':'lower mileage', economy:'a lower asking price' }[search.preferences.priority] }.${needBudget ? ' What budget would you like me to stay within?' : ' You can refine the shortlist by changing your budget, fuel type or transmission.'}${unsupported.length ? '\n\n' + unsupported.join(' ') : ''}`;
}
