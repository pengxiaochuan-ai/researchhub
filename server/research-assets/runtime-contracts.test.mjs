import test from'node:test';import assert from'node:assert/strict';
import{validateAssetAccessInput,assetAccessTransition}from'../../scripts/local-research-assets-access.mjs';
import{validateAssetGovernance}from'../../scripts/research-assets-governance-contract.mjs';
const ids={owner:'old-owner',admin:'old-admin'},binding={version:9,expectedRevision:30,requestKey:'runtime_request_01',contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),identityRevision:'current-identity'};
test('runtime uses real recipient identities and business version bounds only when explicitly selected',()=>{
 const v={...binding,action:'share',recipientAccountId:'current-member',actions:['read_body','derive'],purpose:'Synthetic review',reason:'Rights confirmed',ttlDays:1};
 assert.throws(()=>validateAssetAccessInput(v,{ids,detail:true}),e=>e.status===400);assert.equal(validateAssetAccessInput(v,{ids,detail:true,runtimeBusiness:true}).recipientAccountId,'current-member');
 for(const change of [{version:2147483648},{expectedRevision:0},{ttlDays:8},{recipientAccountId:'../other'}])assert.throws(()=>validateAssetAccessInput({...v,...change},{ids,detail:true,runtimeBusiness:true}),e=>e.status===400);
});
test('runtime sharing still requires the immutable source ceiling and live release',()=>{
 const now=Date.now(),p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'asset-owner',identityRevision:'current-identity'},record={family:{family:'business',maxOperations:2147483647},registry:{...p,assetId:'rhab-00000000-0000-4000-8000-000000000001',kind:'protocol',ownerAccountId:p.accountId,revision:30,workingVersionNo:9,workingState:'approved'},policies:[{version:9,sourceValid:true,contentHash:binding.contentHash,policyHash:binding.policyHash,rightsEvidence:'Synthetic only',discoveryRecipientCeiling:['permitted-member']}],events:[{version:9,revision:30,type:'released',discoveryRecipients:['permitted-member'],expiresAt:new Date(now+86400000).toISOString()}],grants:[]};
 const v={...binding,action:'share',recipientAccountId:'not-licensed',actions:['derive'],purpose:'Synthetic reuse',reason:'Check license',ttlDays:1};
 assert.throws(()=>assetAccessTransition(record,v,p,now,{runtimeBusiness:true}),e=>e.status===422);
 const result=assetAccessTransition(record,{...v,recipientAccountId:'permitted-member'},p,now,{runtimeBusiness:true});assert.deepEqual(result.request.actions,['derive']);
 record.events.push({type:'withdrawn',version:9,revision:31});assert.throws(()=>assetAccessTransition(record,{...v,recipientAccountId:'permitted-member'},p,now,{runtimeBusiness:true}),e=>e.status===409);
});
test('portable release input keeps the first seven-day and bounded distinct recipient contract',()=>{
 const v={...binding,action:'release',reason:'Scope reviewed',ttlDays:7,discoveryRecipients:['current-member']};
 assert.throws(()=>validateAssetGovernance(v,{ids,family:'business'}),e=>e.status===400);assert.equal(validateAssetGovernance(v,{ids,family:'business',runtimeBusiness:true}).discoveryRecipients[0],'current-member');
 for(const change of [{ttlDays:8},{discoveryRecipients:['x','x']},{discoveryRecipients:['bad/recipient']},{discoveryRecipients:Array.from({length:101},(_,i)=>'member-'+i)}])assert.throws(()=>validateAssetGovernance({...v,...change},{ids,family:'business',runtimeBusiness:true}),e=>e.status===400);
});
