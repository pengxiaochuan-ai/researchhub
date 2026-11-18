// Exactly two new named synthetic originals; a failed run never spends another identity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--two-resumable-videos']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/.tmp/ai-resumable-2026-11-16/live/';mkdirSync(out,{recursive:true,mode:0o700});
const save=(p,v)=>writeFileSync(out+p,JSON.stringify(v,null,2)+'\n',{mode:0o600});
const state=existsSync(out+'checkpoint.json')?JSON.parse(readFileSync(out+'checkpoint.json')):{scope:'resumable-two-synthetic-videos-20261116',actors:{}};
assert.equal(state.scope,'resumable-two-synthetic-videos-20261116');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids;assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const old=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-2026-11-16/live/facts.json'));
const protectedFacts=()=>withFixtureTransaction(env,'direct',async tx=>({rows:await tx.$queryRawUnsafe(`SELECT id,account_id,session_id,source_sha256,byte_size::text,archive_state,inspection_state,inspection_classification,version FROM rh_ai.session_media_uploads WHERE id=ANY($1) ORDER BY account_id,id`,old.rows.map(x=>x.id)),subjects:await tx.subject.count({where:{tenantId:ids.tenant}}),forms:await tx.formResponse.count({where:{tenantId:ids.tenant}}),usage:await tx.usageRecord.count({where:{tenantId:ids.tenant}}),reservations:await tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant}})}),{readOnly:true});
if(!state.before){state.before=await protectedFacts();assert.deepEqual(state.before.rows,old.rows);save('checkpoint.json',state);}
const raw=readFileSync(root+'researchhub/.tmp/ai-video-2026-11-16/reuse-probe/generated-av.mp4'),padding=Buffer.alloc(5*1024*1024+8);padding.writeUInt32BE(padding.length);padding.write('free',4,'ascii');
const bytes=Buffer.concat([raw,padding]),file=out+'RESUME-SYNTHETIC-AV.mp4';if(!existsSync(file))writeFileSync(file,bytes,{mode:0o600});assert.deepEqual(readFileSync(file),bytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const actor of ['owner','admin']){
 const record=state.actors[actor]??={conversationKey:randomUUID()};save('checkpoint.json',state);
 if(record.started&&!record.completed)throw Error('Unresolved original '+actor+' upload: inspect its saved requestKey; no new identity or automatic retry.');
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),headers={Origin:base,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const api=async(path,{method='GET',data,status=200,range,binary=false}={})=>{const r=await context.request.fetch(base+'/api'+path,{method,headers:{...headers,...(range?{Range:range}:{})},...(data===undefined?{}:{data})});assert.equal(r.status(),status,path);return binary?r.body():r.json();};
 await api('/auth/login',{method:'POST',status:201,data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal((await api('/auth/me')).accountId,ids[actor]);assert.equal((await api('/knowledge/ai-status')).materialUpload.mediaResumable,true);
 if(!record.sessionId){record.sessionId=(await api('/sessions/hub-source',{method:'POST',status:201,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:record.conversationKey}})).id;save('checkpoint.json',state);}
 const sid=record.sessionId,calls=[],errors=[],consoleEvents=[],page=await context.newPage();let interrupt=!record.completed;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleEvents.push({type:m.type(),text:m.text().slice(0,180)});});
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();
  if(u.pathname.startsWith('/api/')){
   calls.push({method:q.method(),path:u.pathname,status:'requested'});
   if(q.method()!=='GET'&&!/^\/api\/(?:auth\/renew|sessions\/[A-Za-z0-9_-]+\/media-uploads(?:\/[a-f0-9-]+\/(?:chunks\/[0-9]+|complete))?)$/.test(u.pathname)){errors.push('Unexpected write '+u.pathname);return route.abort();}
   if(interrupt&&/\/chunks\/[1-9][0-9]*$/.test(u.pathname)){calls.at(-1).status='controlled-network-interruption';return route.abort('failed');}
   if(u.pathname===`/api/sessions/${sid}/media-uploads`&&q.method()==='POST'){
    const body=q.postDataJSON();if(record.requestKey)assert.equal(body.requestKey,record.requestKey);record.requestKey=body.requestKey;record.fileIdentity=body.fileIdentity;save('checkpoint.json',state);
   }
  }
  return route.continue();
 });
 try{
  const started=performance.now();await page.goto(base+'/pages/ai01/?sessionId='+sid);await page.locator('.agent-history-group .conv').first().waitFor();const historyVisibleMs=Math.round(performance.now()-started);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='上传文件'&&!x.disabled));
  if(!record.completed){
   record.started=true;save('checkpoint.json',state);
   const initWait=page.waitForResponse(r=>r.url()===base+`/api/sessions/${sid}/media-uploads`&&r.request().method()==='POST');
   await page.locator('input[data-agent-materials]').setInputFiles(file);const response=await initWait;assert.equal(response.status(),201);const init=await response.json();record.uploadId=init.uploadId;record.mediaId=init.item.id;save('checkpoint.json',state);
   await page.getByRole('alert').filter({hasText:'上传连接失败'}).waitFor();const snapshot=await api(`/sessions/${sid}/media-uploads/${record.uploadId}`);record.receivedBefore=snapshot.received.map(x=>x.index);assert.deepEqual(record.receivedBefore,[0]);save('checkpoint.json',state);await page.screenshot({path:out+actor+'-interrupted.png'});
   await page.goto(base+'/pages/p01/');await page.goto(base+'/pages/ai01/?sessionId='+sid);await page.getByRole('button',{name:'继续上传',exact:true}).waitFor();await page.screenshot({path:out+actor+'-returned.png'});
   const writesBefore=calls.filter(x=>x.method==='POST'&&x.path.includes('/media-uploads')).length,wrong=Buffer.from(bytes);wrong[wrong.length-1]^=1;
   const pick=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await pick).setFiles({name:'RESUME-SYNTHETIC-AV.mp4',mimeType:'video/mp4',buffer:wrong});await page.getByText('所选文件与原视频内容不同，请重新选择原视频。',{exact:false}).waitFor();assert.equal(calls.filter(x=>x.method==='POST'&&x.path.includes('/media-uploads')).length,writesBefore);
   interrupt=false;const before=calls.length,complete=page.waitForResponse(r=>r.url().endsWith(`/media-uploads/${record.uploadId}/complete`)&&r.request().method()==='POST');
   const resume=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await resume).setFiles(file);const done=await complete;assert.equal(done.status(),201);const item=await done.json();assert.equal(item.id,record.mediaId);assert.equal(item.classification,'valid');
   record.completed=true;record.sentAfter=calls.slice(before).filter(x=>x.method==='POST'&&x.path.includes('/chunks/')).map(x=>Number(x.path.split('/').at(-1))).sort();assert.deepEqual(record.sentAfter,[1,2,3,4,5]);save('checkpoint.json',state);
  }
  const row=page.locator(`[data-media-id="${record.mediaId}"]`);await row.waitFor();await row.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>{const v=document.querySelector('.agent-media-player video');return v?.readyState>=2&&v.currentTime>0;});await page.locator('.agent-media-player video').evaluate(v=>{v.pause();v.currentTime=0.5;});await page.waitForFunction(()=>document.querySelector('.agent-media-player video')?.currentTime>=0.49);
  await page.screenshot({path:out+actor+'-resumed.png'});const delivered=await api(`/sessions/${sid}/media/${record.mediaId}/content`,{binary:true});assert.equal(sha(delivered),sha(bytes));assert.deepEqual(await api(`/sessions/${sid}/media/${record.mediaId}/content`,{binary:true,status:206,range:'bytes=0-15'}),bytes.subarray(0,16));
  const writes=calls.filter(x=>x.method==='POST'&&x.path.includes('/media-uploads')).length;await page.reload();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(calls.filter(x=>x.method==='POST'&&x.path.includes('/media-uploads')).length,writes);
  assert.deepEqual(errors,[]);const result={actor,historyVisibleMs,receivedBefore:record.receivedBefore,sentAfter:record.sentAfter,originalSha256:sha(bytes),played:true,seeked:true,refreshWithoutWrites:true,calls,errors,consoleEvents};results.push(result);save(actor+'.json',result);
 }catch(e){await page.screenshot({path:out+actor+'-failure.png'});throw e;}finally{await context.close();}
}
 const after=await protectedFacts();assert.deepEqual(after,state.before);save('db-protection.json',{unchanged:true,after});
 const db=await withFixtureTransaction(env,'direct',async tx=>({rows:await tx.$queryRawUnsafe('SELECT id,source_sha256,archive_state FROM rh_ai.session_media_uploads WHERE session_id=ANY($1) ORDER BY id',Object.values(state.actors).map(x=>x.sessionId)),jobs:await tx.knowledgeChatJob.count({where:{sessionId:{in:Object.values(state.actors).map(x=>x.sessionId)}}})}),{readOnly:true});assert.equal(db.rows.length,2);assert.equal(db.jobs,0);save('db.json',db);
 save('result.json',{passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,newOriginals:2,newProviderRequests:0,results});console.log(JSON.stringify({passed:true,newOriginals:2,actors:results.length,evidence:out}));
}catch(e){save('failure.json',{message:e.message,at:new Date().toISOString()});throw e;}finally{await browser.close();}
