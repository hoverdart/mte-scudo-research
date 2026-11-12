import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {taggedBlocks,layoutBlocks,mergeSeedRecords,validatePageBlocks} from '../dist/pdf-structure.mjs';
const w=new JSDOM('').window;globalThis.window=w;globalThis.document=w.document;
const {renderBlocks,renderMarkdown,renderPlainText}=await import('../dist/formatting.mjs');
const library=JSON.parse(await readFile(new URL('../dist/library.json',import.meta.url)));
const dom=html=>{const e=w.document.createElement('div');e.innerHTML=html;return e;};
test('all 73 source pages have formatted content with real headings, emphasis, lists and tables',()=>{
 for(const r of library.filter(r=>r.id.startsWith('source-'))){validatePageBlocks(r.pageBlocks,r.pages.length);assert.equal(r.pageBlocks.length,r.pages.length);for(const blocks of r.pageBlocks)assert.ok(blocks.length,`${r.title} has an empty page`);}
 const plan=library.find(r=>r.id==='source-plan');
 const first=dom(renderBlocks(plan.pageBlocks[0]));assert.equal(first.querySelector('h3').textContent,'The Refined Plan');assert.match(first.querySelector('strong').textContent,/one question/);assert.equal(first.querySelectorAll('table tr').length,8);assert.match(first.querySelector('table').textContent,/Oracle \/ success-checker/);
 const second=dom(renderBlocks(plan.pageBlocks[1]));assert.equal(second.querySelectorAll('ul').length,2);assert.equal(second.querySelectorAll('li').length,6);assert.match(second.textContent,/use-after-free/);assert.ok(second.querySelector('h4'));
 assert.ok(!first.textContent.includes('Page 1 of 4'),'PDF running footer is removed');
});
test('headings, bold, emphasis, lists, tables, links and code render as Markdown without arbitrary HTML',()=>{
 const html=renderMarkdown('# Heading\n\nA **bold** and *italic* paragraph.\n\n- First item\n- Second item\n\n| Term | Meaning |\n| --- | --- |\n| MTE | Tags |\n\n```c\nint x = 1;\n```\n\n[Docs](https://example.com)\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))');
 const content=dom(html);assert.equal(content.querySelector('h3').textContent,'Heading');assert.equal(content.querySelector('strong').textContent,'bold');assert.equal(content.querySelector('em').textContent,'italic');assert.equal(content.querySelectorAll('li').length,2);assert.ok(content.querySelector('.table-scroll table'));assert.ok(content.querySelector('pre code'));assert.equal(content.querySelector('script'),null);assert.equal(content.querySelector('a[href^="javascript:"]'),null);assert.equal(content.querySelector('a[href^="https:"]').rel,'noopener noreferrer');
});
test('search highlights only text while keeping source and Markdown structure intact',()=>{
 const content=dom(renderMarkdown('## MTE\n\n**MTE** uses tags. [Source](https://example.com/MTE)','MTE'));
 assert.equal(content.querySelectorAll('mark').length,2);assert.ok(content.querySelector('strong mark'));assert.equal(content.querySelector('a').href,'https://example.com/MTE');
});
test('plain fallback reflows PDF line breaks and indents into normal paragraphs',()=>{
 const content=dom(renderPlainText('   A paragraph with\n    wrapped text.\n\n   Another paragraph.'));
 assert.equal(content.querySelectorAll('p').length,2);assert.equal(content.querySelector('p').textContent,'A paragraph with wrapped text.');
});
test('old metadata edits and old backups inherit formatted seed pages without losing user edits',()=>{
 const seed=library.find(r=>r.id==='source-plan');const {pageBlocks,...old}=seed;
 const [merged]=mergeSeedRecords([seed],[{...old,title:'My title',date:'2026-10-21'}]);assert.equal(merged.title,'My title');assert.equal(merged.date,'2026-10-21');assert.equal(merged.pageBlocks,pageBlocks);
 assert.equal(mergeSeedRecords([seed],[{...old,fingerprint:'different'}])[0].pageBlocks,undefined);
});
test('structured text is escaped, and backups reject arbitrary tags and invalid shapes',()=>{
 const html=renderBlocks([{tag:'p',children:[{text:'<img src=x onerror=alert(1)>',bold:true}]}]);assert.ok(html.includes('&lt;img'));assert.equal(dom(html).querySelector('img'),null);
 assert.throws(()=>validatePageBlocks([[{tag:'script',children:[]}]],1));assert.throws(()=>validatePageBlocks([],1));
});
test('untagged PDF fallback detects larger headings and reflows positioned body lines',()=>{
 const item=(str,x,y,size)=>({str,width:str.length*size/2,height:size,transform:[size,0,0,size,x,y]});
 const blocks=layoutBlocks({items:[item('A heading',10,100,24),item('A body line',10,70,12),item('that continues.',10,54,12)]});
 const content=dom(renderBlocks(blocks));assert.ok(content.querySelector('h3'));assert.equal(content.querySelector('p').textContent,'A body line that continues.');
});
