import cases from '../evals/cases.json' with {type:'json'};
import { extractBaseline, searchCatalog, sanitizePreferences } from './recommendation.mjs';
export { cases };
export function evaluateCase(test, extracted, catalog) {
  const failures=[];
  for(const [key,value] of Object.entries(test.expected)) if(JSON.stringify(extracted.preferences[key])!==JSON.stringify(value)) failures.push(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(extracted.preferences[key])}`);
  if(test.unsupported&&!extracted.unsupported?.length)failures.push('Unsupported need was not surfaced');
  if(test.intent&&test.intent!==extracted.intent)failures.push(`Expected ${test.intent} intent`);
  const search=searchCatalog(catalog,extracted.preferences);
  if(test.mustFind===true&&!search.cars.length)failures.push('Expected at least one real match');
  if(test.mustFind===false&&search.cars.length)failures.push('Expected no match');
  const p=extracted.preferences;
  for(const c of search.cars){
    if(!catalog.some(r=>r.id===c.id))failures.push('Unknown record ID');
    if(p.maxPrice!==null&&c.price>p.maxPrice)failures.push('Budget violation');
    if(p.minPrice!==null&&c.price<p.minPrice)failures.push('Minimum budget violation');
    if(p.minSeats!==null&&(c.seats===null||c.seats<p.minSeats))failures.push('Seat requirement violation');
    if(p.maxMileage!==null&&(c.mileage===null||c.mileage>p.maxMileage))failures.push('Mileage requirement violation');
    if(p.minYear!==null&&c.year<p.minYear)failures.push('Year violation');
    if(p.fuel.length&&!p.fuel.includes(c.fuel))failures.push('Fuel violation');
    if(p.gearbox&&c.gearbox!==p.gearbox)failures.push('Gearbox violation');
    if(c.damaged===true)failures.push('Reported damaged listing returned');
    if(c.qualityFlags?.length)failures.push('Quarantined price returned');
  }
  return {name:test.name,passed:failures.length===0,detail:failures.join('; ')||`${search.total.toLocaleString('en-GB')} matches; requirements respected`,preferences:p,returnedIds:search.cars.map(c=>c.id)};
}
export function runBaselineEvaluation(catalog){return cases.map(test=>evaluateCase(test,extractBaseline(test.message,sanitizePreferences(test.previous),catalog),catalog));}
