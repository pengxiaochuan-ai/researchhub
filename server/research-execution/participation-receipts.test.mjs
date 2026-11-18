import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnrollmentService} from './enrollment.mjs';
import {createSubjectsService} from './subjects.mjs';

function fixture(kind){
 let allowed=true,saved,reads=0,authorized=0;
 const user={tenantId:'t',accountId:'u',authVersion:1},ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p'};
 const tx={subject:{findFirst:async()=>({id:'s'})},tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>allowed?{status:'active'}:null},studyGroupMembership:{findFirst:async()=>({status:'active',role:{tenantId:'t',status:'active',menuPermissions:['subjects','workbench'],buttonPermissions:['subject.create','study.execute']}})}};
 const studies={withResearchStudyTransaction:async(_u,_s,_op,fn)=>{authorized++;return fn(tx,ctx);}};
 const receipts={getReceipt:async()=>{reads++;return saved;}};
 const core={authorize:async()=>{if(!allowed)throw Object.assign(Error('revoked'),{status:403});return user;},context:async()=>{if(!allowed)throw Object.assign(Error('revoked'),{status:403});return {};}};
 const service=kind==='create'?createSubjectsService({studies,core,receipts}):createEnrollmentService({studies,core,receipts});
 return {user,lookup:key=>kind==='create'?service.receipt(user,'study',key):service.receipt(user,'study','s',key),setSaved:value=>saved=value,revoke:()=>allowed=false,get reads(){return reads;},get authorized(){return authorized;}};
}

test('historical participation receipt can be confirmed without a currently executing protocol',async()=>{
 let authorityChecked=false,queried=false;
 const tx={subject:{findFirst:async q=>{assert.deepEqual(q.where,{tenantId:'t',studyGroupId:'g',researchProjectId:'p',id:'s',deletedAt:null,acceptanceFixture:false});return {id:'s'};}}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const result={studyId:'study',receipt:{requestKey:'original_request',action:'participation.record',targetId:'s'}};
 const service=createEnrollmentService({studies,core:{authorize:async(_tx,user)=>{authorityChecked=true;return user;},context:async()=>{throw Error('NO_EXECUTING_PROTOCOL');}},receipts:{getReceipt:async()=>{queried=true;assert.equal(authorityChecked,true);return {action:'participation.record',target_id:'s',result};}}});
 assert.deepEqual(await service.receipt({tenantId:'t',accountId:'u',authVersion:0},'study','s','original_request'),result);assert.equal(queried,true);
});

for(const kind of ['create','participation']){
 test(`${kind} receipt recovery requires current authority and the original Study, target and action`,async()=>{
  const f=fixture(kind),action=kind==='create'?'subject.create':'participation.record',target=kind==='create'?'study':'s';
  const result={studyId:'study',receipt:{requestKey:'original_request',action,targetId:target}};
  f.setSaved({action,target_id:target,result});
  assert.deepEqual(await f.lookup('original_request'),result);assert.equal(f.authorized,1);assert.equal(f.reads,1);
  for(const mismatch of [{...result,studyId:'other'}, {...result,receipt:{...result.receipt,requestKey:'different_key'}}]){
   f.setSaved({action,target_id:target,result:mismatch});
   await assert.rejects(f.lookup('original_request'),e=>e.status===404);
  }
  for(const saved of [undefined,{action:'protocol.activate',target_id:target,result},{action,target_id:'other',result}]){
   f.setSaved(saved);await assert.rejects(f.lookup('original_request'),e=>e.status===404);
  }
  f.setSaved({action,target_id:target,result});const before=f.reads;f.revoke();
  await assert.rejects(f.lookup('original_request'),e=>e.status===403);assert.equal(f.reads,before);
 });
 test(`${kind} receipt recovery validates keys and performs no write or replay`,async()=>{
  const f=fixture(kind);
  await assert.rejects(async()=>f.lookup('../invalid'),e=>e.code==='RESEARCH_INPUT_INVALID');
  assert.equal(f.authorized,0);assert.equal(f.reads,0);
 });
}
