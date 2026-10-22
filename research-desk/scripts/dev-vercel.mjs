import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {handleRequest} from '../server/main.mjs';
import {buildVercel} from './build-vercel.mjs';
const root=resolve(await buildVercel());
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(url.pathname.startsWith('/api/')||url.pathname==='/library.json'||url.pathname.startsWith('/sources/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const options={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method))options.body=Buffer.concat(chunks);
    const response=await handleRequest(new Request(url,options));
    res.statusCode=response.status;for(const [name,value]of response.headers)if(name!=='set-cookie')res.setHeader(name,value);
    if(response.headers.getSetCookie().length)res.setHeader('set-cookie',response.headers.getSetCookie());
    res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+'/')||!(await stat(file)).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4318,'127.0.0.1',()=>console.log('Password app preview: http://127.0.0.1:4318'));
