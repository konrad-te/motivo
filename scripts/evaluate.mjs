import fs from 'node:fs/promises';
import { catalog } from '../lib/service.mjs';
import { runBaselineEvaluation,cases,evaluateCase } from '../lib/evaluation.mjs';
import { extractWithModel } from '../lib/model.mjs';
import { sanitizePreferences } from '../lib/recommendation.mjs';
try{process.loadEnvFile('.env.local');}catch{}
try{process.loadEnvFile('.dev.vars');}catch{}
const useModel=process.argv.includes('--model');
if(useModel&&!process.env.OPENAI_API_KEY){console.error('Set OPENAI_API_KEY in .env.local before running model evaluations. No API calls were made.');process.exit(1);}
const results=[];
if(useModel){for(const test of cases){const start=performance.now();try{const extraction=await extractWithModel({message:test.message,previous:sanitizePreferences(test.previous),apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-6.1-sol'});results.push({...evaluateCase(test,extraction,catalog),latencyMs:Math.round(performance.now()-start),usage:extraction.usage});}catch(e){results.push({name:test.name,passed:false,detail:e.code||e.message,latencyMs:Math.round(performance.now()-start)});}}}else results.push(...runBaselineEvaluation(catalog));
const run={timestamp:new Date().toISOString(),interpreter:useModel?(process.env.OPENAI_MODEL||'gpt-6.1-sol'):'baseline-v1',results};
await fs.mkdir('evals/runs',{recursive:true});
const file=`evals/runs/${run.timestamp.replace(/[:.]/g,'-')}.json`;
await fs.writeFile(file,JSON.stringify(run,null,2));
for(const r of results)console.log(`${r.passed?'PASS':'FAIL'} ${r.name}: ${r.detail}`);
console.log(`${results.filter(r=>r.passed).length}/${results.length} passed. Report: ${file}`);
if(results.some(r=>!r.passed))process.exitCode=1;
