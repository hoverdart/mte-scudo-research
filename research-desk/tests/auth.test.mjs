import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {allowedSession,correctPassword,issueSession,validSession,SESSION_SECONDS} from '../server/auth.mjs';
import {handleRequest} from '../server/main.mjs';
import {buildVercel} from '../scripts/build-vercel.mjs';
const origin='https://research.example';
const env={VERCEL_PASS:'a test-only site password'};
function request(path,options={}){return new Request(origin+path,options);}
function authenticatedRequest(path,options={}){return request(path,{...options,headers:{cookie:'__Host-research-session='+issueSession(env),...options.headers}});}
async function login(password=env.VERCEL_PASS){
 const csrf=await handleRequest(request('/api/password/csrf'),env);
 const {csrfToken}=await csrf.json();const csrfCookie=csrf.headers.get('set-cookie').split(';')[0];
 return handleRequest(request('/api/password/login',{method:'POST',headers:{origin,cookie:csrfCookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password,csrfToken,callbackUrl:'/'}).toString()}),env);
}
test('password comes only from VERCEL_PASS and has no default',()=>{
 assert.equal(correctPassword(env.VERCEL_PASS,env),true);assert.equal(correctPassword('wrong',env),false);assert.equal(correctPassword('',{}),false);
});
test('session expires exactly 24 hours after login and does not slide on reads',()=>{
 const time=1000000,token=issueSession(env,time);assert.equal(SESSION_SECONDS,86400);assert.equal(validSession(token,env,time),true);assert.equal(validSession(token,env,time+86399),true);assert.equal(validSession(token,env,time+86400),false);
 assert.equal(validSession(token,{VERCEL_PASS:'changed'},time),false);assert.equal(validSession(token+'x',env,time),false);assert.equal(validSession('forged',env,time),false);
});
test('library, PDFs and direct function requests require a password session even before setup',async()=>{
 for(const path of ['/library.json','/sources/plan.pdf','/api/index?resource=library.json','/api/index?resource=sources/plan.pdf']){
  for(const settings of [env,{}]){const response=await handleRequest(request(path),settings);assert.equal(response.status,401);assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!(await response.text()).includes('The Refined Plan'));}
 }
 assert.equal((await handleRequest(request('/api/password/csrf'),{})).status,503);
 assert.deepEqual(await (await handleRequest(request('/api/password/session'),{})).json(),{authenticated:false});
});
test('successful login sets a secure HTTP-only 24-hour cookie and unlocks exact PDF bytes',async()=>{
 const response=await login();assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/');const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/Max-Age=86400/);assert.match(cookie,/SameSite=Lax/);
 const next=request('/sources/plan.pdf',{headers:{cookie:cookie.split(';')[0]}});assert.equal(allowedSession(next,env),true);
 const pdf=await handleRequest(next,env);assert.equal(pdf.status,200);assert.match(pdf.headers.get('cache-control'),/private, no-store/);assert.deepEqual(Buffer.from(await pdf.arrayBuffer()),await readFile(new URL('../dist/sources/plan.pdf',import.meta.url)));
 const library=await handleRequest(authenticatedRequest('/api/index?resource=library.json'),env);assert.equal(library.status,200);assert.equal((await library.json()).length,14);
});
test('incorrect password, missing CSRF token and cross-origin login are rejected',async()=>{
 const wrong=await login('incorrect');assert.equal(wrong.status,303);assert.match(wrong.headers.get('location'),/error=incorrect/);assert.equal(wrong.headers.get('set-cookie'),null);
 const missing=await handleRequest(request('/api/password/login',{method:'POST',headers:{origin},body:'password=guess'}),env);assert.equal(missing.status,403);
 const external=await handleRequest(request('/api/password/login',{method:'POST',headers:{origin:'https://elsewhere.example'},body:'password=guess'}),env);assert.equal(external.status,403);
 assert.equal((await handleRequest(request('/api/password/login'),env)).status,405);
});
test('resource paths are allowlisted, POST reads fail, and config exposes only readiness',async()=>{
 assert.equal((await handleRequest(authenticatedRequest('/api/index?resource=../.env'),env)).status,404);assert.equal((await handleRequest(authenticatedRequest('/sources/unknown.pdf'),env)).status,404);assert.equal((await handleRequest(authenticatedRequest('/library.json',{method:'POST'}),env)).status,405);
 const config=await handleRequest(request('/api/config'),env);assert.deepEqual(await config.json(),{configured:true});assert.deepEqual(await (await handleRequest(request('/api/password/session',{headers:{cookie:'__Host-research-session=forged'}}),env)).json(),{authenticated:false});
});
test('Vercel public output excludes research files and uses password startup without OAuth',async()=>{
 const output=await buildVercel();await assert.rejects(stat(output+'/library.json'));await assert.rejects(stat(output+'/sources'));
 assert.ok((await readFile(output+'/app.mjs','utf8')).startsWith("import {requirePasswordSession}"));
 const login=await readFile(output+'/login.html','utf8');assert.match(login,/type="password"/);assert.match(login,/24 hours/);assert.ok(!/Google|ChatGPT|OAuth/.test(login));
});
