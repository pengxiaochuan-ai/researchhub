// Filename-only browser verification: real auth/read paths; init is held then
// answered locally. No upload, model request or persistent media mutation.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--filename-only']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/.tmp/ai-video-feedback-2026-11-16/live/';
mkdirSync(out,{recursive:true,mode:0o700});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const checkpoint=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-origin-2026-11-16/live/checkpoint.json'));
assert.equal(checkpoint.scope,'media-origin-two-synthetic-20261116');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const actor of ['owner','admin']){
 const sid=checkpoint.actors[actor].sessionId,context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}});
 const headers={Origin:base,'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
 const request=async(path,options={})=>{const r=await context.request.fetch(base+'/api'+path,{headers,...options});assert.equal(r.status(),options.method==='POST'?201:200);return r.json();};
 await request('/auth/login',{method:'POST',data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});
 assert.equal((await request('/auth/me')).accountId,runtime.ids[actor]);
 const before=await request(`/sessions/${sid}/media?limit=20`),page=await context.newPage(),errors=[],blocked=[];let release,initCount=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());
  if(u.origin!==base)return route.abort();
  if(u.pathname.endsWith('/content'))return route.abort();
  if(u.pathname===`/api/sessions/${sid}/media-uploads`&&q.method()==='POST'){
   ++initCount;await new Promise(resolve=>release=resolve);
   return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'SYNTHETIC_FILENAME_ONLY',message:'本次核验未提交视频，请保留原文件。'})});
  }
  if(u.pathname.startsWith('/api/')&&q.method()!=='GET'&&u.pathname!=='/api/auth/renew'){blocked.push(u.pathname);return route.abort();}
  return route.continue();
 });
 try{
  await page.goto(base+'/pages/ai01/?sessionId='+sid);
  await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();
  await page.waitForFunction(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='上传文件');return e&&!e.disabled;});
  const name='合成研究视频_当前上传文件名核验_不含患者资料.mp4';
  await page.locator('input[data-agent-materials]').setInputFiles({name,mimeType:'video/mp4',buffer:Buffer.alloc(512)});
  const label=page.locator('[data-media-upload-name]');await label.waitFor({timeout:10000});assert.equal(await label.textContent(),name);
  const style=await label.evaluate(e=>{const s=getComputedStyle(e);return{fontSize:s.fontSize,lineHeight:s.lineHeight};});assert.deepEqual(style,{fontSize:'14px',lineHeight:'22px'});
  assert.equal(await page.evaluate(n=>Object.values(sessionStorage).some(v=>v.includes(n)),name),false);
  await page.screenshot({path:out+actor+'-filename-uploading.png'});
  assert.equal(initCount,1);release();
  await page.getByRole('alert').filter({hasText:'本次核验未提交视频'}).waitFor();assert.equal(await label.count(),0);
  await page.screenshot({path:out+actor+'-filename-cleared.png'});
  assert.deepEqual(await request(`/sessions/${sid}/media?limit=20`),before);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  results.push({actor,sessionId:sid,initIntercepted:1,mediaWriteRequestsForwarded:0,filenameRendered:true,filenameCleared:true,style,mediaListUnchanged:true,pageErrors:0});
 }finally{release?.();await context.close();}
}
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),results,newMedia:0,providerRequests:0,notes:'Real auth and media reads; upload initialization deliberately intercepted before server, not a real backend failure or new upload.'},null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({passed:true,actors:results.length,newMedia:0,providerRequests:0,evidence:out}));
}finally{await browser.close();}
