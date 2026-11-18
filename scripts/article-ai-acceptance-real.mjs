// One explicit acceptance attempt per invocation. Never auto-retry a Provider call.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
import {LocalArticleFeeGuard} from './article-ai-fee.mjs';
import {LocalArticleAcceptanceFeeGuard} from './article-ai-acceptance-fee.mjs';
import {articleModelInputProof} from './article-ai-output.mjs';
assert.equal(process.argv[2],'--execute','B08 requires explicit paid execution');
const roleArg=process.argv[3];assert(['owner','admin'].includes(roleArg));
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const budget=new LocalAiBudget(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json');
const scope={tenant:ids.tenant,group:ids.group,project:ids.project,owner:ids.owner,admin:ids.admin};
const previous=new LocalArticleFeeGuard({approvalPath:root+'.tmp/researchhub-bilingual-article-ai/b07-fee-approval.json',budget,ids:scope});
const priorFees=new LocalArticleFeeGuard({approvalPath:root+'.tmp/researchhub-bilingual-article-ai/b08-fee-approval.json',budget,ids:scope,previous});
const fees=new LocalArticleAcceptanceFeeGuard({approvalPath:root+'.tmp/researchhub-bilingual-article-ai/acceptance-fee-approval.json',budget,ids:scope,previous:priorFees});
const priorAttempts=fees.attempts().length,remainingBefore=fees.status().remainingRequests;assert(priorAttempts<5);assert(fees.status().canStart);
const out='docs/testing/evidence/article-ai-real-acceptance-'+randomUUID();mkdirSync(out,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex'),originalLedger=budget.read();
const oldFiles=[previous.approvalPath,previous.path,priorFees.approvalPath,priorFees.path,priorFees.approvalPath+'.halt.json',priorFees.approvalPath+'.resume.json'],oldHashes=oldFiles.map(f=>sha(readFileSync(f)));
const plans=[[roleArg,roleArg==='owner'?'PMC13672493':'PMC13678665']];
const preservedJobIds=[...(fees.resumption()?.baselineJobIds??fees.approval().baselineJobIds),...fees.attempts().map(a=>a.jobId)];
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const snapshot=()=>withFixtureTransaction(env,'direct',async db=>{
 const sources={};for(const t of ['pmc_candidate','pmc_candidate_version','pmc_article_decision']){const[r]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(string_agg(row_to_json(x)::text,E'\n' ORDER BY row_to_json(x)::text)) AS hash FROM rh_source.${t} x WHERE tenant_id=$1`,ids.tenant);sources[t]=r;}
 const oldJobs=await db.knowledgeChatJob.findMany({where:{id:{in:preservedJobIds}},orderBy:{id:'asc'}});
 const oldAnswers=await db.message.findMany({where:{id:{in:oldJobs.map(j=>j.assistantMessageId).filter(Boolean)}},orderBy:{id:'asc'}});
 return{sources,roles:sha(JSON.stringify(await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}))),oldJobs:sha(JSON.stringify(oldJobs)),oldAnswers:sha(JSON.stringify(oldAnswers)),active:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:{in:['queued','processing']}}})};
},{readOnly:true});
const before=await snapshot();assert.equal(before.active,0);
// Read quota before creating another task; a fee ceiling is not a Token grant.
const quota=await withFixtureTransaction(env,'direct',async db=>{
 const now=new Date(),accountId=ids[roleArg],remaining=async account=>{const where={tenantId:ids.tenant,...(account?{accountId:account}:{})},[g,u,r]=await Promise.all([db.tokenQuotaGrant.aggregate({where:{tenantId:ids.tenant,accountId:account??null},_sum:{deltaTokens:true}}),db.usageRecord.aggregate({where:{...where,usedMock:false},_sum:{totalTokens:true}}),db.tokenQuotaReservation.aggregate({where:{...where,OR:[{status:'reconciliation_required'},{status:'active',expiresAt:{gt:now}}]},_sum:{reservedTokens:true}})]);return(g._sum.deltaTokens??0n)-BigInt(u._sum.totalTokens??0)-(r._sum.reservedTokens??0n);};return{tenant:String(await remaining(null)),account:String(await remaining(accountId))};
},{readOnly:true});
assert(BigInt(quota.tenant)>=12288n&&BigInt(quota.account)>=12288n,'TOKEN_QUOTA_PREFLIGHT: no new task, Provider request or grant');
writeFileSync(out+'/intent.json',JSON.stringify({at:new Date().toISOString(),plans,approvalHash:fees.approval().approvalHash,resumeHash:fees.resumption()?.resumeHash,priorRecords:originalLedger.records.length,priorBudgetHash:sha(JSON.stringify(originalLedger)),oldHashes,before,maxNewRequests:plans.length,noRetry:true},null,2));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],results=[],network=[],errors=[],posts=[];let page,stage='';
try{
 for(const[role,pmcid]of plans){
  stage=role+'-preview';const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(ctx);
  assert.equal((await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base+'/api/'))network.push({role,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),at:new Date().toISOString()});});
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/sessions/')){posts.push({role,path:new URL(r.url()).pathname,body:r.postDataJSON(),at:new Date().toISOString()});writeFileSync(out+'/posts.json',JSON.stringify(posts,null,2));}});
  const pre=await(await ctx.request.get(base+'/api/hub-sources/article-context/pmc-'+pmcid,{headers})).json();
  assert(pre.existingSessionId,'B08 must keep original session');assert.equal(pre.execution.canStart,true,pre.execution.message);
  assert.equal(pre.evidence.policyVersion,'rh-article-evidence-v2');assert.deepEqual(pre.evidence.coverage.mapping.failedAnchors,[]);assert(pre.evidence.fragments.every(f=>f.complete));
  await page.goto(base+'/pages/e02/?recordId=pmc-'+pmcid);await page.getByRole('heading',{name:pre.title,exact:true}).waitFor();await page.getByRole('button',{name:'岐研 AI 解读',exact:true}).click();await page.locator('.article-context h3').waitFor();
  await page.getByLabel('本篇研究问题（2–100字）').fill('请仅据本篇选段作定性解读，分别说明研究类型、作者观察、测量及因果局限和研究参考价值；保留残余症状与适用范围，不复述数字，不把作者观察当已证实疗效。');
  const send=page.getByRole('button',{name:'发送本篇问题',exact:true});await page.waitForFunction(()=>!document.querySelector('.composer button[type="submit"]')?.disabled);assert(await send.isEnabled());await page.screenshot({path:out+'/'+role+'-before-send.png'});
  stage=role+'-actual-provider';console.log(JSON.stringify({stage,source:pmcid,evidence:out}));
  const submitted=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/knowledge-messages'));await send.click();const response=await submitted;assert.equal(response.status(),201);const accepted=await response.json();
  let state,task;const deadline=Date.now()+180000;
  do{const r=await ctx.request.get(base+`/api/sessions/${pre.existingSessionId}/knowledge-state?limit=60`,{headers});assert.equal(r.status(),200);state=await r.json();task=state.jobs.find(j=>j.id===accepted.id);if(task&&['completed','failed','cancelled'].includes(task.status))break;await new Promise(ok=>setTimeout(ok,1000));}while(Date.now()<deadline);
  assert.equal(task?.status,'completed',JSON.stringify(task));
  const answer=state.messages.find(m=>m.id===task.assistantMessageId);assert(answer);assert.equal(answer.meta.sourceStatus,'current');
  const pack=answer.meta.provenance.articleEvidence;assert.equal(pack.policyVersion,'rh-article-evidence-v2');assert.equal(pack.packHash,pre.packHash);assert.equal(pack.binding.recordId,'pmc-'+pmcid);assert.equal(answer.meta.provenance.hubTools[0].actualRetrieval,'ResearchHub-fixed-article-PG');
  await page.reload();await page.locator('.hub-agent-answer').waitFor();assert((await page.locator('.hub-agent-answer').innerText()).length>100);
  await page.locator('.article-context summary').click();assert.deepEqual(await page.locator('.article-fragment .article-reading').allTextContents(),pack.fragments.map(f=>f.text));
  await page.screenshot({path:out+'/'+role+'-answer-1440.png'});await page.setViewportSize({width:390,height:1000});await page.screenshot({path:out+'/'+role+'-answer-390.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const attempt=fees.attempts().find(a=>a.jobId===task.id),charge=budget.read().records.find(c=>c.id===attempt?.reservationId);assert.equal(charge?.status,'known');
  const trace=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+charge.id+'.json'));assert.equal(trace.httpStatus,200);assert(trace.usage);assert.equal(trace.jobId,task.id);assert.equal(trace.endpoint,'https://api.deepseek.com/chat/completions');
  const proof=articleModelInputProof(trace.request.messages,pack,posts.find(p=>p.role===role&&p.path.endsWith('/knowledge-messages')).body.text);assert.deepEqual(trace.articleModelInput,proof);assert.deepEqual(answer.meta.provenance.articleModelInput,proof);
  const url=new URL(page.url()),record={role,pmcid,sessionId:pre.existingSessionId,task,answer,binding:pack.binding,packHash:pack.packHash,requestKey:task.requestKey,inputHash:url.searchParams.get('inputHash'),toolTrace:answer.meta.provenance.hubTools,inputProof:proof,actualProviderMessages:trace.request.messages,provider:{model:trace.model,usage:trace.usage,startedAt:trace.startedAt,endedAt:trace.endedAt,finishReason:trace.finishReason,structuredResponse:JSON.parse(trace.response[0].message.content)},budgetCharge:charge,citationReadback:(await ctx.request.get(base+`/api/sessions/${pre.existingSessionId}/knowledge-sources/${answer.id}/1`,{headers})).status()};
  assert.equal(record.citationReadback,200);results.push(record);writeFileSync(out+'/'+role+'-result.json',JSON.stringify(record,null,2));console.log(JSON.stringify({stage:role+'-complete',jobId:task.id,conservativeMicroCny:charge.costMicroCny}));
 }
 const cross=[],other=await browser.newContext();contexts.push(other);const otherRole=roleArg==='admin'?'owner':'admin';assert.equal((await other.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:otherRole+'@example.org',password}})).status(),201);const crossResponse=await other.request.get(base+`/api/sessions/${results[0].sessionId}/knowledge-state?limit=60`,{headers});assert([403,404].includes(crossResponse.status()));cross.push({actor:otherRole,status:crossResponse.status()});
 assert.deepEqual(errors,[]);assert.equal(posts.filter(p=>p.path.endsWith('/knowledge-messages')).length,plans.length);
 const ledger=budget.read();assert.deepEqual({...ledger,records:ledger.records.slice(0,originalLedger.records.length)},originalLedger);assert.equal(ledger.records.length,originalLedger.records.length+1);assert.equal(fees.attempts().length,priorAttempts+1);assert.equal(fees.status().remainingRequests,remainingBefore-1);assert(ledger.records.every(r=>r.status==='known'));assert.deepEqual(oldFiles.map(f=>sha(readFileSync(f))),oldHashes);
 const after=await snapshot();assert.deepEqual(after,before);
 const totalTaskCount=await withFixtureTransaction(env,'direct',db=>db.knowledgeChatJob.count({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,OR:[{id:{in:fees.approval().baselineJobIds}},...['rh-article-evidence-v1','rh-article-evidence-v2'].map(equals=>({payload:{path:['articleEvidence','policyVersion'],equals}}))]}}),{readOnly:true});
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),results:results.map(({answer,...r})=>({...r,answerId:answer.id})),network,errors,posts,cross,before,after,newProviderRequests:plans.length,newTasks:plans.length,totalRequestCount:fees.status().requests,totalTaskCount,budget:fees.status().budget,priorLedgerPreserved:true,originalB07FilesPreserved:true,professionalAcceptance:'pending separate claim audit and researcher signoff'},null,2));
 console.log(JSON.stringify({passed:true,evidence:out,budget:budget.status()}));
}catch(e){/* Keep every failed task and known charge; this invocation never retries. */writeFileSync(out+'/failure.json',JSON.stringify({stage,message:e.message,network,errors,posts,completed:results.map(r=>r.task.id),budget:budget.status(),attempts:fees.attempts()},null,2));await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,message:e.message,evidence:out}));process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await browser.close();}

