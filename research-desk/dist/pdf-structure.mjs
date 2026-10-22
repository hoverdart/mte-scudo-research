// PDF logical structure is preferred over guesses from physical line positions.
export const STRUCTURE_TAGS = new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','tr','th','td','blockquote','pre','code','strong','em','span']);
const textOf = nodes => nodes.map(n=>typeof n.text==='string'?n.text:textOf(n.children||[])).join('');
const node = (tag,children) => ({tag,children});
function fontStyle(name='') {
  return {bold:/bold|semibold|demi|black|heavy/i.test(name),italic:/italic|oblique/i.test(name),code:/mono|courier|consolas|menlo/i.test(name)};
}
function textRun(item, fonts) {
  const style=fontStyle(fonts[item.fontName] || '');
  let text=item.str.replace(/[\t\u00a0 ]+/g,' ');
  if(item.hasEOL && text && !/\s$/.test(text) && !/[\p{L}\p{N}]-$/u.test(text))text+=' ';
  return {text,...(style.bold?{bold:true}:{}),...(style.italic?{italic:true}:{}),...(style.code?{code:true}:{})};
}
export function taggedBlocks(tree,content,fonts={}) {
  if(!tree)return null;
  const marked=new Map(),stack=[];
  for(const item of content.items){
    if(item.type==='beginMarkedContent'||item.type==='beginMarkedContentProps')stack.push(item.id||null);
    else if(item.type==='endMarkedContent')stack.pop();
    else if(typeof item.str==='string'){
      const id=stack.findLast(x=>x);
      if(id){if(!marked.has(id))marked.set(id,[]);marked.get(id).push(textRun(item,fonts));}
    }
  }
  if(!marked.size)return null;
  const referenced=new Set();
  function render(n){
    if(n.type==='content'){referenced.add(n.id);return marked.get(n.id)||[];}
    const children=(n.children||[]).flatMap(render);
    const text=textOf(children).trim();
    if(n.role==='Lbl')return []; // Native list markers replace the PDF's printed markers.
    const keepEmptyCell=n.role==='TD'||n.role==='TH';
    if(!text&&!keepEmptyCell)return [];
    if(/^H[1-6]$/.test(n.role))return [node(n.role.toLowerCase(),children)];
    const tags={P:'p',LI:'li',Table:'table',TR:'tr',TH:'th',TD:'td',BlockQuote:'blockquote',Code:'code',Strong:'strong',Em:'em'};
    if(n.role==='L'){
      const label=n.children?.find(c=>c.role==='LI')?.children?.find(c=>c.role==='Lbl');
      function labelText(x){return x?.type==='content'?textOf(marked.get(x.id)||[]):(x?.children||[]).map(labelText).join('');}
      return [node(/^\s*\d+[.)]/.test(labelText(label))?'ol':'ul',children)];
    }
    return tags[n.role]?[node(tags[n.role],children)]:children;
  }
  const blocks=render(tree);
  // Avoid dropping untagged content in partially tagged documents.
  const total=[...marked.values()].reduce((sum,r)=>sum+textOf(r).trim().length,0);
  const covered=[...referenced].reduce((sum,id)=>sum+textOf(marked.get(id)||[]).trim().length,0);
  return total&&covered/total>=.98&&blocks.length?blocks:null;
}
export function layoutBlocks(content,fonts={}) {
  const items=content.items.filter(i=>typeof i.str==='string'&&i.str.trim());
  if(!items.length)return [];
  const sizes=new Map();
  for(const i of items){const size=Math.round(Math.abs(i.height||i.transform?.[3]||12));sizes.set(size,(sizes.get(size)||0)+i.str.length);}
  const bodySize=[...sizes].sort((a,b)=>b[1]-a[1])[0][0];
  const lines=[];
  for(const item of items){
    const y=item.transform?.[5];
    if(y===undefined)return plainTextBlocks(items.map(i=>i.str+(i.hasEOL?'\n':' ')).join(''));
    let line=lines.find(l=>Math.abs(l.y-y)<Math.max(2,(item.height||bodySize)*.2));
    if(!line){line={y,items:[],size:item.height||bodySize};lines.push(line);}
    line.items.push(item);line.size=Math.max(line.size,item.height||bodySize);
  }
  lines.sort((a,b)=>b.y-a.y);
  const blocks=[];let current=null,previous=null;
  for(const line of lines){
    line.items.sort((a,b)=>a.transform[4]-b.transform[4]);
    const runs=[];
    let right=-Infinity;
    for(const item of line.items){if(runs.length&&item.transform[4]-right>bodySize*.15&&!/\s$/.test(runs.at(-1).text))runs.push({text:' '});runs.push(textRun({...item,hasEOL:false},fonts));right=item.transform[4]+item.width;}
    const text=textOf(runs).trim();
    if(!text)continue;
    const heading=line.size>bodySize*1.22;
    const list=/^\s*(?:[•●▪◦]|[-*] |\d+[.)] )/.test(text);
    if(heading){current=null;blocks.push(node(line.size>bodySize*1.7?'h1':'h2',runs));}
    else if(list){current=null;const ordered=/^\s*\d/.test(text);const tag=ordered?'ol':'ul';const clean=runs.map(r=>({...r}));clean[0].text=clean[0].text.replace(/^\s*(?:[•●▪◦]|[-*]|\d+[.)])\s*/,'');let container=blocks.at(-1);if(container?.tag!==tag){container=node(tag,[]);blocks.push(container);}container.children.push(node('li',clean));}
    else{
      const gap=previous?Math.abs(previous.y-line.y):Infinity;
      if(!current||gap>bodySize*1.8){current=node('p',[]);blocks.push(current);}
      if(current.children.length&&!/[\p{L}\p{N}]-$/u.test(textOf(current.children)))current.children.push({text:' '});
      current.children.push(...runs);
    }
    previous=line;
  }
  return blocks;
}
export function plainTextBlocks(text){
  return String(text||'').split(/\n\s*\n/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean).map(p=>node('p',[{text:p}]));
}
export function validatePageBlocks(pages,expectedPages){
  if(!Array.isArray(pages)||pages.length!==expectedPages)throw new Error('Invalid formatted document pages.');
  let count=0;
  function check(n,depth){
    if(++count>150000||depth>60||!n||typeof n!=='object')throw new Error('Invalid document structure.');
    if(typeof n.text==='string'){
      if(n.text.length>2000000)throw new Error('Document text is too large.');
      for(const key of ['bold','italic','code'])if(n[key]!==undefined&&typeof n[key]!=='boolean')throw new Error('Invalid text style.');
    }else{
      if(!STRUCTURE_TAGS.has(n.tag)||!Array.isArray(n.children))throw new Error('Invalid document element.');
      n.children.forEach(c=>check(c,depth+1));
    }
  }
  for(const page of pages){if(!Array.isArray(page))throw new Error('Invalid formatted page.');page.forEach(n=>check(n,0));}
}
export function mergeSeedRecords(base,local){
  const byId=new Map(base.map(r=>[r.id,r]));
  for(const record of local){
    const seed=byId.get(record.id);
    byId.set(record.id,seed?.fingerprint&&seed.fingerprint===record.fingerprint&&!record.pageBlocks?{...record,pageBlocks:seed.pageBlocks}:record);
  }
  return [...byId.values()];
}
