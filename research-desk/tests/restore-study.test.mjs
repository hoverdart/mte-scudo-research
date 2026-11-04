import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
test('fresh-clone redacted evidence restores offline, is idempotent, and rejects tampering',async()=>{
  const scratch=await mkdtemp(join(tmpdir(),'restore-study-'));
  try {
    await mkdir(join(scratch,'scripts'));await mkdir(join(scratch,'docs/results'),{recursive:true});
    for(const file of ['restore-study.mjs','benchmark-core.mjs','cost-ledger.mjs'])await copyFile(`scripts/${file}`,join(scratch,'scripts',file));
    await copyFile('docs/results/requests.json',join(scratch,'docs/results/requests.json'));
    const run=()=>spawnSync(process.execPath,[join(scratch,'scripts/restore-study.mjs')],{encoding:'utf8',timeout:5000});
    assert.equal(run().status,0);
    const ledger=JSON.parse(await readFile(join(scratch,'artifacts/cost-ledger.json'),'utf8'));
    const original=JSON.parse(await readFile('docs/results/requests.json','utf8'));
    assert.equal(ledger.requestCount,original.length);
    assert.equal(ledger.reportedCostUSD,Number(original.reduce((s,r)=>s+r.usage.cost,0).toFixed(12)));
    assert.equal(run().status,0);
    await mkdir(join(scratch,'docs/expansion'),{recursive:true});
    await copyFile('docs/expansion/results.json',join(scratch,'docs/expansion/results.json'));
    assert.equal(run().status,0);
    const expanded=JSON.parse(await readFile(join(scratch,'artifacts/cost-ledger.json'),'utf8'));
    const extra=JSON.parse(await readFile('docs/expansion/results.json','utf8')).upstream.requests;
    assert.equal(expanded.requestCount,original.length+extra.length);
    const archive=join(scratch,'artifacts/analyses',original[0].archive);
    const record=JSON.parse(await readFile(archive,'utf8'));record.model='tampered';await writeFile(archive,JSON.stringify(record));
    assert.equal(run().status,1);
  }finally{await rm(scratch,{recursive:true,force:true});}
});
