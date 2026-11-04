#!/usr/bin/env node
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openSync, closeSync, existsSync } from 'node:fs';
import { summarizeCoverage } from './coverage-summary.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const source=resolve(root,'artifacts/upstream/dav1d');const out=resolve(root,'artifacts/expansion/coverage');const build=resolve(out,'build');
const steps=[];const hash=x=>createHash('sha256').update(x).digest('hex');
const run=(command,args,extra={})=>{
  const r=spawnSync(command,args,{cwd:root,env:{...process.env,PATH:`${resolve(root,'artifacts/upstream/tools/bin')}:${process.env.PATH}`,...extra},encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024});
  steps.push({command,args,status:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.message});
  if(r.status!==0||r.error||/ERROR: AddressSanitizer|runtime error:/.test(r.stderr||''))throw Error(`Failed ${command}; see coverage record`);return r.stdout.trim();
};
const exportCoverage=async(cov,binary,profile,path)=>{
  const args=['export',binary,`-instr-profile=${profile}`,'--skip-expansions'];
  const fd=openSync(path,'w');let r;
  try{r=spawnSync(cov,args,{cwd:root,encoding:'utf8',timeout:180000,stdio:['ignore',fd,'pipe'],maxBuffer:1024*1024});}finally{closeSync(fd);}
  const bytes=await readFile(path);steps.push({command:cov,args,status:r.status,signal:r.signal,stderr:r.stderr||'',stdoutArtifact:path,stdoutBytes:bytes.length,stdoutSha256:hash(bytes),error:r.error?.message});
  if(r.status!==0||r.error)throw Error('Coverage export failed');return JSON.parse(bytes);
};
await mkdir(out,{recursive:true});let passed=false,error;const results={};
try{
  const revision=run('git',['-C',source,'rev-parse','HEAD']);if(revision!=='e5af12796d46cd7788e5f5349da1a27c5f7a8f1a')throw Error('Wrong upstream revision');
  run('git',['rev-parse','HEAD']);run('git',['status','--porcelain']);run('clang',['--version']);
  const meson=resolve(root,'artifacts/upstream/tools/bin/meson');
  run(meson,['setup',...(existsSync(resolve(build,'meson-private/coredata.dat'))?['--reconfigure']:[]),build,source,'--wrap-mode=nodownload','--buildtype=debug','--default-library=static','-Denable_asm=false','-Denable_tests=false','-Denable_tools=true','-Denable_docs=false','-Dtestdata_tests=false','-Dc_args=-O0 -fprofile-instr-generate -fcoverage-mapping','-Dc_link_args=-fprofile-instr-generate']);
  run(meson,['compile','-C',build,'-j','2']);
  const tool=n=>process.platform==='darwin'?run('xcrun',['--find',n]):n;const profdata=tool('llvm-profdata'),cov=tool('llvm-cov');
  run(profdata,['--version']);run(cov,['--version']);
  const binary=resolve(build,'tools/dav1d');const media=JSON.parse(await readFile(resolve(root,'artifacts/upstream/media-results.json'),'utf8'));
  const textured=resolve(out,'texture.ivf');
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=96x64:rate=3','-frames:v','6','-pix_fmt','yuv420p','-c:v','libsvtav1','-preset','12','-crf','30','-svtav1-params','lp=1','-f','ivf',textured]);
  const sanitized=resolve(out,'textured-sanitized.yuv');
  run(resolve(root,'artifacts/upstream/build/tools/dav1d'),['--input',textured,'--output',sanitized,'--muxer','yuv','--threads','1','--framedelay','1'],{ASAN_OPTIONS:'halt_on_error=1',UBSAN_OPTIONS:'halt_on_error=1:print_stacktrace=1'});
  const texturedReference=hash(await readFile(sanitized));
  const groups={baseline:media.map(m=>({file:resolve(root,'artifacts/upstream',`${m.id}.ivf`),expected:m.outputSha256})),textured:[{file:textured,expected:texturedReference}]};
  for(const [name,inputs]of Object.entries(groups)){
    const dir=resolve(out,name);await mkdir(dir,{recursive:true});const profiles=[];const observations=[];
    for(let i=0;i<inputs.length;i++){
      const raw=resolve(dir,`${i}.profraw`);await rm(raw,{force:true});const output=resolve(dir,`${i}.yuv`);
      run(binary,['--input',inputs[i].file,'--output',output,'--muxer','yuv','--threads','1','--framedelay','1'],{LLVM_PROFILE_FILE:raw});
      const pixels=await readFile(output);const digest=hash(pixels);
      if(inputs[i].expected&&digest!==inputs[i].expected)throw Error('Coverage build differs from sanitizer baseline output');
      if(name==='textured'){
        if(pixels.length!==96*64*3/2*6)throw Error('Wrong textured output size');
        const second=resolve(dir,'repeat.yuv');run(binary,['--input',inputs[i].file,'--output',second,'--muxer','yuv','--threads','1','--framedelay','1'],{LLVM_PROFILE_FILE:resolve(dir,'repeat.profraw')});
        if(hash(await readFile(second))!==digest)throw Error('Nondeterministic textured decode');
      }
      profiles.push(raw);observations.push({inputSha256:hash(await readFile(inputs[i].file)),outputSha256:digest,outputBytes:pixels.length});
    }
    const merged=resolve(dir,'merged.profdata');run(profdata,['merge','-sparse',...profiles,'-o',merged]);
    const exported=await exportCoverage(cov,binary,merged,resolve(dir,'coverage.json'));
    const summary=summarizeCoverage(exported,resolve(source,'src'));results[name]={...summary,observations};
    await writeFile(resolve(dir,'summary.json'),JSON.stringify(results[name],null,2)+'\n');
  }
  const merged=resolve(out,'combined.profdata');run(profdata,['merge','-sparse',resolve(out,'baseline/merged.profdata'),resolve(out,'textured/merged.profdata'),'-o',merged]);
  const exported=await exportCoverage(cov,binary,merged,resolve(out,'combined-coverage.json'));results.combined=summarizeCoverage(exported,resolve(source,'src'));
  const seen=new Set(results.baseline.executedFunctions.map(f=>f.name));results.newlyExecutedFunctions=results.textured.executedFunctions.filter(f=>!seen.has(f.name));
  if(results.combined.totals.branches.covered<results.baseline.totals.branches.covered)throw Error('Coverage union lost baseline outcomes');passed=true;
}catch(e){error=e.message;process.exitCode=1;}
await writeFile(resolve(out,'record.json'),JSON.stringify({capturedAt:new Date().toISOString(),passed,error,results,steps,settings:'Separate O0 LLVM coverage build, static C library, no assembly; not a sanitizer or MTE result.'},null,2)+'\n');
console.log(JSON.stringify({passed,error,baseline:results.baseline?.totals,combined:results.combined?.totals,newFunctions:results.newlyExecutedFunctions?.length}));
