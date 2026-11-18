// Free diagnosis of the already-paid response. Never replay the Provider or publish repaired text.
import assert from'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync,mkdtempSync}from'node:fs';
import{createHash,randomUUID}from'node:crypto';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';
import{assertFixtureTarget,withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
import{parseCrfMethodInterpretation}from'./synthetic-crf-methods-ai-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--free']);
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-knowledge-local/',r=JSON.parse(readFileSync(dir+'runtime.json')),fixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/ai-fixtures.json')),ledgerPath=dir+'ai-budget-20261022.json',ledgerText=readFileSync(ledgerPath,'utf8'),ledger=JSON.parse(ledgerText),last=ledger.records.at(-1),trace=JSON.parse(readFileSync(dir+'ai-traces/'+last.id+'.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);assert.equal(ledger.records.length,76);assert.equal(last.status,'known');assert.equal(trace.httpStatus,200);assert.equal(trace.finishReason,'stop');
const key='ai-output-check-'+randomUUID().slice(0,8),out=root+'docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/'+key+'/';mkdirSync(out,{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,chrome=pw.chromium??pw.default.chromium,checks=[],errors=[],held='AI解读暂缓：本轮真实模型回答缺少正文来源编号，已拒绝交付；费用已留痕，不自动重试。';
async function json(res,status){assert.equal(res.status(),status,await res.text());return res.json();}
try{
 for(const actor of['owner','admin']){
  const f=fixtures[actor],headers={'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project},c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:headers});
  try{
   await json(await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}}),201);
   const{run}=await json(await c.get(f.endpoint),200);assert.equal(run.status,'needs_review');assert.equal(run.sourceStatus,'current');assert.equal(run.explanation,null);assert.equal(run.actions.canInterpret,false);
   const original=await withFixtureTransaction(env,'direct',tx=>tx.researchMethodRun.findFirst({where:{id:f.runId,tenantId:r.ids.tenant,accountId:r.ids[actor]}}),{readOnly:true});assert(original);
   if(actor==='owner'){
    assert.equal(run.job.id,trace.jobId);assert.equal(run.job.status,'failed');assert.equal(run.job.errorCode,'CRF_AI_OUTPUT_INVALID');
    const job=await withFixtureTransaction(env,'direct',tx=>tx.knowledgeChatJob.findFirst({where:{id:trace.jobId,tenantId:r.ids.tenant,studyGroupId:r.ids.group,researchProjectId:r.ids.project,accountId:r.ids.owner,sessionId:original.sessionId}}),{readOnly:true});assert(job&&!job.assistantMessageId);const task=job.payload.researchCrfMethods,packet=await json(await c.get(f.path),200),modelView=JSON.parse(trace.request.messages[1].content.split('可信定性方法与非数值摘录：')[1]),answer=trace.response[0].message.content;
    assert.throws(()=>parseCrfMethodInterpretation(answer,{ids:task.evidenceIds,config:packet.config,modelView}),e=>e.message==='CRF_AI_CITATION_INVALID');
    const diagnostic=JSON.parse(answer);for(const item of diagnostic.items)item.explanation+=item.sourceRefs.map(s=>'['+(s.kind==='method'?'M':'')+s.index+']').join('');
    assert(parseCrfMethodInterpretation(JSON.stringify(diagnostic),{ids:task.evidenceIds,config:packet.config,modelView}));
    // Diagnostic strings stay private to this script. They are NOT written as an assistant or business output.
    const body={baseRunVersion:task.baseRunVersion,resultHash:task.binding.resultHash,evidenceIds:task.evidenceIds,requestKey:task.requestKey};const duplicate=await json(await c.post(f.endpoint+'/interpretation-jobs',{data:body}),201);assert.equal(duplicate.operation.jobId,job.id);assert.equal(duplicate.run.job.status,'failed');assert.equal((await c.post(f.endpoint+'/interpretation-jobs',{data:{...body,evidenceIds:body.evidenceIds.slice(0,1)}})).status(),409);
    const runtime=JSON.parse(readFileSync(dir+'ai-traces/'+job.id+'-runtime.json'));assert(runtime.tools.length===1&&runtime.tools[0].tool==='kb_search');assert.equal(runtime.result.provenance.kbAnswerFastPath,true);
    writeFileSync(out+'diagnosis.json',JSON.stringify({providerActuallyExecuted:true,httpStatus:trace.httpStatus,model:trace.model,finishReason:trace.finishReason,usage:last.usage,costMicroCny:last.costMicroCny,jobId:job.id,resultMessageId:null,reason:'CRF_AI_CITATION_INVALID',structuredReferencesPresent:true,inlineReferencesMissing:true,diagnosticOnlyAfterAddingInlineRefsAccepted:true,diagnosticTextPublished:false,actualTool:runtime.tools[0],requestHash:createHash('sha256').update(JSON.stringify(trace.request)).digest('hex')},null,2));checks.push('actual-tool-and-provider-known-output-rejected-no-assistant-same-key-idempotent');
   }
   const denied=await c.post(f.endpoint+'/interpretation-jobs',{data:{baseRunVersion:run.runVersion,resultHash:run.resultHash,evidenceIds:run.result.evidenceGroups.slice(0,2).map(g=>g.evidenceId),requestKey:key+'-'+actor}});assert.equal(denied.status(),403);assert.equal((await denied.json()).code,'CRF_AI_NOT_APPROVED');
   assert.deepEqual(await withFixtureTransaction(env,'direct',tx=>tx.researchMethodRun.findUnique({where:{id:f.runId}}),{readOnly:true}),original);
  }finally{await c.dispose();}
  const browser=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/wp07-output-hold-'),{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:900},recordVideo:{dir:out+actor+'-video',size:{width:1440,height:900}}});
  const p=await browser.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
  try{
   await json(await browser.request.post('http://127.0.0.1:19501/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}}),201);
   await p.goto('http://127.0.0.1:19501/pages/s06/?'+new URLSearchParams({crfMethods:'1',studyGroupId:r.ids.group,researchProjectId:r.ids.project,researchPlanId:f.planId,collectionId:f.collectionId,runId:f.runId}));await p.getByText(held,{exact:true}).waitFor();assert(await p.getByRole('button',{name:'发起AI方法解读（计入累计预算）',exact:true}).isDisabled());assert.equal(await p.getByRole('region',{name:'真实AI方法解释',exact:true}).count(),0);
   for(const width of[1440,390,320]){await p.setViewportSize({width,height:900});await p.getByText(held,{exact:true}).scrollIntoViewIfNeeded();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await p.locator('.crf-ai-choice span').first().evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight})),{size:'14px',line:'22px'});await p.screenshot({path:out+actor+'-'+width+'.png',fullPage:true});}
   checks.push(actor+'-real-Chrome-current-method-readable-explicit-output-hold-and-no-failed-prose');
  }catch(e){await p.screenshot({path:out+actor+'-failure.png',fullPage:true});throw e;}finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);assert.equal(readFileSync(ledgerPath,'utf8'),ledgerText);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,newModelCalls:0,ledgerUnchanged:true,notD05Acceptance:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,newModelCalls:0,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message,errors,newModelCalls:0},null,2));throw e;}finally{assert.equal(readFileSync(ledgerPath,'utf8'),ledgerText);}
