// Explicit, named synthetic upload acceptance; blocks every model/command POST.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createMaterialFixtures} from './ai-material-fixtures.mjs';
const args=process.argv.slice(2);let prior=null;
if(args[0]==='--resume-p02-synthetic'){
 assert.equal(args.length,2);assert.match(args[1],/^\.tmp\/ai-file-data-2026-11-12\/p02-browser-\d+\/result\.json$/);
 prior=JSON.parse(readFileSync(args[1],'utf8'));assert(prior.uploads?.length,'resume requires accepted original uploads');
}else assert.deepEqual(args,['--run-p02-synthetic']);
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-file-data-2026-11-12/p02-browser-'+Date.now();
mkdirSync(out+'/video',{recursive:true,mode:0o700});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const records=[],uploads=[...(prior?.uploads??[])],errors=[],blocked=[];let passed=false;
const checkpoint=()=>writeFileSync(out+'/result.json',JSON.stringify({passed,records,uploads,errors,blocked,modelCalls:0},null,2),{mode:0o600});
const fixtures=await createMaterialFixtures();
const scopeHeaders={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
try{
 for(const actor of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});
  context.on('page',page=>{
   page.on('pageerror',error=>errors.push({actor,type:'pageerror',message:error.message}));
   page.on('console',message=>{if(message.type()==='error')errors.push({actor,type:'console',message:message.text().slice(0,600)});});
  });
  const decisionTasks=new Set();
  try{
   const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}});assert.equal(login.status(),201);
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==base)return route.abort();
    const decision=url.pathname.match(/^\/api\/knowledge\/docs\/import\/([A-Za-z0-9_-]+)\/decision$/);
    const permittedDecision=req.method()==='PUT'&&decisionTasks.has(decision?.[1])&&req.postDataJSON()?.decision==='save';
    const permittedStatus=req.method()==='POST'&&url.pathname==='/api/knowledge/docs/import/status'&&Array.isArray(req.postDataJSON()?.taskIds)&&req.postDataJSON().taskIds.every(id=>decisionTasks.has(id));
    if(url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method())&&!['/api/auth/renew','/api/sessions/hub-source','/api/sessions/knowledge'].includes(url.pathname)&&!/^\/api\/sessions\/[A-Za-z0-9_-]+\/materials$/.test(url.pathname)&&!permittedDecision&&!permittedStatus){
     blocked.push({actor,path:url.pathname});return route.abort();
    }
    return route.continue();
   });
   const page=await context.newPage();
   const previous=uploads.filter(x=>x.actor===actor);const sids=[...new Set(previous.map(x=>x.sessionId))];assert(sids.length<=1);if(sids.length)assert.match(sids[0],/^[A-Za-z0-9_-]+$/);
   await page.goto(base+'/pages/ai01/'+(sids.length?'?sessionId='+sids[0]:''));const upload=page.getByRole('button',{name:'上传文件',exact:true});await upload.waitFor();
   if(!previous.length)await page.waitForFunction(()=>!document.querySelector('#hub-agent-question')?.disabled);
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='上传文件'&&!button.disabled));
   assert(await upload.isEnabled(),'original upload button should be connected');
   const accepted=[];
   for(const [format,path] of Object.entries(fixtures.paths)){
    const existing=previous.find(x=>x.format===format);
    if(existing){accepted.push({format,materialId:existing.materialId});continue;}
    const response=page.waitForResponse(r=>r.request().method()==='POST'&&/^\/api\/sessions\/[^/]+\/materials$/.test(new URL(r.url()).pathname));
    await page.locator('input[type=file][data-agent-materials]').setInputFiles(path);
    const posted=await response,item=await posted.json();
    if(posted.status()!==201)records.push({actor,format,uploadStatus:posted.status(),failure:item});
    assert.equal(posted.status(),201,JSON.stringify(item));assert.equal(item.state,'importing');assert.equal(item.available,false);
    accepted.push({format,materialId:item.id});uploads.push({actor,format,materialId:item.id,sessionId:new URL(page.url()).searchParams.get('sessionId')});checkpoint();
    await page.waitForFunction(count=>Array.from(document.querySelectorAll('[aria-label="本会话资料"] li')).filter(e=>e.textContent.includes('已保存，可查看')).length===count,accepted.length,{timeout:60000});
   }
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('[aria-label="本会话资料"] li')).filter(e=>e.textContent.includes('已保存，可查看')).length===4,null,{timeout:60000});
   await page.screenshot({path:out+'/'+actor+'-uploaded.png'});
   const sid=new URL(page.url()).searchParams.get('sessionId');assert(sid);
   const links=page.locator('[aria-label="本会话资料"] li').filter({hasText:'已保存，可查看'}).getByRole('link',{name:'查看资料',exact:true});assert.equal(await links.count(),4);
   const hrefs=await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
   for(const href of hrefs){
    const docId=new URL(href,base).searchParams.get('docId');assert(docId);assert(href.includes('kbId='));
    const response=await context.request.get(base+'/api/knowledge/docs/'+docId,{headers:scopeHeaders});assert.equal(response.status(),200);
    const doc=await response.json();assert.equal(doc.reviewed,false);assert.equal(doc.status,'draft');
    for(const marker of fixtures.markers)assert(doc.contentMd.includes(marker));
   }
   if(actor==='admin'){
    const owner=records.find(r=>r.actor==='owner'&&r.restored);
    const denied=await context.request.get(base+'/api/sessions/'+owner.sessionId+'/materials?limit=20',{headers:scopeHeaders});assert.equal(denied.status(),403);
    const ownerDoc=new URL(owner.hrefs[0],base).searchParams.get('docId');
    assert.equal((await context.request.get(base+'/api/knowledge/docs/'+ownerDoc,{headers:scopeHeaders})).status(),404);
   }
   await page.reload();await page.waitForFunction(()=>Array.from(document.querySelectorAll('[aria-label="本会话资料"] li')).filter(e=>e.textContent.includes('已保存，可查看')).length===4,null,{timeout:20000});
   assert.deepEqual((await page.locator('[aria-label="本会话资料"] li').filter({hasText:'已保存，可查看'}).getByRole('link',{name:'查看资料',exact:true}).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).sort(),[...hrefs].sort());
   await page.screenshot({path:out+'/'+actor+'-restored.png'});
   const popupReady=context.waitForEvent('page');await page.locator('[aria-label="本会话资料"] li').filter({hasText:'已保存，可查看'}).getByRole('link',{name:'查看资料',exact:true}).first().click();const popup=await popupReady;
   await popup.waitForLoadState('domcontentloaded');
   await popup.frameLocator('iframe[title="知识资料操作区"]').getByRole('button',{name:'抽取预览',exact:true}).click();
   await popup.frameLocator('iframe[title="知识资料操作区"]').getByText(/P02-HEAD/).first().waitFor({timeout:30000});
   await popup.screenshot({path:out+'/'+actor+'-knowledge.png'});await popup.close();
   let nativeDecision=false;
   if(actor==='owner'){
    const existing=previous.find(x=>x.format==='synthetic-identity');let pending=existing?{id:existing.materialId}:null;
    if(!pending){
     const response=page.waitForResponse(r=>r.request().method()==='POST'&&/^\/api\/sessions\/[^/]+\/materials$/.test(new URL(r.url()).pathname));
     await page.locator('input[data-agent-materials]').setInputFiles(root+'researchhub/scripts/fixtures/agent-material-identity-synthetic.txt');
     const posted=await response;assert.equal(posted.status(),201);pending=await posted.json();uploads.push({actor,format:'synthetic-identity',materialId:pending.id,sessionId:sid});checkpoint();
    }
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[aria-label="本会话资料"] li')).some(row=>row.textContent.includes('需要确认保存')||row.textContent.includes('已保存，需核对')),null,{timeout:60000});
    const state=await context.request.get(base+'/api/sessions/'+sid+'/materials?limit=20',{headers:scopeHeaders});assert.equal(state.status(),200);
    const own=(await state.json()).items.find(x=>x.id===pending.id);assert(own);
    if(own.decisionRequired){assert(own.importTaskId);decisionTasks.add(own.importTaskId);
    const ready=context.waitForEvent('page');await page.getByRole('link',{name:'确认保存',exact:true}).click();const review=await ready;
    const frame=review.frameLocator('iframe[title="知识资料操作区"]');
    await frame.getByRole('button',{name:'恢复本页导入进度（不重新上传）',exact:true}).click();
    const dialog=frame.getByRole('dialog').filter({has:frame.getByRole('heading',{name:'恢复导入：需要保存确认',exact:true})});
    await dialog.getByRole('button',{name:'保存',exact:true}).click();
    await frame.getByRole('button',{name:'抽取预览',exact:true}).click();
    await frame.getByText('SYNTHETIC-NOT-A-PERSON',{exact:false}).first().waitFor({timeout:60000});
    await review.screenshot({path:out+'/owner-native-decision.png'});await review.close();
    }else assert.equal(own.canReviewDoc,true,'original decision result must remain queryable, never replace the task');
    await page.reload();await page.getByText('已保存，需核对',{exact:true}).waitFor({timeout:30000});
    const verified=await context.request.get(base+'/api/sessions/'+sid+'/materials?limit=20',{headers:scopeHeaders});assert.equal(verified.status(),200);
    const saved=(await verified.json()).items.find(x=>x.id===pending.id);assert.equal(saved.available,false);assert.equal(saved.canReviewDoc,true);assert.equal(saved.decisionRequired,false);
    const warning=await context.request.get(base+'/api/knowledge/docs/'+saved.docId,{headers:scopeHeaders});assert.equal(warning.status(),200);
    const doc=await warning.json();assert.equal(doc.safetyLevel,'warning');assert.equal(doc.reviewed,false);assert.equal(doc.status,'draft');nativeDecision=true;
   }
   records.push({actor,sessionId:sid,materials:accepted,hrefs,restored:true,knowledgeOpened:true,nativeDecision});
  }finally{try{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}catch{errors.push({actor,type:'cleanup',message:'Diagnostic logout unconfirmed'});}await context.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);passed=true;
}catch(reason){console.error(JSON.stringify({passed:false,code:reason.code??reason.name??'MATERIAL_BROWSER_FAILED',evidence:out}));process.exitCode=1;}
finally{
 await browser.close();checkpoint();console.log(JSON.stringify({passed,evidence:out,records:records.length,uploads:uploads.length,newUploads:uploads.length-(prior?.uploads.length??0),errors:errors.length,blocked:blocked.length,modelCalls:0}));
}
