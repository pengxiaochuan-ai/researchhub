import test from 'node:test';import assert from 'node:assert/strict';
import {validateAssetAccessInput,assetAccessTransition} from './local-research-assets-access.mjs';
const now=Date.parse('2026-11-13T00:00:00Z'),ids={owner:'owner',admin:'admin'},p={tenantId:'t',studyGroupId:'g',researchProjectId:'s',accountId:'owner',identityRevision:'identity'},admin={...p,accountId:'admin',isTenantAdmin:true};
const record={family:{family:'detail'},registry:{...p,ownerAccountId:'admin',revision:5,workingVersionNo:1,kind:'protocol'},policies:[{version:1,sourceValid:true,contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),discoveryRecipientCeiling:['owner','admin']}],events:[{type:'released',version:1,revision:4,discoveryRecipients:['owner'],expiresAt:new Date(now+100000).toISOString()}],grants:[]};
const input=(actions)=>({action:'request',version:1,expectedRevision:5,requestKey:'detail-request-key',identityRevision:'identity',contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),actions,purpose:'核对原创合成材料',ttlDays:7});
test('new detail contract supports eight independent approved purposes without widening legacy validation',()=>{
 const actions=['read_body','cite','comment','download','ai','derive','apply','export'];
 assert.throws(()=>validateAssetAccessInput(input(actions),{ids}),e=>e.status===400);
 const value=validateAssetAccessInput(input(actions),{ids,detail:true});assert.equal(value.actions.length,8);
 assert.equal(assetAccessTransition(record,value,p,now).request.expiresAt,record.events[0].expiresAt);
 assert.throws(()=>assetAccessTransition({...record,family:{family:'catalog'}},value,p,now),e=>e.status===400);
 for(const actions of [['ai','ai'],['unknown'],[]])assert.throws(()=>validateAssetAccessInput(input(actions),{ids,detail:true}),e=>e.status===400);
});
test('new purposes still require fixed-version current discovery, subset, expiry and real protocol kind',()=>{
 const r=structuredClone(record);r.registry.kind='dataset';const v=validateAssetAccessInput(input(['apply']),{ids,detail:true});assert.throws(()=>assetAccessTransition(r,v,p,now),e=>e.status===422);
 const value=validateAssetAccessInput(input(['comment','ai']),{ids,detail:true});assert.throws(()=>assetAccessTransition(record,value,p,now+200000),e=>e.status===409);
 r.registry.kind='protocol';r.grants=[{requestId:'ask',version:1,revision:1,recipientAccountId:'owner',requestedActions:['comment'],actions:[],state:'pending',expiresAt:new Date(now+90000).toISOString()}];
 assert.throws(()=>assetAccessTransition(r,{...value,action:'decide',requestId:'ask',expectedRequestRevision:1,conclusion:'approved',actions:['ai'],reason:'核对'},admin,now),e=>e.status===422);
});
test('related reuse projection never emits target IDs, study names or links without current target authorization',async()=>{
 const {previewAssetView}=await import('./research-assets-catalog-views.mjs');const r=structuredClone(record);r.registry.assetId='asset';r.policies[0].metadata={title:'合成'};r.policies[0].sourceBindings=[];
 const result=await previewAssetView({tx:{$queryRawUnsafe:async()=>[{kind:'apply',created_at:new Date(now)}]},records:[r],principal:admin,id:'asset',version:1,tab:'citations',now});assert.deepEqual(result.reuse,[{kind:'apply',at:new Date(now).toISOString(),targetAvailable:false}]);assert(!JSON.stringify(result).includes('target_project_id'));
});
