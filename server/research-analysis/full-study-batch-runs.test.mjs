import test from 'node:test';
import assert from 'node:assert/strict';
import {createFullStudyBatchProcess} from './full-study-batch-runs.mjs';
import {fullStudyHash} from './full-study-projection.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
const user={...scope,accountId:'actor',authVersion:3};
const current={basis:{studyId:'study',snapshotId:'root'}};
const hash='a'.repeat(64),targets=['one','two','three'].map(x=>({sliceId:x,methodKey:'key-'+x,snapshotId:'snap-'+x}));
function fixture(){
 const logs=[],audits=[],receipts=[],rs=[],opts={};
 const header={id:'group',accountId:'actor',action:'researchhub.full.analysis.run.group',target:'study',...scope,meta:{snapshotId:'root',manifestHash:hash,authVersion:user.authVersion,slices:targets}};
 const matches=(r,w)=>Object.entries(w).every(([k,v])=>v?.in?v.in.includes(r[k]):r[k]===v);
 const db={
  $queryRaw:async (q,...v)=>q.join('').includes('rh_research.operation')?receipts.filter(r=>r.request_key===v[2]):[],
  $executeRaw:async(_q,...v)=>{receipts.push({request_key:v[3],request_hash:v[4],action:v[5],target_id:v[6],result:JSON.parse(v[7]),audit_id:v[8]});},
  auditLog:{findFirst:async({where})=>[header,...audits].find(a=>matches(a,where)),findMany:async({where})=>audits.filter(a=>matches(a,where)),createMany:async({data})=>{audits.push(data);}}
 };
 const view=Object.create(db);
 const resolver={assertCurrent:async(tx,actor,s,study,id,phase)=>{assert.equal(tx,view);assert.equal(actor,user);assert.deepEqual(s,scope);assert.equal(study,'study');logs.push(phase+':'+id);return{basis:{snapshotId:id}};}};
 const methods={
  createBatchFromWorkbench(){assert.fail('old unproved creation must never execute');},
  async createBatchAndProve(actor,items,_context,hooks){
   await hooks.authorizePublication(db);
   for(const item of items)rs.push({...scope,id:'run-'+item.input.snapshotId,accountId:user.accountId,skillKey:item.skillKey,idempotencyKey:item.idempotencyKey,inputSummary:item.input,status:'needs_review'});
   await opts.onClaim?.(audits,receipts);
   const receipt=await hooks.provePublication(resolver,view,current);return {kind:'published',receipt};
  },
  verifyProcessRunInTransaction:async(tx,_actor,row,proof)=>{assert.equal(tx,view);assert.equal(proof.basis.snapshotId,row.inputSummary.snapshotId);logs.push('verify:'+row.id);return row;}
 };
 const api=createFullStudyBatchProcess({
  reviewTransaction:async(_u,_st,fn)=>{logs.push('fresh-study');return fn(db,scope,user);},
  authorizePublication:async(tx,actor,st,s)=>{assert.equal(tx,db);assert.equal(actor,user);assert.equal(st,'study');assert.deepEqual(s,scope);logs.push('publish-study');},
  group:async(_tx,_u,_s,_st,_id,phase,root)=>{if(root){assert.equal(root,current);logs.push('group:'+phase);}return{a:header,cancelled:false};},
  rows:async()=>rs,present:()=>({stateHash:hash}),addCapabilities:async(_u,_st,_id,actual)=>actual.value,
  analysis:{withBatchResolver:async(_tx,_u,_s,_st,_r,_ids,phase,fn)=>{logs.push('fresh:'+phase);return fn(resolver,view,current);}},methods
 });
 const body={limit:3,requestKey:'batch-parent-key',expectedStateHash:hash};
 return {methods,opts,logs,audits,receipts,run:()=>api.process(user,'study','group',body),get:()=>api.read(user,'study','group',body.requestKey)};
}
test('normal parent proof verifies each fixed child in publish; subsequent GET uses fresh snapshot and writes no audit',async()=>{
 const f=fixture(),r=await f.run();assert(r.batchReceipt.executionConfirmed);
 assert.equal(f.logs.filter(e=>e==='fresh-study').length,1);
 assert.equal(f.logs.filter(e=>e==='publish-study').length,1);assert(f.logs.includes('group:publish'));
 assert.deepEqual(f.logs.filter(e=>e.startsWith('publish:')),targets.map(t=>'publish:'+t.snapshotId));
 assert.equal(f.logs.filter(e=>e.startsWith('verify:')).length,3);assert.equal(f.audits.length,2);
 assert((await f.get()).executionConfirmed);assert.equal(f.audits.length,2);
 assert(f.logs.includes('fresh:snapshot'));assert.deepEqual(f.logs.filter(e=>e.startsWith('snapshot:')),targets.map(t=>'snapshot:'+t.snapshotId));
});
test('an absent optimized adapter or a claimed publish which never invokes parent proof cannot succeed',async()=>{
 for(const impl of [undefined,async()=>({kind:'published',receipt:{executionConfirmed:true}})]){
  const f=fixture();f.methods.createBatchAndProve=impl;await assert.rejects(f.run(),e=>e.status===503);
  assert(!f.audits.some(a=>a.action==='researchhub.full.analysis.process.finished'));
 }
});
test('guarded parent proof rechecks independent frozen-target receipt and actor before marking finished',async()=>{
 const f=fixture();f.opts.onClaim=(_audits,receipts)=>{receipts[0].result.targetsHash=fullStudyHash([]);};
 await assert.rejects(f.run(),e=>e.code==='FULL_STUDY_PROCESS_RECEIPT_CHANGED');
 assert(!f.audits.some(a=>a.action==='researchhub.full.analysis.process.finished'));
});
