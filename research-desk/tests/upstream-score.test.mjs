import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLifetime } from '../scripts/upstream-score.mjs';
const expected={both:{after_setup:[],after_unref:['payload','metadata'],after_second_unref:['payload','metadata'],size:0,timestamp:'INT64_MIN',offset:-1}};
test('upstream scoring preserves ordering and distinguishes format from semantics',()=>{
  const raw=JSON.stringify(expected);
  assert.equal(scoreLifetime(expected,raw).success,true);
  const fenced=scoreLifetime(expected,'```json\n'+raw+'\n```');
  assert.equal(fenced.success,false);assert.equal(fenced.semanticSuccess,true);
  const wrong=structuredClone(expected);wrong.both.after_unref.reverse();
  assert.equal(scoreLifetime(expected,JSON.stringify(wrong)).semanticSuccess,false);
});
test('upstream scoring rejects missing, extra and wrong-type fields without repairing them',()=>{
  assert.equal(scoreLifetime(expected,'{}').success,false);
  assert.equal(scoreLifetime(expected,JSON.stringify({...expected,extra:1})).success,false);
  const wrong=structuredClone(expected);wrong.both.size='0';
  assert.equal(scoreLifetime(expected,JSON.stringify(wrong)).success,false);
});
