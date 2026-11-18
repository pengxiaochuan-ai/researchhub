import test from 'node:test';import assert from 'node:assert/strict';
import {validateAssetAccessInput,assetAccessTransition,createAssetUsage} from './local-research-assets-access.mjs';
const ids={owner:'owner',admin:'admin'},now=Date.parse('2026-11-13T00:00:00Z'),p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner',identityRevision:'identity',permissions:['artifact.read']},admin={...p,accountId:'admin',isTenantAdmin:true};
const record={registry:{...p,assetId:'asset',ownerAccountId:'admin',revision:4,workingVersionNo:1,workingState:'approved',deletedAt:null},policies:[{version:1,sourceValid:true,contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),rightsEvidence:'原创合成',discoveryRecipientCeiling:['owner','admin']}],events:[{version:1,revision:4,type:'released',discoveryRecipients:['owner'],expiresAt:new Date(now+86400000).toISOString()}],grants:[]};
const input=(action,extra={})=>({action,version:1,expectedRevision:4,requestKey:'access-original-key',identityRevision:'identity',contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),...extra});
const run=(i,actor=p,r=record)=>assetAccessTransition(r,validateAssetAccessInput(i,{ids}),actor,now);
test('metadata never grants body, AI, export or application; requests use closed two-purpose contract',()=>{
 for(const a of ['ai','download','derive','apply'])assert.throws(()=>run(input('request',{actions:[a],purpose:'核对方法',ttlDays:1})),e=>e.status===400);
 assert.equal(run(input('request',{actions:['read_body'],purpose:'核对方法',ttlDays:1})).request.state,'pending');
 assert.throws(()=>run(input('cite')),e=>e.status===403);
});
test('self, hidden, unavailable source and duplicate active requests fail closed',()=>{
 const ask=input('request',{actions:['read_body'],purpose:'核对方法',ttlDays:1});
 assert.throws(()=>run(ask,admin),e=>e.status===409);
 const duplicate=structuredClone(record);duplicate.grants=[{version:1,recipientAccountId:'owner',state:'pending',expiresAt:new Date(now+10000).toISOString()}];assert.throws(()=>run(ask,p,duplicate),e=>e.status===409);
 const invalid=structuredClone(record);invalid.policies[0].sourceValid=false;assert.throws(()=>run(ask,p,invalid),e=>e.status===409);
 assert.throws(()=>run(ask,{...p,tenantId:'other'}),e=>e.status===404);
});
test('grant requires owner or administrator, valid release and subset of requested purposes',()=>{
 const r=structuredClone(record);r.grants=[{requestId:'request',version:1,revision:1,recipientAccountId:'owner',initiatorAccountId:'owner',requestedActions:['read_body'],state:'pending',expiresAt:new Date(now+10000).toISOString()}];
 const decide=input('decide',{requestId:'request',expectedRequestRevision:1,conclusion:'approved',actions:['read_body'],reason:'核对用途后授予'});
 assert.throws(()=>run(decide,p,r),e=>e.status===403);assert.equal(run(decide,admin,r).request.state,'approved');
 assert.throws(()=>run({...decide,actions:['cite']},admin,r),e=>e.status===422);
 assert.throws(()=>run({...decide,expectedRequestRevision:2},admin,r),e=>e.status===409);
});
test('expiry, withdrawal and revocation block new citation without restoring permissions',()=>{
 const r=structuredClone(record);r.grants=[{requestId:'request',version:1,revision:1,recipientAccountId:'owner',requestedActions:['cite'],actions:['cite'],state:'approved',expiresAt:new Date(now+10000).toISOString()}];
 assert.equal(run(input('cite'),p,r).type,'cited');
 for(const state of ['revoked','rejected']){r.grants[0].state=state;assert.throws(()=>run(input('cite'),p,r),e=>e.status===403);}
 r.grants[0].state='approved';r.grants[0].expiresAt=new Date(now-1).toISOString();assert.throws(()=>run(input('cite'),p,r),e=>e.status===403);
 r.events.push({type:'withdrawn',version:1,revision:5});assert.throws(()=>run(input('cite'),p,r),e=>e.status===409);
});
test('current identity, policy, content, CAS and seven-day TTL are enforced before mutation',()=>{
 const ask=input('request',{actions:['cite'],purpose:'书目引用',ttlDays:7}),result=run(ask);assert.equal(result.request.expiresAt,record.events[0].expiresAt);
 for(const extra of [{identityRevision:'old'},{expectedRevision:3},{contentHash:'c'.repeat(64)},{policyHash:'c'.repeat(64)}])assert.throws(()=>run({...ask,...extra}),e=>e.status===409);
 assert.throws(()=>run({...ask,ttlDays:8}),e=>e.status===400);
 assert(!Object.hasOwn(result,'memberships'));assert(!Object.hasOwn(result,'roles'));
});
test('current manager may revoke a now-invalid source without approving or re-enabling it',()=>{
 const r=structuredClone(record);r.policies[0].sourceValid=false;r.grants=[{requestId:'request',version:1,revision:1,state:'approved',recipientAccountId:'owner',actions:['read_body']}];
 assert.equal(run(input('revoke',{requestId:'request',expectedRequestRevision:1,reason:'上游来源失效'}),admin,r).request.state,'revoked');
});
test('service validates before opening transaction and uses current read authorization for every usage operation',async()=>{
 const sentinel=new Error('current authorization');let calls=0;const service=createAssetUsage({ids,withAccess:async(_u,permission)=>{assert.equal(permission,'artifact.read');calls++;throw sentinel;}});
 await assert.rejects(service.execute(p,'asset',{action:'ai'}),e=>e.status===400);assert.equal(calls,0);
 await assert.rejects(service.execute(p,'asset',input('request',{actions:['cite'],purpose:'核对',ttlDays:1})),e=>e===sentinel);
 await assert.rejects(service.options(p,'asset',1),e=>e===sentinel);assert.equal(calls,2);
});
