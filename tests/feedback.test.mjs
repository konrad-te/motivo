import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, catalog } from '../lib/service.mjs';
import { emptyPreferences, searchCatalog } from '../lib/recommendation.mjs';

const previous={...emptyPreferences(),maxPrice:60000,fuel:['petrol'],gearbox:'automatic',body:['compact']};
const history=[{role:'user',content:'Automatic petrol hatchback under 60,000 PLN.'},{role:'assistant',content:'Here is your shortlist.'}];
const response=(preferences,updatedFields=[],clarification=null,intent='search',unsupported=[])=>({preferences,updatedFields,clarification,intent,unsupported});
const mock=(output,inspect=()=>{})=>({provider:'openai',apiKey:'test-only',fetchImpl:async(url,options)=>{inspect(JSON.parse(options.body));return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});}});

test('Feedback model receives current shortlist, conversation and requirements',async()=>{
  const result=await chat({message:'2018 or newer please.',preferences:previous,messages:history,feedback:true},mock(response({...emptyPreferences(),minYear:2018},['minYear']),request=>{
    const input=JSON.parse(request.input);
    assert.equal(input.feedback,true);
    assert.deepEqual(input.previous,previous);
    assert.equal(input.shownShortlist.length,3);
    assert.ok(input.shownShortlist.every(c=>catalog.some(record=>record.id===c.id)));
    assert.deepEqual(input.recentConversation,history);
  }));
  assert.deepEqual(result.preferences,{...previous,minYear:2018});
  assert.ok(result.cars.every(c=>c.year>=2018&&c.price<=60000&&c.fuel==='petrol'&&c.gearbox==='automatic'));
  assert.ok(result.changes.items.some(item=>item.includes('Minimum year')));
});

test('Model clarification never changes filters or creates a misleading empty shortlist',async()=>{
  const clarification={field:'minYear',question:'What is the oldest model year you would consider?'};
  const result=await chat({message:'These are too old.',preferences:previous,messages:history,feedback:true},mock(response({...emptyPreferences(),minYear:2020},['minYear','maxPrice'],clarification)));
  assert.equal(result.intent,'clarification');
  assert.deepEqual(result.preferences,previous);
  assert.equal(result.content,clarification.question);
  assert.equal(result.questions,null);
  assert.equal(result.changes,null);
  assert.deepEqual(result.cars,[]);
  assert.equal(result.total,searchCatalog(catalog,previous).total);
});

test('Clarification answer is passed to the model with its field and preserves unrelated filters',async()=>{
  const pendingQuestion={field:'minYear',question:'What is the oldest model year you would consider?'};
  const result=await chat({message:'2018',preferences:previous,messages:[...history,{role:'user',content:'These are too old.'},{role:'assistant',content:pendingQuestion.question}],pendingQuestion},mock(response({...emptyPreferences(),minYear:2018},['minYear']),request=>assert.deepEqual(JSON.parse(request.input).pendingQuestion,pendingQuestion)));
  assert.deepEqual(result.preferences,{...previous,minYear:2018});
  assert.equal(result.intent,'search');
});

test('Catalog mode clarifies vague age then accepts a short numeric answer',async()=>{
  const first=await chat({message:'These are too old.',preferences:previous,messages:history,feedback:true});
  assert.equal(first.clarification.field,'minYear');
  assert.deepEqual(first.preferences,previous);
  const next=await chat({message:'2018',preferences:first.preferences,messages:history,pendingQuestion:first.clarification});
  assert.deepEqual(next.preferences,{...previous,minYear:2018});
  assert.equal(next.intent,'search');
});

test('Catalog feedback asks relevant questions for price and mileage without inventing limits',async()=>{
  for(const [message,field]of [['They are too expensive.','maxPrice'],['The mileage is too high.','maxMileage'],['I am not satisfied.','general']]) {
    const result=await chat({message,preferences:previous,messages:history,feedback:true});
    assert.equal(result.clarification.field,field);
    assert.deepEqual(result.preferences,previous);
    assert.equal(result.changes,null);
  }
});

test('Out-of-range numeric clarification answers never remove the existing budget',async()=>{
  const result=await chat({message:'9999999999999',preferences:previous,messages:history,pendingQuestion:{field:'maxPrice',question:'What is your maximum budget in PLN?'}});
  assert.equal(result.intent,'clarification');
  assert.equal(result.clarification.field,'maxPrice');
  assert.deepEqual(result.preferences,previous);
});

test('Unavailable model asks for clarification instead of misreading negative feedback',async()=>{
  const result=await chat({message:'Exclude petrol.',preferences:previous,messages:history,feedback:true},{provider:'openai',apiKey:'test-only',fetchImpl:async()=>new Response('{}',{status:429})});
  assert.match(result.warning,/rate_limit/);
  assert.equal(result.intent,'clarification');
  assert.deepEqual(result.preferences,previous);
});

test('Unavailable vehicle qualities are explained without pretending they were filtered',async()=>{
  const result=await chat({message:'I need more boot space.',preferences:previous,messages:history,feedback:true});
  assert.equal(result.intent,'clarification');
  assert.match(result.content,/not recorded/);
  assert.deepEqual(result.preferences,previous);
});

test('Offtopic and greeting responses do not show interview questions or alter requirements',async()=>{
  for(const intent of ['offtopic','greeting']) {
    const result=await chat({message:intent==='greeting'?'Hello':'Write a poem about the moon.',preferences:previous},mock(response(emptyPreferences(),[],null,intent)));
    assert.equal(result.intent,intent);
    assert.equal(result.questions,null);
    assert.deepEqual(result.preferences,previous);
  }
});

test('A car request misclassified as offtopic becomes explicit clarification',async()=>{
  const result=await chat({message:'We are a family of seven. I need an automatic car for no more than 110,000 PLN. Exclude petrol.',preferences:emptyPreferences()},mock(response(emptyPreferences(),[],null,'offtopic')));
  assert.equal(result.intent,'clarification');
  assert.match(result.content,/misunderstood/);
  assert.equal(result.questions,null);
  assert.equal(result.changes,null);
});

test('Genuine zero matches keep requirements and retain refinement options',async()=>{
  const result=await chat({message:'2018 or newer',preferences:{...previous,maxPrice:1000},messages:history,feedback:true},mock(response({...emptyPreferences(),minYear:2018},['minYear'])));
  assert.equal(result.intent,'search');
  assert.equal(result.total,0);
  assert.equal(result.preferences.maxPrice,1000);
  assert.ok(result.questions.length);
});

test('Malformed updated fields trigger a visible fallback without clearing existing constraints',async()=>{
  const result=await chat({message:'These are too old.',preferences:previous,messages:history,feedback:true},mock(response(emptyPreferences(),['inventedField'])));
  assert.match(result.warning,/invalid_output/);
  assert.deepEqual(result.preferences,previous);
  assert.equal(result.clarification.field,'minYear');
});
