import test from 'node:test';import assert from 'node:assert/strict';
import {assertReportAiAccess,reportAiBinding} from '../server/research-assets/report-ai-access.mjs';
const hash='a'.repeat(64),policyHash='b'.repeat(64),now=Date.parse('2026-11-17T04:00:00Z');
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'admin',authVersion:2,identityRevision:'c'.repeat(64)};
const a={id:'asset',artifactVersionId:'version',tenantId:'t',studyGroupId:'g',researchProjectId:'p',studyId:'study',ownerAccountId:'admin',kind:'publication',version:2,state:'approved',bodyAllowed:true,sourceValid:true,contentHash:hash,policyHash,sourceReportId:'report',sourceReportVersion:1};
const c={id:'consent',tenantId:'t',studyGroupId:'g',researchProjectId:'p',studyId:'study',assetId:'asset',assetVersion:2,accountId:'admin',purpose:'research_report_qa',providerScope:'deepseek',contentHash:hash,policyHash,sourceReportId:'report',sourceReportVersion:1,materialUseAllowed:true,basisReference:'user-approval-20261117',materialBasisHash:'f'.repeat(64),revision:1,state:'active',startsAt:'2026-11-17T03:00:00Z',expiresAt:'2026-11-24T03:00:00Z'};
test('independent AI consent binds an approved private fixed report without a release or new content version',()=>{
 assert.doesNotThrow(()=>assertReportAiAccess(p,a,c,{now,providerScope:'deepseek'}));assert.equal(reportAiBinding(p,a,c).assetVersion,2);
 assert.throws(()=>assertReportAiAccess(p,a,null,{now,providerScope:'deepseek'}));
});
test('tenant-admin identity, approval text, read permission or an old grant cannot substitute current explicit AI consent',()=>{
 for(const patch of [{state:'revoked'},{state:'expired'},{materialUseAllowed:false},{basisReference:''},{assetVersion:1},{accountId:'owner'},{tenantId:'other'},{studyId:'other'},{providerScope:'other'},{contentHash:'d'.repeat(64)},{policyHash:'e'.repeat(64)},{revision:0},{expiresAt:new Date(now).toISOString()},{startsAt:new Date(now+1).toISOString()}])assert.throws(()=>assertReportAiAccess(p,a,{...c,...patch},{now,providerScope:'deepseek'}));
 for(const patch of [{state:'draft'},{state:'in_review'},{sourceValid:false},{bodyAllowed:false},{deletedAt:'2026-11-17T03:00:00Z'},{ownerAccountId:'someone'},{kind:'dataset'}])assert.throws(()=>assertReportAiAccess({...p,isTenantAdmin:true},{...a,...patch},c,{now,providerScope:'deepseek'}));
 assert.throws(()=>assertReportAiAccess({...p,accountId:'owner',isTenantAdmin:true},a,c,{now,providerScope:'deepseek'}));
 assert.notDeepEqual(reportAiBinding(p,a,c),reportAiBinding(p,a,{...c,revision:2}));
});
