import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskAuthorization} from './authorization.mjs';

const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'main'};
const boundary={scope,ids:{owner:'owner',admin:'admin'},project:{id:'aux'}};
const principal={accountId:'admin',tenantId:'tenant',authVersion:1};
test('admin_without_project_membership_can_read_using_current_legacy_authority',async()=>{
 let received;
 const authorize=createTaskAuthorization({boundary,assertAuthority:async(...args)=>{received=args;return{isTenantAdmin:true,...args[2]};}});
 const tx={};const result=await authorize(tx,principal,{...scope,researchProjectId:'aux'},'read');
 assert.equal(result.isTenantAdmin,true);assert.equal(received[0],tx);assert.equal(received[1],principal);assert.equal(received[2].researchProjectId,'aux');
});
test('local_boundary_refuses_other_actors_tenants_and_historical_studies_before_queries',async()=>{
 let calls=0;const authorize=createTaskAuthorization({boundary,assertAuthority:()=>{calls++;}});
 for(const [user,target] of [[{...principal,accountId:'another'},scope],[{...principal,tenantId:'foreign'},scope],[principal,{...scope,researchProjectId:'historical'}],[principal,{...scope,studyGroupId:'foreign'}]])
  await assert.rejects(()=>authorize({},user,target,'read'),{code:'STUDY_TASK_SCOPE_REJECTED'});
 assert.equal(calls,0);
});
test('revoked_admin_is_not_replaced_with_fixture_capability',async()=>{
 const authorize=createTaskAuthorization({boundary,assertAuthority:()=>{throw Object.assign(new Error('revoked'),{code:'STUDY_TASK_AUTH_STALE'});}});
 await assert.rejects(()=>authorize({},principal,scope,'read'),{code:'STUDY_TASK_AUTH_STALE'});
});
