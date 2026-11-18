import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {withTaskExecutorProbe} from './study-tasks-role-probe.mjs';
export async function runReviewsApi({root,env,plan,taskIds,owner,admin,login,write,call}){
 const checks=[];let current=(await call('/'+taskIds[0],owner,plan.scope.researchProjectId)).item;
 assert.equal(current.reviewStatus,'pending_review','S08_REVIEW_PHASE_ALREADY_ADVANCED');
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 const probe=await withTaskExecutorProbe({env,plan,lockAuthorizationMutation},async()=>{
  const executor=await login('owner@example.org');const value=(await call('/'+taskIds[0],executor,plan.scope.researchProjectId)).item;assert.equal(value.capabilities.canReview,false);
  await write('/'+taskIds[0]+'/reviews',executor,{requestKey:plan.runId+'-executor-review-denied',expectedVersion:current.version,decision:'accept',note:''},'POST',403);
 });
 owner=await login('owner@example.org');checks.push('real_executor_cannot_review_manager_role_restored');
 await write('/'+taskIds[0]+'/reviews',admin,{requestKey:plan.runId+'-return-empty-note',expectedVersion:current.version,decision:'return',note:''},'POST',400);
 const returned=await write('/'+taskIds[0]+'/reviews',admin,{requestKey:plan.runId+'-review-return',expectedVersion:current.version,decision:'return',note:'合成验收：请补充一次字段复核说明后重新提交'},'POST');
 current=(await call('/'+taskIds[0],owner,plan.scope.researchProjectId)).item;assert.equal(current.status,'in_progress');assert.equal(current.reviewStatus,'returned');assert.equal(current.reviewer.id,plan.ids.admin);assert(current.reviewNote.includes('补充'));checks.push('return_reason_real_reviewer_and_reopened_execution');
 const submitted=await write('/'+taskIds[0]+'/transitions',owner,{requestKey:plan.runId+'-return-resubmit',expectedVersion:returned.version,status:'completed',completionNote:'合成验证：补充字段复核说明后，再次提交任务验收。'},'POST');
 const accepted=await write('/'+taskIds[0]+'/reviews',owner,{requestKey:plan.runId+'-self-review-accept',expectedVersion:submitted.version,decision:'accept',note:'合成演练中本人核对并验收，不作为独立复核'},'POST');
 current=(await call('/'+taskIds[0],owner,plan.scope.researchProjectId)).item;assert.equal(current.reviewStatus,'accepted');assert.equal(current.status,'completed');assert.equal(current.version,accepted.version);assert.equal(current.sameActorReview,true);assert.equal(current.submission.actor.id,plan.ids.owner);assert.equal(current.reviewer.id,plan.ids.owner);checks.push('resubmission_and_same_actor_review_explicit');
 await write('/'+taskIds[0]+'/reviews',admin,{requestKey:plan.runId+'-cannot-review-accepted',expectedVersion:accepted.version,decision:'accept',note:''},'POST',409);
 const [dep]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT receipt FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
  AND research_project_id=${plan.scope.researchProjectId} AND request_key=${plan.runId+'-dependency-create'}`,{readOnly:true});assert(dep);
 const pending=(await call('/'+dep.receipt.taskId,owner,plan.scope.researchProjectId)).item;
 await write('/'+dep.receipt.taskId+'/reviews',owner,{requestKey:plan.runId+'-dependency-accepted',expectedVersion:pending.version,decision:'accept',note:'合成验收：前置任务已核对；引用读取仍按各账号原权限'},'POST');
 const [api]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT receipt FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
  AND research_project_id=${plan.scope.researchProjectId} AND request_key=${plan.runId+'-api-create-edit'}`,{readOnly:true});
 const ready=(await call('/'+api.receipt.taskId,admin,plan.scope.researchProjectId)).item;assert.equal(ready.dependenciesReady,true);assert(ready.capabilities.transitions.includes('in_progress'));checks.push('accepted_parent_unblocks_dependent_task');
 const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(out,{recursive:true});const evidence=out+'reviews-api-'+randomUUID()+'.json';
 writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,taskId:taskIds[0],version:accepted.version,ownerAuthVersion:probe.restoredVersion,newTasks:0,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({passed:true,checks,ownerAuthVersion:probe.restoredVersion,newTasks:0,modelCalls:0,evidence}));
}
