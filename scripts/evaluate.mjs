import fs from 'node:fs/promises';
import { catalog } from '../lib/service.mjs';
import { runBaselineEvaluation,cases,evaluateCase } from '../lib/evaluation.mjs';
import { extractWithProvider } from '../lib/model.mjs';
import { getModelConfig } from '../lib/model-config.mjs';
import { sanitizePreferences } from '../lib/recommendation.mjs';
try{process.loadEnvFile('.env.local');}catch{}
try{process.loadEnvFile('.dev.vars');}catch{}
const useModel=process.argv.includes('--model');
const config=getModelConfig();
if(useModel&&config.provider==='catalog'){console.error('Set AI_PROVIDER=ollama, or configure an OpenAI API key, before running model evaluations.');process.exit(1);}
const results=[];
if(useModel){for(const test of cases){const start=performance.now();try{const extraction=await extractWithProvider({...config,message:test.message,previous:sanitizePreferences(test.previous)});results.push({...evaluateCase(test,extraction,catalog),latencyMs:Math.round(performance.now()-start),usage:extraction.usage});}catch(e){results.push({name:test.name,passed:false,detail:e.code||e.message,latencyMs:Math.round(performance.now()-start)});}}}else results.push(...runBaselineEvaluation(catalog));
const run={timestamp:new Date().toISOString(),provider:useModel?config.provider:'catalog',interpreter:useModel?config.model:'baseline-v1',results};
await fs.mkdir('evals/runs',{recursive:true});
const file=`evals/runs/${run.timestamp.replace(/[:.]/g,'-')}.json`;
await fs.writeFile(file,JSON.stringify(run,null,2));
for(const r of results)console.log(`${r.passed?'PASS':'FAIL'} ${r.name}: ${r.detail}`);
console.log(`${results.filter(r=>r.passed).length}/${results.length} passed. Report: ${file}`);
if(results.some(r=>!r.passed))process.exitCode=1;
