import test from 'node:test';
import assert from 'node:assert/strict';
import {createFormalCaptureService} from './formal-capture.mjs';
const user={tenantId:'tenant',accountId:'actor',authVersion:4},ctx={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'},tx={};
const ref={responseId:'response',assignmentId:'assignment',revisionNo:1,contentHash:'a'.repeat(64)};
function fixture(){const calls=[];const studies={withResearchStudyTransaction:async(u,id,operation,fn)=>{assert.equal(u,user);assert.equal(id,'study');assert.equal(operation,'read');return fn(tx,ctx);}};const core=Object.fromEntries(['write','review'].map(name=>[name,async(...args)=>{calls.push({name,args});return {version:1};}]));return {calls,api:createFormalCaptureService({studies,core})};}
test('draft forwards zero, false and initial CAS in the same authorized Study transaction',async()=>{
 const {calls,api}=fixture(),body={requestKey:'request-key',expectedVersion:0,answers:{value:0,completed:false}};
 const result=await api.write(user,'study','assignment','draft',body);
 assert.deepEqual(calls,[{name:'write',args:[tx,user,{tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},'assignment',{...body,kind:'draft'}]}]);
 assert.equal(result.studyId,'study');assert.deepEqual(result.receipt,{requestKey:body.requestKey,action:'form.draft',targetId:'assignment'});
});
test('correction and review retain fixed source and explicit reason for core validation',async()=>{
 const {calls,api}=fixture();await api.write(user,'study','assignment','correct',{requestKey:'correct-key',expectedVersion:2,answers:{value:1},expectedRef:ref,reason:'source corrected'});
 await api.review(user,'study','assignment','review',{requestKey:'review-key',expectedVersion:3,expectedRef:ref,decision:'returned',reason:'please verify source'});
 assert.equal(calls[0].args[4].expectedRef,ref);assert.equal(calls[0].args[4].reason,'source corrected');assert.equal(calls[1].args[4].kind,'review_returned');assert.equal('decision' in calls[1].args[4],false);
});
test('scope, actor, unsupported actions and malformed baselines never reach the business core',async()=>{
 const {calls,api}=fixture(),body={requestKey:'request-key',expectedVersion:0,answers:{value:0}};
 for(const invalid of [{...body,tenantId:'other'},{...body,actorId:'other'},{...body,expectedVersion:-1},{...body,expectedVersion:0.5},{...body,answers:[]}])await assert.rejects(async()=>api.write(user,'study','assignment','draft',invalid),e=>e.status===400);
 await assert.rejects(async()=>api.write(user,'study','assignment','delete',body),e=>e.status===400);
 await assert.rejects(async()=>api.write(user,'study','assignment','correct',{...body,reason:'x',expectedRef:{...ref,assignmentId:'other'}}),e=>e.status===400);assert.equal(calls.length,0);
});
test('core failures propagate without manufacturing success or receipt',async()=>{
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,ctx)},error=Object.assign(Error('revoked'),{status:403});
 const api=createFormalCaptureService({studies,core:{write:async()=>{throw error;}}});
 await assert.rejects(api.write(user,'study','assignment','submit',{requestKey:'submit-key',expectedVersion:0,answers:{}}),e=>e===error);
});
test('assignment retry uses the same receipt, after current authority and parent validation',async()=>{
 const calls=[],user={tenantId:'tenant',accountId:'actor'},tx={$queryRaw:async()=>[],auditLog:{createMany:async()=>({count:1})}},scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
 const studies={withResearchStudyTransaction:async(_u,_s,_o,fn)=>fn(tx,ctx)};let saved;
 const receipts={getReceipt:async()=>saved,saveReceipt:async(_tx,_user,value)=>{saved={request_hash:value.hash,action:value.action,target_id:value.target,result:value.result};}};
 const core={authorize:async()=>calls.push('authority'),assign:async()=>{calls.push('assign');return {id:'assignment',subjectVisitId:'visit',formVersionId:'form'};},read:async()=>{calls.push('parent');return {assignment:{id:'assignment',subjectVisitId:'visit',formVersion:{id:'form'}}};}};
 const api=createFormalCaptureService({studies,core,receipts}),body={requestKey:'assign-key',formVersionId:'form'};
 const first=await api.assign(user,'study','visit',body),second=await api.assign(user,'study','visit',body);
 assert.deepEqual(second,first);assert.deepEqual(calls,['authority','assign','authority','parent']);
 await assert.rejects(api.assign(user,'study','visit',{...body,formVersionId:'different'}),e=>e.status===409);
});
test('assignment and response receipt reads never replay a write',async()=>{
 const {api}=fixture();
 await assert.rejects(async()=>api.receipt(user,'study','assignment','request-key',{operation:'delete'}),e=>e.status===400);
});

test('history cursor is signed and bound to study, actor and assignment',async()=>{
 const core={listRevisions:async(_tx,_u,_s,assignment,input)=>({items:[{ref:{...ref,assignmentId:assignment,revisionNo:2}}],nextBeforeRevisionNo:2,legacyUnversioned:false}),readRevision:async(_tx,_u,_s,_a,r)=>({ref:r,answers:{value:0}})};
 const studies={withResearchStudyTransaction:async(_u,_s,_o,fn)=>fn(tx,ctx)},api=createFormalCaptureService({studies,core,cursorSecret:'test-secret'});
 const page=await api.historyList(user,'study','assignment',{limit:'1'});assert.equal(page.items[0].ref.revisionNo,2);assert.ok(page.nextCursor);
 await api.historyList(user,'study','assignment',{limit:'1',cursor:page.nextCursor});
 await assert.rejects(async()=>api.historyList({...user,authVersion:5},'study','assignment',{cursor:page.nextCursor}),e=>e.status===400);
 await assert.rejects(async()=>api.historyList(user,'study','other',{cursor:page.nextCursor}),e=>e.status===400);
 const detail=await api.historyRead(user,'study','assignment',ref);assert.equal(detail.revision.answers.value,0);
});
