// Current batch task: computation and read-only inspection/recovery only.
// New synthetic performance runs only; never writes accepted source/report evidence.
import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {openHarness,json,save,key,sha,base,privateDir as sourcePrivate,evidenceDir as sourceEvidence} from './full-study-runtime.mjs';
import {batchReceipt} from '../server/research-analysis/full-study-batch-receipt.mjs';
const stage=process.argv[2],phase=process.argv[3],count=Number(process.argv[4]??100);
assert(['baseline','after','fault'].includes(stage),'EXPLICIT_TAIL_STAGE_REQUIRED');
assert(['create','compute','inspect','recover'].includes(phase));
assert(Number.isSafeInteger(count)&&count>0&&count<=100);
const task='full-study-compute-tail-2026-11-16',priv=new URL('../../.tmp/'+task+'/'+stage+'/',import.meta.url).pathname,out=new URL('../docs/testing/evidence/'+task+'/actual/'+stage+'/',import.meta.url).pathname;
mkdirSync(priv,{recursive:true,mode:0o700});mkdirSync(out,{recursive:true,mode:0o700});
const path=priv+'benchmark-journal.json',b=json(sourcePrivate+'bootstrap.json'),prior=json(sourcePrivate+'analysis-corrected-journal.json');
const snapshotId='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',manifestHash='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7';
assert.equal(prior.snapshotId,snapshotId);assert.equal(sha(readFileSync(sourceEvidence+'report-corrected/report.docx')),'e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7');
const journal=existsSync(path)?json(path):{task,stage,studyId:b.study.id,snapshotId,manifestHash,at:new Date().toISOString(),steps:{},network:[]};
assert.equal(journal.task,task);assert.equal(journal.stage,stage);assert.equal(journal.studyId,b.study.id);assert.equal(journal.snapshotId,snapshotId);
if(journal.runGroupId){assert.equal(journal.steps.create?.value?.id,journal.runGroupId);assert(!['full-run-7a6ecafc-345c-456e-b620-d8de8fe92d02','full-run-937ad872-cc4e-4e3a-bc8a-aa0fa8b497fb','full-run-0358f67e-e4d7-4e5f-b861-ed25db601745'].includes(journal.runGroupId));}
assert(['recover','inspect'].includes(phase)||!Object.values(journal.steps).some(s=>s.status==='pending'&&s.attempted),'UNKNOWN_PREVIOUS_RESPONSE_USE_RECOVER_NO_NEW_POST');
const h=await openHarness({privateOutputDir:priv}),A='/research-studies/'+b.study.id+'/analysis';
const commit=()=>save(path,journal);
async function op(name,url,body){
 let s=journal.steps[name];if(!s){s={url,body:{...body,requestKey:key()},status:'pending',at:new Date().toISOString()};journal.steps[name]=s;commit();}
 assert.equal(s.url,url);if(s.status==='done')return s.value;
 if(s.attempted)throw Error('UNKNOWN_PREVIOUS_RESPONSE_USE_RECOVER_NO_AUTOMATIC_POST');
 s.attempted=true;commit();const start=performance.now();
 try{s.value=await h.post(url,s.body);s.status='done';s.elapsedMs=performance.now()-start;s.finishedAt=new Date().toISOString();commit();console.log(JSON.stringify({phase:name,elapsedMs:Math.round(s.elapsedMs),remaining:s.value.remaining??s.value.progress?.remaining,status:s.value.status}));return s.value;}
 catch(error){s.elapsedMs=performance.now()-start;s.error={message:String(error.message).slice(0,1000),at:new Date().toISOString()};commit();throw error;}
}
async function exportState(){
 const snapshot=await h.get(A+'/snapshots/'+snapshotId);assert.equal(snapshot.basis.manifestHash,manifestHash);save(out+'snapshot.json',snapshot);
 if(!journal.runGroupId)return;
 const group=await h.get(A+'/runs/'+journal.runGroupId);assert.equal(group.manifestHash,manifestHash);save(out+'group.json',group);
 const ids=group.slices.map(s=>s.methodRunId).filter(Boolean),runs=await h.read(tx=>tx.researchMethodRun.findMany({where:{...b.scope,id:{in:ids}},orderBy:{id:'asc'}}));
 assert.equal(runs.length,ids.length);assert(runs.every(r=>r.executorVersion==='descriptive-v1'&&(!['needs_review','completed'].includes(r.status)||r.environment.llm===false)));save(out+'actual-method-runs.json',{studyId:b.study.id,runGroupId:group.id,runs});
 if(journal.operationId){const operation=await h.get(A+'/runs/'+group.id+'/review-operations/'+journal.operationId);save(out+'review-operation.json',operation);}
 journal.current={runGroupId:group.id,status:group.status,remaining:group.remaining,methodRunCount:runs.length,reviewStatus:group.reviewStatus};commit();
 console.log(JSON.stringify({phase:'inspect',...journal.current}));
}
try{
 if(phase==='create'){
  assert(!journal.runGroupId,'ALREADY_CREATED_USE_COMPUTE');const snapshot=await h.get(A+'/snapshots/'+snapshotId);assert.equal(snapshot.basis.manifestHash,manifestHash);assert.equal(snapshot.qualityGate.status,'released');save(out+'snapshot.json',snapshot);
  const group=await op('create',A+'/runs',{snapshotId});assert.equal(group.batching?.maxItems,3);journal.runGroupId=group.id;commit();save(out+'group-initial.json',group);
 }else if(phase==='compute'){
  assert(journal.runGroupId);let group=await h.get(A+'/runs/'+journal.runGroupId);
  for(let n=0;n<count&&group.remaining>0;n++){assert(!['blocked','cancelled','failed'].includes(group.status));const before=group.remaining;group=await op('compute-'+before,A+'/runs/'+group.id+'/process',{expectedStateHash:group.stateHash,limit:3});assert.equal(group.batchReceipt?.version,'full-study-batch-v1');assert.equal(group.batchReceipt.executionConfirmed,true);assert.equal(group.batchReceipt.requestKey,journal.steps['compute-'+before].body.requestKey);assert(group.batchReceipt.items.every(x=>x.executionConfirmed));assert.equal(before-group.remaining,group.batchReceipt.items.length);assert(group.remaining<before);save(out+'group-latest.json',group);}
 }else if(phase==='recover'){
  for(const[name,s]of Object.entries(journal.steps).filter(([,s])=>s.status==='pending'&&s.attempted)){
   let url;if(name==='create')url=A+'/run-receipts/'+s.body.requestKey;
   else if(name.startsWith('compute-'))url=A+'/runs/'+journal.runGroupId+'/process-receipts/'+s.body.requestKey;
   else throw Error('UNEXPECTED_PHASE_NO_RECOVERY');
   const value=await h.get(url);save(out+'recovery-'+name+'.json',value);
   const proved=name==='create'?value.receipt?.requestKey===s.body.requestKey:value.executionConfirmed===true;
   if(name.startsWith('compute-')){const r=value.batchReceipt;assert(r);assert.equal(r.requestKey,s.body.requestKey);assert.equal(r.studyId,journal.studyId);assert.equal(r.runGroupId,journal.runGroupId);assert.equal(r.snapshotId,snapshotId);assert.equal(r.manifestHash,manifestHash);assert.deepEqual(r,batchReceipt('process',{requestKey:r.requestKey,studyId:r.studyId,runGroupId:r.runGroupId,snapshotId:r.snapshotId,manifestHash:r.manifestHash},r.targets,r.items));assert(r.items.every(x=>x.executionConfirmed));}
   assert(proved,'ORIGINAL_REQUEST_NOT_PROVED_NO_POST');s.status='done';s.value=value.batchReceipt?{...value.group,batchReceipt:value.batchReceipt}:value.group??value;s.recoveredReadOnly=true;s.recoveredAt=new Date().toISOString();if(name==='create')journal.runGroupId=value.group?.id??value.id;commit();
  }
 }
 await exportState();
}finally{
 journal.network.push(...h.network);commit();save(out+'network.json',journal.network);
 save(out+'timings.json',{measurement:'Full HTTP per batch; every member waits for complete response, never divide batch duration by item count',at:new Date().toISOString(),studyId:b.study.id,runGroupId:journal.runGroupId,syntheticOnly:true,sourceSnapshotId:snapshotId,manifestHash,steps:Object.fromEntries(Object.entries(journal.steps).map(([name,s])=>[name,{status:s.status,at:s.at,finishedAt:s.finishedAt,elapsedMs:s.elapsedMs,limit:s.body.limit??1,memberIds:s.value?.batchReceipt?.items?.map(x=>x.runId)??s.value?.slices?.filter(x=>x.methodRunId).map(x=>x.methodRunId),requestKey:s.body.requestKey,recoveredReadOnly:s.recoveredReadOnly??false,error:s.error}]))});
}
