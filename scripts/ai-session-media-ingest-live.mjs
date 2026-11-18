// Approved VB05: two existing synthetic originals, at most one new file each.
import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{createHash}from'node:crypto';
import pw from'/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction,assertFixtureTarget}from'../../app/server/scripts/wp01/fixture-guard.mjs';import{readMediaBindingProtection}from'./ai-session-media-ingest-preflight.mjs';
import{assertMediaBindingProtection}from'./ai-session-media-ingest-protection.mjs';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mvb01-mvb03']);
const root=new URL('../../',import.meta.url).pathname,out=root+'researchhub/.tmp/ai-video-binding-2026-11-16/live/',base='http://127.0.0.1:19501';mkdirSync(out,{recursive:true,mode:0o700});
const save=(file,data)=>writeFileSync(out+file,JSON.stringify(data,null,2)+'\n',{mode:0o600}),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const cfg=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/authorized-scope.json')),{ids}=runtime,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const cp=existsSync(out+'checkpoint.json')?JSON.parse(readFileSync(out+'checkpoint.json')):{scope:'media-binding-two-originals-20261116',actors:{owner:{},admin:{}}};assert.equal(cp.scope,'media-binding-two-originals-20261116');
const checkpoint=()=>save('checkpoint.json',cp),results=[],browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const actor of ['owner','admin']){
 const a=cfg.actors[actor],record=cp.actors[actor],c=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out}}),headers={Origin:base,'X-Study-Group-Id':cfg.source.studyGroupId,'X-Research-Project-Id':cfg.source.researchProjectId};
 const api=async(path,{method='GET',data,status=200,range,binary=false}={})=>{const r=await c.request.fetch(base+'/api'+path,{method,headers:{...headers,...(range?{Range:range}:{})},...(data===undefined?{}:{data})});assert.equal(r.status(),status,path+':'+r.status());return binary?r.body():r.json();};
 await api('/auth/login',{method:'POST',data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password},status:201});assert.equal((await api('/auth/me')).accountId,a.accountId);
 assert.equal((await api('/knowledge/ai-status')).materialUpload.mediaRegistrationEnabled,true);
 const mediaBase=`/sessions/${a.sessionId}/media/${a.mediaId}`;
 if(record.started){assert(record.requestKey,'Unknown original request; do not create another.');const old=await api(mediaBase+'/ingest-receipts/'+record.requestKey);if(old.found&&old.item.state==='committed'){record.completed=true;record.receipt=old.item;checkpoint();}}
 const p=await c.newPage(),pageErrors=[],writes=[],rejected=[];let duplicate;
 p.on('pageerror',e=>pageErrors.push(e.message));
 await c.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();
  if(u.pathname.startsWith('/api/')&&q.method()!=='GET'&&u.pathname!=='/api/auth/renew'){
   if(!u.pathname.startsWith('/api'+mediaBase+'/ingests')){rejected.push(u.pathname);return route.abort();}
   const body=q.postDataJSON();writes.push({path:u.pathname,body});
   if(u.pathname.endsWith('/ingests')){assert.equal(body.studyId,cfg.target.studyId);assert.equal(body.subjectId,a.subjectId);assert.equal(body.subjectVisitId,a.visit?.id??null);if(record.requestKey)assert.equal(body.requestKey,record.requestKey);record.started=true;record.requestKey=body.requestKey;record.body=body;checkpoint();}
   else if(u.pathname.endsWith('/confirm')){
    record.planId=u.pathname.split('/').at(-2);record.confirmBody=body;record.confirmSent=true;checkpoint();
    if(actor==='owner'&&!record.concurrentObserved){duplicate=c.request.post(base+u.pathname,{headers,data:body});}
    if(actor==='admin'&&!record.lostResponse){const response=await route.fetch();assert.equal(response.status(),201);const committed=await response.json();assert.equal(committed.state,'committed');record.lostResponse=true;record.receipt=committed;checkpoint();return route.abort('failed');}
   }
  }
  return route.continue();
 });
 if(record.started&&!record.completed){await p.addInitScript(({key,value})=>sessionStorage.setItem(key,JSON.stringify(value)),{key:`rh-media-ingest:${[ids.tenant,a.accountId,cfg.source.studyGroupId,cfg.source.researchProjectId].join(':')}:${a.sessionId}:${a.mediaId}`,value:{schema:'hub-media-ingest-pending.v1',requestKey:record.requestKey,phase:record.confirmSent?'confirming':'preparing',body:record.body}});}
 const shot=async name=>p.screenshot({path:out+actor+'-'+name+'.png',fullPage:true,mask:[p.locator('[aria-label="会话列表"]')]});
 try{
  await p.goto(base+'/pages/ai01/?sessionId='+a.sessionId);
  const panel=p.locator('.agent-media-ingest');await panel.waitFor({timeout:20000});
  if(!record.completed){
   await panel.getByRole('button',{name:record.started?'继续登记':'确认关联并登记',exact:true}).waitFor({timeout:20000});
   if(a.visit&&!record.started)await panel.getByRole('combobox',{name:'关联访视',exact:true}).selectOption(a.visit.id);
   await shot('before-confirm');await panel.getByRole('button',{name:record.started?'继续登记':'确认关联并登记',exact:true}).click();
   if(actor==='admin'){await panel.getByRole('button',{name:'核对登记',exact:true}).waitFor({timeout:15000});record.unknownVisible=true;checkpoint();await shot('unknown');await panel.getByRole('button',{name:'核对登记',exact:true}).click();}
   await panel.getByText('登记成功',{exact:true}).waitFor({timeout:20000});
   const saved=await api(mediaBase+'/ingest-receipts/'+record.requestKey);assert.equal(saved.item.state,'committed');record.receipt=saved.item;record.completed=true;
   if(duplicate){const response=await duplicate;assert.equal(response.status(),201);const value=await response.json();assert.equal(value.receipt.modalityFileId,saved.item.receipt.modalityFileId);record.concurrentObserved=true;}
   checkpoint();
  }else await panel.getByText('登记成功',{exact:true}).waitFor({timeout:20000});
  await shot('registered');const writeCount=writes.length;await p.reload();await panel.getByText('登记成功',{exact:true}).waitFor();assert.equal(writes.length,writeCount);
  await panel.getByRole('link',{name:'查看被试资料',exact:true}).click();
  const card=p.locator('.registered-media-list');await card.getByRole('button',{name:'查看回执',exact:true}).waitFor({timeout:15000});await card.getByRole('button',{name:'查看回执',exact:true}).click();await card.locator('.media-ingest-receipt').waitFor();await shot('subject-receipt');
  await card.getByRole('button',{name:'播放',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.registered-media-list video')?.readyState>=2);await card.locator('video').evaluate(v=>v.play());await p.waitForFunction(()=>document.querySelector('.registered-media-list video')?.currentTime>0);await card.locator('video').evaluate(v=>v.pause());await shot('subject-playback');
  const content=record.receipt.contentHref.slice(4),bytes=await api(content,{binary:true});assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.equal((await api(content,{range:'bytes=0-15',status:206,binary:true})).length,16);
  if(a.visit){const href=await p.locator(`a[href*="${a.visit.id}"]`).first().getAttribute('href');assert(href);await p.goto(base+href);const files=p.locator('.fc-files');await files.locator('summary').first().click();const row=p.locator('#capture-file-'+record.receipt.receipt.modalityFileId);await row.waitFor({timeout:15000});await row.locator('.registered-media-list').getByRole('button',{name:'查看回执',exact:true}).waitFor();await shot('visit-file');}
  assert.deepEqual(pageErrors,[]);assert.deepEqual(rejected,[]);
  const result={actor,sourceMediaId:a.mediaId,ingestId:record.receipt.id,modalityFileId:record.receipt.receipt.modalityFileId,visitId:a.visit?.id??null,shaVerified:true,range:true,refreshWithoutWrite:true,subjectReceipt:true,playback:true,concurrentObserved:record.concurrentObserved??false,lostResponse:record.lostResponse??false,unknownVisible:record.unknownVisible??false,writes,originalRequest:{body:record.body,planId:record.planId,confirm:record.confirmBody}};results.push(result);save(actor+'-result.json',result);
 }catch(e){await shot('failure');save(actor+'-failure.json',{message:e.message,writes,rejected,pageErrors});throw e;}finally{await c.close();}
}
 const before=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/protection-before.json')),anchor=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/coordinated-other-study-anchor.json')),after=await readMediaBindingProtection(env,ids,cfg.target);
 const files=Object.values(cp.actors).map(x=>x.receipt.receipt.modalityFileId);assert.equal(new Set(files).size,2);
 const currentProjects=await withFixtureTransaction(env,'direct',async tx=>{const out={};for(const row of anchor.rows){assert(['subject_visit','form_response'].includes(row.table));const [parent]=await tx.$queryRawUnsafe(`SELECT "researchProjectId" AS project FROM public.${row.table} WHERE id=$1 AND "tenantId"=$2`,row.id,cfg.tenantId);out[row.table+'/'+row.id]=parent?.project;}return out;},{readOnly:true});
 const outsideChanges=assertMediaBindingProtection({before,after,anchor,currentProjects,targetProjectId:cfg.target.executionProjectId,registeredFileIds:files});
 const actual=await withFixtureTransaction(env,'direct',tx=>tx.modalityFile.findMany({where:{id:{in:files}},select:{id:true,subjectId:true,subjectVisitId:true,storageKey:true,meta:true}}),{readOnly:true});assert.equal(actual.length,2);
 save('protection.json',{targetAndSharedProtectedRowsUnchanged:true,outsideScopeObservedChanges:outsideChanges,note:'The three exact other-project rows were identified before our writes, during coordinated acceptance. Their changing values are retained as observations, never called whole-database unchanged; no broader exclusions are permitted.',newModalityFiles:actual.map(x=>({id:x.id,subjectId:x.subjectId,visitId:x.subjectVisitId,sha256:x.meta.sha256})),newNativeTasks:0,newNativeStatuses:0});
 save('result.json',{passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,results,newOriginalObjects:0,newModalityFiles:2,newProviderRequests:0});console.log(JSON.stringify({passed:true,actors:2,newOriginals:0,newModalityFiles:2,newNativeTasks:0,newProviderRequests:0,evidence:out}));
}finally{await browser.close();}
