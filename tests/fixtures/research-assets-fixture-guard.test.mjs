import {test} from 'node:test';
import assert from 'node:assert/strict';
const guard=await import('./research-assets-fixture-guard.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
const ids={tenant:'t',group:'g',project:'p',owner:'u',admin:'a'};
const row={tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'u',createdBy:'u',idempotencyKey:'rh-research-asset:local-20261112:owner:protocol',currentVersionNo:2,status:'draft',deletedAt:null};
test('named fixture admission refuses extra prefix keys or wrong owners/parents before writing any approved object',()=>{
 assert.equal(typeof guard.assertNamedResearchAssetFixtures,'function');
 assert.equal(guard.assertNamedResearchAssetFixtures([],ids),0);assert.equal(guard.assertNamedResearchAssetFixtures([row],ids),1);
 for(const delta of [{idempotencyKey:'rh-research-asset:local-20261112:unexpected'},{ownerAccountId:'a'},{createdBy:'a'},{tenantId:'foreign'},{researchProjectId:'foreign'},{status:'released'},{currentVersionNo:3},{deletedAt:new Date()}])assert.throws(()=>guard.assertNamedResearchAssetFixtures([{...row,...delta}],ids),/ASSET_FIXTURE_SCOPE_REJECTED/);
 assert.throws(()=>guard.assertNamedResearchAssetFixtures([row,row],ids),/ASSET_FIXTURE_SCOPE_REJECTED/);
});
