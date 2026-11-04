#!/usr/bin/env node
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { summarizeCoverage } from './coverage-summary.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));const source=resolve(root,'artifacts/upstream/skia');const out=resolve(root,'artifacts/expansion/skia-coverage');const build=resolve(source,'out/ResearchCoverage');
await mkdir(out,{recursive:true});await mkdir(build,{recursive:true});const steps=[];let passed=false,error,summary;
const hash=x=>createHash('sha256').update(x).digest('hex');
const run=(command,args,cwd=root,input)=>{console.log(`skia coverage step: ${command.split('/').at(-1)} ${args[0]??''}`);const r=spawnSync(command,args,{cwd,input,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});steps.push({command,args,status:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.message});if(r.status!==0||r.error)throw Error('Skia coverage step failed');return r.stdout.trim();};
try{
 if(run('git',['-C',source,'rev-parse','HEAD'])!=='aaa39bfcd3934d396e3480fd2d8ab9d311ea3973')throw Error('Wrong Skia revision');
 run('git',['rev-parse','HEAD']);run('git',['status','--porcelain']);run('clang++',['--version']);
 const config=(await readFile(resolve(root,'config/skia-research.gn'),'utf8')).replace('sanitize = "address,undefined"','sanitize = ""')+'\nextra_cflags = ["-O0", "-fprofile-instr-generate", "-fcoverage-mapping"]\nextra_ldflags = ["-fprofile-instr-generate"]\n';
 await writeFile(resolve(build,'args.gn'),config);await writeFile(resolve(out,'args.gn'),config);
 run(resolve(source,'bin/gn'),['gen','out/ResearchCoverage'],source);
 run(resolve(root,'artifacts/upstream/tools/bin/ninja'),['-C',build,'-j','2','skia']);
 const binary=resolve(out,'raster-covered');
 run('clang++',['-std=c++20','-g','-O0','-DSK_DEBUG','-fprofile-instr-generate','-fcoverage-mapping','-I',source,'fixtures/skia_smoke.cpp',resolve(build,'libskia.a'),'-framework','ApplicationServices','-framework','CoreFoundation','-framework','CoreGraphics','-framework','CoreText','-framework','ImageIO','-framework','Foundation','-o',binary]);
 const raw=resolve(out,'run.profraw');await rm(raw,{force:true});
 const execution=spawnSync(binary,[out],{cwd:root,env:{...process.env,LLVM_PROFILE_FILE:raw},encoding:'utf8',timeout:30000});steps.push({command:binary,args:[out],status:execution.status,signal:execution.signal,stdout:execution.stdout,stderr:execution.stderr});if(execution.status!==0||execution.error)throw Error('Raster assertions failed');
 const reference=JSON.parse(await readFile(resolve(root,'artifacts/skia/record.json'),'utf8'));
 for(const file of Object.keys(reference.inputAndSourceHashes).filter(n=>n.endsWith('.png')))if(hash(await readFile(resolve(out,file)))!==reference.inputAndSourceHashes[file])throw Error('Coverage PNG differs from sanitizer output');
 const tool=n=>run('xcrun',['--find',n]);const profdata=tool('llvm-profdata'),cov=tool('llvm-cov');const profile=resolve(out,'run.profdata');run(profdata,['merge','-sparse',raw,'-o',profile]);
 const path=resolve(out,'coverage.json');const fd=openSync(path,'w');let r;const args=['export',binary,`-instr-profile=${profile}`,'--skip-expansions'];
 try{r=spawnSync(cov,args,{cwd:root,encoding:'utf8',timeout:120000,stdio:['ignore',fd,'pipe'],maxBuffer:1024*1024});}finally{closeSync(fd);}
 steps.push({command:cov,args,status:r.status,signal:r.signal,stderr:r.stderr,stdoutArtifact:path});if(r.status!==0||r.error)throw Error('Coverage export failed');
 summary=summarizeCoverage(JSON.parse(await readFile(path,'utf8')),resolve(source,'src'));
 const functions=[...summary.executedFunctions,...summary.unexecutedFunctions];
 const names=run('c++filt',[],root,functions.map(f=>f.name).join('\n')+'\n').split('\n');for(let i=0;i<functions.length;i++)functions[i].demangled=names[i];
 if(!summary.totals.branches?.covered||!summary.executedFunctions.length)throw Error('Empty source coverage');passed=true;
}catch(e){error=e.message;process.exitCode=1;}
await writeFile(resolve(out,'record.json'),JSON.stringify({capturedAt:new Date().toISOString(),passed,error,summary,steps,limitations:'Mapped linked Skia src files only; excludes third-party codec internals and unlinked/unbuilt code. Separate LLVM build; validated against existing sanitizer PNG hashes. Function counts are not call edges.'},null,2)+'\n');
console.log(JSON.stringify({passed,error,totals:summary?.totals}));
