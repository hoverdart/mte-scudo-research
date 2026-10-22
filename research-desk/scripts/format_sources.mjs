import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extractPdfDocument} from '../dist/imports.mjs';
import {validatePageBlocks} from '../dist/pdf-structure.mjs';
// These newer built-ins are used by the pinned PDF.js build; Node 24 needs shims.
if(!Uint8Array.prototype.toHex)Uint8Array.prototype.toHex=function(){return Buffer.from(this).toString('hex');};
if(!Math.sumPrecise)Math.sumPrecise=items=>[...items].reduce((a,b)=>a+b,0);
if(!Map.prototype.getOrInsertComputed)Map.prototype.getOrInsertComputed=function(k,cb){if(!this.has(k))this.set(k,cb(k));return this.get(k);};
// Text extraction does not perform matrix operations or render a canvas.
if(!globalThis.DOMMatrix)globalThis.DOMMatrix=class{};
const pdfjs=await import('../dist/vendor/pdf.mjs');
const libraryUrl=new URL('../dist/library.json',import.meta.url);
const records=JSON.parse(await fs.readFile(libraryUrl,'utf8'));
for(const record of records){
  if(!record.file)continue;
  const bytes=await fs.readFile(new URL('../dist/'+record.file,import.meta.url));
  const result=await extractPdfDocument(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),options=>pdfjs.getDocument(options));
  if(result.pages.length!==record.pages.length)throw new Error('Page count changed for '+record.title);
  validatePageBlocks(result.pageBlocks,record.pages.length);
  record.pageBlocks=result.pageBlocks;
  console.log(`${record.sourceName}: formatted ${result.pages.length} pages`);
}
const tmp=fileURLToPath(libraryUrl)+'.tmp';
await fs.writeFile(tmp,JSON.stringify(records,null,2)+'\n');
await fs.rename(tmp,libraryUrl);
