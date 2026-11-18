import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

export async function runAssignmentsApi({root,env,plan,runtime,login,write,call,owner,admin}){
 const checks=[];
 const [origin]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT receipt FROM rh_study_tasks.operation
  WHERE tenant_id=${plan.scope.tenantId} AND research_project_id=${plan.scope.researchProjectId}
  AND actor_account_id=${plan.ids.owner} AND request_key=${plan.runId+'-api-create-edit'}`,{readOnly:true});
 assert(origin,'S08_CREATE_EDIT_PROOF_REQUIRED');const taskId=origin.receipt.taskId;
 const dependency=await write('',owner,{requestKey:plan.runId+'-dependency-create',name:plan.runId+'-前置任务验证',assigneeAccountId:plan.ids.owner,dueDate:'2026-11-13'},'POST',201);
 let current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;
 assert.equal(current.status,'open','S08_ASSIGNMENT_PHASE_ALREADY_ADVANCED');
 const assignment={assigneeAccountId:plan.ids.admin,collaboratorAccountIds:[plan.ids.owner],dependencyTaskIds:[dependency.taskId]};
 if(current.assignee?.id!==plan.ids.admin||current.collaborators.map(c=>c.id).join(',')!==plan.ids.owner||!current.dependencies.some(d=>d.id===dependency.taskId)){
  const input={requestKey:plan.runId+'-api-assign',expectedVersion:current.version,...assignment};
  const first=await write('/'+taskId+'/assignments',owner,input,'POST');assert.deepEqual(await write('/'+taskId+'/assignments',owner,input,'POST'),first);
  current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;
 }else{
  const [operation]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT expected_version,receipt FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
   AND research_project_id=${plan.scope.researchProjectId} AND actor_account_id=${plan.ids.owner} AND request_key=${plan.runId+'-api-assign'}`,{readOnly:true});
  assert(operation,'S08_ASSIGNMENT_RECEIPT_REQUIRED');
  assert.deepEqual(await write('/'+taskId+'/assignments',owner,{requestKey:plan.runId+'-api-assign',expectedVersion:operation.expected_version,...assignment},'POST'),operation.receipt);
 }
 assert.equal(current.assignee.id,plan.ids.admin);assert(current.collaborators.some(c=>c.id===plan.ids.owner));assert(current.dependencies.some(d=>d.id===dependency.taskId));checks.push('real_assignment_collaborator_dependency_and_idempotency');
 await write('/'+taskId+'/assignments',owner,{...assignment,requestKey:plan.runId+'-assign-self',expectedVersion:current.version,dependencyTaskIds:[taskId]},'POST',400);
 const dep=(await call('/'+dependency.taskId,owner,plan.scope.researchProjectId)).item;
 assert.equal(dep.status,'open','S08_ASSIGNMENT_PHASE_ALREADY_ADVANCED');
 await write('/'+dependency.taskId+'/assignments',owner,{...assignment,requestKey:plan.runId+'-assign-cycle',expectedVersion:dep.version,dependencyTaskIds:[taskId]},'POST',400);
 await write('/'+taskId+'/assignments',owner,{...assignment,requestKey:plan.runId+'-assign-foreign-actor',expectedVersion:current.version,assigneeAccountId:'synthetic-foreign-account'},'POST',403);
 const aux=(await call('',admin,plan.project.id)).items[0];assert(aux);
 await write('/'+taskId+'/assignments',owner,{...assignment,requestKey:plan.runId+'-assign-foreign-task',expectedVersion:current.version,dependencyTaskIds:[aux.id]},'POST',400);
 assert.equal((await call('/'+taskId,owner,plan.scope.researchProjectId)).item.version,current.version);checks.push('self_cycle_foreign_actor_cross_study_rejected_without_version_change');

 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 let switched=false,version;const manager=plan.roles[1].id,executor=plan.roles[0].id;
 async function switchRole(from,to,expectedVersion){return withFixtureTransaction(env,'direct',async db=>{
  await lockAuthorizationMutation(db,plan.scope.tenantId);
  const account=await db.account.findFirst({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active',role:'researcher',isTenantAdmin:false},select:{authVersion:true}});
  assert(account&&(!Number.isInteger(expectedVersion)||account.authVersion===expectedVersion),'S08_ROLE_PROBE_IDENTITY_CHANGED');
  const member=await db.studyGroupMembership.updateMany({where:{id:plan.ownerGroupMemberId,tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,accountId:plan.ids.owner,roleId:from,status:'active'},data:{roleId:to}});assert.equal(member.count,1,'S08_ROLE_PROBE_MEMBERSHIP_CHANGED');
  const changed=await db.account.updateMany({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active',authVersion:account.authVersion},data:{authVersion:{increment:1}}});assert.equal(changed.count,1);
  await db.auditLog.create({data:{tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,accountId:plan.ids.admin,action:'researchhub_s08_role_probe',target:plan.ownerGroupMemberId,meta:{actorKind:'approved_local_synthetic_role_probe',from,to,authVersion:account.authVersion+1}}});
  return account.authVersion+1;
 });}
 try{
  version=await switchRole(manager,executor);switched=true;
  await call('/context',owner,plan.scope.researchProjectId,401);
  const executorCookie=await login('owner@example.org');
  const context=await call('/context',executorCookie,plan.scope.researchProjectId);assert.equal(context.capabilities.canConfigure,false);assert.equal(context.capabilities.canExecute,true);assert.equal(context.capabilities.canReview,false);
  const visible=await call('/'+taskId,executorCookie,plan.scope.researchProjectId);assert.equal(visible.item.capabilities.canAssign,false);
  await write('/'+taskId+'/assignments',executorCookie,{...assignment,requestKey:plan.runId+'-executor-cannot-assign',expectedVersion:current.version},'POST',403);
  await call('/context',executorCookie,plan.project.id,403);checks.push('real_executor_role_collaborator_read_but_no_assignment_or_auxiliary_access');
 }finally{if(switched)version=await switchRole(executor,manager,version);}
 const restored=await login('owner@example.org');assert.equal((await call('/context',restored,plan.scope.researchProjectId)).capabilities.canConfigure,true);checks.push('manager_role_restored_with_new_auth_version');
 const stored=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:taskId,...plan.scope},include:{collaborators:true,dependencies:true}}),{readOnly:true});
 assert.equal(stored.assigneeAccountId,plan.ids.admin);assert.equal(stored.version,current.version);assert.deepEqual(stored.dependencies.map(d=>d.dependsOnTaskId),[dependency.taskId]);
 const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(out,{recursive:true});
 const evidence=out+'assignments-api-'+randomUUID()+'.json';writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,taskId,dependencyTaskId:dependency.taskId,ownerAuthVersion:version,originalManagerRoleRestored:true,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({passed:true,checks,taskId,dependencyTaskId:dependency.taskId,ownerAuthVersion:version,modelCalls:0,evidence}));
}
