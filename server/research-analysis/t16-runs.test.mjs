import test from 'node:test';import assert from 'node:assert/strict';
import {createT16Runs} from './t16-runs.mjs';
test('Study resolution commits before Methods invocation and client values cannot become analysis inputs',async()=>{
 let active=false,calls=0;const context={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'},user={tenantId:'tenant',accountId:'actor',authVersion:1};
 const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>{active=true;try{return await fn({},context);}finally{active=false;}}};
 const methods={createFromWorkbench:async(u,input)=>{assert(!active);assert.equal(u.researchProjectId,'project');assert.deepEqual(input.input,{studyId:'study',snapshotId:'snapshot'});calls++;return{id:'run',status:'needs_review'};}};
 const api=createT16Runs({studies,methods});const result=await api.create(user,'study',{requestKey:'request-1234',snapshotId:'snapshot'});assert.equal(calls,1);assert.deepEqual(result.receipt,{requestKey:'request-1234',action:'analysis.run.create',targetId:'study',runId:'run'});
 await assert.rejects(api.create(user,'study',{requestKey:'request-2345',snapshotId:'snapshot',rows:[1]}));assert.equal(calls,1);
});
test('receipt lookup is actor and Study bound and unknown never invokes creation',async()=>{
 let where,creates=0;const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn({researchMethodRun:{findFirst:async args=>{where=args.where;return null;}}},{tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'})};
 const api=createT16Runs({studies,methods:{createFromWorkbench:async()=>{creates++;}}});await assert.rejects(api.receipt({tenantId:'tenant',accountId:'actor'},'study','unknown-key'),e=>e.status===404);assert.equal(where.accountId,'actor');assert.deepEqual(where.inputSummary,{path:['studyId'],equals:'study'});assert.equal(creates,0);
});
test('capabilities are exact Study/run permission metadata from Methods without exposing Run outputs',async()=>{
 let active=false,where,called=0;const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>{active=true;try{return await fn({researchMethodRun:{findFirst:async args=>{where=args.where;return{id:'run'};}}},{tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'});}finally{active=false;}}};
 const methods={getDescriptiveCapabilities:async(user,runId)=>{assert(!active);assert.equal(user.researchProjectId,'project');assert.equal(runId,'run');called++;return{runId,status:'cancelled',reviewStatus:'pending_review',capabilities:{canReview:false,canCancel:true},outputs:{private:1},sourceHash:'private'};}};
 const api=createT16Runs({studies,methods}),result=await api.capabilities({tenantId:'tenant',accountId:'actor'},'study','run');
 assert.deepEqual(result,{studyId:'study',runId:'run',status:'cancelled',reviewStatus:'pending_review',capabilities:{canReview:false,canCancel:true}});assert.deepEqual(where.inputSummary,{path:['studyId'],equals:'study'});assert.equal(where.skillKey,'descriptive-statistics');assert.equal(called,1);
 methods.getDescriptiveCapabilities=async()=>({runId:'other',status:'cancelled',reviewStatus:'pending_review',capabilities:{canReview:true,canCancel:true}});await assert.rejects(api.capabilities({},'study','run'),e=>e.status===503);
 methods.getDescriptiveCapabilities=async()=>({runId:'run',status:'cancelled',reviewStatus:'pending_review',capabilities:{canReview:'true',canCancel:true}});await assert.rejects(api.capabilities({},'study','run'),e=>e.status===503);
});

test('capabilities adapter refuses missing or non-string current state instead of inventing cancel recovery',async()=>{
 const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn({researchMethodRun:{findFirst:async()=>({id:'run'})}},{tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'})};
 for(const state of [{},{status:true,reviewStatus:'pending_review'},{status:'cancelled',reviewStatus:null}]){
  const api=createT16Runs({studies,methods:{getDescriptiveCapabilities:async()=>({runId:'run',...state,capabilities:{canReview:true,canCancel:true}})}});
  await assert.rejects(api.capabilities({},'study','run'),error=>error.status===503);
 }
});
