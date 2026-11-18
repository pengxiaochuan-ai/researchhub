// Recover/replay the two originals already created in this repair's checkpoint.
// Refuse a missing checkpoint rather than silently spend another identity.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {identifyMediaFile} from '../src/media-content-identity.js';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--origin-repair']);
const root=new URL('../../',import.meta.url).pathname,out=root+'researchhub/.tmp/ai-media-origin-2026-11-16/live/',base='http://127.0.0.1:19501';mkdirSync(out,{recursive:true,mode:0o700});
assert(existsSync(out+'checkpoint.json'),'MEDIA_ORIGIN_EXISTING_CHECKPOINT_REQUIRED');
const save=(file,value)=>writeFileSync(out+file,JSON.stringify(value,null,2)+'\n',{mode:0o600}),checkpoint=JSON.parse(readFileSync(out+'checkpoint.json'));assert.equal(checkpoint.scope,'media-origin-two-synthetic-20261116');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids;assert.equal(runtime.key,'rh-kb-local-b0e2af9d');const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const facts=()=>withFixtureTransaction(env,'direct',async tx=>({media:await tx.$queryRawUnsafe('SELECT id,source_sha256,version,archive_state,inspection_state,inspection_classification,byte_size::text FROM rh_ai.session_media_uploads WHERE tenant_id=$1 ORDER BY id',ids.tenant),subjects:await tx.subject.count({where:{tenantId:ids.tenant}}),forms:await tx.formResponse.count({where:{tenantId:ids.tenant}}),usage:await tx.usageRecord.count({where:{tenantId:ids.tenant}}),reservations:await tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant}})}),{readOnly:true});
assert(checkpoint.before,'MEDIA_ORIGIN_ORIGINAL_PROTECTION_REQUIRED');
const prefix=readFileSync(root+'researchhub/.tmp/ai-video-2026-11-16/reuse-probe/generated-av.mp4'),pad=Buffer.alloc(3*1024*1024+8);pad.writeUInt32BE(pad.length);pad.write('free',4,'ascii');const bytes=Buffer.concat([prefix,pad]),file=out+'ORIGIN-SYNTHETIC-AV.mp4';writeFileSync(file,bytes,{mode:0o600});const sha=createHash('sha256').update(bytes).digest('hex');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const actor of ['owner','admin']){
 const record=checkpoint.actors[actor];assert(record?.sessionId&&record.requestKey,'MEDIA_ORIGIN_ORIGINAL_RECEIPT_REQUIRED');
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),headers={Origin:base,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const api=async(path,{method='GET',data,status=200,range,binary=false}={})=>{const q=await context.request.fetch(base+'/api'+path,{method,headers:{...headers,...(range?{Range:range}:{})},...(data===undefined?{}:{data})});assert.equal(q.status(),status,path);return binary?q.body():q.json();};
 await api('/auth/login',{method:'POST',status:201,data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal((await api('/auth/me')).accountId,ids[actor]);
 if(record.started&&!record.completed){
  if(!record.requestKey)throw Error('Unresolved original without a receipt key; no new upload.');
  const receipt=await api(`/sessions/${record.sessionId}/media/receipts/${record.requestKey}`);
  if(!receipt.found||receipt.item.archiveState!=='archived'||receipt.item.byteSize!==bytes.length)throw Error('Unresolved original; inspect saved receipt, do not create another upload.');
  record.mediaId=receipt.item.id;record.uploadId=receipt.upload.uploadId;record.completed=true;record.recoveredKnownArchive=true;save('checkpoint.json',checkpoint);
 }
 const sid=record.sessionId,page=await context.newPage(),calls=[],errors=[],consoleEvents=[],requests=new Map(),extra=new Map();
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',v=>{if(v.request.method==='POST'&&v.request.url.includes(`/sessions/${sid}/media-uploads`))requests.set(v.requestId,new URL(v.request.url).pathname);});
 cdp.on('Network.requestWillBeSentExtraInfo',v=>extra.set(v.requestId,Object.fromEntries(Object.entries(v.headers).map(([k,x])=>[k.toLowerCase(),x]))));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleEvents.push({type:m.type(),text:m.text().slice(0,160)});});
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();
  if(u.pathname.startsWith('/api/')&&q.method()!=='GET'&&u.pathname!=='/api/auth/renew'&&!u.pathname.startsWith(`/api/sessions/${sid}/media-uploads`)){errors.push('Unexpected write '+u.pathname);return route.abort();}
  return route.continue();
 });
 try{
  await page.goto(base+'/pages/ai01/?sessionId='+sid);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='上传文件'&&!x.disabled));
  if(!record.completed)throw Error('This repair run requires recovery of the already saved original; no new identity.');
  const fileIdentity=(await identifyMediaFile(new Blob([bytes]))).fileIdentity,body={requestKey:record.requestKey,filename:'ORIGIN-SYNTHETIC-AV.mp4',mimeType:'video/mp4',size:bytes.length,fileIdentity};
  const replay=await page.evaluate(async v=>{const {createKnowledgeClient}=await import('/src/knowledge-session.js');const c=createKnowledgeClient({scope:()=>v.scope});const first=await c.post(`/sessions/${v.sid}/media-uploads`,v.body);const done=await c.post(`/sessions/${v.sid}/media-uploads/${v.uploadId}/complete`,{});let binary;try{await c.upload(`/sessions/${v.sid}/media-uploads/12345678-1234-4234-a234-123456789012/chunks/0`,new Blob(['synthetic']),{contentType:'application/octet-stream'});}catch(e){binary={status:e.status,code:e.code};}return{first:first.item.id,done:done.id,binary};},{sid,uploadId:record.uploadId,scope:{studyGroupId:ids.group,researchProjectId:ids.project},body});
  assert.equal(replay.first,record.mediaId);assert.equal(replay.done,record.mediaId);assert.deepEqual(replay.binary,{status:404,code:'MEDIA_NOT_FOUND'});
  const proofs=[...requests].map(([id,path])=>({path,headers:extra.get(id)}));assert.equal(proofs.length,3);assert(proofs.every(p=>p.headers));
  for(const proof of proofs){const h=proof.headers;assert.equal(h['sec-fetch-site'],'same-origin');assert.equal(h['sec-fetch-mode'],'same-origin');assert.equal(h['sec-fetch-dest'],'empty');assert.equal(h['x-researchhub-request'],'session-media-v1');assert.equal(new URL(h.referer).origin,base);
   const isChunk=proof.path.includes('/chunks/'),headers={...h,origin:'http://127.0.0.1'};delete headers.host;delete headers[':authority'];delete headers[':method'];delete headers[':path'];delete headers[':scheme'];delete headers['content-length'];delete headers.cookie;
   const response=await context.request.post(base+proof.path,{headers,data:isChunk?Buffer.from('synthetic'):proof.path.endsWith('/complete')?'{}':JSON.stringify(body)});assert.equal(response.status(),isChunk?404:201);
   calls.push({path:proof.path,status:response.status(),originReplay:'http://127.0.0.1',proofSource:'Actual Chrome Network.requestWillBeSentExtraInfo',site:h['sec-fetch-site'],mode:h['sec-fetch-mode'],dest:h['sec-fetch-dest'],marker:h['x-researchhub-request']});
  }
  save(actor+'-network.json',calls);
  const row=page.locator(`[data-media-id="${record.mediaId}"]`);await row.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>{const v=document.querySelector('.agent-media-player video');return v?.readyState>=2&&v.currentTime>0;});await page.locator('video').evaluate(v=>v.pause());await page.screenshot({path:out+actor+'-archived.png'});
  const first=await api(`/sessions/${sid}/media/${record.mediaId}/content`,{range:'bytes=0-15',status:206,binary:true});assert.deepEqual(first,bytes.subarray(0,16));const writes=calls.length;await page.reload();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(calls.length,writes);assert.deepEqual(errors,[]);assert.equal(consoleEvents.length,1);assert(consoleEvents[0].text.includes('404'));
  const result={actor,calls,errors,consoleEvents,sha256:sha,playback:true,range:true,refreshWithoutWrites:true,controlledOriginExplanation:'Actual Chrome metadata captured with CDP; port-stripped HTTP replay used those observed proofs against the real backend. Fresh normal-browser archives recovered by saved receipt; attempted route header overrides were not used as proof of on-wire Origin.'};results.push(result);save(actor+'.json',result);
 }catch(e){await page.screenshot({path:out+actor+'-failure.png'});throw e;}finally{await context.close();}
}
 const after=await facts(),newIds=Object.values(checkpoint.actors).map(x=>x.mediaId),oldRows=after.media.filter(x=>!newIds.includes(x.id));assert.deepEqual(oldRows,checkpoint.before.media);assert.deepEqual({...after,media:oldRows},checkpoint.before);const added=after.media.filter(x=>newIds.includes(x.id));assert.equal(added.length,2);assert(added.every(x=>x.source_sha256===sha&&x.archive_state==='archived'&&x.inspection_classification==='valid'));save('protection.json',{oldUnchanged:true,newRows:added});
 save('result.json',{passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,results,newOriginals:2,newProviderRequests:0});console.log(JSON.stringify({passed:true,actors:results.length,newOriginals:2,evidence:out}));
}catch(e){save('failure.json',{message:e.message,at:new Date().toISOString()});throw e;}finally{await browser.close();}
