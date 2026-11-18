import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

// Diagnostic only: no HTTP registration, lasting account, grant or role change.
// All business effects below end in the same mandatory synthetic PG rollback.
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {AccountsService}=require(root+'app/server/src/accounts/accounts.service.ts');
const {PiGovernanceService}=require(root+'app/server/src/pi-governance/pi-governance.service.ts');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const prefix='rh-p2-reuse-'+randomUUID().slice(0,8);
const ids=Object.fromEntries(['group','project','manager','member'].map(k=>[k,prefix+'-'+k]));
const report={run:prefix,database:env.WP01_TEST_DB_NAME,role:'aisci_app',checks:[],blockers:[],rolledBack:false};
const record=(name,data={})=>report.checks.push({name,...data});
const rollback=new Error('P2_REUSE_EXPECTED_ROLLBACK');
const setContext=(tx,group='',project='')=>tx.$executeRawUnsafe(
 "SELECT set_config('app.tenant_id',$1,true),set_config('app.account_id',$2,true),set_config('app.study_group_id',$3,true),set_config('app.research_project_id',$4,true)",runtime.ids.tenant,runtime.ids.admin,group,project);
try{
 await withFixtureTransaction(env,'app',async tx=>{
  await setContext(tx);
  const actor=await tx.account.findFirst({where:{id:runtime.ids.admin,tenantId:runtime.ids.tenant,status:'active'},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}});
  assert.equal(actor?.role,'tenant_admin');assert.equal(actor.isTenantAdmin,true);
  const user={tenantId:runtime.ids.tenant,accountId:actor.id,role:actor.role,isTenantAdmin:true,authVersion:actor.authVersion};
  const role=await tx.permissionRole.findFirst({where:{tenantId:user.tenantId,id:'wp02-invite-3a7f7604-reader',status:'active'},select:{id:true,menuPermissions:true,buttonPermissions:true}});
  assert.deepEqual(role?.menuPermissions,[]);assert.deepEqual(role.buttonPermissions,[]);
  for(const k of ['manager','member'])await tx.account.create({data:{id:ids[k],tenantId:user.tenantId,username:ids[k]+'@example.test',displayName:'P2事务对照 '+k,passwordHash:'not-a-usable-login-hash',role:'researcher',isTenantAdmin:false}});
  const [accountBefore]=await tx.account.findMany({where:{id:ids.member},select:{authVersion:true}});
  await tx.tokenQuotaGrant.create({data:{tenantId:user.tenantId,accountId:ids.member,scopeKey:ids.member,deltaTokens:50n,idempotencyKey:prefix+'-temporary-grant',reason:'P2 rollback-only fixture; no provider call'}});
  let auditInserted=0;
  const tracked=new Proxy(tx,{get(t,key){
   if(key==='auditLog')return new Proxy(t.auditLog,{get(model,method){if(method==='createMany')return async input=>{const value=await model.createMany(input);auditInserted+=value.count;return value;};return model[method];}});
   return t[key];
  }});
  const bound={forTenant:()=>tracked,withTenantTransaction:(tenant,group,project,fn)=>{
   assert.equal(tenant,user.tenantId);if(group!==undefined)assert.equal(group,ids.group);if(project!==undefined)assert.equal(project,ids.project);return fn(tracked);
  }};
  const accounts=new AccountsService(bound);
  await tx.$executeRawUnsafe('SAVEPOINT p2_account_audit_failure');
  const failingTx=new Proxy(tx,{get(t,key){return key==='auditLog'?{createMany:async()=>{throw new Error('P2_INJECTED_AUDIT_FAILURE');}}:t[key];}});
  const failing=new AccountsService({withTenantTransaction:(_t,_g,_p,fn)=>fn(failingTx)});
  await assert.rejects(failing.update(user,ids.member,{status:'disabled'}),/P2_INJECTED_AUDIT_FAILURE/);
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p2_account_audit_failure');
  assert.equal((await tx.account.findUnique({where:{id:ids.member}})).status,'active');
  assert.equal((await tx.tokenQuotaGrant.aggregate({where:{accountId:ids.member},_sum:{deltaTokens:true}}))._sum.deltaTokens,50n);
  record('account-audit-failure-rolls-back-status-and-refund');
  const disabled=await accounts.update(user,ids.member,{status:'disabled'});
  assert.equal(disabled.status,'disabled');assert.equal(disabled.refundedTokens,'50');assert.equal(auditInserted,1);
  assert.equal((await tx.tokenQuotaGrant.aggregate({where:{accountId:ids.member},_sum:{deltaTokens:true}}))._sum.deltaTokens,0n);
  record('legacy-disable-refund-and-audit-in-same-app-transaction',{refundTokens:'50',auditInserted});
  const receipt=await tx.auditLog.findFirst({where:{tenantId:user.tenantId,accountId:user.accountId,action:'update_account',target:ids.member+'@example.test'},select:{id:true,meta:true}});
  if(!receipt)report.blockers.push({code:'P2_ACCOUNT_RECEIPT_HIDDEN_BY_RLS',message:'Tenant-level account audit inserted but application role cannot read it with empty project scope.'});
  const restored=await accounts.update(user,ids.member,{status:'active'});
  assert.equal(restored.status,'active');assert.equal((await tx.account.findUnique({where:{id:ids.member}})).authVersion,accountBefore.authVersion);
  record('legacy-restore-has-no-new-grant-and-does-not-advance-auth-version',{credentialAdaptationStillRequired:true});
  assert.equal(await tx.tokenQuotaGrant.count({where:{accountId:ids.member}}),2);
  await tx.studyGroup.create({data:{id:ids.group,tenantId:user.tenantId,slug:ids.group,name:'P2 rollback-only group'}});
  await setContext(tx,ids.group,ids.project);
  await tx.researchProject.create({data:{id:ids.project,tenantId:user.tenantId,studyGroupId:ids.group,code:prefix,name:'P2 rollback-only Study'}});
  for(const k of ['manager','member'])await tx.studyGroupMembership.create({data:{tenantId:user.tenantId,studyGroupId:ids.group,accountId:ids[k],roleId:role.id}});
  await tx.researchProjectMembership.create({data:{tenantId:user.tenantId,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.manager,roleKey:'project_manager'}});
  const pi=new PiGovernanceService(bound),scopeUser={...user,studyGroupId:ids.group,researchProjectId:ids.project};
  await tx.$executeRawUnsafe('SAVEPOINT p2_member_audit_failure');
  const memberFailureTx=new Proxy(tx,{get(t,key){return key==='auditLog'?{create:async()=>{throw new Error('P2_INJECTED_MEMBER_AUDIT_FAILURE');}}:t[key];}});
  const memberFailure=new PiGovernanceService({withTenantTransaction:(_t,_g,_p,fn)=>fn(memberFailureTx)});
  await assert.rejects(memberFailure.changeMember(scopeUser,ids.member,{roleKey:'researcher',status:'active',reason:'P2 rollback-only fault injection'}),/P2_INJECTED_MEMBER_AUDIT_FAILURE/);
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p2_member_audit_failure');
  assert.equal(await tx.researchProjectMembership.count({where:{researchProjectId:ids.project,accountId:ids.member}}),0);
  record('member-audit-failure-rolls-back-created-membership');
  for(const roleKey of ['researcher','data_manager','project_manager']){
   const changed=await pi.changeMember(scopeUser,ids.member,{roleKey,status:'active',reason:'P2 rollback-only reuse validation'});
   assert.equal(changed.roleKey,roleKey);
  }
  const memberAudit=await tx.auditLog.findMany({where:{tenantId:user.tenantId,researchProjectId:ids.project,action:'pi_project_member_change'},select:{researchProjectId:true,meta:true}});
  assert.equal(memberAudit.length,3);assert(memberAudit.every(row=>row.researchProjectId===ids.project));
  record('three-member-roles-and-project-audit-reuse-with-true-parent',{auditRows:3});
  await pi.changeMember(scopeUser,ids.member,{roleKey:'researcher',status:'disabled',reason:'P2 rollback-only removal'});
  await assert.rejects(pi.changeMember(scopeUser,ids.manager,{roleKey:'researcher',status:'disabled',reason:'P2 last manager must remain'}),e=>e.getResponse?.().code==='LAST_PROJECT_MANAGER_REQUIRED');
  assert.equal((await tx.researchProjectMembership.findUnique({where:{researchProjectId_accountId:{researchProjectId:ids.project,accountId:ids.manager}}})).status,'active');
  record('soft-removal-and-last-project-manager-protection');
  assert.equal(await tx.studyGroupMembership.count({where:{studyGroupId:ids.group,accountId:user.accountId}}),0);
  assert.equal(await tx.researchProjectMembership.count({where:{researchProjectId:ids.project,accountId:user.accountId}}),0);
  record('no-fake-admin-membership-created',{httpAuthorizationNotYetImplemented:true});
  throw rollback;
 });
 throw new Error('P2_EXPECTED_ROLLBACK_DID_NOT_HAPPEN');
}catch(e){if(e!==rollback)throw e;report.rolledBack=true;}
await withFixtureTransaction(env,'app',async tx=>{
 await setContext(tx);
 assert.equal(await tx.account.count({where:{id:{in:[ids.manager,ids.member]}}}),0);
 assert.equal(await tx.studyGroup.count({where:{id:ids.group}}),0);
 assert.equal(await tx.tokenQuotaGrant.count({where:{idempotencyKey:prefix+'-temporary-grant'}}),0);
 record('fresh-connection-confirms-fixtures-and-financial-effects-rolled-back');
},{readOnly:true});
const out=root+'researchhub/docs/testing/evidence/governance-p2-reuse-2026-11-13/'+prefix;
mkdirSync(out,{recursive:true});writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,evidence:out+'/result.json'}));
// A compatibility gate is intentionally nonzero when an extra authorization is needed.
process.exitCode=report.blockers.length?2:0;
