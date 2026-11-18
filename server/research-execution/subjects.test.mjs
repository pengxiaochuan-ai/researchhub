import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubjectsService} from './subjects.mjs';
const user={tenantId:'t',accountId:'u',authVersion:1};
const ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p'};
function fixture(menus=['subjects'],buttons=['subject.create'],readers={}){
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>({status:'active'})},studyGroupMembership:{findFirst:async()=>({status:'active',role:{tenantId:'t',status:'active',menuPermissions:menus,buttonPermissions:buttons}})}};
 return {tx,service:createSubjectsService({studies:{withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn(tx,ctx)},core:{},...readers})};
}
test('media result read exposes only its subject while preserving independently authorized import subjects',async()=>{
 const {tx,service}=fixture([],[],{limitedImportRead:async()=>({subjectIds:['import-subject'],visitIds:[]}),limitedMediaRead:async()=>({subjectIds:['media-subject'],visitIds:[]})});
 tx.subject={findMany:async q=>{assert.deepEqual(q.where.id.in,['import-subject','media-subject']);assert.equal(q.where.createdBy,'u');return[{id:'media-subject',subjectId:'MEDIA-01'}];}};
 const result=await service.list(user,'study');assert.equal(result.items.length,1);assert.equal(result.capabilities.canCreate,false);
});
test('absent media authority preserves the pre-existing import denial code',async()=>{
 const old=Object.assign(Error('old scoped denial'),{status:403,code:'DATA_IMPORT_PERMISSION_CHANGED'}),{service}=fixture([],[],{limitedImportRead:async()=>{throw old;},limitedMediaRead:async()=>null});
 await assert.rejects(service.list(user,'study'),e=>e===old);
});
test('subject menu and create button are both required',async()=>{
 for(const [menus,buttons] of [[[],['subject.create']],[['subjects'],[]]]){
  const {service}=fixture(menus,buttons);
  await assert.rejects(service.create(user,'study',{requestKey:'request-123',subjectId:'S1'}),e=>e.code==='RESEARCH_FORBIDDEN');
 }
});
test('rejects extra fields and invalid pseudonymous identifiers',async()=>{
 const {service}=fixture();
 for(const body of [{requestKey:'request-123',subjectId:'S1',sex:'F'},{requestKey:'request-123',subjectId:'invalid id'}])await assert.rejects(service.create(user,'study',body),e=>e.code==='RESEARCH_INPUT_INVALID');
});
test('subject detail supplies real scoped visit titles and preserves source versions',async()=>{
 const {tx,service}=fixture();
 tx.subject={findFirst:async()=>({id:'s',subjectId:'S1'})};tx.studyEnrollment={findFirst:async()=>({id:'e',protocolVersionId:'new'})};
 tx.subjectVisit={findMany:async()=>[{id:'oldVisit',visitPlanId:'oldPlan',protocolVersionId:'old',status:'cancelled'},{id:'newVisit',visitPlanId:'newPlan',protocolVersionId:'new',status:'planned'}]};
 tx.visitPlan={findMany:async q=>{assert.deepEqual(q.where,{tenantId:'t',studyGroupId:'g',researchProjectId:'p',id:{in:['oldPlan','newPlan']}});return [{id:'oldPlan',protocolVersionId:'old',name:'原基线',sequence:1},{id:'newPlan',protocolVersionId:'new',name:'新基线',sequence:1}];}};
 const result=await service.detail(user,'study','s');assert.deepEqual(result.visits.map(v=>v.visitPlan.name),['原基线','新基线']);assert.equal(result.visits[0].protocolVersionId,'old');assert.equal(result.visits[0].status,'cancelled');
});
test('missing or mismatched visit plan fails closed instead of guessing its title',async()=>{
 const {tx,service}=fixture();tx.subject={findFirst:async()=>({id:'s',subjectId:'S1'})};tx.studyEnrollment={findFirst:async()=>({id:'e'})};tx.subjectVisit={findMany:async()=>[{id:'v',visitPlanId:'p1',protocolVersionId:'old'}]};
 tx.visitPlan={findMany:async()=>[{id:'p1',protocolVersionId:'other',name:'不可作为该访视名称',sequence:1}]};
 await assert.rejects(service.detail(user,'study','s'),e=>e.code==='SUBJECT_VISIT_BINDING_UNAVAILABLE');
});
