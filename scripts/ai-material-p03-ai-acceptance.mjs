// A human-approved one-question-per-account acceptance harness, not a product gate.
// Re-running an armed/checkpointed account only reads the original command.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,statSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {verifiedUsage} from '../server/billing/attempts.mjs';
import {verifyPrivateMaterialOutput} from '../server/ai-agent/private-material-output.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const out='.tmp/ai-file-data-2026-11-12/p03-real-approved-2026-11-13';
const actor=process.argv.find(x=>x.startsWith('--actor='))?.slice(8);
assert(['owner','admin'].includes(actor),'Choose exactly one original synthetic account');
const execute=process.argv.includes('--execute-approved-once');
mkdirSync(out+'/video',{recursive:true,mode:0o700});
const checkpointPath=out+'/'+actor+'-checkpoint.json';
const checkpoint=existsSync(checkpointPath)?JSON.parse(readFileSync(checkpointPath,'utf8')):null;
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const prior=JSON.parse(readFileSync('.tmp/ai-file-data-2026-11-12/p02-browser-1794503079959/result.json','utf8'));
const original=prior.uploads.find(x=>x.actor===actor&&x.format==='txt');assert(original?.sessionId);
const sid=original.sessionId,headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const question='仅依据本会话上传的合成资料，总结材料的目的、缺失值处理和数据完整性注意事项，并标注来源。材料不是真实临床研究，不新增计算。';
const save=(name,value)=>writeFileSync(out+'/'+actor+'-'+name+'.json',JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2),{mode:0o600});
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
const errors=[],network=[],blocked=[];let record=checkpoint,passed=false;
context.on('page',page=>{page.on('pageerror',e=>errors.push({kind:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text().slice(0,300)});});page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({path:u.pathname,method:r.request().method(),status:r.status()});});});
async function get(path){const r=await context.request.get(base+'/api'+path,{headers});assert.equal(r.status(),200,'GET '+path);return r.json();}
async function ledger(requestKey){return withFixtureTransaction(env,'direct',async tx=>{
 const reservation=await tx.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:ids.tenant,requestKey:'chat:'+sid+':'+requestKey}}});
 if(!reservation)return{reservation:null};assert.equal(reservation.accountId,ids[actor]);
 const events=await tx.auditLog.findMany({where:{tenantId:ids.tenant,target:reservation.id,action:{in:['hub.token.attempt.started','hub.token.attempt.completed','hub.token.attempt.unknown','hub.token.execution.sealed','hub.token.execution.inconsistent']}},orderBy:{createdAt:'asc'}});
 const binding=events.find(e=>e.action==='hub.token.attempt.started')?.meta;
 const usage=binding?verifiedUsage(events,binding):null;
 return{reservation,usage,events:events.map(e=>({id:e.id,action:e.action,createdAt:e.createdAt,meta:e.meta}))};
},{readOnly:true});}
try{
 assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
 const status=await get('/knowledge/ai-status');assert.equal(status.materialUpload.analysisReady,true);assert.equal(status.quota.canStart,true,'Do not top up or weaken business quota');
 const materials=await get('/sessions/'+sid+'/materials?limit=20');const available=materials.items.filter(m=>m.available);assert.equal(available.length,4);
 const before=await get('/sessions/'+sid+'/knowledge-state?limit=60');
 save('preflight',{actor,sessionId:sid,quota:status.quota,materialIds:available.map(m=>m.id),oldJobIds:before.jobs.map(j=>j.id),checkpoint:Boolean(checkpoint)});
 if(!execute&&!checkpoint){console.log(JSON.stringify({actor,ready:true,modelCalls:0,evidence:out}));}
 else{
  // Observe only localhost; model calls happen in the already-approved backend.
  let posts=0;
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base){blocked.push(u.origin);return route.abort();}if(r.method()==='POST'&&u.pathname==='/api/sessions/'+sid+'/commands'){posts++;if(checkpoint||posts>1)return route.abort();}return route.continue();});
  const page=await context.newPage();await page.goto(base+'/pages/ai01/?sessionId='+sid);
  const input=page.getByLabel('研究问题',{exact:true});await input.waitFor();await page.waitForFunction(()=>!document.querySelector('#hub-agent-question')?.disabled);
  if(!checkpoint){
   assert.equal(before.jobs.length,0,'Use the original unused material session only');
   const oldCommands=await get('/sessions/'+sid+'/commands');assert.equal(oldCommands.items.length,0);
   record={actor,sessionId:sid,question,armedAt:new Date().toISOString(),state:'armed-before-Enter'};save('checkpoint',record);
   await input.fill(question);await page.screenshot({path:out+'/'+actor+'-before-send.png'});
   const sent=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/sessions/'+sid+'/commands');
   await input.press('Enter');const response=await sent;const command=await response.json();
   record={...record,state:'submitted',httpStatus:response.status(),commandId:command.id,requestKey:command.requestKey};save('checkpoint',record);assert.equal(response.status(),201);assert(command.id&&command.requestKey);
  }
  assert(record.requestKey,'An armed but unknown submission must be investigated read-only, never sent again');
  let state,job;
  for(let i=0;i<210;i++){
   state=await get('/sessions/'+sid+'/knowledge-state?limit=60');job=state.jobs.find(j=>j.requestKey===record.requestKey||j.userMessageId===record.commandId);
   if(job&&['completed','failed'].includes(job.status))break;
   const commands=await get('/sessions/'+sid+'/commands');const paused=commands.items.find(c=>c.id===record.commandId&&c.status==='paused');
   if(paused){save('paused',paused);throw Object.assign(Error('The original command paused; do not resubmit'),{code:paused.pauseCode??'COMMAND_PAUSED'});}
   await page.waitForTimeout(700);
  }
  save('state',state);if(job){record={...record,jobId:job.id,status:job.status};save('checkpoint',record);}
  const billing=await ledger(record.requestKey);save('billing',billing);
  await page.screenshot({path:out+'/'+actor+'-result.png'});
  assert.equal(job?.status,'completed','Original task did not deliver; preserve known usage and do not retry');
  const answer=state.messages.find(m=>m.id===job.assistantMessageId);assert(answer?.content?.length>10);assert.equal(answer.meta.sourceStatus,'current');
  const p=answer.meta.provenance,pack=p.privateMaterialEvidence;
  assert.equal(p.runtime,'hub-opencode');assert.equal(p.mode,'hub-private-materials');assert.equal(p.privateRuntime.providerCalls,1);assert.match(p.privateRuntime.sessionId,/^ses_/);
  assert.equal(pack.sources.length,4);assert.equal(pack.binding.principal.accountId,ids[actor]);assert.equal(pack.binding.sessionId,sid);assert.equal(p.privateMaterials.packHash,pack.packHash);
  assert.deepEqual(pack.sources.map(s=>s.materialId).sort(),available.map(m=>m.id).sort());
  assert(p.hubTools.some(t=>t.tool==='private_material_read'&&t.permission==='file.read'&&t.executedBy==='hub-controlled-evidence-adapter'&&t.status==='succeeded'&&t.packHash===pack.packHash));
  verifyPrivateMaterialOutput(p.privateMaterialOutput,pack,answer.content);
  for(const n of answer.content.matchAll(/\[(\d+)\]/g))assert(pack.sources[Number(n[1])-1],'No fabricated source number');
  for(const s of pack.sources){assert(s.coverage.complete);assert(s.fragments.some(f=>f.text.includes('P02-HEAD')));}
  const source=await get('/sessions/'+sid+'/knowledge-sources/'+answer.id+'/1');assert.equal(source.packHash,pack.packHash);assert.equal(source.materialId,pack.sources[0].materialId);
  assert.equal(billing.reservation.status,'settled');assert.equal(billing.reservation.usedMock,false);assert(billing.reservation.actualTokens>0n);assert(billing.reservation.reservedTokens>=billing.reservation.actualTokens);assert(billing.reservation.settledAt);
  assert.equal(billing.usage.callCount,1);assert.equal(BigInt(billing.usage.totalTokens),billing.reservation.actualTokens);
  assert.equal(billing.events.filter(e=>e.action==='hub.token.attempt.started').length,1);assert.equal(billing.events.filter(e=>e.action==='hub.token.attempt.completed').length,1);assert.equal(billing.events.filter(e=>e.action.endsWith('unknown')||e.action.endsWith('inconsistent')).length,0);
  const traces=root+'.tmp/researchhub-knowledge-local/ai-traces/';const matched=[];
  for(const name of readdirSync(traces)){if(!name.endsWith('.json')||name.endsWith('-runtime.json'))continue;const path=traces+name;if(statSync(path).mtimeMs<Date.parse(record.armedAt)-1000)continue;const t=JSON.parse(readFileSync(path,'utf8'));if(t.jobId===job.id)matched.push({...t,path});}
  assert.equal(matched.length,1);assert.equal(matched[0].httpStatus,200);assert.equal(matched[0].usage.total_tokens,billing.usage.totalTokens);assert.equal(matched[0].finishReason,'stop');
  save('provider',{tracePath:matched[0].path,model:matched[0].model,httpStatus:200,usage:matched[0].usage,startedAt:matched[0].startedAt,endedAt:matched[0].endedAt,finishReason:matched[0].finishReason});
  await page.locator('.private-material-sources > summary').click();await page.locator('.private-material-sources').getByText('本人上传，尚未审核',{exact:false}).first().waitFor();await page.screenshot({path:out+'/'+actor+'-sources.png'});
  const link=await page.locator('.private-material-sources a').first().getAttribute('href');assert(link.includes('docVersion=')&&link.includes('contentSha256='));
  const k01=await context.newPage();await k01.goto(base+link);const frame=k01.frameLocator('iframe[title="知识资料操作区"]');await frame.getByRole('button',{name:'抽取预览',exact:true}).click();await frame.getByText(/P02-HEAD/).first().waitFor();await k01.screenshot({path:out+'/'+actor+'-source-document.png'});await k01.close();
  await page.reload();await page.locator('.private-material-sources > summary').waitFor();const restored=await get('/sessions/'+sid+'/knowledge-state?limit=60');assert.equal(restored.messages.find(m=>m.id===answer.id)?.content,answer.content);assert.equal(restored.jobs.length,state.jobs.length);await page.screenshot({path:out+'/'+actor+'-refreshed.png'});
  if(actor==='admin'){const own=prior.uploads.find(x=>x.actor==='owner'&&x.format==='txt');assert.equal((await context.request.get(base+'/api/sessions/'+own.sessionId+'/materials?limit=20',{headers})).status(),403);}
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.equal(posts,checkpoint?0:1);
  record={...record,state:'verified',answerId:answer.id,actualTokens:billing.usage.totalTokens,reservationId:billing.reservation.id,sourceCount:4,modelCalls:1};save('checkpoint',record);passed=true;
 }
}catch(e){save('failure',{code:e.code??e.name??'ACCEPTANCE_FAILED',message:e instanceof assert.AssertionError?e.message:'See original task/checkpoint; no automatic retry',record});process.exitCode=1;}
finally{
 try{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}catch{errors.push({kind:'cleanup',message:'Diagnostic logout unconfirmed'});}
 await context.close();await browser.close();save('result',{passed,actor,record,errors,network,blocked,newUploads:0,developmentGate:false});console.log(JSON.stringify({passed,actor,record,evidence:out,errors:errors.length}));
}
