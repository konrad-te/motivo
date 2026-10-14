import catalog from '../data/catalog.json' with { type: 'json' };
import report from '../data/report.json' with { type: 'json' };
import { extractBaseline, sanitizePreferences, searchCatalog, buildReply, recommendationReasons } from './recommendation.mjs';
import { extractWithProvider } from './model.mjs';
import { interviewQuestions, applyInterviewAnswer, describeChanges } from './advisor.mjs';
import { extractFeedbackBaseline, sanitizeClarification } from './feedback.mjs';

export { catalog, report };
export async function chat(body, config = {}) {
  const started = performance.now();
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 3000) throw Object.assign(new Error('Please send a message between 1 and 3,000 characters.'),{status:400});
  const message = body.message.trim();
  const previous = sanitizePreferences(body.preferences);
  const history = Array.isArray(body.messages) ? body.messages.filter(m=>['user','assistant'].includes(m.role) && typeof m.content === 'string') : [];
  const pendingQuestion = sanitizeClarification(body.pendingQuestion);
  const feedback = body.feedback === true || !!pendingQuestion || history.some(m=>m.role==='assistant') && /too old|too expensive|too high|not satisfied|don.t like|not what i|prefer|lower mileage/i.test(message);
  let extracted, warning = null, mode = 'catalog', usage = null, provider = 'catalog';
  const configuredProvider = config.provider || (config.apiKey ? 'openai' : 'catalog');
  const selectedModel = config.model || (configuredProvider === 'ollama' ? 'qwen3.5:4b' : 'gpt-6.1-sol');
  if (body.refinement) extracted = applyInterviewAnswer(catalog,previous,body.refinement);
  else if (body.usePreferences === true) extracted = {preferences:previous,unsupported:[],intent:'search'};
  else if (configuredProvider === 'ollama' || (configuredProvider === 'openai' && config.apiKey)) {
    try {
      const shortlist = history.some(m=>m.role==='assistant') || feedback ? searchCatalog(catalog,previous).cars.map(({id,make,model,year,price,mileage,seats,fuel,gearbox,body,city})=>({id,make,model,year,price,mileage,seats,fuel,gearbox,body,city})) : [];
      extracted = await extractWithProvider({ provider:configuredProvider, message, previous, messages:history, context:{feedback,pendingQuestion,shownShortlist:shortlist}, apiKey:config.apiKey, baseUrl:config.baseUrl, model:selectedModel, fetchImpl:config.fetchImpl });
      mode = 'ai'; provider = configuredProvider; usage = extracted.usage;
    } catch (error) {
      warning = `AI interpretation is temporarily unavailable (${error.name === 'AbortError' ? 'timeout' : error.code || 'connection'}). Basic catalog search was used; check the interpreted filters below.`;
    }
  }
  extracted ??= feedback ? extractFeedbackBaseline(message,previous,catalog,pendingQuestion) : extractBaseline(message, previous, catalog);
  // Apply only declared updates. Clarification never changes saved requirements.
  if(extracted.updatedFields) extracted.preferences = sanitizePreferences({...previous,...Object.fromEntries(extracted.updatedFields.map(key=>[key,extracted.preferences[key]]))});
  if(extracted.intent!=='search' && (feedback || extracted.updatedFields?.length || /\b(?:need|find|looking|budget|family)\b/i.test(message) && /\b(?:car|seats?|gearbox|petrol|diesel|automatic)\b/i.test(message))) {
    extracted.clarification = {field:'general',question:'I may have misunderstood. What would you like to change or prioritize in your car search?'};
  }
  const clarification = sanitizeClarification(extracted.clarification);
  const intent = clarification ? 'clarification' : extracted.intent;
  if(intent!=='search') extracted.preferences = previous;
  const searchStarted = performance.now();
  const search = searchCatalog(catalog, extracted.preferences);
  const isSearch = intent === 'search';
  const cars = !isSearch ? [] : search.cars.map(car => {
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
    content:clarification ? [extracted.unsupported.join(' '),clarification.question].filter(Boolean).join('\n\n') : intent==='offtopic' ? 'I can help you explore cars in this catalog. Tell me your budget and the features you need.' : buildReply(search,extracted.unsupported,intent),
    intent, clarification, cars, total:search.total, preferences:search.preferences, mode, provider, warning,
    questions:isSearch ? interviewQuestions(catalog,search.preferences) : null,
    changes:isSearch ? (body.previousPreferences ? describeChanges(catalog,sanitizePreferences(body.previousPreferences),search.preferences) : (history.some(m=>m.role==='assistant') ? describeChanges(catalog,previous,search.preferences) : null)) : null,
    trace:{ provider, attemptedProvider:configuredProvider === 'catalog' ? null : configuredProvider, model:mode==='ai' ? selectedModel : 'deterministic-baseline-v1', promptVersion:'preferences-v2-feedback', intent, clarification, feedback, updatedFields:extracted.updatedFields || null, catalogVersion:report.archiveSha256.slice(0,12), preferences:search.preferences, candidateCount:search.total, returnedIds:cars.map(c=>c.id), retrievalMs:Math.round(performance.now()-searchStarted), totalMs:Math.round(performance.now()-started), usage, fallback:!!warning, unsupported:extracted.unsupported }
  };
}
