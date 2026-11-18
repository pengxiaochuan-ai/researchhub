// Free readback of a failed real B08 attempt; no Provider calls or retry.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {articleEvidenceHref} from '../src/article-ai-session.js';import {assertArticleQualitativeAnswer} from './article-ai-output.mjs';
const source=process.argv[2];assert(/^docs\/testing\/evidence\/article-ai-real-b08-[a-f0-9-]+$/.test(source??''));
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const original='docs/testing/evidence/article-ai-real-b07-8264b496-4382-4391-bf5f-b00db15c7924',intent=JSON.parse(readFileSync(source+'/intent.json')),failure=JSON.parse(readFileSync(source+'/failure.json'));
assert.equal(failure.attempts.length,1);assert.equal(failure.posts.length,1);
const approval=JSON.parse(readFileSync(root+'.tmp/researchhub-bilingual-article-ai/b08-fee-approval.json')),attempt=failure.attempts[0],trace=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+attempt.reservationId+'.json'));
const out='docs/testing/evidence/article-ai-b08-failed-readback-'+randomUUID();mkdirSync(out,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex'),ledgerPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledgerBefore=sha(readFileSync(ledgerPath)),ledger=JSON.parse(readFileSync(ledgerPath));
assert.equal(ledger.records.length,92);assert(ledger.records.every(r=>r.status==='known'));assert.equal(sha(JSON.stringify({...ledger,records:ledger.records.slice(0,91)})),intent.priorBudgetHash);
assert.deepEqual([root+'.tmp/researchhub-bilingual-article-ai/b07-fee-approval.json',root+'.tmp/researchhub-bilingual-article-ai/b07-fee-approval.json.attempts.json'].map(p=>sha(readFileSync(p))),intent.oldHashes);
const dbEvidence=await withFixtureTransaction(env,'direct',async db=>{
 const job=await db.knowledgeChatJob.findUnique({where:{id:attempt.jobId}});assert.equal(job.status,'failed');assert.equal(job.errorMessage,'ARTICLE_AI_NUMERIC_REJECTED');assert.equal(job.assistantMessageId,null);
 const oldJobs=await db.knowledgeChatJob.findMany({where:{id:{in:approval.baselineJobIds}},orderBy:{id:'asc'}}),oldAnswers=await db.message.findMany({where:{id:{in:oldJobs.map(j=>j.assistantMessageId).filter(Boolean)}},orderBy:{id:'asc'}});
 for(const role of ['owner','admin']){const saved=JSON.parse(readFileSync(original+'/'+role+'-result.json')),old=oldJobs.find(j=>j.id===saved.task.id);for(const k of ['id','status','requestKey','userMessageId','assistantMessageId'])assert.equal(old[k],saved.task[k]);assert.equal(old.payload.articleInputHash,saved.task.inputHash);assert.equal(oldAnswers.find(m=>m.id===saved.answer.id).content,saved.answer.content);}
 const sources={};for(const t of ['pmc_candidate','pmc_candidate_version','pmc_article_decision']){const[r]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(string_agg(row_to_json(x)::text,E'\n' ORDER BY row_to_json(x)::text)) AS hash FROM rh_source.${t} x WHERE tenant_id=$1`,ids.tenant);sources[t]=r;}
 return{job,oldJobsHash:sha(JSON.stringify(oldJobs)),oldAnswersHash:sha(JSON.stringify(oldAnswers)),sources,rolesHash:sha(JSON.stringify(await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}))),active:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:{in:['queued','processing']}}})};
},{readOnly:true});
assert.equal(dbEvidence.active,0);const content=trace.response[0].message.content;assert.throws(()=>assertArticleQualitativeAnswer(content,dbEvidence.job.payload.articleEvidence),/ARTICLE_AI_NUMERIC_REJECTED/);
const freeGate=JSON.parse(readFileSync('docs/testing/evidence/article-ai-gates-b2ff51a0-a89f-46ae-a6a9-5697ce6fcae5/result.json'));assert.equal(dbEvidence.rolesHash,freeGate.after.roles);for(const [t,value]of Object.entries(dbEvidence.sources))assert.deepEqual(value,freeGate.after.sources[t]);
writeFileSync(out+'/rejected-response.json',JSON.stringify({notDelivered:true,jobId:attempt.jobId,error:dbEvidence.job.errorMessage,content,pack:dbEvidence.job.payload.articleEvidence,actualProviderMessages:trace.request.messages,actualInputFragments:dbEvidence.job.payload.articleEvidence.fragments.map(f=>({id:f.id,role:f.role,fullyPresent:trace.request.messages.some(m=>m.content.includes(f.text))})),provider:{model:trace.model,httpStatus:trace.httpStatus,usage:trace.usage,finishReason:trace.finishReason,startedAt:trace.startedAt,endedAt:trace.endedAt},charge:ledger.records.at(-1)},null,2));
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),contexts=[],checks=[],errors=[],mutations=[];let page;
try{
 for(const role of ['owner','admin']){
  const saved=JSON.parse(readFileSync(original+'/'+role+'-result.json')),ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(ctx);
  assert.equal((await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  await ctx.route('**/api/**',rt=>{if(!['GET','HEAD'].includes(rt.request().method())){mutations.push(new URL(rt.request().url()).pathname);return rt.abort();}return rt.continue();});
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const current=await(await ctx.request.get(base+'/api/hub-sources/article-context/pmc-'+saved.pmcid,{headers})).json();assert.equal(current.execution.canStart,false);assert.equal(current.execution.code,'ARTICLE_VALIDATION_HALTED');assert.equal(current.execution.requests,13);assert.equal(current.execution.remainingRequests,1);
  if(role==='owner'){
   await page.goto(base+'/pages/ai01/?'+new URLSearchParams({articleId:saved.binding.recordId,requestKey:dbEvidence.job.requestKey,inputHash:dbEvidence.job.payload.articleInputHash}));
   await page.getByText('本次任务失败或来源失效，未交付解读；不会自动重试。',{exact:true}).waitFor();assert.equal(await page.locator('.hub-agent-answer').count(),0);
   await page.screenshot({path:out+'/owner-failed-1440.png'});await page.reload();await page.getByText('本次任务失败或来源失效，未交付解读；不会自动重试。',{exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isDisabled());await page.setViewportSize({width:390,height:1000});await page.screenshot({path:out+'/owner-failed-390.png',fullPage:true});
  }
  await page.goto(base+'/pages/ai01/?'+new URLSearchParams({articleId:saved.binding.recordId,requestKey:saved.requestKey,inputHash:saved.inputHash}));await page.locator('.hub-agent-answer').waitFor();
  assert(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isDisabled());
  await page.locator('.article-context summary').click();assert.deepEqual(await page.locator('.article-fragment .article-reading').allTextContents(),saved.answer.meta.provenance.articleEvidence.fragments.map(f=>f.text));
  await page.screenshot({path:out+'/'+role+'-old-preserved.png'});await page.reload();await page.locator('.hub-agent-answer').waitFor();
  const state=await(await ctx.request.get(base+`/api/sessions/${saved.sessionId}/knowledge-state?limit=60`,{headers})).json();assert.equal(state.messages.find(m=>m.id===saved.answer.id).content,saved.answer.content);
  const pack=role==='owner'?dbEvidence.job.payload.articleEvidence:current.evidence,fragment=pack.fragments.find(f=>f.role===(role==='owner'?'limitations':'topic'));
  await page.goto(base+articleEvidenceHref(pack.binding,fragment));await page.locator('.article-evidence-mark').waitFor();assert.equal((await page.locator('.article-evidence-mark').textContent()).replace(/\s+/g,' ').trim(),fragment.text);
  await page.locator('.article-evidence-mark').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-v2-source.png'});
  const sent=role==='owner'?failure.posts[0].body:JSON.parse(readFileSync(original+'/posts.json')).find(p=>p.role==='admin'&&p.path.endsWith('/knowledge-messages')).body;
  const replay=await ctx.request.post(base+`/api/sessions/${saved.sessionId}/knowledge-messages`,{headers,data:sent});assert.equal(replay.status(),201);assert.equal((await replay.json()).id,role==='owner'?attempt.jobId:saved.task.id);
  const denied=await ctx.request.post(base+`/api/sessions/${saved.sessionId}/knowledge-messages`,{headers,data:{...sent,requestKey:'b08-halted-'+randomUUID()}});assert.equal(denied.status(),429);
  checks.push({role,halted:true,newKey:denied.status(),sameKey:replay.status(),oldAnswerPreserved:true,oldPackDisplayed:true,sourcePositionVerified:true,...(role==='owner'?{failedTaskRestored:true,noRejectedAnswerDelivered:true}:{})});
 }
 const cross=await contexts[1].request.get(base+failure.posts[0].path.replace('/knowledge-messages','/knowledge-state?limit=60'),{headers});assert([403,404].includes(cross.status()));
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);assert.equal(sha(readFileSync(ledgerPath)),ledgerBefore);
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,errors,mutations,crossAccountStatus:cross.status(),newProviderRequests:0,ledgerUnchanged:true,original91Preserved:true,originalB07FilesPreserved:true,newTasks:1,totalTasks:14,totalRequests:13,unusedRequests:1,unusedRequestPaused:true,spentMicroCny:ledger.records.reduce((n,r)=>n+r.costMicroCny,0),heldMicroCny:0,dbEvidence:{...dbEvidence,job:undefined}},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({message:e.message,checks,errors,mutations},null,2));await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
