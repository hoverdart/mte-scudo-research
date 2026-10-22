import {readFile} from 'node:fs/promises';
import {allowedSession,authReady,handleAuth} from './auth.mjs';
let libraryPromise;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
function library(){return libraryPromise||=readFile(new URL('../dist/library.json',import.meta.url),'utf8').then(JSON.parse);}
export async function handleRequest(request,env=process.env){
  const url=new URL(request.url);
  const pathname=url.pathname;
  const passwordAction=pathname.startsWith('/api/password/')?pathname.slice('/api/password/'.length):url.searchParams.get('passwordAction');
  if(passwordAction)return handleAuth(request,passwordAction,env);
  if(pathname==='/api/config'||url.searchParams.get('action')==='config'){
    return Response.json({configured:authReady(env)},{headers:{'Cache-Control':'no-store'}});
  }
  let resource=url.searchParams.get('resource');
  if(!resource&&(pathname==='/library.json'||pathname.startsWith('/sources/')))resource=pathname.slice(1);
  if(!resource)return new Response('Not found',{status:404,headers});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  const session=await allowedSession(request,env);
  if(!session)return Response.json({error:'Enter the site password to open the library.'},{status:401,headers});
  if(resource!=='library.json'&&!/^sources\/[a-z0-9-]+\.pdf$/.test(resource))return new Response('Not found',{status:404,headers});
  const entries=await library();
  if(resource!=='library.json'&&!entries.some(r=>r.file===resource))return new Response('Not found',{status:404,headers});
  const bytes=await readFile(new URL('../dist/'+resource,import.meta.url));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':resource==='library.json'?'application/json; charset=utf-8':'application/pdf','Content-Length':String(bytes.byteLength)}});
}
