import test from 'node:test';import assert from 'node:assert/strict';import {createSubjectsService} from '../research-execution/subjects.mjs';
test('P05 result read is limited to receipt subject IDs and never grants ordinary creation or full Study reading',async()=>{
 const user={tenantId:'t',accountId:'owner',authVersion:5},ctx={tenantId:'t',studyId:'study',studyGroupId:'g',executionProjectId:'p'},tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>({status:'active'})},studyGroupMembership:{findFirst:async()=>({status:'active',role:{tenantId:'t',status:'active',menuPermissions:['workbench'],buttonPermissions:[]}})},subject:{findMany:async q=>{assert.deepEqual(q.where.id,{in:['new-subject']});assert.equal(q.where.createdBy,'owner');return[{id:'new-subject',subjectId:'P05-OWNER-A'}];}}};
 const studies={withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn(tx,ctx)},read=async()=>({subjectIds:['new-subject'],visitIds:[]}),api=createSubjectsService({studies,core:{},limitedImportRead:read});
 const result=await api.list(user,'study');assert.equal(result.items[0].id,'new-subject');assert.equal(result.capabilities.canCreate,false);
 await assert.rejects(api.create(user,'study',{requestKey:'new-subject-request',subjectId:'P05-OWNER-C'}),e=>e.code==='RESEARCH_FORBIDDEN');
 await assert.rejects(createSubjectsService({studies,core:{}}).list(user,'study'),e=>e.code==='RESEARCH_FORBIDDEN');
});
