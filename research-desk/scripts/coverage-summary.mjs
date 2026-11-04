import { relative, isAbsolute } from 'node:path';
export function summarizeCoverage(exported, sourceRoot) {
  const units=exported.data??[];
  const inside=path=>{const r=relative(sourceRoot,path);return r!==''&&!r.startsWith('..')&&!isAbsolute(r);};
  const files=units.flatMap(d=>d.files??[]).filter(f=>inside(f.filename)).map(f=>({file:relative(sourceRoot,f.filename),summary:f.summary}));
  const functions=units.flatMap(d=>d.functions??[]).filter(f=>(f.filenames??[]).some(inside)).map(f=>({name:f.name,count:f.count,files:f.filenames.filter(inside).map(p=>relative(sourceRoot,p))}));
  const totals={};for(const f of files)for(const key of ['branches','functions','lines','regions']){const t=totals[key]??={count:0,covered:0};t.count+=f.summary[key]?.count??0;t.covered+=f.summary[key]?.covered??0;}
  for(const t of Object.values(totals))t.percent=t.count?100*t.covered/t.count:0;
  return {totals,files,executedFunctions:functions.filter(f=>f.count>0),unexecutedFunctions:functions.filter(f=>!f.count),note:'LLVM emitted mappings only; function counts establish execution, not call edges, exhaustive paths or full-source completeness.'};
}
