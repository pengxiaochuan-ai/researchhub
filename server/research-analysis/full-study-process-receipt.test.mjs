import test from 'node:test';
import assert from 'node:assert/strict';
import {createFullStudyProcessReceipt} from './full-study-process-receipt.mjs';
import {requestHash} from '../research-studies/contract.mjs';

function fixture(){
 const user={tenantId:'t',accountId:'actor',authVersion:1},s={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},binding={sliceId:'slice',snapshotId:'slice-snapshot',methodKey:'native-key'},g={a:{accountId:'actor',meta:{authVersion:1,snapshotId:'root',slices:[binding]}},current:{basis:{manifestHash:'root-hash',planId:'plan',planReviewId:'review'},manifest:{}}};
 const state={valid:true,allowed:true,nativeChecks:0,writes:0,run:{...s,id:'native-run',accountId:'actor',skillKey:'descriptive-statistics',idempotencyKey:binding.methodKey,inputSummary:{studyId:'study',snapshotId:binding.snapshotId},status:'running'},claim:{id:'claim',...s,accountId:'actor',target:'group',action:'researchhub.full.analysis.process.claim',meta:{requestKey:'process-key',authVersion:1,methodKey:binding.methodKey,snapshotId:binding.snapshotId}},receipt:{action:'full.analysis.run.process',target_id:'group',result:{studyId:'study',runGroupId:'group',claimId:'claim'}}};
 state.claim.meta.requestDigest=requestHash({studyId:'study',id:'group',body:{requestKey:'process-key',expectedStateHash:'a'.repeat(64),limit:1}});state.receipt.request_hash=state.claim.meta.requestDigest;state.receipt.audit_id=state.claim.id;
 const tx={$queryRaw:async()=>state.receipt?[state.receipt]:[],auditLog:{findFirst:async()=>state.claim,findMany:async()=>[]}};
 const deps={transaction:async(_u,_study,fn)=>fn(tx,s,{...user,studyGroupId:'g',researchProjectId:'p'}),group:async()=>{if(!state.valid)throw Object.assign(Error('stale'),{code:'ANALYSIS_BASIS_STALE'});return g;},rows:async()=>state.run?[state.run]:[],present:()=>({id:'group',capabilities:{canReview:true}}),analysis:{assertCurrent:async(_tx,_u,_s,study,snapshot,phase,cache)=>{assert.equal(study,'study');assert.equal(snapshot,binding.snapshotId);assert.equal(phase,'snapshot');assert(cache.has('study:plan:review'));return{basis:{snapshotId:binding.snapshotId}};}},verifyProcessRunInTransaction:async(_tx,_u,row)=>{state.nativeChecks++;if(!state.allowed)throw Object.assign(Error('revoked'),{status:403});return row;}};
 return{user,state,g,read:createFullStudyProcessReceipt(deps)};
}
test('exact compute receipt remains processing for queued/running/missing native outcome and never redispatches',async()=>{
 const f=fixture();for(const status of ['queued','running']){f.state.run.status=status;const r=await f.read(f.user,'study','group','process-key');assert.equal(r.status,'processing');assert.equal(r.executionConfirmed,false);assert.deepEqual(r.group.capabilities,{canReview:false,canCancel:false,canProcessRun:false});}
 f.state.run=null;assert.equal((await f.read(f.user,'study','group','process-key')).executionConfirmed,false);
});
test('a matching actual terminal native run with fresh source proof confirms completion or failure',async()=>{
 const f=fixture();for(const [native,status]of [['needs_review','completed'],['completed','completed'],['needs_input','completed'],['failed','failed'],['cancelled','failed']]){f.state.run.status=native;const r=await f.read(f.user,'study','group','process-key');assert.equal(r.status,status);assert.equal(r.executionConfirmed,true);assert.deepEqual(r.receipt,{requestKey:'process-key',action:'full.analysis.run.process',targetId:'group'});}
 assert.equal(f.state.nativeChecks,5);
});
test('receipt never accepts a different claim, binding, actor, source or native permission',async()=>{
 const f=fixture();f.state.receipt=null;await assert.rejects(f.read(f.user,'study','group','process-key'),e=>e.status===404);
 const a=fixture();a.state.claim.meta.requestKey='other-key';await assert.rejects(a.read(a.user,'study','group','process-key'),e=>e.status===409);
 const b=fixture();b.state.run.inputSummary.snapshotId='other';await assert.rejects(b.read(b.user,'study','group','process-key'),e=>e.status===409);
 const c=fixture();await assert.rejects(c.read({...c.user,accountId:'other'},'study','group','process-key'),e=>e.status===403);
 const d=fixture();d.state.valid=false;await assert.rejects(d.read(d.user,'study','group','process-key'),e=>e.code==='ANALYSIS_BASIS_STALE');
 const e=fixture();e.state.allowed=false;await assert.rejects(e.read(e.user,'study','group','process-key'),x=>x.status===403);
});
test('compute GET binds the original request digest and audit id; legacy or changed claims cannot prove completion',async()=>{
 for(const corrupt of [f=>{f.state.receipt.request_hash='0'.repeat(64);},f=>{f.state.receipt.audit_id='other';},f=>{delete f.state.claim.meta.requestDigest;},f=>{f.state.claim.meta.requestDigest='1'.repeat(64);}]){
  const f=fixture();f.state.run.status='needs_review';corrupt(f);
  await assert.rejects(f.read(f.user,'study','group','process-key'),e=>e.code==='FULL_STUDY_PROCESS_RECEIPT_CHANGED');assert.equal(f.state.nativeChecks,0);
 }
});
