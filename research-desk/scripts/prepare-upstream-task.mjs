#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));const out=resolve(root,'artifacts/expansion/upstream-model');const source=resolve(root,'artifacts/upstream/dav1d');const build=resolve(root,'artifacts/upstream/build');
await mkdir(out,{recursive:true});const steps=[];const hash=x=>createHash('sha256').update(x).digest('hex');
const run=(command,args)=>{const r=spawnSync(command,args,{cwd:root,env:{...process.env,ASAN_OPTIONS:'halt_on_error=1',UBSAN_OPTIONS:'halt_on_error=1:print_stacktrace=1'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});steps.push({command,args,status:r.status,signal:r.signal,stdout:r.stdout||'',stderr:r.stderr||''});if(r.status!==0||r.error)throw Error('Upstream task preparation failed');return r.stdout.trim();};
const pinned=run('git',['-C',source,'rev-parse','HEAD']);if(pinned!=='e5af12796d46cd7788e5f5349da1a27c5f7a8f1a')throw Error('Wrong source revision');
const binary=resolve(out,'data-lifetime');run('clang',['-std=c11','-g','-O0','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-fno-sanitize-recover=all','-I',resolve(source,'include'),'-I',resolve(build,'include'),'fixtures/expansion/data_lifetime.c','-L',resolve(build,'src'),'-ldav1d',`-Wl,-rpath,${resolve(build,'src')}`,'-o',binary]);
const actual=JSON.parse(run(binary,[]));
const expected={owned:[],wrapped:['payload'],metadata:['metadata'],both:['payload','metadata']};
for(const [name,events]of Object.entries(expected)){const r=actual[name];if(JSON.stringify(r.after_setup)!=='[]'||JSON.stringify(r.after_unref)!==JSON.stringify(events)||JSON.stringify(r.after_second_unref)!==JSON.stringify(events)||r.size!==0||r.timestamp!=='INT64_MIN'||r.offset!==-1)throw Error('Upstream lifetime oracle mismatch');}
const data=await readFile(resolve(source,'src/data.c'),'utf8');const ref=await readFile(resolve(source,'src/ref.c'),'utf8');const refh=await readFile(resolve(source,'src/ref.h'),'utf8');
// Whole function excerpts retain the exact pinned text; no rewrite of library logic.
const functionText=(s,start)=>{const a=s.indexOf(start);if(a<0)throw Error('Missing function');const b=s.indexOf('{',a);let depth=1,i=b+1;for(;i<s.length&&depth;i++){if(s[i]==='{')depth++;if(s[i]==='}')depth--;}if(depth)throw Error('Unbalanced function');return s.slice(a,i);};
const names=['uint8_t *dav1d_data_create_internal','int dav1d_data_wrap_internal','int dav1d_data_wrap_user_data_internal','void dav1d_data_props_set_defaults','void dav1d_data_unref_internal'];
const snippet=names.map(n=>functionText(data,n)).concat([functionText(refh,'static inline Dav1dRef *dav1d_ref_init'),functionText(ref,'void dav1d_ref_dec')]).join('\n\n');
const driver=await readFile(resolve(root,'fixtures/expansion/data_lifetime.c'),'utf8');
const prompt=`Defensive cybersecurity research, valid local API lifetimes only. Predict the JSON printed by the supplied trusted driver. Public dav1d_data_* calls delegate to the same-name *_internal implementations below; assume every allocation succeeds. Only log_event callbacks count as events; the internal owned-buffer default callback is not log_event. No corruption, dangling-pointer access, reclaim, bypasses or escalation. Return only the driver's JSON object with exactly the same fields, no Markdown or explanation. Use the exact pinned implementations to determine callback order, idempotent cleanup, size and metadata defaults. Do not supply code.\n\nUPSTREAM (${pinned}):\n${snippet}\n\nTRUSTED DRIVER:\n${driver}`;
await writeFile(resolve(out,'task.json'),JSON.stringify({pinned,prompt,promptSha256:hash(prompt),driverSha256:hash(driver),upstreamSnippetSha256:hash(snippet),expected:actual,steps},null,2)+'\n');
console.log('Prepared upstream lifetime task; four scenarios validated under ASan/UBSan.');
