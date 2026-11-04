#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));const [library,filter='',option='']=process.argv.slice(2);
if(!['dav1d','skia'].includes(library))throw Error('Usage: query-paths.mjs dav1d|skia [literal-name-filter] [--uncovered]');
const record=JSON.parse(await readFile(resolve(root,library==='dav1d'?'artifacts/expansion/coverage/record.json':'artifacts/expansion/skia-coverage/record.json'),'utf8'));
const summary=library==='dav1d'?record.results.combined:record.summary;
const list=option==='--uncovered'?summary.unexecutedFunctions:summary.executedFunctions;
const found=list.filter(f=>(f.demangled||f.name).toLowerCase().includes(filter.toLowerCase()));
for(const f of found.slice(0,50))console.log(`${f.count}\t${f.demangled||f.name}\t${[...new Set(f.files)].join(',')}`);
console.log(`${found.length} matching function entries; showing at most 50. Execution counts do not establish call edges.`);
