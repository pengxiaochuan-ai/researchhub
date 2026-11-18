import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApplicabilityCurrentAccess,applicabilityAccessRegistration} from './asset-applicability-current-access.mjs';
const ids={tenant:'tenant',group:'group',project:'study',owner:'owner',admin:'admin'};
const user={tenantId:'tenant',studyGroupId:'group',researchProjectId:'study',accountId:'owner',authVersion:3};
const pair={accountId:'owner',assetId:'asset',targetPlanId:'target'};
function fixture(){
 const role={tenantId:'tenant',status:'active',menuPermissions:['knowledge','workbench','artifacts'],buttonPermissions:['chat.use','artifact.read','artifact.create','artifact.edit']};
 const tx={account:{findFirst:async()=>({id:'owner'})},studyGroupMembership:{findFirst:async()=>({role})},researchProject:{findFirst:async()=>({id:'study'})},researchProjectMembership:{findFirst:async()=>({id:'member'})},auditLog:{findFirst:async()=>({meta:applicabilityAccessRegistration(ids),createdAt:new Date('2026-10-01')})},researchArtifact:{findMany:async()=>[{id:'asset'},{id:'target'}]}};
 return{tx,role,access:createApplicabilityCurrentAccess(ids)};
}
test('normal access has no test expiry and requires exact account, Study and registered mode',async()=>{
 const {tx,access}=fixture();assert.equal((await access.authorized(tx,user,'U01',pair)).mode,'current_permissions');
 for(const op of ['U02','U03'])assert((await access.authorized(tx,user,op,pair)).operations.includes(op));
 for(const changed of [{accountId:'other'},{tenantId:'other'},{studyGroupId:'other'},{researchProjectId:'other'}])await assert.rejects(access.authorized(tx,{...user,...changed},'U01',pair),/APPLICABILITY_ACCESS_RESTRICTED/);
 tx.auditLog.findFirst=async()=>null;await assert.rejects(access.authorized(tx,user,'U01'),/APPLICABILITY_ACCESS_RESTRICTED/);
});
test('operation availability comes from current grants and is not restored on read',async()=>{
 const {tx,access,role}=fixture();role.buttonPermissions=['chat.use','artifact.read'];
 assert.deepEqual((await access.authorized(tx,user,'U01',pair)).operations,['U01']);
 for(const op of ['U02','U03'])await assert.rejects(access.authorized(tx,user,op,pair),/APPLICABILITY_ACCESS_RESTRICTED/);
 for(const model of ['account','studyGroupMembership','researchProject','researchProjectMembership']){const old=tx[model].findFirst;tx[model].findFirst=async()=>null;await assert.rejects(access.authorized(tx,user,'U01'),/APPLICABILITY_ACCESS_RESTRICTED/);tx[model].findFirst=old;}
});
test('normal mode rejects unknown fixture operations and foreign parents, keeps schema and version checks live',async()=>{
 const {tx,access}=fixture();assert.throws(()=>access.purpose(user,'U04'),/APPLICABILITY_ACCESS_RESTRICTED/);
 assert.throws(()=>access.purpose(user,'U01',{...pair,accountId:'admin'}),/APPLICABILITY_ACCESS_RESTRICTED/);
 tx.researchArtifact.findMany=async()=>[{id:'asset'}];await assert.rejects(access.authorized(tx,user,'U01',pair),/APPLICABILITY_ACCESS_RESTRICTED/);
 let accountQuery;tx.account.findFirst=async q=>{accountQuery=q;return null;};await assert.rejects(access.authorized(tx,user,'U01'),/APPLICABILITY_ACCESS_RESTRICTED/);assert.equal(accountQuery.where.authVersion,3);assert.equal(accountQuery.where.tenantId,'tenant');
});
