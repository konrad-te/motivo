'use client';
import { useEffect, useState, ReactNode } from 'react';
import { ArrowRight, Check, LoaderCircle, SlidersHorizontal, Sparkles, X } from 'lucide-react';

export type Preferences={minPrice:number|null;maxPrice:number|null;minYear:number|null;maxMileage:number|null;minSeats:number|null;fuel:string[];gearbox:string|null;body:string[];make:string[];city:string|null;priority:string};
export type Question={id:string;title:string;reason:string;key:string;options:{id:string;label:string;count:number}[]};
export type Refinement={questionId:string;optionId?:string;city?:string};
export type InterviewState={phase:'offer'|'active'|'paused'|'satisfied';asked:string[];round:number;step:number};
export const initialInterview:InterviewState={phase:'offer',asked:[],round:1,step:0};
export type Changes={summary:string;items:string[];previousCount:number;currentCount:number};
export type Clarification={field:string;question:string};

export function ChangeSummary({changes}:{changes:Changes}) {
  return <div className="change-summary"><span className="change-icon"><SlidersHorizontal size={16}/></span><div><strong>What changed</strong><p>{changes.summary}</p><ul>{changes.items.map(item=><li key={item}>{item}</li>)}</ul></div></div>;
}

export function Interview({questions,state,onState,onAnswer,onDescribe,pending,onEdit,total}:{questions:Question[];state:InterviewState;onState:(next:InterviewState)=>void;onAnswer:(answer:Refinement,text:string,next:InterviewState)=>void;onDescribe:()=>void;pending:boolean;onEdit:()=>void;total:number}) {
  const remaining=questions.filter(q=>!state.asked.includes(q.id));
  const question=remaining[0];
  const next=(id:string):InterviewState=>({...state,asked:[...state.asked,id],step:state.step+1,phase:state.step+1>=3?'paused':'active'});
  const answer=(option:{id:string;label:string})=>{if(question)onAnswer({questionId:question.id,optionId:option.id},option.label,next(question.id));};
  function start(){onState({...state,phase:'active',round:state.phase==='paused'?state.round+1:state.round,step:0});}
  if(state.phase==='satisfied') return <div className="interview-card interview-complete"><span><Check size={17}/>Your shortlist is ready to explore.</span><button className="text-button" onClick={()=>onState({...state,phase:'offer'})} disabled={pending}>Refine again<ArrowRight size={13}/></button></div>;
  if(state.phase==='active' && question) return <section className="interview-card" aria-label="Refine your recommendations"><div className="interview-heading"><span><Sparkles size={15}/>A BETTER FIT</span><small>Question {state.step+1} of up to 3</small></div><h3>{question.title}</h3><p>{question.reason}</p><div className="interview-options">{question.options.map(option=><button key={option.id} disabled={pending} onClick={()=>answer(option)}><strong>{option.label}</strong><small>{option.count.toLocaleString('en-GB')} {option.count===1?'match':'matches'}</small><ArrowRight size={14}/></button>)}</div><div className="interview-actions"><button className="text-button" onClick={()=>onState(next(question.id))} disabled={pending}>Skip this question</button><button className="text-button" onClick={onDescribe} disabled={pending}>Describe it instead</button><button className="text-button" onClick={()=>onState({...state,phase:'paused'})} disabled={pending}>Finish for now</button></div>{pending&&<span className="interview-updating" role="status"><LoaderCircle size={14} className="spin"/>Updating your shortlist…</span>}</section>;
  const exhausted=!question;
  return <section className="interview-card" aria-label="Suggested questions">
    <div className="interview-heading"><span><Sparkles size={15}/>LET’S MAKE IT FIT</span></div>
    <h3>{exhausted?'Want to refine something else?':'Would you like more guidance?'}</h3>
    <p>{exhausted?'You’ve covered these suggested questions. Tell me in the chat what you’d like to change.':'Answer up to three more suggested questions, or describe what you’d like in the main chat.'}</p>
    <div className="interview-actions offer-actions">
      {total>0&&<button className="secondary-button" onClick={()=>onState({...state,phase:'satisfied'})} disabled={pending}><Check size={14}/>I’m happy with these</button>}
      {!exhausted&&<button className="text-button" onClick={start} disabled={pending}>Keep refining<ArrowRight size={14}/></button>}
      <button className="text-button" onClick={onDescribe} disabled={pending}>Use the chat<ArrowRight size={14}/></button>
      <button className="text-button" onClick={onEdit} disabled={pending}>Edit preferences<SlidersHorizontal size={14}/></button>
    </div>
  </section>;
}

type Page<T>={cars:T[];total:number;page:number;pages:number};
export function ListingsBrowser<T extends {id:string}>({preferences,renderCard,onClose}:{preferences:Preferences;renderCard:(car:T)=>ReactNode;onClose:()=>void}) {
  const [sort,setSort]=useState(preferences.priority),[page,setPage]=useState(1),[data,setData]=useState<Page<T>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:{...preferences,priority:sort},page}),signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return await r.json() as Page<T>;}).then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);}}).catch(()=>{if(!controller.signal.aborted){setError('We couldn’t load these listings. Please try again.');setLoading(false);}});return()=>controller.abort();},[preferences,page,sort,retry]);
  return <div className="listings-browser"><div className="listings-controls"><div><strong>{data?data.total.toLocaleString('en-GB'):'…'} matching listings</strong><p>Every matching offer, including different listings of the same model.</p></div><label>Sort by<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="balanced">Recommended balance</option><option value="economy">Lower asking price</option><option value="newer">Newer model year</option><option value="low-mileage">Lower mileage</option></select></label></div><p className="snapshot-note">Historical listings · March 2025 · Availability unverified</p>{error?<div className="listings-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:loading?<div className="listings-loading" role="status"><LoaderCircle size={22} className="spin"/>Loading matching listings…</div>:data?.cars.length?<div className="car-grid listings-grid">{data.cars.map(renderCard)}</div>:<p className="modal-intro">No listings match these preferences.</p>}<div className="listings-pagination"><button className="secondary-button" disabled={loading||!!error||page<=1} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {data?.page||page} of {data?.pages||1}</span><button className="secondary-button" disabled={loading||!!error||!data||page>=data.pages} onClick={()=>setPage(n=>n+1)}>Next<ArrowRight size={13}/></button></div><button className="text-button" onClick={onClose}><X size={13}/>Back to conversation</button></div>;
}
