// Test-only: caller owns the guarded physical fixture transaction and its rollback.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdmissionService,bindAdmissionContext,assertApprovedInTransaction} from '../admission/service.mjs';
import {HUB_KEY} from '../admission/policy.mjs';

export async function approveNewAnalysisFixtureAccount(tx,f,accountId=f?.id?.account){
 const id=f?.id,user=f?.user,prefix=typeof id?.tenant==='string'&&id.tenant.endsWith('_tenant')?id.tenant.slice(0,-7):null;
 assert(prefix&&id.account===prefix+'_account'&&id.group===prefix+'_group'&&id.project===prefix+'_project'&&f.studyId===prefix+'_study','ANALYSIS_NEW_FIXTURE_SCOPE_REQUIRED');
 assert(user?.accountId===id.account&&user.tenantId===id.tenant&&user.authVersion===0&&f.scope?.tenantId===id.tenant&&f.scope.studyGroupId===id.group&&f.scope.researchProjectId===id.project,'ANALYSIS_NEW_FIXTURE_ADMIN_REQUIRED');
 assert(typeof accountId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(accountId),'ANALYSIS_EXPLICIT_FIXTURE_ACCOUNT_REQUIRED');
 await bindAdmissionContext(tx,user);
 const ids=[...new Set([id.account,accountId])];
 const fresh=await tx.$queryRaw`SELECT t.id AS "tenantId",a.id AS "accountId" FROM public.tenant t JOIN public.account a ON a."tenantId"=t.id WHERE t.id=${id.tenant} AND a.id=ANY(${ids}::text[]) AND t.xmin::text=pg_current_xact_id()::text AND a.xmin::text=pg_current_xact_id()::text`;
 assert(fresh.length===ids.length&&fresh.every(r=>r.tenantId===id.tenant)&&new Set(fresh.map(r=>r.accountId)).size===ids.length&&ids.every(value=>fresh.some(r=>r.accountId===value)),'ANALYSIS_ACCOUNTS_MUST_BE_NEW_IN_THIS_FIXTURE_TX');
 const admin=await tx.account.findUnique({where:{id:id.account},include:{tenant:true}}),account=accountId===id.account?admin:await tx.account.findUnique({where:{id:accountId},include:{tenant:true}});
 for(const a of [admin,account])assert(a&&a.tenantId===id.tenant&&a.authVersion===0&&a.status==='active'&&a.tenant?.status==='active','ANALYSIS_CURRENT_NEW_FIXTURE_ACCOUNT_REQUIRED');
 if(accountId!==id.account)await assertApprovedInTransaction(tx,user);
 const existing=await tx.$queryRawUnsafe('SELECT id FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3',id.tenant,HUB_KEY,accountId);
 assert(existing.length===0,'ANALYSIS_FIXTURE_ADMISSION_ALREADY_EXISTS');
 const hubs=await tx.$queryRaw`SELECT tenant_id,hub_key,status,scope_status,(xmin::text=pg_current_xact_id()::text) AS "createdInTransaction" FROM rh_hub.hub WHERE tenant_id=${id.tenant} AND hub_key=${HUB_KEY}`;
 if(accountId===id.account){
  assert(hubs.length===0,'ANALYSIS_FIXTURE_HUB_ALREADY_EXISTS');
  await tx.$executeRaw`INSERT INTO rh_hub.hub(tenant_id,hub_key,name,summary,status,scope_status) VALUES(${id.tenant},${HUB_KEY},'Synthetic analysis regression fixture','T15/T16/T17 transaction-local software test only','active','confirmed')`;
 }else{
  assert(hubs.length===1&&hubs[0].tenant_id===id.tenant&&hubs[0].hub_key===HUB_KEY&&hubs[0].status==='active'&&hubs[0].scope_status==='confirmed'&&hubs[0].createdInTransaction===true,'ANALYSIS_EXISTING_NEW_FIXTURE_HUB_REQUIRED');
 }
 const noOuterTransaction=()=>{throw Error('ANALYSIS_ADMISSION_FIXTURE_REQUIRES_CALLER_TRANSACTION');};
 const service=createAdmissionService({tenantId:id.tenant,transact:noOuterTransaction,lockAuthorization:noOuterTransaction});
 return service.legacyInTransaction(tx,user,account,'analysis-fixture-admission-'+randomUUID());
}
