// Read existing accepted registrations and exercise rejected requests; no new fixtures.
import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import pw from'/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';import{assertFixtureTarget}from'../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mvb01-mvb03']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/.tmp/ai-video-binding-2026-11-16/negative-live/';mkdirSync(out,{recursive:true,mode:0o700});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),cfg=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/authorized-scope.json')),cp=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/live/checkpoint.json'));
assert.equal(runtime.key,'rh-kb-local-b0e2af9d');const{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),checks=[];
try{
 for(const actor of ['owner','admin']){
  const a=cfg.actors[actor],other=cfg.actors[actor==='owner'?'admin':'owner'],r=cp.actors[actor].receipt,c=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out}}),headers={Origin:base,'X-Study-Group-Id':cfg.source.studyGroupId,'X-Research-Project-Id':cfg.source.researchProjectId};
  try{
   const login=await c.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(login.status(),201);
   const source=`/sessions/${a.sessionId}/media/${a.mediaId}`,subject=`/research-studies/${cfg.target.studyId}/subjects/${a.subjectId}/session-media-ingests`;
   const rejected=async(name,path,status,{data,origin=base,range}={})=>{const response=await c.request.fetch(base+'/api'+path,{method:data?'POST':'GET',headers:{...headers,Origin:origin,...(range?{Range:range}:{})},...(data?{data}:{})});assert.equal(response.status(),status,name);checks.push({actor,name,status});};
   await rejected('foreign-source',`/sessions/${other.sessionId}/media/${other.mediaId}/ingests/${cp.actors[actor==='owner'?'admin':'owner'].receipt.id}`,403);
   await rejected('foreign-subject',`/research-studies/${cfg.target.studyId}/subjects/${other.subjectId}/session-media-ingests/${r.id}`,404);
   await rejected('unknown-study',`/research-studies/rh-study-mvb-unavailable/subjects/${a.subjectId}/session-media-ingests/${r.id}`,404);
   await rejected('invalid-client-storage-pointer',source+'/ingests',400,{data:{requestKey:'rejected-pointer-no-plan',studyId:cfg.target.studyId,subjectId:a.subjectId,storageKey:'not-permitted'}});
   await rejected('old-confirmation-version',source+'/ingests/'+r.id+'/confirm',409,{data:{expectedVersion:999,confirmationHash:r.confirmationHash}});
   await rejected('cross-origin-mutation',source+'/ingests/'+r.id+'/confirm',403,{origin:'https://other.invalid',data:{expectedVersion:r.version-1,confirmationHash:r.confirmationHash}});
   await rejected('invalid-range',subject+'/'+r.id+'/content',416,{range:'bytes='+a.byteSize+'-'});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));let deny=false;
   await c.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(deny&&u.pathname.startsWith('/api'+subject)){return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'MEDIA_INGEST_PERMISSION',message:'当前没有此视频的读取权限。'})});}if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(route.request().method())&&u.pathname!=='/api/auth/renew')return route.abort();return route.continue();});
   await p.goto(base+'/pages/ai01/?sessionId='+a.sessionId);const panel=p.locator('.agent-media-ingest');await panel.getByText('登记成功',{exact:true}).waitFor({timeout:20000});await panel.getByRole('link',{name:'查看被试资料',exact:true}).click();
   const card=p.locator('.registered-media-list');await card.getByRole('button',{name:'查看回执',exact:true}).waitFor({timeout:15000});await card.getByRole('button',{name:'查看回执',exact:true}).click();await card.locator('.media-ingest-receipt').waitFor();
   await card.getByRole('button',{name:'播放',exact:true}).click();await card.locator('video').waitFor();
   deny=true;await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await card.getByRole('alert').waitFor({timeout:10000});assert.equal(await card.locator('video').count(),0);assert.equal(await card.locator('.media-ingest-receipt').count(),0);
   await p.getByRole('heading',{name:a.subjectCode,exact:true}).waitFor();await p.screenshot({path:out+actor+'-registration-denied-parent-kept.png',fullPage:true});assert.deepEqual(errors,[]);checks.push({actor,name:'registration-read-403-clears-player-keeps-subject',status:403,controlledResponse:true});
  }finally{await c.close();}
 }
 const anon=await browser.newContext();try{const a=cfg.actors.owner,response=await anon.request.get(base+cp.actors.owner.receipt.contentHref,{headers:{Origin:base}});assert.equal(response.status(),401);checks.push({actor:'anonymous',name:'private-content-needs-authentication',status:401});}finally{await anon.close();}
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,newFixtures:0,newRegistrations:0,newProviderRequests:0},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,checks:checks.length,newFixtures:0,newRegistrations:0,newProviderRequests:0}));
}finally{await browser.close();}
