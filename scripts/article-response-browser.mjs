// Default: explicitly labeled free fault-injection UI check. --send-one: one
// deliberate real verification request, no retries and no product spending cap.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {parseArticleResponse,verifyArticleResponse} from './article-response-policy.mjs';
const real=process.argv[2]==='--send-one';assert(process.argv.length===2||real&&process.argv.length===3);
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),sample=JSON.parse(readFileSync('docs/testing/fixtures/article-response-sjogren-2026-11-06.json'));
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);
const direct=cb=>withFixtureTransaction(env,'direct',cb,{readOnly:true}),hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledgerHash=hash(readFileSync(ledger,'utf8'));
const old=await direct(db=>db.knowledgeChatJob.findUnique({where:{id:sample.taskId}}));assert.equal(old.tenantId,rt.ids.tenant);assert.equal(old.status,'failed');
const before=await direct(async db=>({jobIds:(await db.knowledgeChatJob.findMany({where:{tenantId:rt.ids.tenant},select:{id:true}})).map(j=>j.id),reservationIds:(await db.tokenQuotaReservation.findMany({where:{tenantId:rt.ids.tenant},select:{id:true}})).map(r=>r.id),grants:await db.tokenQuotaGrant.findMany({where:{tenantId:rt.ids.tenant}})}));
const snapshot=()=>direct(async db=>({jobs:hash(await db.knowledgeChatJob.findMany({where:{id:{in:before.jobIds}},orderBy:{id:'asc'}})),reservations:hash(await db.tokenQuotaReservation.findMany({where:{id:{in:before.reservationIds}},orderBy:{id:'asc'}})),grants:hash(await db.tokenQuotaGrant.findMany({where:{tenantId:rt.ids.tenant},orderBy:{id:'asc'}}))}));
const protectedBefore=await snapshot(),out='docs/testing/evidence/article-response-'+(real?'real-':'free-')+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),contexts=[],errors=[],network=[],checks=[];
const headers={'X-Study-Group-Id':rt.ids.group,'X-Research-Project-Id':rt.ids.project};let page,job,answer,stage='login';
const json=async r=>{assert(r.ok(),'HTTP '+r.status());return r.json();};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(c);await json(await c.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}}));
 const raw=structuredClone(sample.response);raw.observations.text+='治疗8周后评分降至七。';raw.relevance.kind='hypothesis';const injected=parseArticleResponse(JSON.stringify(raw),sample.pack);
 await c.route('**/api/**',async route=>{
  const req=route.request();network.push({method:req.method(),path:new URL(req.url()).pathname});
  if(!real&&!['GET','HEAD'].includes(req.method()))return route.abort();
  if(!real&&new URL(req.url()).pathname==='/api/sessions/'+old.sessionId+'/knowledge-state'){
   const r=await route.fetch(),state=await r.json(),id='FREE_UI_ONLY_NOT_A_REAL_MODEL_RESULT';
   state.jobs=state.jobs.map(j=>j.id===old.id?{...j,status:'completed',errorCode:null,assistantMessageId:id}:j);
   state.messages.push({id,role:'assistant',content:injected.text,meta:{sourceStatus:'current',provenance:{articleEvidence:sample.pack,articleResponseValidation:injected.validation}}});
   return route.fulfill({response:r,json:state});
  }return route.continue();
 });
 page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
 const originalUrl=base+'/pages/ai01/?'+new URLSearchParams({articleId:sample.pack.binding.recordId,requestKey:old.requestKey,inputHash:old.payload.articleInputHash});await page.goto(originalUrl);
 if(real){
  await page.getByRole('alert').filter({hasText:'数值未通过来源与语境核验'}).waitFor();assert.equal(await page.getByLabel('本篇研究问题（2–100字）').inputValue(),old.text);await page.screenshot({path:out+'/original-failure-preserved.png',fullPage:true});
  stage='business-token-preview';assert((await json(await c.request.get(base+'/api/hub-sources/article-context/'+sample.pack.binding.recordId,{headers}))).execution.canStart,'BUSINESS_TOKEN_NOT_READY');
  stage='one-real-request';const posted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/knowledge-messages'));await page.getByRole('button',{name:'发送本篇问题',exact:true}).click();const sent=await json(await posted);
  let state;for(let n=0;n<90;n++){state=await json(await c.request.get(base+'/api/sessions/'+old.sessionId+'/knowledge-state?limit=60',{headers}));job=state.jobs.find(j=>j.id===sent.id);if(['completed','failed'].includes(job?.status))break;await new Promise(r=>setTimeout(r,1000));}
  answer=state.messages.find(m=>m.id===job?.assistantMessageId);writeFileSync(out+'/real-result.json',JSON.stringify({job,answer},null,2));assert.equal(job?.status,'completed',job?.errorCode??'NOT_COMPLETED');assert.equal(answer.meta.usedMock,false);const p=answer.meta.provenance;assert.equal(p.articleModelInput.responsePolicyVersion,'rh-article-response.v3');verifyArticleResponse(p.articleResponseValidation,p.articleEvidence,answer.content);
  const billing=await direct(async db=>{const r=await db.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:rt.ids.tenant,requestKey:'chat:'+old.sessionId+':'+job.requestKey}}}),u=await db.usageRecord.findFirst({where:{tenantId:rt.ids.tenant,messageId:answer.id}});assert.equal(r.status,'settled');assert.equal(Number(r.actualTokens),answer.meta.usage.totalTokens);assert.equal(u.totalTokens,answer.meta.usage.totalTokens);return{status:r.status,actualTokens:String(r.actualTokens),reservationId:r.id,usageRecordId:u.id};});writeFileSync(out+'/billing-readback.json',JSON.stringify(billing,null,2));checks.push({actualTask:job.id,usage:answer.meta.usage.totalTokens,billing});
  await page.getByRole('button',{name:'查看状态',exact:true}).click();
 }
 stage=real?'real-readback':'free-injected-local-warning';await page.locator('.hub-agent-answer').waitFor();const area=page.locator('.hub-agent-answer');assert.match(await area.innerText(),/AI基于本次选段/);
 if(!real){assert.match(await area.innerText(),/Th17\/Treg/);assert.match(await area.innerText(),/2025年meta分析/);assert.match(await area.innerText(),/待核对/);assert(!(await area.innerText()).includes('治疗8周后评分降至七'));await area.getByText(/待核对：相关句含/).first().scrollIntoViewIfNeeded();checks.push('FREE_FAULT_INJECTION_not_actual_model_or_saved_answer');}
 await page.screenshot({path:out+'/response-1440.png',fullPage:true});await page.reload();await page.locator('.hub-agent-answer').waitFor();assert.match(await area.innerText(),/AI基于本次选段/);const font=await area.locator('p').first().evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(font,{size:'16px',line:'28px'});
 await page.setViewportSize({width:390,height:1000});await area.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/response-390.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push('refresh-no-auto-send-16/28-1440/390-no-horizontal-overflow');
 const owner=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(owner);await json(await owner.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:'owner@example.org',password:rt.password}}));const denied=await owner.request.get(base+'/api/sessions/'+old.sessionId+'/knowledge-state?limit=60',{headers});assert([403,404].includes(denied.status()));checks.push('owner-denied-admin-session');
 assert.deepEqual(await snapshot(),protectedBefore);assert.equal(hash(readFileSync(ledger,'utf8')),ledgerHash);assert.deepEqual(errors,[]);if(!real)assert(network.every(n=>['GET','HEAD'].includes(n.method)));
 const traces=[];if(real)for(const file of readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces')){if(!file.endsWith('.json'))continue;const t=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+file));if(t.jobId===job.id&&t.request)traces.push({file,httpStatus:t.httpStatus,startedAt:t.startedAt,model:t.model,usage:t.usage});}if(real){assert.equal(traces.length,1);assert.equal(traces[0].httpStatus,200);assert.equal(traces[0].usage.total_tokens,answer.meta.usage.totalTokens);}writeFileSync(out+'/provider-evidence.json',JSON.stringify({expectedProviderCalls:real?1:0,actualProviderCalls:traces.length,traces},null,2));
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),mode:real?'real-provider':'free-fault-injection',expectedProviderCalls:real?1:0,actualProviderCalls:traces.length,checks,errors,network,protectedHistoryUnchanged:true,grantsUnchanged:true,oldLedgerUnchanged:true},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({stage,error:e.message,job,checks,errors},null,2));await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,error:e.message,evidence:out,job:job?.id}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
