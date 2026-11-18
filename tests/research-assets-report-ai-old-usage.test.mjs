import test from'node:test';import assert from'node:assert/strict';import{assetAccessTransition}from'../scripts/local-research-assets-access.mjs';
const h='a'.repeat(64),p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'admin',identityRevision:'current',isTenantAdmin:true},policy={version:2,contentHash:h,policyHash:h,sourceValid:true,discoveryRecipientCeiling:['admin']};
const record={registry:{...p,assetId:'asset',kind:'publication',ownerAccountId:'admin',revision:6,workingVersionNo:2,workingState:'approved'},policies:[policy],events:[],grants:[],family:{family:'detail',maxVersions:8,maxOperations:24}},input={action:'request',version:2,expectedRevision:6,requestKey:'test-ai-self',contentHash:h,policyHash:h,identityRevision:'current',actions:['ai'],purpose:'本人私有报告问答',ttlDays:7};
test('existing purpose workflow retains release and no-self-sharing rules instead of being weakened for private AI',()=>{
 assert.throws(()=>assetAccessTransition(record,input,p),e=>e.code==='ASSET_CATALOG_STATE_CONFLICT');
 const released={...record,events:[{type:'released',version:2,revision:5,discoveryRecipients:['admin'],expiresAt:new Date(Date.now()+86400000).toISOString()}]};
 assert.throws(()=>assetAccessTransition(released,input,p),e=>e.code==='ASSET_CATALOG_SELF_REQUEST');
 assert.throws(()=>assetAccessTransition({...record,family:{family:'business',maxVersions:2147483647,maxOperations:2147483647}},input,p),e=>e.code==='ASSET_CATALOG_INPUT_INVALID');
});
