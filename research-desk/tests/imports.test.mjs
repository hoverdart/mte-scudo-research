import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPdf} from '../dist/imports.mjs';
test('PDF worker transfer preserves attachment bytes and cleans up the loading task',async()=>{
  const bytes=new TextEncoder().encode('%PDF-test').buffer;
  let destroyed=false;
  const pages=await extractPdf(bytes,({data})=>{
    structuredClone(data,{transfer:[data.buffer]});
    return {promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'First line',hasEOL:true},{str:'Second line'}]})})}),destroy:async()=>{destroyed=true;}};
  });
  assert.equal(new TextDecoder().decode(bytes),'%PDF-test');
  assert.deepEqual(pages,['First line\nSecond line ']);
  assert.equal(destroyed,true);
});
