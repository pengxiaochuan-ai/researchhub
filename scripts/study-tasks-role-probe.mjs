// Test-only, already approved S02 role switch. No role definition or project grant changes.
import assert from 'node:assert/strict';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export async function withTaskExecutorProbe({env,plan,lockAuthorizationMutation},operation){
 assert(/^rh-s08-[a-f0-9]{8}$/.test(plan.runId)&&plan.roles[0].id===plan.runId+'-executor'&&plan.roles[1].id===plan.runId+'-manager','S08_ROLE_PROBE_SCOPE_REJECTED');
 const manager=plan.roles[1].id,executor=plan.roles[0].id;
 async function switchRole(from,to,expectedVersion){return withFixtureTransaction(env,'direct',async db=>{
  await lockAuthorizationMutation(db,plan.scope.tenantId);
  const admin=await db.account.findFirst({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,status:'active',role:'tenant_admin',isTenantAdmin:true},select:{id:true}});assert(admin,'S08_ROLE_PROBE_ADMIN_CHANGED');
  const account=await db.account.findFirst({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active',role:'researcher',isTenantAdmin:false},select:{authVersion:true}});
  assert(account&&(!Number.isInteger(expectedVersion)||account.authVersion===expectedVersion),'S08_ROLE_PROBE_IDENTITY_CHANGED');
  const member=await db.studyGroupMembership.updateMany({where:{id:plan.ownerGroupMemberId,tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,accountId:plan.ids.owner,roleId:from,status:'active'},data:{roleId:to}});assert.equal(member.count,1,'S08_ROLE_PROBE_MEMBERSHIP_CHANGED');
  assert.equal((await db.account.updateMany({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active',authVersion:account.authVersion},data:{authVersion:{increment:1}}})).count,1);
  await db.auditLog.create({data:{tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,accountId:plan.ids.admin,action:'researchhub_s08_role_probe',target:plan.ownerGroupMemberId,meta:{actorKind:'approved_local_synthetic_role_probe',from,to,authVersion:account.authVersion+1}}});
  return account.authVersion+1;
 });}
 const executorVersion=await switchRole(manager,executor);let result,restoredVersion;
 try{result=await operation(executorVersion);}finally{restoredVersion=await switchRole(executor,manager,executorVersion);}
 return {result,restoredVersion};
}
