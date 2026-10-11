import catalog from '../data/catalog.json' with { type: 'json' };
import report from '../data/report.json' with { type: 'json' };
import { extractBaseline, sanitizePreferences, searchCatalog, buildReply, recommendationReasons } from './recommendation.mjs';
import { extractWithModel } from './model.mjs';

export { catalog, report };
export async function chat(body, config = {}) {
  const started = performance.now();
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 3000) throw Object.assign(new Error('Please send a message between 1 and 3,000 characters.'),{status:400});
  const message = body.message.trim();
  const previous = sanitizePreferences(body.preferences);
  let extracted, warning = null, mode = 'catalog', usage = null;
  if (config.apiKey) {
    try {
      extracted = await extractWithModel({ message, previous, messages:Array.isArray(body.messages) ? body.messages.filter(m=>['user','assistant'].includes(m.role) && typeof m.content === 'string') : [], apiKey:config.apiKey, model:config.model || 'gpt-6.1-sol', fetchImpl:config.fetchImpl });
      mode = 'ai'; usage = extracted.usage;
    } catch (error) {
      warning = `AI interpretation is temporarily unavailable (${error.code || (error.name === 'AbortError' ? 'timeout' : 'connection')}). Basic catalog search was used; check the interpreted filters below.`;
    }
  }
  extracted ??= extractBaseline(message, previous, catalog);
  const searchStarted = performance.now();
  const search = searchCatalog(catalog, extracted.preferences);
  const isGreeting = extracted.intent === 'greeting';
  const isOfftopic = extracted.intent === 'offtopic';
  const cars = isGreeting || isOfftopic ? [] : search.cars.map(car => {
    const cheapest=Math.min(...search.cars.map(c=>c.price));
    const newest=Math.max(...search.cars.map(c=>c.year));
    const knownMileage=search.cars.filter(c=>c.mileage!==null).map(c=>c.mileage);
    const lowestMileage=knownMileage.length?Math.min(...knownMileage):null;
    let tradeoff='Condition and service history still need independent verification.';
    if(car.mileage===null)tradeoff='Mileage was not recorded, so a mileage comparison is not possible.';
    else if(car.price>cheapest)tradeoff=`${(car.price-cheapest).toLocaleString('en-GB')} PLN more than the lowest-priced option here.`;
    else if(car.year<newest)tradeoff=`${newest-car.year} model ${newest-car.year===1?'year':'years'} older than the newest option here.`;
    else if(lowestMileage!==null&&car.mileage>lowestMileage)tradeoff=`${(car.mileage-lowestMileage).toLocaleString('en-GB')} km more than the lowest-mileage option here.`;
    return {...car,reasons:recommendationReasons(car,search.preferences),tradeoff};
  });
  return {
    id:crypto.randomUUID(),
    content:isOfftopic ? 'I can help you explore cars in this catalog. Tell me your budget and the features you need.' : buildReply(search,extracted.unsupported,extracted.intent),
    cars, total:isGreeting || isOfftopic ? 0 : search.total, preferences:search.preferences, mode, warning,
    trace:{ model:mode==='ai' ? (config.model || 'gpt-6.1-sol') : 'deterministic-baseline-v1', promptVersion:'preferences-v1', catalogVersion:report.archiveSha256.slice(0,12), preferences:search.preferences, candidateCount:search.total, returnedIds:cars.map(c=>c.id), retrievalMs:Math.round(performance.now()-searchStarted), totalMs:Math.round(performance.now()-started), usage, fallback:!!warning, unsupported:extracted.unsupported }
  };
}
