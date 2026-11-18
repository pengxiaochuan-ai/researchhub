import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessAssetRegistration,businessRegistrationRequestHash} from '../server/research-assets/business-registration.mjs';
const principal={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'third-member',permissions:['artifact.read','artifact.create','artifact.edit'],identityRevision:'current'};
const input=()=>({kind:'protocol',metadata:{title:'合成研究方案',summary:'摘要',purpose:'方案复用',limitations:'非临床',author:'研究者'},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'本人原创',discoveryRecipients:[]},contentMd:'合成方案正文',requestKey:'business-register-test-001'});
test('malformed business registration and caller authority fields are rejected before access',async()=>{
 const service=createBusinessAssetRegistration({withAccess:()=>assert.fail('invalid payload entered authorization')});
 await assert.rejects(service.register({}, {...input(),ownerAccountId:'admin'}),e=>e.status===400);
 await assert.rejects(service.revise({},'legacy-id',{...input(),baseVersion:1,expectedRevision:1}),e=>e.status===400);
});
test('business registration performs current create permission before checking replay or source',async()=>{
 const permissions=[],blocked=Error('current authorization failed');
 const service=createBusinessAssetRegistration({withAccess:async(_user,permission)=>{permissions.push(permission);throw blocked;}});
 await assert.rejects(service.register({},input()),e=>e===blocked);
 await assert.rejects(service.options({}),e=>e===blocked);
 assert.deepEqual(permissions,['artifact.create','artifact.read']);
});
test('business replay returns original outcome without allocating a new artifact',async()=>{
 const receipt={assetId:'rhab-11111111-1111-4111-8111-111111111111',version:1,revision:1,operation:'created',status:'committed'};
 const {validateAssetRegistration}=await import('../scripts/research-assets-registration-contract.mjs');
 const value=validateAssetRegistration(input(),{family:'business'});
 const tx={$queryRawUnsafe:async()=>[{request_hash:businessRegistrationRequestHash(value,principal),result_receipt:receipt}],researchArtifact:{create:()=>assert.fail('replay must not create')}};
 const service=createBusinessAssetRegistration({withAccess:async(_u,_p,run)=>run(tx,principal)});
 assert.deepEqual(await service.register({},input()),receipt);
 await assert.rejects(service.register({}, {...input(),contentMd:'changed'}),e=>e.status===409);
});
test('unproved knowledge or upload cannot be admitted as self-authored',async()=>{
 const tx={$queryRawUnsafe:async()=>[],researchArtifact:{create:()=>assert.fail('unproved source must not create')}};
 const service=createBusinessAssetRegistration({withAccess:async(_u,_p,run)=>run(tx,principal)});
 await assert.rejects(service.register({}, {...input(),sourceKind:'knowledge',sourceBindings:[{kind:'knowledge',id:'doc',version:1,contentHash:'a'.repeat(64)}]}),e=>e.code==='ASSET_CATALOG_SOURCE_INVALID');
 const upload=input();delete upload.contentMd;
 await assert.rejects(service.register({}, {...upload,sourceKind:'upload',uploadId:'file-123'}),e=>e.code==='ASSET_CATALOG_SOURCE_INVALID');
});
