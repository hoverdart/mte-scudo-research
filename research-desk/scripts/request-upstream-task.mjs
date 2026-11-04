#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { scoreLifetime } from './upstream-score.mjs';
import { updateLedger } from './cost-ledger.mjs';
import { conservativeRequestBound } from './benchmark-core.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));const dir=resolve(root,'artifacts/analyses');const out=resolve(root,'artifacts/expansion/upstream-model');
const model=process.argv[2];if(!['anthropic/claude-haiku-4.5','anthropic/claude-sonnet-4.5'].includes(model)||process.env.ALLOW_LOCAL_RESEARCH_API!=='1')throw Error('Use an approved model and explicit API opt-in');
for(const path of ['.env','.env.local','../.env','../.env.local']){try{for(const line of(await readFile(resolve(root,path),'utf8')).split(/\r?\n/)){const m=line.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.*?)\s*$/);if(m&&process.env.OPENROUTER_API_KEY===undefined)process.env.OPENROUTER_API_KEY=m[1].replace(/^['"]|['"]$/g,'');}}catch(e){if(e.code!=='ENOENT')throw e;}}
if(!process.env.OPENROUTER_API_KEY)throw Error('Missing credential');
const task=JSON.parse(await readFile(resolve(out,'task.json'),'utf8'));
const driver=await readFile(resolve(root,'fixtures/expansion/data_lifetime.c'));if(createHash('sha256').update(driver).digest('hex')!==task.driverSha256)throw Error('Changed driver; prepare task again');
const pinned=spawnSync('git',['-C',resolve(root,'artifacts/upstream/dav1d'),'rev-parse','HEAD'],{encoding:'utf8'});if(pinned.status!==0||pinned.stdout.trim()!==task.pinned)throw Error('Changed upstream revision');
await mkdir(dir,{recursive:true});const lock=await open(resolve(root,'artifacts/analysis.lock'),'wx',0o600);
const id=randomUUID();const path=resolve(dir,`${id}.json`);let invoked=false;
const request={model,max_tokens:1000,temperature:0,provider:{allow_fallbacks:false},messages:[{role:'user',content:task.prompt}]};
const record={study:'expansion-data-lifetime-v1',fixture:'dav1d-data-api',capturedAt:new Date().toISOString(),provider:'openrouter',model,max_tokens:1000,request,promptSha256:task.promptSha256,sourceSha256:task.upstreamSnippetSha256,driverSha256:task.driverSha256,upstreamRevision:task.pinned,sourceRevision:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),status:'preflight'};
try{
 const ledger=await updateLedger(resolve(root,'artifacts'));if(ledger.requestsWithUnknownCost)throw Error('Unknown earlier costs');
 let count=0;for(const file of(await readdir(dir)).filter(f=>f.endsWith('.json'))){const r=JSON.parse(await readFile(resolve(dir,file),'utf8'));if(r.study===record.study){count++;if(r.model===model)throw Error('Duplicate request prohibited');}}
 if(count>=2)throw Error('Two-request expansion limit reached');
 const r=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Catalog unavailable');const catalog=await r.json();const info=catalog.data.find(m=>m.id===model);if(!info)throw Error('Unavailable model');
 const bound=conservativeRequestBound(task.prompt,info.pricing,1000);if(ledger.reportedCostUSD+bound>0.25)throw Error('Cumulative expansion ceiling exceeded');
 Object.assign(record,{status:'started',catalog:{id:model,pricing:info.pricing},priorReportedCostUSD:ledger.reportedCostUSD,conservativeRequestBoundUSD:bound});await writeFile(path,JSON.stringify(record,null,2)+'\n');invoked=true;
 const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'content-type':'application/json',Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},body:JSON.stringify(request)});
 record.httpStatus=res.status;const body=await res.json();record.rawResponse=body;record.usage=body.usage;if(!res.ok||body.error)throw Error('Provider error');
 record.stopReason=body.choices?.[0]?.finish_reason;record.content=[{type:'text',text:body.choices?.[0]?.message?.content||''}];record.status='completed';
 Object.assign(record,scoreLifetime(task.expected,record.content[0].text));
 record.success=record.stopReason==='stop'&&record.success;
 await writeFile(path,JSON.stringify(record,null,2)+'\n');await writeFile(resolve(out,`${model.includes('haiku')?'haiku':'sonnet'}.json`),JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify({model,usage:record.usage,strictFormat:record.strictFormat,correctScenarios:record.correctScenarios,success:record.success}));
 if(record.stopReason!=='stop')throw Error('Incomplete response; no retry');
}catch(e){if(invoked){record.error=e.message;record.status=record.status==='completed'?'completed':'failed';await writeFile(path,JSON.stringify(record,null,2)+'\n');}console.error(e.message);process.exitCode=1;}
finally{await updateLedger(resolve(root,'artifacts'));await lock.close();await unlink(resolve(root,'artifacts/analysis.lock'));}
