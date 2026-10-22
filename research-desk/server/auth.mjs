import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const SESSION_SECONDS=24*60*60;
export function authReady(env=process.env){return typeof env.VERCEL_PASS==='string'&&env.VERCEL_PASS.length>0;}
function equal(a,b){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function correctPassword(password,env=process.env){
  if(!authReady(env)||typeof password!=='string'||password.length>4096)return false;
  return timingSafeEqual(createHash('sha256').update(password).digest(),createHash('sha256').update(env.VERCEL_PASS).digest());
}
function signature(payload,env){return createHmac('sha256',env.VERCEL_PASS).update('research-desk/session/v1\0'+payload).digest('base64url');}
export function issueSession(env=process.env,now=Math.floor(Date.now()/1000)){
  if(!authReady(env))throw new Error('Password is not configured.');
  const payload=Buffer.from(JSON.stringify({v:1,iat:now,exp:now+SESSION_SECONDS,nonce:randomBytes(18).toString('base64url')})).toString('base64url');
  return payload+'.'+signature(payload,env);
}
export function validSession(token,env=process.env,now=Math.floor(Date.now()/1000)){
  if(!authReady(env)||typeof token!=='string'||token.length>2048)return false;
  const [payload,mac,extra]=token.split('.');
  if(!payload||!mac||extra||!equal(mac,signature(payload,env)))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.v===1&&Number.isInteger(data.iat)&&Number.isInteger(data.exp)&&data.iat<=now&&data.exp-data.iat===SESSION_SECONDS&&data.exp>now;}catch{return false;}
}
export function cookies(request){
  const result={};for(const part of (request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>=0)result[part.slice(0,i).trim()]=part.slice(i+1).trim();}return result;
}
export function sessionCookieName(request){return new URL(request.url).protocol==='https:'?'__Host-research-session':'research-session';}
function csrfCookieName(request){return new URL(request.url).protocol==='https:'?'__Host-research-csrf':'research-csrf';}
function cookie(request,name,value,maxAge){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export function allowedSession(request,env=process.env){return validSession(cookies(request)[sessionCookieName(request)],env);}
function sameOrigin(request){return request.headers.get('origin')===new URL(request.url).origin;}
function redirect(path,request,headers={}){return new Response(null,{status:303,headers:{...headers,Location:new URL(path,request.url).href,'Cache-Control':'no-store'}});}
function returnPath(value,request){try{const target=new URL(value||'/',request.url);return target.origin===new URL(request.url).origin?target.pathname+target.search+target.hash:'/';}catch{return '/';}}
export async function handleAuth(request,action,env=process.env){
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  if(action==='config')return Response.json({configured:authReady(env)},{headers});
  if(action==='session')return Response.json({authenticated:allowedSession(request,env)},{headers});
  if(!authReady(env))return Response.json({error:'The site password has not been configured yet.'},{status:503,headers});
  if(action==='csrf'&&request.method==='GET'){
    const csrfToken=randomBytes(32).toString('base64url');
    return Response.json({csrfToken},{headers:{...headers,'Set-Cookie':cookie(request,csrfCookieName(request),csrfToken,15*60)}});
  }
  if(!['login','logout'].includes(action))return new Response('Not found',{status:404,headers});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'POST'}});
  if(!sameOrigin(request))return new Response('Request origin does not match this site.',{status:403,headers});
  const body=await request.text();if(body.length>8192)return new Response('Request too large',{status:413,headers});
  const fields=new URLSearchParams(body),submitted=fields.get('csrfToken'),expected=cookies(request)[csrfCookieName(request)];
  if(!submitted||!expected||!equal(submitted,expected))return new Response('Reload the sign-in page and try again.',{status:403,headers});
  if(action==='logout')return redirect('/login.html',request,{'Set-Cookie':cookie(request,sessionCookieName(request),'',0)});
  if(!correctPassword(fields.get('password'),env))return redirect('/login.html?error=incorrect',request);
  return redirect(returnPath(fields.get('callbackUrl'),request),request,{'Set-Cookie':cookie(request,sessionCookieName(request),issueSession(env),SESSION_SECONDS)});
}
