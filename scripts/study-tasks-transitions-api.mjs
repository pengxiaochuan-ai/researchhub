import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const reference=item=>Object.fromEntries(['kind','artifactId','version','contentHash','sourceSnapshotHash'].map(key=>[key,item[key]]));
export async function runTransitionsApi({root,env,plan,taskIds,owner,admin,write,call}){
 const checks=[];
 const operations=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT request_key,receipt FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
  AND research_project_id=${plan.scope.researchProjectId} AND request_key=ANY(${[plan.runId+'-api-create-edit',plan.runId+'-dependency-create']}::text[])`,{readOnly:true});
 const apiTask=operations.find(o=>o.request_key.endsWith('-api-create-edit'))?.receipt.taskId,dependencyTask=operations.find(o=>o.request_key.endsWith('-dependency-create'))?.receipt.taskId;assert(apiTask&&dependencyTask,'S08_ASSIGNMENTS_PROOF_REQUIRED');
 const before=(await call('/'+apiTask,admin,plan.scope.researchProjectId)).item;assert.equal(before.status,'open','S08_TRANSITION_PHASE_ALREADY_ADVANCED');
 await write('/'+apiTask+'/transitions',admin,{requestKey:plan.runId+'-dependency-start-blocked',expectedVersion:before.version,status:'in_progress'},'POST',409);checks.push('unaccepted_dependency_prevents_start');
 async function transition(taskId,cookie,key,version,status,extra={}){return write('/'+taskId+'/transitions',cookie,{requestKey:plan.runId+'-'+key,expectedVersion:version,status,...extra},'POST');}
 const started=await transition(taskIds[0],owner,'owner-start',0,'in_progress');
 const blocked=await transition(taskIds[0],owner,'owner-blocked',started.version,'blocked',{blockedReason:'合成验证：等待复核资料'});
 const resumed=await transition(taskIds[0],owner,'owner-resumed',blocked.version,'in_progress');
 await write('/'+taskIds[0]+'/transitions',owner,{requestKey:plan.runId+'-empty-completion-rejected',expectedVersion:resumed.version,status:'completed'},'POST',400);
 const submitted=await transition(taskIds[0],owner,'owner-completed',resumed.version,'completed',{completionNote:'合成验证：本人已完成资料与字段核对，提交任务验收。'});
 const current=(await call('/'+taskIds[0],owner,plan.scope.researchProjectId)).item;assert.equal(current.status,'completed');assert.equal(current.reviewStatus,'pending_review');assert.equal(current.version,submitted.version);checks.push('real_start_block_resume_submit_is_pending_review_not_accepted');
 await write('/'+dependencyTask+'/transitions',admin,{requestKey:plan.runId+'-acting-reason-required',expectedVersion:0,status:'in_progress'},'POST',400);
 const acting=await transition(dependencyTask,admin,'admin-acting-start',0,'in_progress',{reason:'合成验证：管理员代办前置核对'});
 const adminSources=await call('/link-options?kind=completion_evidence',admin,plan.scope.researchProjectId),ownerSources=await call('/link-options?kind=completion_evidence',owner,plan.scope.researchProjectId);
 assert(adminSources.items.length&&ownerSources.items.length,'S08_READABLE_OWN_SOURCE_REQUIRED');
 const good=reference(adminSources.items[0]),other=reference(ownerSources.items[0]);
 await write('/'+dependencyTask+'/transitions',admin,{requestKey:plan.runId+'-bad-evidence-hash',expectedVersion:acting.version,status:'completed',reason:'合成验证代办',evidenceRefs:[{...good,contentHash:'0'.repeat(64)}]},'POST',409);
 await write('/'+dependencyTask+'/transitions',admin,{requestKey:plan.runId+'-other-owner-evidence',expectedVersion:acting.version,status:'completed',reason:'合成验证代办',evidenceRefs:[other]},'POST',403);
 const done=await transition(dependencyTask,admin,'admin-acting-complete',acting.version,'completed',{reason:'合成验证：管理员按已授权本人资料固定版本完成前置核对',evidenceRefs:[good]});
 const ownView=(await call('/'+dependencyTask,admin,plan.scope.researchProjectId)).item;assert.equal(ownView.reviewStatus,'pending_review');assert.equal(ownView.evidence[0].available,true);assert.equal(ownView.evidence[0].contentHash,good.contentHash);
 const recipientView=(await call('/'+dependencyTask,owner,plan.scope.researchProjectId)).item;assert.deepEqual(recipientView.evidence,[{available:false}]);checks.push('acting_reason_and_own_fixed_version_evidence_current_authority_no_cross_owner_leak');
 await write('/'+apiTask+'/transitions',admin,{requestKey:plan.runId+'-submitted-is-not-accepted-dependency',expectedVersion:before.version,status:'in_progress'},'POST',409);checks.push('pending_review_does_not_satisfy_dependency');
 const cancelled=await write('',owner,{requestKey:plan.runId+'-cancel-create',name:plan.runId+'-取消验证',assigneeAccountId:plan.ids.admin,dueDate:'2026-11-13'},'POST',201);
 await write('/'+cancelled.taskId+'/transitions',owner,{requestKey:plan.runId+'-manager-cannot-impersonate',expectedVersion:0,status:'in_progress'},'POST',403);
 const ownStart=await transition(cancelled.taskId,admin,'cancel-admin-start',0,'in_progress');
 const stop=await transition(cancelled.taskId,owner,'manager-cancel',ownStart.version,'cancelled',{reason:'合成验证：管理者取消不再需要的任务，保留原负责人及历史'});
 const final=(await call('/'+cancelled.taskId,owner,plan.scope.researchProjectId)).item;assert.equal(final.status,'cancelled');assert.equal(final.assignee.id,plan.ids.admin);assert.equal(final.version,stop.version);assert(final.history.some(h=>h.actor.id===plan.ids.owner&&h.reason?.includes('管理者取消')));checks.push('manager_can_cancel_not_impersonate_executor_and_reason_is_persistent');
 const audit=await withFixtureTransaction(env,'direct',db=>db.auditLog.findFirst({where:{...plan.scope,target:cancelled.taskId,action:'researchhub_study_task_transition',accountId:plan.ids.owner},select:{meta:true}}),{readOnly:true});assert(audit?.meta.reason.includes('管理者取消'));assert.equal(audit.meta.toStatus,'cancelled');
 const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(out,{recursive:true});const evidence=out+'transitions-api-'+randomUUID()+'.json';
 writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,taskIds:{owner:taskIds[0],dependency:dependencyTask,cancelled:cancelled.taskId},versions:{owner:submitted.version,dependency:done.version,cancelled:stop.version},newPersistentTaskTotal:6,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({passed:true,checks,newPersistentTaskTotal:6,modelCalls:0,evidence}));
}
