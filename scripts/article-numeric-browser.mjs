// A deliberate verification run, not a product task/price gate. No automatic retries.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {verifyArticleNumericEvidence} from './article-numeric-evidence.mjs';
assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--send-one');
const send=process.argv[2]==='--send-one',root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',oldId='cmw3h3yit000mluhbcq0fwu0r',rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);
const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledgerHash=digest(readFileSync(ledger,'utf8'));
const snapshot=()=>withFixtureTransaction(env,'direct',async db=>{const j=await db.knowledgeChatJob.findUnique({where:{id:oldId}});assert.equal(j.tenantId,rt.ids.tenant);const r=await db.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:rt.ids.tenant,requestKey:'chat:'+j.sessionId+':'+j.requestKey}}});return{job:j,oldJobHash:digest(j),oldReservationHash:digest(r),grantCount:await db.tokenQuotaGrant.count({where:{tenantId:rt.ids.tenant}})};},{readOnly:true});
const before=await snapshot(),out='docs/testing/evidence/article-numeric-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),contexts=[],checks=[],errors=[];
const headers={'X-Study-Group-Id':rt.ids.group,'X-Research-Project-Id':rt.ids.project};let page,stage='login',newTask;
const json=async response=>{assert(response.ok(),'HTTP '+response.status());return response.json();};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(c);await json(await c.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}}));
 await c.route('**/api/**',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
 page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=base+'/pages/ai01/?'+new URLSearchParams({articleId:'pmc-PMC13672493',requestKey:before.job.requestKey,inputHash:before.job.payload.articleInputHash});
 await page.goto(url);await page.getByRole('alert').filter({hasText:'数值未通过来源与语境核验'}).waitFor();assert.equal(await page.getByLabel('本篇研究问题（2–100字）').inputValue(),before.job.text);assert.equal(await page.locator('.hub-agent-answer').count(),0);await page.screenshot({path:out+'/admin-original-failure.png',fullPage:true});
 await page.reload();await page.getByRole('alert').filter({hasText:'数值未通过来源与语境核验'}).waitFor();checks.push('real-original-failed-task-safe-reason-and-refresh-no-model');
 if(send){
  stage='one-real-admin-send';await c.unroute('**/api/**');
  await page.getByLabel('本篇研究问题（2–100字）').fill('请解读本篇研究的设计、主要发现、局限及对针灸防治情志病研究的参考价值，并附一项原文数值依据。');
  const sent=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/knowledge-messages'));
  await page.getByRole('button',{name:'发送本篇问题',exact:true}).click();newTask=await json(await sent);
  let state,job;for(let n=0;n<90;n++){state=await json(await c.request.get(base+'/api/sessions/'+before.job.sessionId+'/knowledge-state?limit=60',{headers}));job=state.jobs.find(j=>j.id===newTask.id);if(['completed','failed'].includes(job?.status))break;await new Promise(r=>setTimeout(r,1000));}
  const answer=state.messages.find(m=>m.id===job?.assistantMessageId);writeFileSync(out+'/real-result.json',JSON.stringify({job,answer,quota:state.quota},null,2));assert.equal(job?.status,'completed',job?.errorCode??'not completed');assert.equal(answer?.meta?.usedMock,false);
  const p=answer.meta.provenance;assert.equal(p.articleModelInput.numericPolicyVersion,'rh-article-numeric-evidence.v1');assert(p.articleNumericEvidence.length>0);verifyArticleNumericEvidence(p.articleNumericEvidence,p.articleEvidence);assert.match(answer.content,/原文数值依据/);assert.match(answer.content,/一例|单病例/);
  await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.locator('.hub-agent-answer').waitFor();await page.screenshot({path:out+'/admin-real-1440.png',fullPage:true});await page.reload();await page.locator('.hub-agent-answer').waitFor();assert((await page.locator('.hub-agent-answer').innerText()).includes('原文数值依据'));
  const font=await page.locator('.hub-agent-answer p').first().evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(font,{size:'16px',line:'28px'});
  await page.setViewportSize({width:390,height:1000});await page.screenshot({path:out+'/admin-real-390.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const receipt=await withFixtureTransaction(env,'direct',async db=>{const r=await db.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:rt.ids.tenant,requestKey:'chat:'+before.job.sessionId+':'+job.requestKey}}}),u=await db.usageRecord.findFirst({where:{tenantId:rt.ids.tenant,messageId:answer.id}});assert.equal(r.status,'settled');assert.equal(Number(r.actualTokens),answer.meta.usage.totalTokens);assert.equal(u.totalTokens,answer.meta.usage.totalTokens);return{reservationId:r.id,status:r.status,reservedTokens:r.reservedTokens.toString(),actualTokens:r.actualTokens.toString(),usageRecordId:u.id};},{readOnly:true});writeFileSync(out+'/billing-readback.json',JSON.stringify(receipt,null,2));checks.push({task:job.id,actualUsage:answer.meta.usage.totalTokens,numericFacts:p.articleNumericEvidence.length,receipt});
 }
 const owner=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/owner-video'}});contexts.push(owner);await json(await owner.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:'owner@example.org',password:rt.password}}));const denied=await owner.request.get(base+'/api/sessions/'+before.job.sessionId+'/knowledge-state?limit=60',{headers});assert([403,404].includes(denied.status()));checks.push('owner-cannot-read-admin-case-session');
 const after=await snapshot();for(const k of ['oldJobHash','oldReservationHash','grantCount'])assert.equal(after[k],before[k]);assert.equal(digest(readFileSync(ledger,'utf8')),ledgerHash);assert.deepEqual(errors,[]);
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,errors,newActualTasks:send?1:0,oldJobUnchanged:true,oldReservationUnchanged:true,grantsUnchanged:true,oldLedgerUnchanged:true},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({stage,error:e.message,newTask,checks,errors},null,2));await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,error:e.message,evidence:out,newTaskId:newTask?.id}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
