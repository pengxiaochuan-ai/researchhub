// Follow the exact accepted uploads without new material/model submissions.
// Existing K01 automatic conversation setup is explicitly retained, not hidden.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'vite';
import {materialKnowledgeHref} from '../src/session-material-session.js';
const [path,mode]=process.argv.slice(2);assert.match(path??'',/^\.tmp\/ai-file-data-2026-11-12\/p02-browser-\d+\/result\.json$/);assert(mode===undefined||mode==='--verify-view-race'||mode==='--isolated-race');
const prior=JSON.parse(readFileSync(path,'utf8')),first=prior.uploads.find(x=>x.actor==='owner');assert(first?.sessionId);
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out=path.replace('/result.json','')+'/readonly-'+Date.now();mkdirSync(out,{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const module=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (module.chromium??module.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900}}),events=[];let localVite,uiBase=base;
try{
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:'owner@example.org',password}});assert.equal(login.status(),201);
 const scope={studyGroupId:ids.group,researchProjectId:ids.project},headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const state=await context.request.get(base+'/api/sessions/'+first.sessionId+'/materials?limit=20',{headers});assert.equal(state.status(),200);const items=(await state.json()).items;
 const doc=items.find(x=>x.id===first.materialId);assert.equal(doc.available,true);
 if(mode==='--isolated-race'){
  localVite=await createServer({root:root+'researchhub',configFile:root+'researchhub/vite.config.js',cacheDir:mkdtempSync(join(tmpdir(),'rh-material-k01-')),build:{outDir:root+'researchhub/'+out+'/unused-build'},define:{'import.meta.env.VITE_AUTH_TENANT_SLUG':JSON.stringify(ids.tenant)},optimizeDeps:{entries:['pages/k01/frame.html','src/knowledge-reuse/pages/knowledge/WikiEditor.tsx']},server:{host:'127.0.0.1',port:19611,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:19502',changeOrigin:true}}},logLevel:'error'});
  await localVite.listen();uiBase='http://127.0.0.1:19611';
 }
 let docReads=0,releaseDetail,observeSecond,finishSecond;
 const secondObserved=new Promise(resolve=>{observeSecond=resolve;}),secondFetched=new Promise(resolve=>{finishSecond=resolve;});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==uiBase)return route.abort();if(url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method())&&(localVite||!['/api/auth/renew','/api/sessions/knowledge'].includes(url.pathname))){events.push({blocked:req.method()+' '+url.pathname});return route.abort();}
  if(mode&&req.method()==='GET'&&url.pathname==='/api/knowledge/docs/'+doc.docId){try{const index=++docReads;if(index===2)observeSecond();const response=await route.fetch();if(index===2)await new Promise(resolve=>{releaseDetail=resolve;finishSecond();});return await route.fulfill({response});}catch(e){finishSecond();events.push({routeFailure:e.name,path:url.pathname});return route.abort().catch(()=>{});}}
  return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>events.push({error:e.message}));page.on('console',m=>{if(m.type()==='error')events.push({console:m.text().slice(0,500)});});
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')||r.status()>=400)events.push({method:r.request().method(),path:u.pathname,query:r.status()>=400?u.search:undefined,status:r.status()});});
 await page.goto(uiBase+materialKnowledgeHref(doc,scope));await page.locator('iframe').waitFor();
 const frame=await page.locator('iframe').contentFrame();
 let verificationError=null;
 if(mode){try{
  await frame.getByRole('button',{name:'抽取预览',exact:true}).waitFor();
  await Promise.race([secondObserved,new Promise(resolve=>setTimeout(resolve,500))]);
  if(docReads>=2)await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('SECOND_DETAIL_TIMEOUT')),15000);secondFetched.then(()=>{clearTimeout(timeout);resolve();});});
  await frame.getByRole('button',{name:'抽取预览',exact:true}).click();
  await frame.getByText(/P02-HEAD/).first().waitFor({timeout:15000});
  const selected=await frame.getByRole('button',{name:'抽取预览',exact:true}).getAttribute('class');
  if(releaseDetail){
   const arrived=page.waitForResponse(r=>r.url()===uiBase+'/api/knowledge/docs/'+doc.docId&&r.request().method()==='GET');releaseDetail();await(await arrived).finished();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  await page.screenshot({path:out+'/view-race.png'});
  events.push({docReads,previewKept:await frame.getByRole('button',{name:'抽取预览',exact:true}).getAttribute('class')===selected});
  writeFileSync(out+'/events.json',JSON.stringify(events,null,2),{mode:0o600});
  assert.equal(await frame.getByRole('button',{name:'抽取预览',exact:true}).getAttribute('class'),selected,'a late duplicate detail response must not reset the selected reading mode');
  assert(await frame.getByText(/P02-HEAD/).first().isVisible());
 }catch(reason){verificationError=reason.message;events.push({verificationError,docReads});releaseDetail?.();}}else{try{await frame.getByText(/P02-HEAD/).first().waitFor({timeout:15000});}catch{}}
 const states=[];for(const f of page.frames())states.push({url:f.url(),text:(await f.locator('body').innerText().catch(()=>'' )).slice(0,6000)});
 await page.screenshot({path:out+'/knowledge.png'});writeFileSync(out+'/result.json',JSON.stringify({url:page.url(),items,states,events},null,2),{mode:0o600});
 console.log(JSON.stringify({evidence:out,states,events}));
 if(verificationError)throw Error(verificationError);
}catch(reason){console.error(JSON.stringify({passed:false,code:reason.code??reason.name??'MATERIAL_READ_VERIFICATION_FAILED',evidence:out}));process.exitCode=1;}
finally{try{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}catch{console.error(JSON.stringify({code:'DIAGNOSTIC_LOGOUT_UNCONFIRMED'}));}await context.close();await browser.close();await localVite?.close();}
