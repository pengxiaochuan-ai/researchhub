import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPolicyDraftService} from './policy-drafts.mjs';
const user={accountId:'u',tenantId:'t'};
test('hub ownership alone cannot save or approve policy',async()=>{
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({tenantId:'t',role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const service=createPolicyDraftService({studies});
 await assert.rejects(service.save(user,'study','protocol',{requestKey:'12345678',expectedPolicyId:null,sections:{}}),e=>e.code==='RESEARCH_FORBIDDEN');
});
test('feature entitlement is required even for tenant admin',async()=>{
 const tx={tenantFeatureEntitlement:{findFirst:async()=>null}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 await assert.rejects(createPolicyDraftService({studies}).save(user,'study','protocol',{requestKey:'12345678',expectedPolicyId:null,sections:{}}),e=>e.code==='FEATURE_NOT_ENABLED');
});
test('policy save appends a version, replays a request, and rejects stale updates',async()=>{
 const policies=[],receipts=[];let audit=0;
 const tx={
  tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({tenantId:'t',role:'tenant_admin',isTenantAdmin:true})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},auditLog:{createMany:async()=>{audit++;}},
  $queryRaw:async(parts,...v)=>{const sql=parts.join('?');if(sql.includes('pg_advisory'))return [{}];if(sql.includes('FROM public.study_protocol_version'))return [{id:'protocol',status:'draft'}];if(sql.includes('FROM rh_research.operation'))return receipts.filter(x=>x.request_key===v[2]);if(sql.includes('FROM public.study_execution_policy_version'))return policies.slice(-1);throw Error(sql);},
  $executeRaw:async(parts,...v)=>{const sql=parts.join('?');if(sql.includes('INSERT INTO public.study_execution_policy_version')){policies.push({id:v[0],versionNumber:v[5],status:'draft',sections:JSON.parse(v[6]),contentHash:v[7],createdAt:new Date('2026-11-11T00:00:00.000Z'),reviewedAt:null});return 1;}if(sql.includes('INSERT INTO rh_research.operation')){receipts.push({request_key:v[3],request_hash:v[4],action:v[5],target_id:v[6],result:JSON.parse(v[7])});return 1;}throw Error(sql);},
 };
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const svc=createPolicyDraftService({studies}),body={requestKey:'savekey01',expectedPolicyId:null,sections:{}};
 const first=await svc.save(user,'study','protocol',body);const retry=await svc.save(user,'study','protocol',body);
 assert.deepEqual(retry,first);assert.equal(policies.length,1);assert.equal(audit,1);
 await assert.rejects(svc.save(user,'study','protocol',{...body,requestKey:'savekey02'}),e=>e.code==='RESEARCH_VERSION_CONFLICT');
 assert.equal(policies.length,1);
});
