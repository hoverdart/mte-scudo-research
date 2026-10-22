import {marked,Renderer} from './vendor/marked.esm.js';
import createDOMPurify from './vendor/purify.es.mjs';
import {escapeHtml,highlight} from './core.mjs';
import {STRUCTURE_TAGS,plainTextBlocks} from './pdf-structure.mjs';
const headingTag=tag=>/^h[1-6]$/.test(tag)?'h'+Math.min(6,Number(tag[1])+2):tag;
export function renderBlocks(blocks,query=''){
  function render(n){
    if(typeof n.text==='string'){
      if(!n.text.trim())return escapeHtml(n.text);
      let text=highlight(n.text,query);
      if(n.code)text='<code>'+text+'</code>';
      if(n.italic)text='<em>'+text+'</em>';
      if(n.bold)text='<strong>'+text+'</strong>';
      return text;
    }
    if(!STRUCTURE_TAGS.has(n.tag))return '';
    const tag=headingTag(n.tag);
    const html=`<${tag}>${(n.children||[]).map(render).join('')}</${tag}>`;
    return tag==='table'?`<div class="table-scroll" role="region" tabindex="0" aria-label="Document table">${html}</div>`:html;
  }
  return (blocks||[]).map(render).join('');
}
export function renderPlainText(text,query=''){return renderBlocks(plainTextBlocks(text),query);}
let purifier;
export function renderMarkdown(text,query=''){
  purifier||=createDOMPurify(window);
  const renderer=new Renderer();
  renderer.html=token=>escapeHtml(token.text);
  renderer.image=token=>escapeHtml(token.text||'');
  const html=marked.parse(String(text||''),{renderer,gfm:true,breaks:false});
  const safe=purifier.sanitize(html,{ALLOWED_TAGS:[...STRUCTURE_TAGS,'a','br','hr','del','thead','tbody','tfoot','sup','sub','kbd','mark'],ALLOWED_ATTR:['href','title','start'],RETURN_DOM_FRAGMENT:true});
  for(const heading of [...safe.querySelectorAll('h1,h2,h3,h4,h5,h6')]){
    const replacement=document.createElement(headingTag(heading.tagName.toLowerCase()));
    replacement.append(...heading.childNodes);heading.replaceWith(replacement);
  }
  for(const link of safe.querySelectorAll('a')){
    const href=link.getAttribute('href')||'';
    if(!/^(https?:\/\/|mailto:|#)/i.test(href))link.removeAttribute('href');
    else if(/^https?:/i.test(href)){link.target='_blank';link.rel='noopener noreferrer';}
  }
  for(const table of [...safe.querySelectorAll('table')]){
    const wrap=document.createElement('div');wrap.className='table-scroll';wrap.setAttribute('role','region');wrap.tabIndex=0;wrap.setAttribute('aria-label','Document table');table.replaceWith(wrap);wrap.append(table);
  }
  for(const pre of safe.querySelectorAll('pre'))pre.tabIndex=0;
  if(query.trim()){
    const walker=document.createTreeWalker(safe,4);
    const texts=[];while(walker.nextNode())texts.push(walker.currentNode);
    for(const item of texts){const match=highlight(item.textContent,query);if(match.includes('<mark>')){const temp=document.createElement('template');temp.innerHTML=match;item.replaceWith(temp.content);}}
  }
  const wrapper=document.createElement('div');wrapper.append(safe);return wrapper.innerHTML;
}
