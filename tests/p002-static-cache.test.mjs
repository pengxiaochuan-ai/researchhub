import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
const close=server=>new Promise(resolve=>server.close(resolve));
test('production static entry caches only verified P002 derivative bytes and leaves HTML/API/old assets unchanged',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'p002-static-cache-'));
 const bytes=Buffer.from('synthetic-only-webp-response');
 const digest=createHash('sha256').update(bytes).digest('hex');
 const cropped=`/pages/p002/assets/crops/crop-${digest.slice(0,16)}.webp`;
 const optimized=`/pages/p002/assets/optimized/background.${digest}.webp`;
 const wrong='/pages/p002/assets/crops/crop-aaaaaaaaaaaa.webp';
 const plain='/pages/p002/assets/optimized/background.webp';
 const elsewhere=`/pages/p003/assets/crops/crop-${digest.slice(0,16)}.webp`;
 const old='/pages/p002/assets/reference-1.png';
 const html='/pages/p002/index.html';
 const js=`/assets/code-${digest.slice(0,16)}.js`;
 for(const path of[cropped,optimized,wrong,plain,elsewhere,old,html,js]){
  const file=join(dir,'dist',path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
 }
 const upstream=createServer((req,res)=>res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"code":"AUTH_SESSION_EXPIRED"}'));
 const up=await listen(upstream),reserve=createServer(),port=await listen(reserve);await close(reserve);
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server/static.mjs',import.meta.url))],{
  cwd:dir,env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:String(port),HUB_API_UPSTREAM:`http://127.0.0.1:${up}`,HUB_API_AUTHORITY:'hub.pengxc.com'},stdio:['ignore','pipe','pipe'],
 });
 let stderr='';child.stderr.on('data',data=>stderr+=data);
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error(stderr||'static process exited');})]);
  const origin=`http://127.0.0.1:${port}`;
  for(const path of[cropped,optimized])for(const method of['GET','HEAD']){
   const r=await fetch(origin+path,{method});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');
   assert.equal(r.headers.get('cache-control'),'public, max-age=31536000, immutable');
   if(method==='GET')assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
  }
  for(const path of[wrong,plain,elsewhere,old,html,js]){
   const r=await fetch(origin+path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),null,path);
  }
  assert.equal((await fetch(origin+'/health')).headers.get('cache-control'),'no-store');
  const api=await fetch(origin+'/api/auth/me');assert.equal(api.status,401);assert.equal(api.headers.get('cache-control'),'no-store');
  assert.equal((await api.json()).code,'AUTH_SESSION_EXPIRED');
  const missing=await fetch(origin+cropped.replace('crop-','missing-'));assert.equal(missing.status,404);assert.equal(missing.headers.get('cache-control'),null);
  await writeFile(join(dir,'dist',cropped),Buffer.from('changed bytes with stale hashed filename'));
  assert.equal((await fetch(origin+cropped)).headers.get('cache-control'),null,'changed bytes cannot keep an immutable assertion');
 }finally{
  child.kill('SIGTERM');await once(child,'exit');await close(upstream);await rm(dir,{recursive:true,force:true});
 }
});
