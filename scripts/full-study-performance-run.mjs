// New synthetic performance runs only; never writes accepted source/report evidence.
import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {openHarness,json,save,key,sha,base,privateDir as sourcePrivate,evidenceDir as sourceEvidence} from './full-study-runtime.mjs';
const phase=process.argv[2],count=Number(process.argv[3]??100);
assert(['create','compute','inspect','review-start','review','recover'].includes(phase));
assert(Number.isSafeInteger(count)&&count>0&&count<=100);
const task='full-study-performance-2026-11-13',priv=new URL('../../.tmp/'+task+'/',import.meta.url).pathname,out=new URL('../docs/testing/evidence/'+task+'/actual/',import.meta.url).pathname;
mkdirSync(priv,{recursive:true,mode:0o700});mkdirSync(out,{recursive:true,mode:0o700});
const path=priv+'benchmark-journal.json',b=json(sourcePrivate+'bootstrap.json'),prior=json(sourcePrivate+'analysis-corrected-journal.json');
const snapshotId='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',manifestHash='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7';
assert.equal(prior.snapshotId,snapshotId);assert.equal(sha(readFileSync(sourceEvidence+'report-corrected/report.docx')),'e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7');
const journal=existsSync(path)?json(path):{task,studyId:b.study.id,snapshotId,manifestHash,at:new Date().toISOString(),steps:{},network:[]};
assert.equal(journal.task,task);assert.equal(journal.studyId,b.study.id);assert.equal(journal.snapshotId,snapshotId);
const h=await openHarness(),A='/research-studies/'+b.study.id+'/analysis';
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
 assert.equal(runs.length,ids.length);assert(runs.every(r=>r.environment.llm===false&&r.executorVersion==='descriptive-v1'));save(out+'actual-method-runs.json',{studyId:b.study.id,runGroupId:group.id,runs});
 if(journal.operationId){const operation=await h.get(A+'/runs/'+group.id+'/review-operations/'+journal.operationId);save(out+'review-operation.json',operation);}
 journal.current={runGroupId:group.id,status:group.status,remaining:group.remaining,methodRunCount:runs.length,reviewStatus:group.reviewStatus};commit();
 console.log(JSON.stringify({phase:'inspect',...journal.current}));
}
try{
 if(phase==='create'){
  assert(!journal.runGroupId,'ALREADY_CREATED_USE_COMPUTE');const snapshot=await h.get(A+'/snapshots/'+snapshotId);assert.equal(snapshot.basis.manifestHash,manifestHash);assert.equal(snapshot.qualityGate.status,'released');save(out+'snapshot.json',snapshot);
  const group=await op('create',A+'/runs',{snapshotId});journal.runGroupId=group.id;commit();save(out+'group-initial.json',group);
 }else if(phase==='compute'){
  assert(journal.runGroupId);let group=await h.get(A+'/runs/'+journal.runGroupId);
  for(let n=0;n<count&&group.remaining>0;n++){assert(!['blocked','cancelled','failed'].includes(group.status));const before=group.remaining;group=await op('compute-'+before,A+'/runs/'+group.id+'/process',{expectedStateHash:group.stateHash,limit:1});assert(group.remaining<before);save(out+'group-latest.json',group);}
 }else if(phase==='review-start'){
  assert(journal.runGroupId);assert(!journal.operationId);const operation=await op('review-start',A+'/runs/'+journal.runGroupId+'/review-operations',{conclusion:'confirmed',comment:'已逐组核对本次性能合成运行的三量表描述统计、配对变化、有效分母及固定来源；数值仍由descriptive-v1计算。'});journal.operationId=operation.operationId;commit();save(out+'review-operation.json',operation);
 }else if(phase==='review'){
  assert(journal.operationId);const url=A+'/runs/'+journal.runGroupId+'/review-operations/'+journal.operationId;let operation=await h.get(url);
  for(let n=0;n<count&&operation.status!=='completed';n++){assert.equal(operation.status,'ready');assert.equal(operation.canContinue,true);const before=operation.progress.completed;operation=await op('review-'+before,url+'/process',{expectedStateHash:operation.stateHash,limit:1});assert(operation.progress.completed>before);save(out+'review-operation.json',operation);}
 }else if(phase==='recover'){
  for(const[name,s]of Object.entries(journal.steps).filter(([,s])=>s.status==='pending'&&s.attempted)){
   let url;if(name==='create')url=A+'/run-receipts/'+s.body.requestKey;
   else if(name.startsWith('compute-'))url=A+'/runs/'+journal.runGroupId+'/process-receipts/'+s.body.requestKey;
   else if(name==='review-start')url=A+'/runs/'+journal.runGroupId+'/review-operation-receipts/'+s.body.requestKey;
   else url=A+'/runs/'+journal.runGroupId+'/review-operations/'+journal.operationId+'/step-receipts/'+s.body.requestKey;
   const value=await h.get(url);save(out+'recovery-'+name+'.json',value);
   const proved=name==='create'?value.receipt?.requestKey===s.body.requestKey:name.startsWith('compute-')?value.executionConfirmed===true:name==='review-start'?value.receipt?.requestKey===s.body.requestKey:value.stepReceipt?.executionConfirmed===true;
   assert(proved,'ORIGINAL_REQUEST_NOT_PROVED_NO_POST');s.status='done';s.value=value.group??value;s.recoveredReadOnly=true;s.recoveredAt=new Date().toISOString();if(name==='create')journal.runGroupId=value.id;if(name==='review-start')journal.operationId=value.operationId;commit();
  }
 }
 await exportState();
}finally{
 journal.network.push(...h.network);commit();save(out+'network.json',journal.network);
 save(out+'timings.json',{at:new Date().toISOString(),studyId:b.study.id,runGroupId:journal.runGroupId,syntheticOnly:true,sourceSnapshotId:snapshotId,manifestHash,steps:Object.fromEntries(Object.entries(journal.steps).map(([name,s])=>[name,{status:s.status,at:s.at,finishedAt:s.finishedAt,elapsedMs:s.elapsedMs,requestKey:s.body.requestKey,recoveredReadOnly:s.recoveredReadOnly??false,error:s.error}]))});
}
