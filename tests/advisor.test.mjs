import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, chat } from '../lib/service.mjs';
import { browseCatalog, emptyPreferences, matches, searchCatalog } from '../lib/recommendation.mjs';
import { interviewQuestions, applyInterviewAnswer, describeChanges } from '../lib/advisor.mjs';

const cityPreferences={...emptyPreferences(),maxPrice:60000,fuel:['petrol'],gearbox:'automatic',body:['compact']};

test('Browse sorting orders actual prices, years and mileage without changing hard filters',()=>{
  for(const [priority,key,direction] of [['economy','price',1],['newer','year',-1],['low-mileage','mileage',1]]) {
    const {cars}=browseCatalog(catalog,{...cityPreferences,priority});
    assert.ok(cars.every(c=>matches(c,cityPreferences)));
    for(let i=1;i<cars.length;i++) assert.ok((cars[i][key]-cars[i-1][key])*direction>=0);
  }
});

test('Browsing pages exposes every matching listing exactly once including repeated models',()=>{
  const first=browseCatalog(catalog,cityPreferences);
  const all=[];
  for(let page=1;page<=first.pages;page++) all.push(...browseCatalog(catalog,cityPreferences,page).cars);
  assert.equal(all.length,first.total);
  assert.equal(new Set(all.map(c=>c.id)).size,first.total);
  assert.ok(all.every(c=>matches(c,cityPreferences)));
  assert.equal(first.total,searchCatalog(catalog,cityPreferences).total);
  assert.ok(all.length>3);
  assert.ok(new Set(all.map(c=>`${c.make}:${c.model}`)).size<all.length);
});

test('Interview asks about unknown needs and reports exact candidate counts',()=>{
  const questions=interviewQuestions(catalog,cityPreferences);
  assert.ok(questions.length>=3);
  assert.ok(!questions.some(q=>['budget','fuel','gearbox','body'].includes(q.id)));
  for(const q of questions) for(const option of q.options) {
    const next=applyInterviewAnswer(catalog,cityPreferences,{questionId:q.id,optionId:option.id});
    assert.equal(searchCatalog(catalog,next.preferences).total,option.count);
    assert.equal(next.preferences.maxPrice,60000);
    assert.deepEqual(next.preferences.fuel,['petrol']);
  }
});

test('Interview refinement bypasses models and explains count and ranking changes',async()=>{
  const question=interviewQuestions(catalog,cityPreferences).find(q=>q.id==='priority');
  const result=await chat({message:'Lower mileage',preferences:cityPreferences,previousPreferences:cityPreferences,refinement:{questionId:question.id,optionId:JSON.stringify('low-mileage')}},{provider:'ollama',fetchImpl:()=>{throw Error('Should not call any model');}});
  assert.equal(result.preferences.priority,'low-mileage');
  assert.equal(result.preferences.maxPrice,60000);
  assert.ok(result.changes.items.some(s=>s.includes('Ranking preference')));
  assert.equal(result.changes.previousCount,result.changes.currentCount);
  assert.equal(result.warning,null);
  assert.ok(!result.questions.some(q=>q.id==='priority'));
});

test('City selection narrows results and invalid answers never alter constraints',()=>{
  const city=interviewQuestions(catalog,cityPreferences).find(q=>q.id==='city');
  const next=applyInterviewAnswer(catalog,cityPreferences,{questionId:'city',optionId:city.options[0].id});
  const changes=describeChanges(catalog,cityPreferences,next.preferences);
  assert.ok(changes.currentCount<changes.previousCount);
  assert.ok(searchCatalog(catalog,next.preferences).cars.every(c=>c.city===next.preferences.city));
  assert.throws(()=>applyInterviewAnswer(catalog,cityPreferences,{questionId:'budget',optionId:'100000'}),/no longer available/);
  assert.throws(()=>applyInterviewAnswer(catalog,cityPreferences,{questionId:'priority',optionId:'anything'}),/available answers/);
});

test('No results offer explicit relaxation without silently broadening',()=>{
  const p={...cityPreferences,maxPrice:1000};
  assert.equal(searchCatalog(catalog,p).total,0);
  const questions=interviewQuestions(catalog,p);
  assert.ok(questions.length);
  assert.ok(questions.every(q=>q.id.startsWith('relax-')));
  const next=applyInterviewAnswer(catalog,p,{questionId:'relax-maxPrice',optionId:'null'});
  assert.equal(next.preferences.maxPrice,null);
  assert.equal(next.preferences.gearbox,'automatic');
});

test('Category aliases preserve original facts while matching canonical filters',()=>{
  const convertible=catalog.find(c=>c.body==='cabrio'&&!c.damaged&&!c.qualityFlags.length);
  assert.ok(convertible);
  assert.equal(searchCatalog([convertible],{...emptyPreferences(),body:['cabriolet']}).total,1);
  assert.equal(browseCatalog([convertible],{...emptyPreferences(),body:['cabriolet']}).cars[0].body,'cabrio');
});

test('Structured preference edits do not reinterpret button text',async()=>{
  const result=await chat({message:'Update my shortlist',preferences:cityPreferences,previousPreferences:emptyPreferences(),usePreferences:true},{provider:'ollama',fetchImpl:()=>{throw Error('Unexpected model call');}});
  assert.deepEqual(result.preferences,cityPreferences);
  assert.ok(result.changes.items.length>=4);
});
