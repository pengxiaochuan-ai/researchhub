// MV03 only. Refuse an unknown prior upload rather than spend another identity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mv03']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const out=root+'researchhub/.tmp/ai-video-2026-11-16/live/';mkdirSync(out+'fixtures',{recursive:true,mode:0o700});
const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const checkpoint=existsSync(out+'checkpoint.json')?JSON.parse(readFileSync(out+'checkpoint.json')):{scope:'MV03-six-synthetic-videos-20261116',actors:{}};
assert.equal(checkpoint.scope,'MV03-six-synthetic-videos-20261116');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const mp4=out+'fixtures/MV03-SYNTHETIC-AV.mp4',webm=out+'fixtures/MV03-SYNTHETIC-VIDEO.webm',bad=out+'fixtures/MV03-SYNTHETIC-CORRUPT.mp4';
if(!existsSync(mp4)){
 const bytes=readFileSync(root+'researchhub/.tmp/ai-video-2026-11-16/reuse-probe/generated-av.mp4'),padding=Buffer.alloc(3*1024*1024+8);padding.writeUInt32BE(padding.length);padding.write('free',4,'ascii');writeFileSync(mp4,Buffer.concat([bytes,padding]),{mode:0o600});
}
if(!existsSync(webm))execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=160x120:r=10','-t','2','-c:v','libvpx-vp9','-an',webm],{timeout:30000});
if(!existsSync(bad))writeFileSync(bad,readFileSync(mp4).subarray(0,40),{mode:0o600});
const fixtures=[{path:mp4,extension:'mp4',classification:'valid'},{path:webm,extension:'webm',classification:'valid'},{path:bad,extension:'mp4',classification:'corrupt'}].map(x=>({...x,name:x.path.split('/').at(-1),size:readFileSync(x.path).length,sha256:sha(readFileSync(x.path))}));
save('fixtures.json',fixtures);
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids;
assert.equal(runtime.key,'rh-kb-local-b0e2af9d');assert.equal(ids.tenant,'rh-kb-local-b0e2af9d-tenant');
assert(execFileSync('ps',['-p',String(runtime.pid),'-o','command='],{encoding:'utf8'}).includes('local-knowledge.mjs serve '+runtime.key));
const facts=()=>withFixtureTransaction(env,'direct',async tx=>({subjects:await tx.subject.count({where:{tenantId:ids.tenant}}),features:await tx.feature.count({where:{tenantId:ids.tenant}}),forms:await tx.formResponse.count({where:{tenantId:ids.tenant}}),usageRecords:await tx.usageRecord.count({where:{tenantId:ids.tenant}}),tokenReservations:await tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant}}),accounts:await tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]}},orderBy:{id:'asc'},select:{id:true,status:true,authVersion:true,role:true,isTenantAdmin:true}})}),{readOnly:true});
if(!checkpoint.before){checkpoint.before=await facts();save('checkpoint.json',checkpoint);}
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),network=[],errors=[],checks=[];
let contexts=[];
try{
 for(const actor of ['owner','admin']){
  mkdirSync(out+actor,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+actor}});contexts.push(context);
  const record=checkpoint.actors[actor]??={conversationKey:randomUUID(),files:{}};save('checkpoint.json',checkpoint);
  const headers={Origin:base,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
  const api=async(path,{method='GET',data,status=200,binary=false,range}={})=>{
   assert(path.startsWith('/')&&!path.includes('..'));
   const r=await context.request.fetch(base+'/api'+path,{method,headers:{...headers,...(range?{Range:range}:{})},...(data!==undefined?{data}:{}),timeout:30000});
   network.push({actor,method,path,status:r.status()});save('network.json',network);assert.equal(r.status(),status,path);
   return binary?await r.body():await r.json();
  };
  await api('/auth/login',{method:'POST',status:201,data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});
  assert.equal((await api('/auth/me')).accountId,ids[actor]);
  assert.equal((await api('/knowledge/ai-status')).materialUpload.mediaEnabled,true,'Target media capability is not enabled');
  if(!record.sessionId){record.sessionId=(await api('/sessions/hub-source',{method:'POST',status:201,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:record.conversationKey}})).id;save('checkpoint.json',checkpoint);}
  const sid=record.sessionId,page=await context.newPage();page.on('pageerror',e=>errors.push({actor,message:e.message}));
  await context.route('**/*',async route=>{
   const q=route.request(),url=new URL(q.url());
   if(url.origin!==base){errors.push({actor,blockedOrigin:url.origin});return route.abort();}
   if(url.pathname.startsWith('/api/')&&q.method()!=='GET'){
    if(!/^\/api\/(?:auth\/renew|sessions\/[A-Za-z0-9_-]+\/media-uploads(?:\/[a-f0-9-]+\/(?:chunks\/[0-9]+|complete))?|sessions\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\/recheck)$/.test(url.pathname)){errors.push({actor,blockedWrite:url.pathname});return route.abort();}
   }
   if(url.pathname.startsWith('/api/'))network.push({actor,method:q.method(),path:url.pathname+url.search});
   return route.continue();
  });
  await page.goto(base+'/pages/ai01/?sessionId='+sid);await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='上传文件'&&!x.disabled));
  for(const fixture of fixtures){
   let entry=record.files[fixture.name];
   if(entry?.completed){const receipt=await api(`/sessions/${sid}/media/receipts/${entry.requestKey}`);assert.equal(receipt.item.id,entry.mediaId);continue;}
   if(entry?.started)throw Error('Prior upload requires original-receipt recovery; no new upload was created: '+fixture.name);
   entry=record.files[fixture.name]={started:true,sha256:fixture.sha256,size:fixture.size};save('checkpoint.json',checkpoint);
   const initWait=page.waitForResponse(r=>r.url()===base+`/api/sessions/${sid}/media-uploads`&&r.request().method()==='POST',{timeout:30000});
   const doneWait=page.waitForResponse(r=>r.url().includes(`/sessions/${sid}/media-uploads/`)&&r.url().endsWith('/complete')&&r.request().method()==='POST',{timeout:60000});void doneWait.catch(()=>{});
   const onRequest=req=>{if(req.url()===base+`/api/sessions/${sid}/media-uploads`&&req.method()==='POST'){entry.requestKey=req.postDataJSON().requestKey;save('checkpoint.json',checkpoint);}};page.on('request',onRequest);
   try{
    await page.locator('input[data-agent-materials]').setInputFiles(fixture.path);
    const initResponse=await initWait;assert.equal(initResponse.status(),201);const init=await initResponse.json();entry.uploadId=init.uploadId;entry.mediaId=init.item.id;save('checkpoint.json',checkpoint);
    const response=await doneWait;entry.completeStatus=response.status();save('checkpoint.json',checkpoint);assert.equal(response.status(),201);
    const result=await response.json();assert.equal(result.archiveState,'archived');assert.equal(result.classification,fixture.classification);entry.completed=true;entry.result=result;save('checkpoint.json',checkpoint);
    const row=page.locator(`[data-media-id="${result.id}"]`);await row.waitFor();
    if(fixture.classification==='valid'){
     await row.getByRole('button',{name:'播放',exact:true}).click();
     await page.waitForFunction(()=>{const v=document.querySelector('.agent-media-player video');return v?.readyState>=2&&v.currentTime>0;});
     await page.locator('.agent-media-player video').evaluate(v=>{v.pause();v.currentTime=0.5;});
     await page.waitForFunction(()=>document.querySelector('.agent-media-player video')?.currentTime>=0.49);
     checks.push({actor,file:fixture.name,played:true,seeked:true});
    }else{assert.equal(await row.getByRole('button',{name:'播放',exact:true}).count(),0);checks.push({actor,file:fixture.name,archivedCorrupt:true});}
    await page.screenshot({path:out+actor+'/'+fixture.name+'.png'});
    const raw=await api(`/sessions/${sid}/media/${result.id}/content`,{binary:true});assert.equal(sha(raw),fixture.sha256);
    const first=await api(`/sessions/${sid}/media/${result.id}/content`,{binary:true,status:206,range:'bytes=0-15'});assert.deepEqual(first,readFileSync(fixture.path).subarray(0,16));
   }finally{page.off('request',onRequest);}
  }
  const writesBefore=network.filter(x=>x.actor===actor&&x.method==='POST'&&x.path.includes('/media-uploads')).length;
  await page.reload();await page.getByText('本会话视频 · 3份',{exact:true}).waitFor();assert.equal(await page.locator('[data-media-id]').count(),3);
  assert.equal(network.filter(x=>x.actor===actor&&x.method==='POST'&&x.path.includes('/media-uploads')).length,writesBefore);
  for(const width of [1366,1920]){await page.setViewportSize({width,height:900});await page.screenshot({path:out+actor+`/layout-${width}.png`});}
  const font=await page.locator('.agent-media').evaluate(el=>({size:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight}));assert.deepEqual(font,{size:'14px',line:'22px'});
  // Real authenticated negative requests: no Provider/knowledge job is created.
  for(const endpoint of ['commands','knowledge-messages']){
   const result=await api(`/sessions/${sid}/${endpoint}`,{method:'POST',status:409,data:{requestKey:'mv03-negative-'+randomUUID(),text:'视频里有几个人？',kbIds:[]}});assert.equal(result.code,'MEDIA_CONTENT_UNAVAILABLE');
  }
  if(actor==='admin'){
   const owner=checkpoint.actors.owner,mediaId=Object.values(owner.files)[0].mediaId;
   const denied=await api(`/sessions/${owner.sessionId}/media/${mediaId}/content`,{status:403});assert.equal(denied.code,'HUB_MATERIAL_ACCESS_REJECTED');checks.push({actor,ownerPrivateVideoDenied:true});
  }
  await context.close();contexts=contexts.filter(x=>x!==context);
 }
 const sessions=Object.values(checkpoint.actors).map(x=>x.sessionId);
 const db=await withFixtureTransaction(env,'direct',async tx=>({rows:await tx.$queryRawUnsafe(`SELECT id,account_id,session_id,source_sha256,byte_size::text,archive_state,inspection_state,inspection_classification,version FROM rh_ai.session_media_uploads WHERE tenant_id=$1 AND session_id=ANY($2) ORDER BY account_id,id`,ids.tenant,sessions),jobs:await tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,sessionId:{in:sessions}}})}),{readOnly:true});
 assert.equal(db.rows.length,6);assert.equal(db.jobs,0);assert.deepEqual(await facts(),checkpoint.before);assert.deepEqual(errors,[]);
 save('facts.json',db);save('network.json',network);save('result.json',{passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,syntheticOnly:true,checks,errors,mediaRecords:6,newKnowledgeJobs:0,newProviderRequests:0,newClinicalWrites:0,scope:'Upload/archive/native playback/Range/checking; no content understanding or production acceptance.'});
 console.log(JSON.stringify({passed:true,mediaRecords:6,checks:checks.length,providerRequests:0,evidence:out}));
}catch(e){save('failure.json',{at:new Date().toISOString(),message:e.message,errors});console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}
finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
