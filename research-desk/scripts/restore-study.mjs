#!/usr/bin/env node
// Rehydrate redacted committed model evidence for offline rescoring on a fresh clone.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, hash } from './benchmark-core.mjs';
import { updateLedger } from './cost-ledger.mjs';
const records=JSON.parse(await readFile(resolve(root,'docs/results/requests.json'),'utf8'));
try {const expansion=JSON.parse(await readFile(resolve(root,'docs/expansion/results.json'),'utf8'));records.push(...expansion.upstream.requests);} catch(e){if(e.code!=='ENOENT')throw e;}
const directory=resolve(root,'artifacts/analyses');await mkdir(directory,{recursive:true});
let restored=0;
for(const r of records){
  if(!/^[a-f0-9-]+\.json$/.test(r.archive))throw Error('Unsafe archive name');
  const path=resolve(directory,r.archive);
  const {archive,archiveSha256,...record}=r;
  record.restoredFromArchiveSha256=archiveSha256;
  record.restorationNote='Rehydrated from committed redacted evidence; this file is not byte-identical to the original raw archive.';
  const reconstructed=JSON.stringify(record,null,2)+'\n';
  let existing;
  try{existing=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing){
    if(hash(existing)!==r.archiveSha256&&existing.toString('utf8')!==reconstructed)throw Error('Existing archive differs; refusing overwrite');
    continue;
  }
  await writeFile(path,reconstructed,{flag:'wx'});restored++;
}
const ledger=await updateLedger(resolve(root,'artifacts'));
console.log(`Restored ${restored} missing redacted archives; retained all existing originals. Recorded spend $${ledger.reportedCostUSD.toFixed(6)}.`);
