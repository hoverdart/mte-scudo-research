#!/usr/bin/env node
import { mkdir, readFile, writeFile, readdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fixtures, root, hash, measure, parseModelAnswer, conservativeRequestBound } from './benchmark-core.mjs';
import { updateLedger } from './cost-ledger.mjs';
const out=resolve(root,'artifacts/benchmark');
const archives=resolve(root,'artifacts/analyses');
await mkdir(out,{recursive:true});await mkdir(archives,{recursive:true});
const [mode,name,model]=process.argv.slice(2);
const complete=r=>r.status==='completed'&&['stop','end_turn'].includes(r.stopReason);
if(mode==='--oracle') {
  const results=[];
  for(const [name,f] of Object.entries(fixtures)) {
    const result=await measure(name,f.tests.map(([hex,expected])=>({hex,expected})),resolve(out,'oracle',name));
    if(!result.allPredictionsCorrect||!result.fullBranchCoverage)throw Error(`Oracle failed ${name}`);
    results.push(result);console.log(`${name}: oracle correct; branches ${result.coverage.branches.covered}/${result.coverage.branches.count}`);
  }
  await writeFile(resolve(out,'oracle.json'),JSON.stringify({capturedAt:new Date().toISOString(),results},null,2)+'\n');
} else if(mode==='--score') {
  const results=[];
  for(const file of (await readdir(archives)).filter(f=>f.endsWith('.json'))) {
    const r=JSON.parse(await readFile(resolve(archives,file),'utf8'));if(r.study!=='defensive-path-pilot-v1')continue;
    const result={request:file,fixture:r.fixture,model:r.model,sourceSha256:r.sourceSha256,promptSha256:r.promptSha256,costUSD:r.usage?.cost,complete:complete(r),success:false};
    if(complete(r)) {
      let parsed;
      try {parsed=parseModelAnswer(r.content[0].text);}
      catch(error){result.strictFormat=false;result.validationError=error.message;results.push(result);continue;}
      const {answer,...format}=parsed;Object.assign(result,format);
      const source=await readFile(resolve(root,fixtures[r.fixture].source));
      if(hash(source)!==r.sourceSha256)throw Error('Source changed since request');
      // Tool failures deliberately propagate; they are not model failures.
      const measured=await measure(r.fixture,answer.tests,resolve(out,'measured',file.replace('.json','')));
      Object.assign(result,measured,{entryPoints:answer.entry_points,contract:answer.contract,sanitizerNotes:answer.sanitizer_notes});
      result.uniqueInputs=new Set(answer.tests.map(t=>t.hex.toLowerCase())).size===answer.tests.length;
      result.semanticSuccess=measured.allPredictionsCorrect&&measured.fullBranchCoverage;
      result.success=result.strictFormat&&result.uniqueInputs&&result.semanticSuccess;
    }
    results.push(result);
  }
  const grouped={};for(const r of results){const g=grouped[r.model]??={tasks:0,successes:0,semanticSuccesses:0,correctPredictions:0,predictions:0,costUSD:0};g.tasks++;g.successes+=Number(r.success);g.semanticSuccesses+=Number(r.semanticSuccess??false);g.correctPredictions+=r.correctCount??0;g.predictions+=r.testCount??0;g.costUSD=Number((g.costUSD+(r.costUSD??0)).toFixed(12));}
  await writeFile(resolve(out,'scores.json'),JSON.stringify({capturedAt:new Date().toISOString(),results,grouped,limitations:'One sample per model/fixture. Branch completeness and expected outputs only; prose reviewed separately. No general equivalence inference.'},null,2)+'\n');
  console.log(JSON.stringify(grouped));
} else if(mode==='--request') {
  if(!fixtures[name]||!['anthropic/claude-haiku-4.5','anthropic/claude-sonnet-4.5','anthropic/claude-opus-4.5'].includes(model))throw Error('Use a protocol fixture and model');
  if(process.env.ALLOW_LOCAL_RESEARCH_API!=='1')throw Error('Explicit command-line ALLOW_LOCAL_RESEARCH_API=1 required');
  // Load credentials only; never permit .env to opt in or replace process variables.
  for(const path of ['.env','.env.local','../.env','../.env.local']) {
    try {for(const line of (await readFile(resolve(root,path),'utf8')).split(/\r?\n/)){const m=line.match(/^\s*(OPENROUTER_API_KEY)\s*=\s*(.*?)\s*$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  if(!process.env.OPENROUTER_API_KEY)throw Error('Missing OpenRouter credential');
  const source=await readFile(resolve(root,fixtures[name].source),'utf8');
  const oracle=JSON.parse(await readFile(resolve(out,'oracle.json'),'utf8')).results.find(r=>r.fixture===name);
  if(!oracle||oracle.sourceSha256!==hash(source)||!oracle.fullBranchCoverage||!oracle.allPredictionsCorrect)throw Error('Run a matching complete local oracle first');
  const prompt=`Defensive cybersecurity research: analyze this memory-safe local C fixture. Return ONLY one JSON object, no Markdown or code. Schema: {"entry_points":["public function names"],"tests":[{"hex":"hexadecimal bytes, empty string for zero length","expected":0}],"contract":"caller buffer preconditions, <=40 words","sanitizer_notes":"instrumentation and its limits, <=40 words"}. Supply 1..16 distinct valid tests, each 0..8 bytes (len is the decoded byte count), with integer expected return values. Choose tests to cover BOTH outcomes of EVERY source condition, including short-circuit operands and fallback cases, not just return statements. Do not supply executable code. Do not claim measured coverage. No corruption primitives, reclaim strategies, bypasses, target objects or escalation.\n\nSOURCE:\n${source}`;
  const request={model,max_tokens:1000,temperature:0,provider:{allow_fallbacks:false},messages:[{role:'user',content:prompt}]};
  const lock=await open(resolve(root,'artifacts/analysis.lock'),'wx',0o600);
  const id=randomUUID();const path=resolve(archives,`${id}.json`);
  const record={study:'defensive-path-pilot-v1',fixture:name,capturedAt:new Date().toISOString(),provider:'openrouter',model,max_tokens:1000,sourceSha256:hash(source),promptSha256:hash(prompt),promptVersion:3,sourceRevision:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),worktree:spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).stdout,request,status:'preflight'};
  let invoked=false;
  try {
    const ledger=await updateLedger(resolve(root,'artifacts'));
    if(ledger.requestsWithUnknownCost)throw Error('Unknown earlier request costs require review');
    const past=[];for(const f of (await readdir(archives)).filter(f=>f.endsWith('.json'))){const r=JSON.parse(await readFile(resolve(archives,f),'utf8'));if(r.study===record.study)past.push(r);}
    if(past.some(r=>r.fixture===name&&r.model===model))throw Error('Protocol forbids duplicate requests');
    if(past.length>=7)throw Error('Protocol request ceiling reached');
    if(model.includes('opus')) {
      const scores=JSON.parse(await readFile(resolve(out,'scores.json'),'utf8')).results;
      if(past.some(r=>r.model.includes('opus'))||!scores.some(r=>r.fixture===name&&r.model==='anthropic/claude-sonnet-4.5'&&!r.success))throw Error('Escalation requires a scored Sonnet failure and no earlier Opus request');
    }
    const response=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Catalog preflight failed');const catalog=await response.json();
    const info=catalog.data.find(m=>m.id===model);if(!info)throw Error('Model unavailable');
    const bound=conservativeRequestBound(prompt,info.pricing,1000);
    if(ledger.reportedCostUSD+bound>0.50)throw Error('Conservative cumulative pilot ceiling would be exceeded');
    Object.assign(record,{status:'started',catalog:{id:info.id,pricing:info.pricing},conservativeRequestBoundUSD:bound,priorReportedSpendUSD:ledger.reportedCostUSD,startedAt:new Date().toISOString()});
    await writeFile(path,JSON.stringify(record,null,2)+'\n');
    invoked=true;
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'content-type':'application/json',Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},body:JSON.stringify(request)});
    record.httpStatus=res.status;
    const body=await res.json();record.rawResponse=body;record.usage=body.usage;
    if(!res.ok||body.error)throw Error(`Model request failed HTTP ${res.status}`);
    record.content=[{type:'text',text:body.choices?.[0]?.message?.content||''}];record.stopReason=body.choices?.[0]?.finish_reason;
    record.status='completed';record.finishedAt=new Date().toISOString();
    await writeFile(path,JSON.stringify(record,null,2)+'\n');
    if(!complete(record))throw Error('Incomplete response: review before any further request');
    console.log(JSON.stringify({id,fixture:name,model,usage:record.usage,answer:record.content[0].text}));
  } catch(e) {
    if(invoked){record.status=record.status==='completed'?'completed':'failed';record.error=e.message;record.finishedAt=new Date().toISOString();await writeFile(path,JSON.stringify(record,null,2)+'\n');}
    console.error(e.message);process.exitCode=1;
  } finally {await updateLedger(resolve(root,'artifacts'));await lock.close();await unlink(resolve(root,'artifacts/analysis.lock'));}
} else throw Error('Usage: benchmark.mjs --oracle | --score | --request FIXTURE MODEL');
