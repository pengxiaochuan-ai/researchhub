import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetRegistration} from './local-research-assets-registration.mjs';
const ids={owner:'owner',admin:'admin'};
const input={kind:'protocol',metadata:{title:'合成方案',summary:'摘要',purpose:'方法讨论',limitations:'非临床',author:'合成作者'},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'原创合成',discoveryRecipients:['owner','admin']},contentMd:'仅合成方法说明。',requestKey:'register-test-1'};
test('invalid registration never enters an authorized mutation transaction',async()=>{
 const service=createAssetRegistration({ids,withAccess:()=>assert.fail('invalid input must not enter database')});
 await assert.rejects(service.register({}, {...input,ownerAccountId:'admin'}),e=>e.status===400);
 await assert.rejects(service.revise({},'id',{...input,baseVersion:0,expectedRevision:1}),e=>e.status===409);
});
test('create and revise require their distinct current permissions before touching storage',async()=>{
 const sentinel=new Error('authorization-boundary');const permissions=[];
 const service=createAssetRegistration({ids,withAccess:async(user,p)=>{assert.equal(user.accountId,'owner');permissions.push(p);throw sentinel;}});
 await assert.rejects(service.register({accountId:'owner'},input),e=>e===sentinel);
 await assert.rejects(service.revise({accountId:'owner'},'asset',{...input,baseVersion:1,expectedRevision:1}),e=>e===sentinel);
 await assert.rejects(service.edit({accountId:'owner'},'asset',1),e=>e===sentinel);
 await assert.rejects(service.options({accountId:'owner'}),e=>e===sentinel);
 assert.deepEqual(permissions,['artifact.create','artifact.edit','artifact.edit','artifact.read']);
});
