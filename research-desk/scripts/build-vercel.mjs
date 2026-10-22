import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function buildVercel(){
  const root=new URL('../',import.meta.url),dist=new URL('dist/',root),output=new URL('vercel-public/',root);
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  for(const name of await readdir(dist)){
    if(name==='library.json'||name==='sources')continue;
    await cp(new URL(name,dist),new URL(name,output),{recursive:true});
  }
  await cp(new URL('hosting/vercel/',root),output,{recursive:true});
  const app=await readFile(new URL('app.mjs',output),'utf8');
  await writeFile(new URL('research-app.mjs',output),app);
  await writeFile(new URL('app.mjs',output),"import {requirePasswordSession} from './access.mjs';\nif(await requirePasswordSession())await import('./research-app.mjs');\n");
  console.log('Built Vercel app. Library and original PDFs are served only by the authenticated function.');
  return fileURLToPath(output);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildVercel();
