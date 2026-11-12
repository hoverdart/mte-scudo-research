import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {validateRecord} from '../dist/core.mjs';
const libraryUrl=new URL('../dist/library.json',import.meta.url);
const existing=JSON.parse(await readFile(libraryUrl,'utf8'));
const metadata=JSON.parse(await readFile(new URL('../docs/crustify/notes.json',import.meta.url),'utf8'));
const hubNotes=await Promise.all(metadata.map(async note=>{
 const markdown=await readFile(new URL('../'+(note.markdownSource||note.sourceName),import.meta.url),'utf8');
 // The native entry title supplies the first heading, so do not render it twice.
 const body=markdown.replace(/^# [^\n]+\n\n/,'');
 const old=existing.find(item=>item.id===note.id);
 const pageBlocks=old?.fingerprint===note.fingerprint?old?.pageBlocks:undefined;
 return validateRecord({...note,body,...(pageBlocks?{pageBlocks}:{})});
}));
const ids=new Set(hubNotes.map(note=>note.id));
if(ids.size!==hubNotes.length)throw new Error('Duplicate hub IDs');
// Keep the guide behind the existing authenticated PDF route.
await copyFile(new URL('../docs/crustify/Marius_Research_Guide.pdf',import.meta.url),new URL('../dist/sources/marius-research-guide.pdf',import.meta.url));
const library=existing.filter(note=>!ids.has(note.id)).concat(hubNotes);
await writeFile(libraryUrl,JSON.stringify(library,null,2)+'\n');
console.log(`Updated ${hubNotes.length} hub notes; preserved ${existing.filter(note=>!ids.has(note.id)).length} other entries.`);
