import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRecord,matches,TOPICS,markdownBrief} from '../dist/core.mjs';
const library=JSON.parse(await readFile(new URL('../dist/library.json',import.meta.url),'utf8'));
test('hub contains attributed notes and preserves original sources and annotations',()=>{
 const hub=library.filter(r=>r.id==='hub-overview'||r.id.startsWith('crustify-'));
 assert.equal(hub.length,6);hub.forEach(validateRecord);
 assert.equal(library.filter(r=>r.id.startsWith('source-')).length,8);
 assert.equal(library.filter(r=>r.id.startsWith('source-')).reduce((n,r)=>n+r.pages.length,0),73);

 const meeting=hub.find(r=>r.id==='crustify-meeting-avenues');
 assert.equal(meeting.date,'');assert.match(meeting.dateBasis,/unconfirmed/);
 assert.match(meeting.body,/Original meeting notes/);assert.match(meeting.body,/Technical clarifications/);
 assert.ok(matches(meeting,{query:'forbid unsafe',topic:'Crustify'}));
 for(const topic of ['Crustify','Unsafe Rust','FFI','Formal verification','Static analysis'])assert.ok(TOPICS.includes(topic));
 const guide=hub.find(r=>r.id==='crustify-beginner-guide');assert.equal(guide.pages.length,15);assert.equal(guide.file,'sources/marius-research-guide.pdf');
 assert.match(markdownBrief(hub),/^# Marius Research Hub/);
});
test('overview links point to existing entries and all curated notes have Markdown sources',async()=>{
 const overview=library.find(r=>r.id==='hub-overview');
 for(const [,id] of overview.body.matchAll(/#entry=([a-z0-9-]+)/g))assert.ok(library.some(r=>r.id===id));
 for(const note of library.filter(r=>(r.markdownSource||r.sourceName)?.startsWith('docs/crustify/'))){
  const source=await readFile(new URL('../'+(note.markdownSource||note.sourceName),import.meta.url),'utf8');
  assert.equal(source.replace(/^# [^\n]+\n\n/,''),note.body);
 }
});
