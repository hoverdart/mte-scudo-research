import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runPrompt, validateFiles, unwrapFence } from '../scripts/prompt-runner.mjs';
const oldOpt=process.env.ALLOW_LOCAL_RESEARCH_API,oldKey=process.env.OPENROUTER_API_KEY;
process.env.ALLOW_LOCAL_RESEARCH_API='1';process.env.OPENROUTER_API_KEY='offline-only-test-key';
after(()=>{for(const [k,v] of [['ALLOW_LOCAL_RESEARCH_API',oldOpt],['OPENROUTER_API_KEY',oldKey]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const roots=[];after(async()=>Promise.all(roots.map(root=>rm(root,{recursive:true,force:true}))));
async function fixture(){const root=await mkdtemp(join(tmpdir(),'prompt-runner-'));roots.push(root);await writeFile(join(root,'prompt.txt'),'Write a function that adds two numbers.');return root;}
function mock(text,{finish='stop',cost=0.002,status=200}={}){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/models'))return {ok:true,json:async()=>({data:[{id:'offline/model',pricing:{prompt:'0.000001',completion:'0.000005'}}]})};
    return {ok:status===200,status,json:async()=>({choices:[{message:{content:text},finish_reason:finish}],usage:{prompt_tokens:10,completion_tokens:20,...(cost===null?{}:{cost})}})};
  };
  return {calls,fetchImpl};
}
const options={promptFile:'prompt.txt',model:'offline/model'};
test('validates every generated path before writing files',()=>{
  for(const path of ['../secret','/tmp/x','a/../../x','a\\b','C:/x','a\u0000b','a/./b','a//b','CON.txt'])assert.throws(()=>validateFiles({files:[{path,content:'x'}]}));
  assert.throws(()=>validateFiles({files:[{path:'a',content:''},{path:'a/b',content:''}]}));
  assert.throws(()=>validateFiles({files:[{path:'A.py',content:''},{path:'a.py',content:''}]}));
  assert.equal(validateFiles({files:[{path:'src/add.py',content:'def add(a,b): return a+b\n'}]}).length,1);
});
test('files mode saves text files and exact request/cost records without credentials',async()=>{
  const root=await fixture();const api=mock(JSON.stringify({files:[{path:'src/add.py',content:'def add(a,b): return a+b\n'}]}));
  const result=await runPrompt({...options,mode:'files'},{root,fetchImpl:api.fetchImpl});
  assert.equal(api.calls.length,2);assert.equal(api.calls[1].options.redirect,'error');
  assert.equal(await readFile(join(result.runDir,'files/src/add.py'),'utf8'),'def add(a,b): return a+b\n');
  const record=await readFile(join(result.runDir,'record.json'),'utf8');assert.ok(!record.includes(process.env.OPENROUTER_API_KEY));
  const ledger=JSON.parse(await readFile(join(root,'artifacts/cost-ledger.json'),'utf8'));assert.equal(ledger.reportedCostUSD,0.002);assert.equal(ledger.requestCount,1);
});
test('code mode strips only a complete outer fence and saves a nonexecuted text artifact',async()=>{
  const root=await fixture();const api=mock('```python\ndef add(a,b): return a+b\n```');
  const result=await runPrompt({...options,mode:'code'},{root,fetchImpl:api.fetchImpl});
  assert.equal(await readFile(join(result.runDir,'files/code.txt'),'utf8'),'def add(a,b): return a+b');
  assert.equal(unwrapFence('explanation\n```python\nx\n```'),'explanation\n```python\nx\n```');
});
test('truncation saves partial response and cost, without materializing generated files',async()=>{
  const root=await fixture();const api=mock('{"files":[',{finish:'length'});
  await assert.rejects(runPrompt({...options,mode:'files'},{root,fetchImpl:api.fetchImpl}),/incomplete/);
  const [id]=await readdir(join(root,'artifacts/generations'));const dir=join(root,'artifacts/generations',id);
  assert.equal(await readFile(join(dir,'response.txt'),'utf8'),'{"files":[');await assert.rejects(readdir(join(dir,'files')),/ENOENT/);
  const ledger=JSON.parse(await readFile(join(root,'artifacts/cost-ledger.json'),'utf8'));assert.equal(ledger.reportedCostUSD,0.002);
});
test('traversal response fails without writing any generated files',async()=>{
  const root=await fixture();const api=mock(JSON.stringify({files:[{path:'good.py',content:'ok'},{path:'../../outside',content:'bad'}]}));
  await assert.rejects(runPrompt({...options,mode:'files'},{root,fetchImpl:api.fetchImpl}),/relative paths/);
  const [id]=await readdir(join(root,'artifacts/generations'));await assert.rejects(readdir(join(root,'artifacts/generations',id,'files')),/ENOENT/);
});
test('budget preflight prevents a paid request and missing costs block the next request',async()=>{
  const root=await fixture();const api=mock('answer');
  await assert.rejects(runPrompt({...options,requestBudget:0.000001},{root,fetchImpl:api.fetchImpl}),/budget/);assert.equal(api.calls.length,1);
  const unknown=mock('answer',{cost:null});const r=await runPrompt(options,{root,fetchImpl:unknown.fetchImpl});assert.equal(r.costKnown,false);
  await assert.rejects(runPrompt(options,{root,fetchImpl:unknown.fetchImpl}),/unknown cost/);assert.equal(unknown.calls.length,2);
});
