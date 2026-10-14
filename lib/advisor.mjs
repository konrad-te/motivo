import { sanitizePreferences, matches, searchCatalog, label, formatPLN, canonicalCategory } from './recommendation.mjs';

// Questions use recorded inventory facts. Answers are validated against these
// choices and applied directly, avoiding a model round trip for button clicks.
export function interviewQuestions(catalog, rawPreferences) {
  const p = sanitizePreferences(rawPreferences);
  const candidates = catalog.filter(car=>matches(car,p));
  const questions = [];
  const add = (id,title,reason,key,choices) => {
    const options = choices.map(([value,text])=>({id:JSON.stringify(value),label:text,patch:{[key]:value},count:catalog.filter(car=>matches(car,{...p,[key]:value})).length}));
    questions.push({id,title,reason,key,options});
  };
  if (!candidates.length) {
    const relaxations = [
      ['city','Where you search','city',null], ['maxPrice','Maximum budget','maxPrice',null],
      ['minPrice','Minimum price','minPrice',null], ['minYear','Minimum year','minYear',null],
      ['maxMileage','Mileage limit','maxMileage',null], ['minSeats','Seat requirement','minSeats',null],
      ['fuel','Fuel preference','fuel',[]], ['body','Body preference','body',[]],
      ['gearbox','Transmission','gearbox',null], ['make','Brand preference','make',[]]
    ];
    for (const [id,text,key,value] of relaxations) {
      if (Array.isArray(p[key]) ? !p[key].length : p[key] === null) continue;
      add(`relax-${id}`,`Would you like to remove your ${text.toLowerCase()}?`,'There are no matches. A requirement changes only when you choose to remove it.',key,[[value,`Remove ${text.toLowerCase()}`]]);
    }
    return questions.sort((a,b)=>b.options[0].count-a.options[0].count);
  }
  if (p.priority === 'balanced') add('priority','What matters most in your shortlist?','This changes the order of the results while keeping your requirements.', 'priority',[
    ['newer','Newer model year'],['low-mileage','Lower mileage'],['economy','Lower asking price']
  ]);
  if (p.maxPrice === null) {
    const prices=candidates.map(c=>c.price).sort((a,b)=>a-b);
    const budgets=[...new Set([0.3,0.6,0.85].map(q=>Math.ceil(prices[Math.floor((prices.length-1)*q)]/5000)*5000))];
    add('budget','What is your maximum budget?','A budget helps narrow this selection to cars you would consider buying.','maxPrice',budgets.map(n=>[n,`Up to ${formatPLN(n)}`]));
  }
  if (p.minSeats === null && candidates.some(c=>c.seats!==null)) add('seats','How many seats do you need?','Only cars with a recorded seat count can satisfy this requirement.','minSeats',[[2,'At least 2'],[5,'At least 5'],[7,'At least 7']]);
  if (!p.city) {
    const counts=new Map();
    for(const car of candidates) if(car.city) counts.set(car.city,(counts.get(car.city)||0)+1);
    const cities=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3);
    if(counts.size>1) add('city','Where would you like to look?','These are the most common exact listing cities in your matches. You can enter another city.','city',cities.map(([city])=>[city,city]));
  }
  for(const [key,id,title] of [['fuel','fuel','Which fuel would you prefer?'],['body','body','Which body style suits you?'],['gearbox','gearbox','Which transmission would you like?']]) {
    if(Array.isArray(p[key]) ? p[key].length : p[key]) continue;
    const values=[...new Set(candidates.map(c=>canonicalCategory(c[key])).filter(Boolean))];
    if(values.length>1) add(id,title,'Choose one option to narrow the matching listings.',key,values.slice(0,9).map(v=>[Array.isArray(p[key])?[v]:v,label(v)]));
  }
  if(p.maxMileage===null) {
    const values=candidates.map(c=>c.mileage).filter(n=>n!==null).sort((a,b)=>a-b);
    const limits=[...new Set([0.4,0.75].map(q=>Math.ceil(values[Math.floor((values.length-1)*q)]/10000)*10000))].filter(Number.isFinite);
    if(limits.length) add('mileage','Would you like a mileage limit?','Unknown mileage is excluded when you set a limit.','maxMileage',limits.map(n=>[n,`Up to ${n.toLocaleString('en-GB')} km`]));
  }
  if(p.minYear===null) {
    const years=[...new Set(candidates.map(c=>c.year))].sort((a,b)=>a-b);
    const limits=[...new Set([0.5,0.75].map(q=>years[Math.floor((years.length-1)*q)]))];
    if(years.length>1) add('year','How recent should the car be?','A minimum year keeps older listings out of your shortlist.','minYear',limits.map(n=>[n,`${n} or newer`]));
  }
  // Prefer unanswered core needs, then questions that divide the remaining inventory.
  const fixed={budget:100,priority:90,seats:80};
  const score=q=>fixed[q.id] ?? Math.max(...q.options.map(o=>Math.min(o.count,candidates.length-o.count)))/candidates.length*60;
  return questions.sort((a,b)=>score(b)-score(a));
}

export function applyInterviewAnswer(catalog, previous, answer) {
  const question=interviewQuestions(catalog,previous).find(q=>q.id===answer?.questionId);
  if(!question) throw Object.assign(new Error('This question is no longer available. Please use the latest shortlist.'),{status:400});
  let patch=question.options.find(o=>o.id===answer.optionId)?.patch;
  if(question.id==='city' && typeof answer.city==='string' && answer.city.trim() && answer.city.trim().length<=80) patch={city:answer.city.trim()};
  if(!patch) throw Object.assign(new Error('Please choose one of the available answers.'),{status:400});
  return {preferences:sanitizePreferences({...previous,...patch}),unsupported:[],intent:'search'};
}

export function describeChanges(catalog, before, after) {
  const changes=[];
  const fields={maxPrice:'Maximum budget',minPrice:'Minimum price',minSeats:'Minimum seats',minYear:'Minimum year',maxMileage:'Maximum mileage',city:'Location',gearbox:'Transmission',fuel:'Fuel',body:'Body style',make:'Brand',priority:'Ranking preference'};
  const display=(key,value)=>value===null||Array.isArray(value)&&!value.length?'Any':key.includes('Price')?formatPLN(value):key==='maxMileage'?`${value.toLocaleString('en-GB')} km`:Array.isArray(value)?value.map(label).join(' or '):key==='priority'?({'balanced':'Balanced','newer':'Newer model year','low-mileage':'Lower mileage','economy':'Lower asking price'}[value]):String(value);
  for(const [key,name] of Object.entries(fields)) if(JSON.stringify(before[key])!==JSON.stringify(after[key])) changes.push(`${name}: ${display(key,before[key])} → ${display(key,after[key])}`);
  if(!changes.length) return null;
  const previousCount=searchCatalog(catalog,before).total;
  const currentCount=searchCatalog(catalog,after).total;
  return {items:changes,previousCount,currentCount,summary:currentCount<previousCount?`Narrowed from ${previousCount.toLocaleString('en-GB')} to ${currentCount.toLocaleString('en-GB')} matching listings.`:currentCount>previousCount?`Expanded from ${previousCount.toLocaleString('en-GB')} to ${currentCount.toLocaleString('en-GB')} matching listings.`:`Still ${currentCount.toLocaleString('en-GB')} matching listings. Your shortlist has been ranked again.`};
}
