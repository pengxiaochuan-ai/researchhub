import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const mode=process.argv[2];assert(['free','owner','admin','verify'].includes(mode));assert.deepEqual(process.argv.slice(3),['--synthetic-staging','--approved-two-text-only']);
const root=new URL('../../',import.meta.url).pathname,dir=root+'researchhub/.tmp/ai-video-chat-2026-11-17/',base='http://127.0.0.1:19501';mkdirSync(dir,{recursive:true,mode:0o700});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),original=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-content-implementation-2026-11-17/scope.json'));assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const path=dir+'live-scope.json';let saved;try{saved=JSON.parse(readFileSync(path));}catch(e){if(e.code!=='ENOENT')throw e;saved={schema:'hub-video-chat-acceptance.v1',createdAt:new Date().toISOString(),maxCalls:2,actors:Object.fromEntries(['owner','admin'].map(k=>[k,{accountId:original.actors[k].accountId,sessionId:original.actors[k].sessionId,mediaId:original.actors[k].mediaId,runId:original.actors[k].runId}]))};}
const checkpoint=()=>writeFileSync(path,JSON.stringify(saved,null,2)+'\n',{mode:0o600});checkpoint();
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const actor of mode==='owner'||mode==='admin'?[mode]:['owner','admin']){
 const a=saved.actors[actor];assert.equal(a.accountId,runtime.ids[actor]);const c=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir}}),errors=[],writes=[];
 const api=async(url,{method='GET',data,status=200}={})=>{const r=await c.request.fetch(base+'/api'+url,{method,headers,...(data===undefined?{}:{data})});const v=await r.json().catch(()=>null);assert.equal(r.status(),status,url+': '+JSON.stringify(v));return v;};
 try{
  await api('/auth/login',{method:'POST',status:201,data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal((await api('/auth/me')).accountId,a.accountId);
  const current=await api(`/sessions/${a.sessionId}/media/${a.mediaId}/content-runs/current`);assert.equal(current.id,a.runId);assert.equal(current.sourceSha256,original.fixtureSha256);assert.equal(current.channels.audio.state,'complete');assert.equal(current.channels.visual.state,'complete');
  if(mode==='free'){
   const negatives=[];for(const [url,data,status]of [[`/sessions/${a.sessionId}/commands`,{text:'解释本视频',requestKey:'vc-invalid-'+actor,kbIds:[],networkIntent:{schema:'hub-network-intent.v1',enabled:true}},422],[`/sessions/${a.sessionId}/commands`,{text:'解释本视频',requestKey:'vc-invalid-extra-'+actor,kbIds:[],hubMediaEvidence:{}},400]]){const v=await api(url,{method:'POST',data,status});negatives.push({url,status,code:v.code});}
   const other=saved.actors[actor==='owner'?'admin':'owner'];const wrong=await c.request.get(base+`/api/sessions/${other.sessionId}/knowledge-state?limit=60`,{headers});assert([403,404].includes(wrong.status()));negatives.push({crossAccount:wrong.status()});
   writeFileSync(dir+actor+'-http-negative.json',JSON.stringify({passed:true,negatives,providerCalls:0},null,2));continue;
  }
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await c.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();if(q.method()!=='GET'&&u.pathname.startsWith('/api/')&&u.pathname!=='/api/auth/renew'){
   if((mode!==actor)||a.started||u.pathname!==`/api/sessions/${a.sessionId}/commands`||q.method()!=='POST'){writes.push({blocked:u.pathname});return route.abort();}
   const body=q.postDataJSON();assert.equal(body.text,a.question);assert.equal(body.networkIntent.enabled,false);a.started=true;a.requestKey=body.requestKey;a.startedAt=new Date().toISOString();checkpoint();writes.push({path:u.pathname,requestKey:body.requestKey});
  }return route.continue();});
  await p.goto(base+'/pages/ai01/?sessionId='+a.sessionId);await p.getByLabel('研究问题',{exact:true}).waitFor();
  if(mode===actor&&!a.started){
   a.question=actor==='owner'?'请依据本视频已有的转写和抽样画面回答：口播的研究关注点是什么，5.8秒附近的画面是什么颜色、有哪些可见文字？区分材料内容与AI解释，说明不能据此证明什么，并引用对应来源。':'请进一步核对本视频：5.8秒附近的抽样画面是什么颜色、有哪些可见文字？红色与蓝色画面又分别显示什么？口播能否作为针灸改善睡眠的疗效证据？请区分自动识别内容、AI推论和待核对事项，并引用对应来源。';checkpoint();
   const input=p.getByLabel('研究问题',{exact:true});await input.fill(a.question);await p.getByRole('button',{name:'发送',exact:true}).click();
  }
  assert(a.started,'No prior authorized request; verification cannot send one');
  let state,job;for(let i=0;i<120;i++){
   state=await api(`/sessions/${a.sessionId}/knowledge-state?limit=60`);job=state.jobs.find(j=>state.messages.some(m=>m.id===j.userMessageId&&m.meta?.hubCommand?.requestKey===a.requestKey));
   if(job&&['completed','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,1000));
  }
  assert(job,'The original request is not visible; never resend');a.jobId=job.id;a.status=job.status;checkpoint();writeFileSync(dir+actor+'-state.json',JSON.stringify(state,null,2),{mode:0o600});assert.equal(job.status,'completed',JSON.stringify(job));
  const answer=state.messages.find(m=>m.id===job.assistantMessageId);assert.equal(answer.meta.sourceStatus,'current');assert.equal(answer.meta.provenance.mode,'hub-video-content');assert.equal(answer.meta.provenance.videoRuntime.runtime,'hub-opencode');assert.equal(answer.meta.provenance.videoRuntime.providerCalls,1);assert.equal(answer.meta.provenance.hubTools[0].tool,'media_content_read');assert(!JSON.stringify(state.messages.filter(m=>m.role==='user')).includes('hubMediaSelection'));
  a.answerId=answer.id;a.packHash=answer.meta.provenance.videoEvidence.packHash;checkpoint();
  await p.locator('.video-chat-sources summary').waitFor({timeout:15000});await p.locator('.video-chat-sources summary').click();const pack=answer.meta.provenance.videoEvidence,checks=[];
  for(const s of pack.sources){await p.getByRole('button',{name:new RegExp(`^回放来源${s.id} `)}).click();await p.waitForFunction(t=>{const v=document.querySelector('.agent-media-player video');return v?.readyState>=2&&v.currentTime>=t-.1&&v.currentTime<t+3;},Number(s.startUs)/1e6);const actual=await p.locator('video').evaluate(v=>{v.pause();return v.currentTime;});checks.push({sourceId:s.id,evidenceId:s.evidenceId,target:Number(s.startUs)/1e6,actual});}
  await p.screenshot({path:dir+actor+'-answer.png',fullPage:true});const count=writes.length;await p.reload();await p.locator('.video-chat-sources summary').waitFor();assert.equal(writes.length,count);assert.equal((await api(`/sessions/${a.sessionId}/knowledge-state?limit=60`)).messages.find(m=>m.id===a.answerId).meta.provenance.videoEvidence.packHash,a.packHash);
  await p.setViewportSize({width:390,height:950});await p.locator('.video-chat-sources summary').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:dir+actor+'-390.png',fullPage:true});assert.deepEqual(errors,[]);assert(!writes.some(x=>x.blocked));writeFileSync(dir+actor+'-browser.json',JSON.stringify({passed:true,jobId:a.jobId,checks,errors,writes,refreshWithoutNewCall:true,runtimePid:runtime.pid},null,2));
 }finally{await c.close();}
}
if(mode==='verify'){
 const{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');const traces=readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces/').filter(x=>x.endsWith('.json')).map(x=>JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+x))).filter(x=>Object.values(saved.actors).some(a=>a.jobId===x.jobId)&&x.request);
 assert.equal(traces.length,2);const ledger=await withFixtureTransaction(env,'direct',async tx=>{
  const result=[];for(const[actor,a]of Object.entries(saved.actors)){const proof=traces.filter(t=>t.jobId===a.jobId);assert.equal(proof.length,1);assert.equal(proof[0].httpStatus,200);assert(proof[0].usage.total_tokens>0);const input=proof[0].request.messages;assert.equal(input.length,2);assert(!JSON.stringify(input).includes('storage_key'));assert(!JSON.stringify(input).includes('/Users/'));assert(!proof[0].request.tools);const usage=await tx.usageRecord.findMany({where:{tenantId:runtime.ids.tenant,sessionId:a.sessionId,messageId:a.answerId}});assert.equal(usage.length,1);assert.equal(usage[0].totalTokens,proof[0].usage.total_tokens);const reservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:runtime.ids.tenant,accountId:a.accountId,requestKey:`chat:${a.sessionId}:${a.requestKey}`}});assert.equal(reservations.length,1);assert.equal(reservations[0].status,'settled');assert.equal(Number(reservations[0].actualTokens),proof[0].usage.total_tokens);result.push({actor,jobId:a.jobId,provider:proof[0].usage,usage,reservation:{id:reservations[0].id,status:reservations[0].status,reservedTokens:String(reservations[0].reservedTokens),actualTokens:String(reservations[0].actualTokens)}});}return result;
 },{readOnly:true});writeFileSync(dir+'actual-usage.json',JSON.stringify({traces:traces.map(t=>({id:t.id,jobId:t.jobId,model:t.model,httpStatus:t.httpStatus,usage:t.usage})),ledger},null,2));
}
console.log(JSON.stringify({mode,passed:true,scope:path}));
}finally{await browser.close();}
