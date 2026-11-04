#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));const out=resolve(root,'artifacts/expansion/allocator');await mkdir(out,{recursive:true});
const steps=[];let passed=false,error,scudo,mte;
const run=(command,args,expected=true)=>{const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});const scrub=s=>(s||'').replace(/0x[0-9a-fA-F]{8,}/g,'<address>');const s={command,args,status:r.status,signal:r.signal,stdout:scrub(r.stdout),stderr:scrub(r.stderr),error:r.error?.message};steps.push(s);if(expected&&(r.status!==0||r.error))throw Error('Allocator step failed; inspect record');return s;};
const image='mte-scudo-research/scudo-local:pilot';
try{
  const native=resolve(out,'native');run('clang',['-std=c11','-O0','-g','-Wall','-Wextra','-Werror','fixtures/expansion/allocator_events.c','-o',native]);
  const host=run(native,[]);if(!host.stdout.includes('"liveRequestedBytes":0'))throw Error('Incomplete host lifetime');
  const imageId=run('docker',['image','inspect',image,'--format','{{.Id}}']).stdout.trim();
  const user=`${process.getuid()||65532}:${process.getgid()||65532}`;
  const container=['run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=256m','--pids-limit=64','--user',user,'--tmpfs','/tmp:rw,nosuid,nodev,size=64m','--mount',`type=bind,src=${resolve(root,'fixtures/expansion')},dst=/input,readonly`,'--mount',`type=bind,src=${out},dst=/out`,imageId];
  run('docker',[...container,'clang-18','--version']);
  run('docker',[...container,'dpkg-query','-W','clang-18','libclang-rt-18-dev','libc6']);
  const runtime=run('docker',[...container,'clang-18','--print-file-name=libclang_rt.scudo_standalone-aarch64.a']).stdout.trim();
  run('docker',[...container,'sha256sum',runtime]);
  run('docker',[...container,'clang-18','-std=c11','-O0','-g','-Wall','-Wextra','-Werror','/input/allocator_events.c','-o','/out/plain-events']);
  const plain=run('docker',[...container,'/out/plain-events']);
  if(!plain.stdout.includes('libc.so')||!plain.stdout.includes('\"scudoStatsSymbol\":false'))throw Error('Unexpected Linux allocator baseline');
  run('docker',[...container,'clang-18','-std=c11','-O0','-g','-Wall','-Wextra','-Werror','-fsanitize=scudo','/input/allocator_events.c','-o','/out/scudo-events']);
  const symbols=run('docker',[...container,'nm','/out/scudo-events']);
  symbols.stdout=symbols.stdout.split('\n').filter(line=>/\b(?:malloc|calloc|realloc|free|__scudo_print_stats)$/.test(line)).map(line=>line.replace(/^[a-f0-9]+\s+/i,'')).join('\n');
  if(!symbols.stdout.includes('__scudo_print_stats')||!/\b[TW]\s+malloc$/m.test(symbols.stdout))throw Error('Missing Scudo runtime symbol');
  const observed=run('docker',[...container,'/out/scudo-events']);
  const objects=observed.stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line));
  scudo=objects.find(o=>o.scudoStatsSymbol===true);mte=objects.find(o=>'mteAdvertised'in o);
  if(!objects.some(o=>o.mallocProvider==='/out/scudo-events')||!scudo||!observed.stderr.includes('Stats:')||!objects.some(o=>o.liveRequestedBytes===0))throw Error('Missing runtime/statistics/lifetime evidence');
  if(!mte)throw Error('Expected ARM64 Linux capability observation');
  passed=true;
}catch(e){error=e.message;process.exitCode=1;}
await writeFile(resolve(out,'record.json'),JSON.stringify({capturedAt:new Date().toISOString(),passed,error,sourceSha256:createHash('sha256').update(await readFile(resolve(root,'fixtures/expansion/allocator_events.c'))).digest('hex'),dockerfileSha256:createHash('sha256').update(await readFile(resolve(root,'config/scudo.Dockerfile'))).digest('hex'),steps,scudo,mte,limits:'Unprivileged local Linux container, network disabled during test, no devices, no added capabilities, 256 MiB memory, 64 PIDs.',interpretation:'Scudo binding and statistics are separate from MTE support. PR_GET_TAGGED_ADDR_CTRL is read-only; no tagging mode or page permissions changed. No reuse, invalid access, mitigation-strength or exploitability experiment.'},null,2)+'\n');
console.log(JSON.stringify({passed,error,scudo,mte}));
