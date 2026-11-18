// Exactly one user-approved synthetic interrupted task; no model calls or requeue.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {verifyInterruptedClose} from './smart-search-interrupted-close-contract.mjs';
import {sealExecution,verifiedUsage} from '../server/billing/attempts.mjs';
import {createHubBilling} from '../server/billing/service.mjs';
process.umask(0o077);
const action=process.argv[2];assert(['--preflight','--apply'].includes(action)&&process.argv.length===3);
const root='/Users/mac/aisciencesys/',jobId='cmwcw7u280005luyi1na8t4wf',reservationId='cmwcw7utc0008luyicjlle5f9',requestKey='smart-grounding-close-'+jobId,out='.tmp/smart-search-grounding-2026-11-12/close/';mkdirSync(out,{recursive:true});
const {ids,key}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const originalPath=root+'.tmp/researchhub-knowledge-local/ai-traces/37122bb8-1e60-4fb9-8410-df516fec10d7.json',trace=JSON.parse(readFileSync(originalPath));assert.equal(trace.endpoint,'https://api.deepseek.com/chat/completions');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {recoverExpiredClaim}=require(root+'app/server/src/common/worker-claim.ts'),{parseDeploymentScope}=require(root+'app/server/src/common/deployment-scope.ts');
const scope=parseDeploymentScope({DEPLOYMENT_ID:key,DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:'knowledge-chat'});
const read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true}),transaction=fn=>withFixtureTransaction(env,'direct',fn),digest=v=>createHash('sha256').update(JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
async function actor(tx){const a=await tx.account.findUnique({where:{id:ids.admin}});assert.equal(a.tenantId,ids.tenant);assert.equal(a.status,'active');assert.equal(a.role,'tenant_admin');assert.equal(a.isTenantAdmin,true);return{tenantId:a.tenantId,accountId:a.id,role:a.role,authVersion:a.authVersion,studyGroupId:ids.group,researchProjectId:ids.project};}
async function snapshot(tx){
 const r=await tx.tokenQuotaReservation.findUnique({where:{id:reservationId}});
 const tables={jobs:await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,id:{not:jobId}},orderBy:{id:'asc'}}),reservations:await tx.tokenQuotaReservation.findMany({where:{tenantId:ids.tenant,id:{not:reservationId}},orderBy:{id:'asc'}}),messages:await tx.message.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),grants:await tx.tokenQuotaGrant.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),roles:await tx.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),accounts:await tx.account.findMany({where:{tenantId:ids.tenant},select:{id:true,role:true,isTenantAdmin:true,status:true,authVersion:true},orderBy:{id:'asc'}}),usage:await tx.usageRecord.findMany({where:{tenantId:ids.tenant,...(r.reconciliationUsageRecordId?{id:{not:r.reconciliationUsageRecordId}}:{})},orderBy:{id:'asc'}}),audits:await tx.auditLog.findMany({where:{tenantId:ids.tenant,target:{notIn:[jobId,reservationId]}},orderBy:{id:'asc'}})};
 return{other:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,{count:v.length,hash:digest(v)}])),target:await tx.knowledgeChatJob.findUnique({where:{id:jobId}}),reservation:r};
}
async function close(tx){
 const user=await actor(tx);
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wp01:tenant:${ids.tenant}`},0))`;
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aisci-token-quota:${ids.tenant}`},0))`;
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reservationId},0))`;
 await tx.$queryRaw`SELECT id FROM public.knowledge_chat_job WHERE id=${jobId} AND "tenantId"=${ids.tenant} FOR UPDATE`;
 const j=await tx.knowledgeChatJob.findUnique({where:{id:jobId}}),r=await tx.tokenQuotaReservation.findUnique({where:{id:reservationId}}),events=await tx.auditLog.findMany({where:{tenantId:ids.tenant,target:reservationId,action:{startsWith:'hub.token.'}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 assert.equal(events.length,2);assert.deepEqual(events.map(e=>e.action),['hub.token.attempt.started','hub.token.attempt.completed']);
 const binding=events[0].meta;assert.equal(binding.jobId,jobId);assert.equal(binding.executionToken,j.executionToken);assert.equal(binding.workerOwner,j.workerOwner);assert.equal(binding.accountId,ids.owner);assert.equal(binding.reservationId,reservationId);assert.equal(binding.sessionId,j.sessionId);
 const fakeSeal={action:'hub.token.execution.sealed',meta:{...binding,attemptIds:[binding.attemptId]}};
 const usage=verifiedUsage([...events,fakeSeal],binding),[clock]=await tx.$queryRaw`SELECT clock_timestamp() AS now`;
 const approved=verifyInterruptedClose({job:j,reservation:r,ids,now:clock.now,usage,trace});assert.equal(JSON.parse(trace.request.messages.find(m=>m.role==='user').content).question,j.text);
 assert.equal(await recoverExpiredClaim(tx,scope,'knowledge-chat',jobId),true);
 const sealed=await sealExecution(tx,binding);assert.deepEqual(sealed.usage,usage);
 const billing=createHubBilling({scope,transaction:fn=>fn(tx),billing:{}}),detail=await billing.detail(user,reservationId);assert.equal(detail.canSettle,true);assert.equal(detail.usage.totalTokens,2273);
 const input={requestKey,fingerprint:detail.fingerprint,action:'settle'},result=await billing.resolve(user,reservationId,input);assert.equal(result.actualTokens,2273);
 assert.deepEqual(await billing.resolve(user,reservationId,input),result);
 await tx.auditLog.create({data:{tenantId:ids.tenant,accountId:user.accountId,studyGroupId:ids.group,researchProjectId:ids.project,action:'hub.smart-search.interrupted.closed',target:jobId,meta:{schema:'hub-smart-interrupted-close.v1',reason:'用户批准仅本轮中断任务失败收口，按真实Provider 1803输入+470输出结算；不重跑、不补额度、不改其他任务。',reservationId,providerTraceHash:digest(trace),actualTokens:2273,releasedTokens:approved.releasedTokens}}});
 const final=await tx.knowledgeChatJob.findUnique({where:{id:jobId}}),reserve=await tx.tokenQuotaReservation.findUnique({where:{id:reservationId}}),record=await tx.usageRecord.findUnique({where:{id:result.usageRecordId}});
 assert.equal(final.status,'failed');assert.equal(final.errorCode,'WP01_EXECUTION_INTERRUPTED');assert.equal(final.assistantMessageId,null);assert.equal(final.attempts,j.attempts);assert.equal(digest(final.payload),digest(j.payload));assert.equal(reserve.status,'settled');assert.equal(reserve.actualTokens,2273n);assert.deepEqual([record.promptTokens,record.completionTokens,record.totalTokens,record.callCount],[1803,470,2273,1]);
 return{...result,jobId,jobStatus:final.status,releasedTokens:10015,input,providerRequests:0};
}
const before=await read(snapshot),rollback=Error('EXPECTED_SINGLE_CLOSE_ROLLBACK');let preview;
await assert.rejects(()=>transaction(async tx=>{preview=await close(tx);throw rollback;}),e=>e===rollback);assert.equal(digest(await read(snapshot)),digest(before));
let result=null;if(action==='--apply'){
 result=await transaction(async tx=>{const r=await close(tx);assert.deepEqual((await snapshot(tx)).other,before.other);return r;});
 const after=await read(snapshot);assert.deepEqual(after.other,before.other);
 const replay=await createHubBilling({scope,transaction,billing:{}}).resolve(await read(actor),reservationId,result.input);assert.equal(replay.usageRecordId,result.usageRecordId);
}
const after=await read(snapshot);writeFileSync(out+(action==='--apply'?'applied':'preflight')+'.json',JSON.stringify({at:new Date().toISOString(),action,jobId,reservationId,rollbackVerified:true,result:result??preview,beforeOther:before.other,afterOther:after.other,otherObjectsUnchanged:digest(before.other)===digest(after.other),newModelCalls:0,newQuotaGrants:0},null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({action,rollbackVerified:true,jobId,reservationId,status:result?.status??'rolled-back-only',actualTokens:2273,releasedTokens:10015,newModelCalls:0,otherObjectsUnchanged:digest(before.other)===digest(after.other)}));
