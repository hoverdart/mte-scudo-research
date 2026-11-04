import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAnswer, measure, parseModelAnswer, conservativeRequestBound } from '../scripts/benchmark-core.mjs';
const answer=tests=>({entry_points:['process_input'],contract:'valid input',sanitizer_notes:'ASan',tests});
test('model inputs are schema-checked before execution',()=>{
  for(const tests of [[],[{hex:'00\r\n',expected:0}],[{hex:'00'.repeat(9),expected:0}],[{hex:'00;touch x',expected:0}],[{hex:'0',expected:0}],[{hex:'',expected:'0'}],Array(17).fill({hex:'',expected:0})])assert.throws(()=>validateAnswer(answer(tests)));
  assert.equal(validateAnswer(answer([{hex:'',expected:0}])).length,1);
});
test('executable scoring detects wrong predictions and missing fallback coverage',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'path-score-'));
  try {
    const result=await measure('toy',[{hex:'',expected:0},{hex:'41',expected:1},{hex:'4221',expected:2},{hex:'42',expected:3},{hex:'43',expected:2}],directory);
    assert.equal(result.allPredictionsCorrect,false);
    assert.equal(result.correctCount,4);
    assert.equal(result.fullBranchCoverage,false);
    assert.equal(result.coverage.branches.covered,9);
    assert.equal(result.coverage.branches.count,10);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('only an exact JSON fence can be removed in separately labeled diagnostic scoring',()=>{
  const text=JSON.stringify(answer([{hex:'',expected:0}]));
  assert.equal(parseModelAnswer(text).strictFormat,true);
  const fenced=parseModelAnswer('```json\n'+text+'\n```');
  assert.equal(fenced.strictFormat,false);
  assert.equal(fenced.secondaryFenceRemoval,true);
  assert.throws(()=>parseModelAnswer('Here is JSON: '+text));
  assert.throws(()=>parseModelAnswer('```json\n'+JSON.stringify(answer([{hex:'../secret',expected:0}]))+'\n```'));
});
test('request cost preflight uses conservative bytes and rejects unknown prices and caps',()=>{
  assert.equal(conservativeRequestBound('abc',{prompt:'0.000001',completion:'0.000005'}),0.006027);
  assert.throws(()=>conservativeRequestBound('abc',{}));
  assert.throws(()=>conservativeRequestBound('abc',{prompt:'-1',completion:'0'}));
  assert.throws(()=>conservativeRequestBound('abc',{prompt:'1',completion:'1'},1001));
});
