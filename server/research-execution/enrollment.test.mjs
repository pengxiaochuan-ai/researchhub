import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnrollmentService} from './enrollment.mjs';
test('same request replays receipt after current authorization; altered content conflicts',async()=>{
 let receipt,auth=0,recorded=0;
 const receipts={getReceipt:async()=>receipt,saveReceipt:async(_tx,_user,data)=>{receipt={id:data.id,request_hash:data.hash,action:data.action,target_id:data.target,result:data.result}}};
 const tx={$queryRaw:async()=>[],auditLog:{createMany:async()=>({count:1})}};
 const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const ctx={actor:{tenantId:'t',accountId:'u',authVersion:0},subject:{id:'s',subjectId:'S'},enrollment:null,protocol:{id:'pr'},policy:{id:'po',contentHash:'a'.repeat(64)},events:[]};
 const core={context:async()=>{auth++;return ctx},evaluate:()=>['screening_missing'],record:async(_tx,_actor,_scope,_subject,event)=>{recorded++;const value={id:'event',sequence:1,protocolVersionId:'pr',policyVersionId:'po',policyHash:'a'.repeat(64)};ctx.events=[{...value,...event,recordedBy:'u'}];return value;}};
 const api=createEnrollmentService({studies,core,receipts}),user={tenantId:'t',accountId:'u',authVersion:0};
 const body={requestKey:'request_123',expectedPolicyVersionId:'po',expectedPolicyHash:'a'.repeat(64),event:{kind:'screening',decision:'passed',method:'manual',evidence:'case',effectiveAt:'2026-11-11T00:00:00.000Z'}};
 const first=await api.record(user,'study','s',body),second=await api.record(user,'study','s',body);
 assert.deepEqual(second,first);assert.equal(recorded,1);assert.equal(auth,3);
 await assert.rejects(api.record(user,'study','s',{...body,event:{...body.event,evidence:'other'}}),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');
});
test('stale policy and site request cannot create facts; receipt replay rechecks authority',async()=>{
 let revoked=false,recorded=0,receipt;
 const tx={$queryRaw:async()=>[],auditLog:{createMany:async()=>({count:1})}},studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const current={actor:{tenantId:'t',accountId:'u',authVersion:0},subject:{id:'s',subjectId:'S'},enrollment:null,protocol:{id:'pr',status:'executing'},policy:{id:'po',contentHash:'a'.repeat(64),sections:{}},events:[]};
 const core={context:async()=>{if(revoked)throw Error('authority revoked');return current;},evaluate:()=>[],record:async(_tx,_actor,_scope,_subject,event)=>{recorded++;const value={id:'event',sequence:1,protocolVersionId:'pr',policyVersionId:'po',policyHash:'a'.repeat(64)};current.events=[{...value,...event,recordedBy:'u'}];return value;}};
 const receipts={getReceipt:async()=>receipt,saveReceipt:async(_tx,_user,data)=>{receipt={id:data.id,request_hash:data.hash,action:data.action,target_id:data.target,result:data.result}}};
 const api=createEnrollmentService({studies,core,receipts}),user={tenantId:'t',accountId:'u',authVersion:0},body={requestKey:'request_987',expectedPolicyVersionId:'po',expectedPolicyHash:'a'.repeat(64),event:{kind:'screening',decision:'passed'}};
 await assert.rejects(api.record(user,'study','s',{...body,expectedPolicyHash:'b'.repeat(64)}),e=>e.code==='PARTICIPATION_POLICY_CHANGED');
 assert.throws(()=>api.enroll(user,'study','s',{requestKey:'request_888',expectedPolicyVersionId:'po',expectedPolicyHash:'a'.repeat(64),siteId:'other'}));assert.equal(recorded,0);
 const result=await api.record(user,'study','s',body);assert.equal(result.studyId,'study');assert.deepEqual(result.policy.sections,{});revoked=true;
 await assert.rejects(api.record(user,'study','s',body),/authority revoked/);assert.equal(recorded,1);
});
test('snapshot exposes authorized, state-aware actions and approved requirements',async()=>{
 const tx={},studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 let context={subject:{id:'s',subjectId:'S'},enrollment:null,protocol:{id:'pr',status:'executing',title:'Protocol',versionNumber:2},policy:{id:'po',contentHash:'a'.repeat(64),sections:{screening:{status:'configured',rules:{decisionMethod:'manual'}},researchConsent:{status:'configured',rules:{textVersion:'v1'}},dataUse:{status:'configured',rules:{scope:'scope'}}}},events:[]};
 const core={context:async()=>context,evaluate:()=>['screening_missing']};const api=createEnrollmentService({studies,core});
 let result=await api.get({tenantId:'t',accountId:'u'},'study','s');assert.equal(result.protocol.title,'Protocol');assert.equal(result.protocol.versionNumber,2);assert.equal(result.capabilities.canRecordScreening,true);assert.equal(result.capabilities.canEnroll,false);assert.ok(result.disableReasons.canEnroll);assert.equal(result.capabilities.canExit,false);
 context={...context,enrollment:{id:'e',status:'withdrawn'}};result=await api.get({tenantId:'t',accountId:'u'},'study','s');assert.equal(result.capabilities.canExit,false);assert.equal(result.capabilities.canRecordDataUseConsent,false);assert.ok(result.disableReasons.canRecordDataUseConsent);
 context={...context,enrollment:null,policy:{...context.policy,sections:{...context.policy.sections,screening:{status:'configured',rules:{decisionMethod:'unknown'}}}}};result=await api.get({tenantId:'t',accountId:'u'},'study','s');assert.equal(result.capabilities.canRecordScreening,false);assert.ok(result.disableReasons.canRecordScreening);
});
