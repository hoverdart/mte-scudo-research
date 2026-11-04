#!/usr/bin/env node
// Pinned local-only native CPU raster/PNG study; preparation is a separate step.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const source=resolve(root,'artifacts/upstream/skia');const out=resolve(root,'artifacts/skia');const build=resolve(source,'out/Research');
const pinned='aaa39bfcd3934d396e3480fd2d8ab9d311ea3973';
const dependencyPins={libpng:'d5515b5b8be3901aac04e5bd8bd5c89f287bcd33',zlib:'646b7f569718921d7d4b5b8e22572ff6c76f2596'};
const hash=data=>createHash('sha256').update(data).digest('hex');
const settings={ASAN_OPTIONS:'halt_on_error=1',UBSAN_OPTIONS:'halt_on_error=1:print_stacktrace=1'};
const steps=[];const inputHashes={};let passed=false;let error;let results;
await mkdir(out,{recursive:true});await mkdir(build,{recursive:true});
const run=(command,args,cwd=root,timeout=30000)=>{
  console.log(`skia step: ${command.split('/').at(-1)} ${args[0]??''}`);
  const r=spawnSync(command,args,{cwd,env:{...process.env,...settings},encoding:'utf8',timeout,maxBuffer:16*1024*1024});
  const entry={command,args,cwd,status:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.message};steps.push(entry);
  if(r.status!==0||r.error||/ERROR: AddressSanitizer|runtime error:/.test(entry.stderr))throw Error(`Unexpected failure: ${command}; inspect artifacts/skia/record.json`);
  return entry.stdout.trim();
};
try {
  if(process.platform!=='darwin')throw Error('This reviewed native configuration requires macOS; review linker flags before porting');
  run('git',['rev-parse','HEAD']);run('git',['status','--porcelain']);
  if(run('git',['rev-parse','HEAD'],source)!==pinned||run('git',['status','--porcelain'],source))throw Error('Expected clean pinned Skia source');
  for(const [name,pin]of Object.entries(dependencyPins)) {
    const dir=resolve(source,'third_party/externals',name);
    if(run('git',['rev-parse','HEAD'],dir)!==pin||run('git',['status','--porcelain'],dir))throw Error('Expected clean pinned dependency');
  }
  const config=await readFile(resolve(root,'config/skia-research.gn'));
  inputHashes['config/skia-research.gn']=hash(config);
  inputHashes['fixtures/skia_smoke.cpp']=hash(await readFile(resolve(root,'fixtures/skia_smoke.cpp')));
  inputHashes['tools/xsan.supp']=hash(await readFile(resolve(source,'tools/xsan.supp')));
  inputHashes['gnExecutable']=hash(await readFile(resolve(source,'bin/gn')));
  await writeFile(resolve(build,'args.gn'),config);
  run('clang++',['--version']);run(resolve(source,'bin/gn'),['--version']);
  run(resolve(source,'bin/gn'),['gen','out/Research'],source);
  const ninja=resolve(root,'artifacts/upstream/tools/bin/ninja');run(ninja,['--version']);
  run(ninja,['-C',build,'-j','2','skia'],root,300000);
  const commands=run(ninja,['-C',build,'-t','commands','skia']);
  await writeFile(resolve(out,'compile-commands.txt'),commands+'\n');
  const compilations=commands.split('\n').filter(line=>line.includes(' -c '));
  if(!compilations.length||compilations.some(line=>!line.includes('-fsanitize=address,undefined')))throw Error('Missing sanitizer flags in native library compile commands');
  const binary=resolve(out,'skia-smoke');
  run('clang++',['-std=c++20','-g','-O0','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-fno-sanitize-recover=all','-DSK_DEBUG','-I',source,'fixtures/skia_smoke.cpp',resolve(build,'libskia.a'),'-framework','ApplicationServices','-framework','CoreFoundation','-framework','CoreGraphics','-framework','CoreText','-framework','ImageIO','-framework','Foundation','-o',binary]);
  const first=run(binary,[out]);results=first.split('\n').map(line=>JSON.parse(line));
  if(results.length!==3||results.some(r=>!r.roundTrip||r.pixelsVerified!==r.width*r.height))throw Error('Incomplete raster test output');
  const firstHashes={};for(const file of (await readdir(out)).filter(f=>/^raster-\d+x\d+\.png$/.test(f)))firstHashes[file]=hash(await readFile(resolve(out,file)));
  const second=run(binary,[out]);if(first!==second)throw Error('Nondeterministic raster results');
  for(const [file,digest]of Object.entries(firstHashes)){if(hash(await readFile(resolve(out,file)))!==digest)throw Error('Nondeterministic PNG encoding');inputHashes[file]=digest;}
  passed=true;
}catch(e){error=e.message;process.exitCode=1;}
await writeFile(resolve(out,'record.json'),JSON.stringify({capturedAt:new Date().toISOString(),passed,error,pinned,upstream:'https://skia.googlesource.com/skia',dependencyPins,inputAndSourceHashes:inputHashes,sanitizerSettings:settings,results,repeats:2,limits:{jobs:2,buildTimeoutMs:300000,otherStepTimeoutMs:30000},steps,limitations:'CPU-only reduced build. GN includes upstream sanitizer suppression file. Fonts, GPU backends, PartitionAlloc and unrelated codecs disabled. Ordinary generated PNG only. No library-wide coverage, CVE reproduction, MTE or Scudo claims.'},null,2)+'\n');
await writeFile(resolve(out,'run.log'),steps.map(s=>`${s.command} ${s.args.join(' ')}\nexit=${s.status} signal=${s.signal}\n${s.stdout}${s.stderr}`).join('\n'));
console.log(`skia: ${passed?'PASS':'FAIL'}; artifacts/skia/record.json`);
