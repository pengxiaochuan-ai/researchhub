import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAssetGovernance,governanceActions,governanceTransition} from './local-research-assets-governance.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
const now=Date.parse('2026-11-13T01:00:00Z'),owner={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'owner',permissions:['artifact.edit'],identityRevision:'identity-1'},admin={...owner,accountId:'admin',isTenantAdmin:true};
const record={registry:{...owner,assetId:'asset',ownerAccountId:'owner',kind:'protocol',revision:2,workingVersionNo:2,workingState:'draft',deletedAt:null,releaseState:'unreleased'},policies:[{version:2,contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),rightsEvidence:'本轮原创',discoveryRecipientCeiling:['owner','admin'],sourceValid:true}],events:[],grants:[]};
const input=(action,extra={})=>({action,version:2,expectedRevision:2,requestKey:'governance-001',contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),identityRevision:'identity-1',...extra});
const ids={owner:'owner',admin:'admin'};
const run=(r,a,p=admin)=>governanceTransition(r,validateAssetGovernance(a,{ids}),p,now);
test('governance has strict action input contracts and no client owner/public/expiry authority',()=>{
 assert.equal(validateAssetGovernance(input('submit'),{ids}).action,'submit');
 for(const extra of [{ownerAccountId:'admin'},{expiresAt:'2027-01-01'},{public:true},{contentChecked:true}])assert.throws(()=>validateAssetGovernance(input('submit',extra),{ids}),e=>e.status===400);
 for(const ttlDays of [0,8,1.5])assert.throws(()=>validateAssetGovernance(input('release',{reason:'限定核对',discoveryRecipients:['owner'],ttlDays}),{ids}));
 assert.throws(()=>validateAssetGovernance(input('release',{reason:'限定核对',discoveryRecipients:['foreign'],ttlDays:1}),{ids}));
});
test('only current scoped administrator can review, release or withdraw',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{workingState:'in_review',submittedVersionNo:2});
 assert.throws(()=>run(r,input('review',{conclusion:'approved',reason:'内容及用途已核对',contentChecked:true,rightsChecked:true}),owner),e=>e.status===403);
 assert.throws(()=>run(r,input('review',{conclusion:'changes_requested',reason:'退回'}),{...admin,tenantId:'other'}),e=>e.status===404);
 assert.equal(run(record,input('submit'),owner).next.workingState,'in_review');
});
test('self-review is explicit, not a replacement for current source approval',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{ownerAccountId:'admin',workingState:'in_review',submittedVersionNo:2});
 const approval=input('review',{conclusion:'approved',reason:'合成内容与用途核对',contentChecked:true,rightsChecked:true});
 assert.throws(()=>run(r,approval),e=>e.code==='ASSET_CATALOG_SELF_REVIEW_REQUIRED');
 assert.equal(run(r,{...approval,selfReviewAcknowledged:true}).payload.selfReview,true);
 r.policies[0].sourceValid=false;
 assert.throws(()=>run(r,{...approval,selfReviewAcknowledged:true}),e=>e.code==='ASSET_CATALOG_SOURCE_INVALID');
 assert.equal(run(r,input('review',{conclusion:'changes_requested',reason:'来源撤审，退回'})).next.workingState,'changes_requested');
});
test('an administrator who revised another owner asset must still mark self-review of that fixed version',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{workingState:'in_review',submittedVersionNo:2});r.policies[0].createdBy='admin';
 const approval=input('review',{conclusion:'approved',reason:'本人修订版',contentChecked:true,rightsChecked:true});
 assert.throws(()=>run(r,approval),e=>e.code==='ASSET_CATALOG_SELF_REVIEW_REQUIRED');
 assert.equal(run(r,{...approval,selfReviewAcknowledged:true}).payload.selfReview,true);
});
test('edited, stale identity, policy or content cannot be approved',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{workingState:'in_review',submittedVersionNo:2});
 const a=input('review',{conclusion:'approved',reason:'已核',contentChecked:true,rightsChecked:true});
 for(const extra of [{expectedRevision:1},{version:1},{identityRevision:'older'},{policyHash:'c'.repeat(64)},{contentHash:'c'.repeat(64)}])assert.throws(()=>run(r,{...a,...extra}),e=>e.status===409);
 assert.throws(()=>run(r,{...a,rightsChecked:false}),e=>e.status===422);
});
test('fixed release is limited, server dated, at most once; withdrawal stops current grants',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{workingState:'approved',approvedVersionNo:2});
 const release=input('release',{reason:'限两人核对',discoveryRecipients:['owner'],ttlDays:2});
 const first=run(r,release);assert.equal(first.type,'released');assert.deepEqual(first.payload.discoveryRecipients,['owner']);assert.equal(first.payload.expiresAt,new Date(now+2*86400000).toISOString());
 r.events.push({type:'released',version:2,revision:3,...first.payload});r.registry.revision=3;
 assert.throws(()=>run(r,{...release,expectedRevision:3,requestKey:'new-release-key'}),e=>e.code==='ASSET_CATALOG_ALREADY_RELEASED');
 r.policies[0].sourceValid=false;
 const withdrawn=run(r,input('withdraw',{expectedRevision:3,reason:'来源撤审，停止使用'}));assert.equal(withdrawn.type,'withdrawn');assert.equal(withdrawn.revokeVersion,2);
 assert.deepEqual(governanceActions(r,admin,2,now),['withdraw']);
});
test('source evidence applies to selected fixed version rather than invalid newer draft',()=>{
 const r=structuredClone(record);r.policies.push({...r.policies[0],version:1,sourceValid:true});r.policies[0].sourceValid=false;
 r.events.push({type:'released',version:1,revision:1,discoveryRecipients:['owner'],expiresAt:new Date(now+10000).toISOString()});
 assert.deepEqual(governanceActions(r,admin,1,now),['withdraw']);
 assert.throws(()=>run(r,input('submit'),owner),e=>e.code==='ASSET_CATALOG_SOURCE_INVALID');
});
test('the last approved success event is reserved for withdrawing a live release',()=>{
 const r=structuredClone(record);Object.assign(r.registry,{workingState:'approved',approvedVersionNo:2,revision:23});
 assert.throws(()=>run(r,input('release',{expectedRevision:23,reason:'额度边界',discoveryRecipients:['owner'],ttlDays:1})),e=>e.code==='ASSET_CATALOG_FIXTURE_CAPACITY');
 r.events.push({type:'released',version:2,revision:22,discoveryRecipients:['owner'],expiresAt:new Date(now+10000).toISOString()});
 assert.deepEqual(governanceActions(r,admin,2,now),['withdraw']);
 assert.equal(run(r,input('withdraw',{expectedRevision:23,reason:'保留最后一次撤回'})).next.revision,24);
});
test('every independently active fixed release retains its own withdrawal event',()=>{
 const r=structuredClone(record);r.registry.revision=22;r.policies.push({...r.policies[0],version:1});
 r.events=[1,2].map(version=>({type:'released',version,revision:version,discoveryRecipients:['owner'],expiresAt:new Date(now+10000).toISOString()}));
 assert.equal(assetEventBudgetAllows(r,'revise',now),false);assert.equal(assetEventBudgetAllows(r,'release',now),false);assert.equal(assetEventBudgetAllows(r,'withdraw',now),true);
});
