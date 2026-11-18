// Explicit storage-fix approval only. No Provider, quote refresh, recovery scan or old scope change.
import assert from'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{randomUUID}from'node:crypto';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';
import{assertFixtureTarget,withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
import{resumeCrfMethodsAi,approveCrfFourthRequest}from'./synthetic-crf-methods-ai-approval.mjs';
import{crfMethodsTask}from'./synthetic-crf-methods-ai-contract.mjs';
assert.equal(process.argv.length,3);const mode=process.argv[2];assert(['--approved-storage-resume','--approved-four-call-plan'].includes(mode));
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-knowledge-local/',f=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/ai-fixtures.json')),r=JSON.parse(readFileSync(dir+'runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);assert.deepEqual(Object.keys(f).sort(),['admin','inflight','owner']);
const paths={ledgerPath:dir+'ai-budget-20261022.json',scopePath:dir+'wp07-scope.json',receiptPath:dir+'wp07-ai-approval-20261025.json',markerPath:root+'.tmp/researchhub-wp07-crf-methods/wp07-paid-round-started.json'};
const result=mode==='--approved-four-call-plan'?await approveCrfFourthRequest({...paths,extensionPath:dir+'wp07-ai-call-extension-20261026.json',approval:'2026-10-26-user-WP07-four-total-requests-original-CNY5-no-topup',verifyRecordedFailure:()=>withFixtureTransaction(env,'direct',async tx=>{
 const ledger=JSON.parse(readFileSync(paths.ledgerPath));assert.equal(ledger.records.length,76);const record=ledger.records.at(-1),trace=JSON.parse(readFileSync(dir+'ai-traces/'+record.id+'.json'));assert.equal(record.status,'known');assert.equal(record.costMicroCny,12051);assert.equal(trace.httpStatus,200);assert.equal(trace.finishReason,'stop');
 const fixture=f.owner,run=await tx.researchMethodRun.findFirst({where:{id:fixture.runId,tenantId:r.ids.tenant,studyGroupId:r.ids.group,researchProjectId:r.ids.project,accountId:r.ids.owner,status:'needs_review'}});assert(run);
 const j=await tx.knowledgeChatJob.findFirst({where:{id:trace.jobId,tenantId:r.ids.tenant,studyGroupId:r.ids.group,researchProjectId:r.ids.project,accountId:r.ids.owner,sessionId:run.sessionId}});assert(j&&j.status==='failed'&&j.errorCode==='CRF_AI_OUTPUT_INVALID'&&!j.assistantMessageId);const task=crfMethodsTask(j.payload);assert.equal(task.binding.runId,run.id);assert.equal(task.binding.inputHash,run.inputHash);assert.equal(task.binding.planId,fixture.planId);assert.equal(task.binding.collectionId,fixture.collectionId);return true;
},{readOnly:true})}).then(extension=>({resumed:true,maxNewRequests:extension.maxNewRequests,alreadyUsed:1,remainingRequests:3,originalQuotePreserved:true})):await resumeCrfMethodsAi({...paths,approval:'2026-10-25-user-approved-minimal-terminal-storage-fix',verifyUnconsumed:()=>withFixtureTransaction(env,'direct',async tx=>{
 for(const fixture of Object.values(f)){
  const accountId=r.ids[fixture.actor],run=await tx.researchMethodRun.findFirst({where:{id:fixture.runId,tenantId:r.ids.tenant,studyGroupId:r.ids.group,researchProjectId:r.ids.project,accountId,status:'needs_review'}});assert(run);
  const jobs=await tx.knowledgeChatJob.findMany({where:{tenantId:r.ids.tenant,studyGroupId:r.ids.group,researchProjectId:r.ids.project,accountId,sessionId:run.sessionId,payload:{path:['researchCrfMethods','binding','runId'],equals:run.id}},take:10});
  assert(jobs.length<10);for(const j of jobs)assert(j.status==='failed'&&j.errorCode==='CONTROLLED_FREE_QUEUE_TEST'&&j.attempts===0&&!j.assistantMessageId,'UNCONSUMED_ROUND_NOT_PROVEN');
 }
 return true;
},{readOnly:true})});
const out=root+'docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/storage-resume-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});writeFileSync(out+'result.json',JSON.stringify({...result,actualJobMetadataVerified:true,modelCalls:0,quoteRenewed:false},null,2));console.log(JSON.stringify({...result,evidence:out,modelCalls:0}));
