import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const root = fileURLToPath(new URL('..', import.meta.url));
export const fixtures = {
  toy: { source: 'fixtures/toy_path.c', tests: [['',0],['41',1],['4121',1],['42',3],['4221',2],['4278',3],['43',3]] },
  flags: { source:'fixtures/benchmark/flags.c', tests:[['',0],['00',1],['8000',2],['8001',4],['0300',3],['0000',4]] },
  record: { source:'fixtures/benchmark/record.c', tests:[['',0],['00',1],['025800',2],['015801',3],['000001',4],['010000',4],['010001',5],['005801',4]] },
};
export const hash = x => createHash('sha256').update(x).digest('hex');
export function validateAnswer(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tests) || value.tests.length < 1 || value.tests.length > 16) throw Error('Expected 1..16 tests');
  for (const t of value.tests) if (!t || typeof t.hex !== 'string' || !/^(?:[a-fA-F0-9]{2}){0,8}$/.test(t.hex) || !Number.isInteger(t.expected) || t.expected < 0 || t.expected > 9) throw Error('Invalid bounded hex input or expected result');
  if (!Array.isArray(value.entry_points) || value.entry_points.some(x=>typeof x !== 'string') || typeof value.contract !== 'string' || typeof value.sanitizer_notes !== 'string') throw Error('Missing analysis fields');
  return value.tests;
}
export async function measure(name, tests, directory) {
  if (!fixtures[name]) throw Error('Unknown fixture');
  validateAnswer({tests, entry_points:[],contract:'',sanitizer_notes:''});
  await mkdir(directory,{recursive:true});
  const steps=[];
  const run=(command,args,extra={})=>{
    const r=spawnSync(command,args,{cwd:root,env:{...process.env,...extra},encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
    const s={command,args,status:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.message};steps.push(s);
    if(r.status!==0 || r.error || /ERROR: AddressSanitizer|runtime error:/.test(s.stderr)) throw Error(`Unexpected tool/sanitizer failure: ${command}`);
    return s.stdout;
  };
  let result;
  try {
    const source=resolve(root,fixtures[name].source);const driver=resolve(root,'fixtures/benchmark/driver.c');
    const flags=['-std=c11','-g','-O0','-Wall','-Wextra','-Werror','-fno-omit-frame-pointer'];
    const binary=resolve(directory,'sanitized');
    run('clang',['--version']);
    run('clang',[...flags,'-fsanitize=address,undefined','-fno-sanitize-recover=all',source,driver,'-o',binary]);
    const sanitizerSettings={ASAN_OPTIONS:'halt_on_error=1',UBSAN_OPTIONS:'halt_on_error=1:print_stacktrace=1'};
    const actual=JSON.parse(run(binary,tests.map(t=>t.hex),sanitizerSettings));
    const correct=tests.map((t,i)=>({hex:t.hex,expected:t.expected,actual:actual[i],correct:t.expected===actual[i]}));
    const covered=resolve(directory,'covered');const raw=resolve(directory,'run.profraw');const profile=resolve(directory,'run.profdata');
    run('clang',[...flags,'-fprofile-instr-generate','-fcoverage-mapping',source,driver,'-o',covered]);
    run(covered,tests.map(t=>t.hex),{LLVM_PROFILE_FILE:raw});
    const tool=name=>process.platform==='darwin'?run('xcrun',['--find',name]).trim():name;
    const profdata=tool('llvm-profdata');const cov=tool('llvm-cov');
    run(profdata,['--version']);run(cov,['--version']);
    run(profdata,['merge','-sparse',raw,'-o',profile]);
    const exported=run(cov,['export',covered,`-instr-profile=${profile}`,source]);
    await writeFile(resolve(directory,'coverage.json'),exported);
    const f=JSON.parse(exported).data.flatMap(d=>d.files).find(f=>f.filename===source);
    if(!f?.summary?.branches?.count) throw Error('No measured fixture branches');
    result={fixture:name,sourceSha256:hash(await readFile(source)),driverSha256:hash(await readFile(driver)),tests:correct,allPredictionsCorrect:correct.every(t=>t.correct),correctCount:correct.filter(t=>t.correct).length,testCount:correct.length,coverage:f.summary,fullBranchCoverage:f.summary.branches.covered===f.summary.branches.count,sanitizerSettings};
  } finally {await writeFile(resolve(directory,'steps.json'),JSON.stringify(steps,null,2)+'\n');}
  await writeFile(resolve(directory,'measurement.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
