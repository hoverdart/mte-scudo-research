import {taggedBlocks,layoutBlocks} from './pdf-structure.mjs';
export async function extractPdfDocument(bytes,getDocument){
  const task=getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false,fontExtraProperties:true});
  try{
    const doc=await task.promise;
    const pages=[],pageBlocks=[];
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i);
      const content=await page.getTextContent({includeMarkedContent:true});
      pages.push(content.items.filter(t=>typeof t.str==='string').map(t=>t.str+(t.hasEOL?'\n':' ')).join(''));
      const fonts={};
      if(page.getOperatorList&&page.commonObjs){
        try{await page.getOperatorList();for(const name of Object.keys(content.styles||{})){if(page.commonObjs.has(name))fonts[name]=page.commonObjs.get(name)?.name||'';}}catch{/* Logical tags still retain structure if font metadata is unavailable. */}
      }
      const tree=page.getStructTree?await page.getStructTree():null;
      pageBlocks.push(taggedBlocks(tree,content,fonts)||layoutBlocks(content,fonts));
      page.cleanup?.();
    }
    return {pages,pageBlocks};
  }finally{await task.destroy();}
}
// Retain the plain-text helper for callers that only need search text.
export async function extractPdf(bytes,getDocument){return (await extractPdfDocument(bytes,getDocument)).pages;}
