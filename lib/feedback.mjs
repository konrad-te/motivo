import { extractBaseline, normalize, sanitizePreferences } from './recommendation.mjs';

const fields = new Set(['minPrice','maxPrice','minYear','maxMileage','minSeats','fuel','gearbox','body','make','city','priority','general']);
export function sanitizeClarification(value) {
  return value && fields.has(value.field) && typeof value.question === 'string' && value.question.trim()
    ? {field:value.field,question:value.question.trim().slice(0,300)} : null;
}

// Catalog mode can clarify common feedback without guessing thresholds. It does
// not claim to understand arbitrary language when the model is unavailable.
export function extractFeedbackBaseline(message, previous, catalog, pendingQuestion) {
  const p = sanitizePreferences(previous), text = normalize(message);
  const extracted = extractBaseline(message,p,catalog);
  const ask = (field,question) => ({preferences:p,intent:'search',unsupported:extracted.unsupported,clarification:{field,question}});
  const pending = sanitizeClarification(pendingQuestion);
  const number = text.trim().match(/^(\d{1,3}(?:[ ,]\d{3})+|\d+)\s*(k|thousand)?\s*(?:pln|km|or newer|and newer|seats)?[.!]?$/);
  if(number && pending && ['minPrice','maxPrice','minYear','maxMileage','minSeats'].includes(pending.field)) {
    const value = Number(number[1].replace(/[ ,]/g,'')) * (number[2]?1000:1);
    if(Number.isFinite(value) && value>0 && value<=1e12 && (pending.field!=='minYear'||value>=1900&&value<=2100) && (pending.field!=='minSeats'||value<=50))
      return {preferences:sanitizePreferences({...p,[pending.field]:value}),intent:'search',unsupported:[],clarification:null};
    return ask(pending.field,pending.question);
  }
  if(/too old|older than i|not new enough/.test(text) && extracted.preferences.minYear===p.minYear)
    return ask('minYear','What is the oldest model year you would consider?');
  if(/mileage (?:is )?too high|too (?:many|much) (?:km|kilomet|miles)|too high mileage/.test(text) && extracted.preferences.maxMileage===p.maxMileage)
    return ask('maxMileage','What maximum mileage would you be comfortable with?');
  if(/too expensive|cost too much|overpriced/.test(text) && extracted.preferences.maxPrice===p.maxPrice)
    return ask('maxPrice','What maximum price in PLN would feel comfortable?');
  if(extracted.unsupported.length)
    return ask('general','Which recorded requirement would you like to change, such as seats, body style or budget?');
  if(/\b(except|exclude|not|without)\b|don.t|do not/.test(text))
    return ask('general','Which requirement should change, and what would you prefer instead?');
  if(JSON.stringify(extracted.preferences)!==JSON.stringify(p)) return {...extracted,clarification:null};
  return ask('general','What feels wrong about these cars: the price, age, mileage, size, or something else?');
}
