import test from 'node:test';
import assert from 'node:assert/strict';
import {createFullStudyReviewOperations} from './full-study-review-operations.mjs';
import {fullStudyHash} from './full-study-projection.mjs';

function fixture({preconfirmed=0,count=3,batch=false}={}){
 const user={tenantId:'t',accountId:'actor',authVersion:1},scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'};
 const state={audits:[],receipts:[],reviews:[],runs:Array.from({length:count},(_,i)=>i+1).map(n=>({id:'run'+n,...scope,accountId:'actor',sessionId:'session',agentId:'agent',skillVersion:1,skillKey:'descriptive-statistics',idempotencyKey:'method'+n,inputSummary:{studyId:'study',snapshotId:'snap'+n},status:n<=preconfirmed?'completed':'needs_review',reviewStatus:n<=preconfirmed?'confirmed':'pending_review',updatedAt:new Date(0)})),now:1000,authorized:true,valid:true,nativeCalls:[],batchCalls:[],inTransaction:false,authorityChecks:0,checkedRows:[],deniedRows:new Set()};
 const g={a:{id:'group',accountId:'actor',meta:{studyId:'study',authVersion:1,snapshotId:'root',manifestHash:'a'.repeat(64),slices:state.runs.map(r=>({sliceId:r.id,snapshotId:r.inputSummary.snapshotId,methodKey:r.idempotencyKey}))}},current:{basis:{manifestHash:'a'.repeat(64),planId:'plan',planReviewId:'review'},manifest:{}},cancelled:false};
 const matches=(r,w)=>Object.entries(w).every(([k,v])=>v&&typeof v==='object'&&'in'in v?v.in.includes(r[k]):r[k]===v);
 const model=name=>({findFirst:async({where})=>state[name].find(r=>matches(r,where))??null,findUnique:async({where})=>state[name].find(r=>matches(r,where))??null,findMany:async({where={}}={})=>state[name].filter(r=>matches(r,where)),createMany:async({data})=>{state[name].push(...(Array.isArray(data)?data:[data]).map(r=>({...r,createdAt:new Date(state.now)})));return{count:1};}});
 const tx={auditLog:model('audits'),researchMethodReview:model('reviews'),researchMethodRun:model('runs'),$queryRaw:async(strings,...v)=>{
  if(strings.join('').includes('rh_research.operation')&&strings.join('').includes('AND action='))return state.receipts.filter(r=>r.tenant_id===v[0]&&r.actor_id===v[1]&&r.action===v[2]&&r.target_id===v[3]);
  if(strings.join('').includes('rh_research.operation'))return state.receipts.filter(r=>r.request_key===v[2]&&r.actor_id===v[1]&&r.tenant_id===v[0]);return[];
 },$executeRaw:async(strings,...v)=>{if(strings.join('').includes('INSERT INTO rh_research.operation'))state.receipts.push({id:v[0],tenant_id:v[1],actor_id:v[2],request_key:v[3],request_hash:v[4],action:v[5],target_id:v[6],result:JSON.parse(v[7]),audit_id:v[8]});return 1;}};
 let queue=Promise.resolve();const transaction=(u,_study,fn)=>{const task=queue.then(async()=>{state.inTransaction=true;const before=structuredClone({audits:state.audits,receipts:state.receipts});try{return await fn(tx,scope,{...u,studyGroupId:'g',researchProjectId:'p'});}catch(e){state.audits=before.audits;state.receipts=before.receipts;throw e;}finally{state.inTransaction=false;}});queue=task.catch(()=>{});return task;};
 const group=async()=>{if(!state.valid)throw Object.assign(Error('source changed'),{status:409,code:'ANALYSIS_BASIS_STALE'});return g;};
 const authorizeReviewInTransaction=async(_tx,u,row)=>{state.authorityChecks++;state.checkedRows.push(row.id);if(!state.authorized||u.authVersion!==1||state.deniedRows.has(row.id))throw Object.assign(Error('revoked'),{status:403,code:'METHOD_AUTHORIZATION_REVOKED'});};
 const nativeReview=async(u,runId,body)=>{
  assert.equal(state.inTransaction,false);state.nativeCalls.push({runId,...body});if(!state.authorized)throw Object.assign(Error('revoked'),{status:403,code:'METHOD_AUTHORIZATION_REVOKED'});
  const r=state.runs.find(r=>r.id===runId),id='descriptive-review-'+fullStudyHash({tenantId:u.tenantId,accountId:u.accountId,requestKey:body.requestKey}),commandHash=fullStudyHash({runId,conclusion:body.conclusion,comment:body.comment.trim()});
  const old=state.audits.find(a=>a.id===id);if(old){assert.equal(old.meta.commandHash,commandHash);return r;}
  if(r.status!=='needs_review')throw Object.assign(Error('changed'),{status:409,code:'METHOD_RUN_CHANGED'});
  const review={id:'review'+(state.reviews.length+1),...scope,runId,reviewerAccountId:u.accountId,reviewRole:'tenant_admin',conclusion:body.conclusion,comment:body.comment.trim(),version:1};state.reviews.push(review);
  state.audits.push({id,...scope,accountId:u.accountId,action:'research_method_run_review',target:runId,meta:{requestKey:body.requestKey,commandHash,conclusion:body.conclusion,reviewId:review.id,reviewVersion:1}});
  r.status=body.conclusion==='confirmed'?'completed':'needs_input';r.reviewStatus=body.conclusion;r.updatedAt=new Date(state.now);return r;
 };
 const nativeBatch=async(u,rows,body,context)=>{state.batchCalls.push({runIds:rows.map(r=>r.id),body:structuredClone(body),context:structuredClone(context)});const before=structuredClone({audits:state.audits,reviews:state.reviews,runs:state.runs});try{for(const row of rows)await nativeReview(u,row.id,{...body,requestKey:'full-review-'+fullStudyHash({requestKey:body.requestKey,runId:row.id})});}catch(e){state.audits=before.audits;state.reviews=before.reviews;state.runs=before.runs;throw e;}};
 const methods={review:nativeReview,...(batch?{reviewBatch:nativeBatch}:{})};const deps={transaction,group,rows:async()=>structuredClone(state.runs),present:()=>({runGroupId:'group',capabilities:{canReview:true,canCancel:true}}),methods,authorizeReviewInTransaction,now:()=>state.now,leaseMs:100};
 const make=()=>createFullStudyReviewOperations(deps),api=make();
 return{state,user,scope,tx,g,api,make,methods,nativeReview,nativeBatch};
}
const command={requestKey:'parent-request',conclusion:'confirmed',comment:'核对原数值'};
const step=(value,key='step-request-1')=>({requestKey:key,expectedStateHash:value.stateHash,limit:1});

test('start freezes targets and durable parent receipt; exact replay is idempotent and GET never writes',async()=>{
 const f=fixture({preconfirmed:1}),o=await f.api.startReviewOperation(f.user,'study','group',command);
 assert.equal(o.kind,'full-study-review-v1');assert.equal(o.status,'ready');assert.deepEqual(o.progress,{total:2,completed:0,remaining:2});assert.equal(o.requestKey,command.requestKey);assert.equal(f.state.nativeCalls.length,0);
 assert.equal((await f.api.startReviewOperation(f.user,'study','group',command)).operationId,o.operationId);
 const before=structuredClone(f.state.audits);assert.equal((await f.api.reviewOperationReceipt(f.user,'study','group',command.requestKey)).operationId,o.operationId);
 assert.equal((await f.api.readReviewOperation(f.user,'study','group',o.operationId)).stateHash,o.stateHash);assert.deepEqual(f.state.audits,before);
 await assert.rejects(f.api.startReviewOperation(f.user,'study','group',{...command,comment:'different'}),e=>e.status===409);
});
test('each advance reviews one frozen child and completed progress requires every original native proof',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);let value=o;
 for(let n=1;n<=3;n++){
  value=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(value,'step-request-'+n));
  assert.equal(value.progress.completed,n);assert.equal(f.state.nativeCalls.length,n);assert.equal(value.requestKey,command.requestKey);
  assert.equal(f.state.nativeCalls[n-1].requestKey,'full-review-'+fullStudyHash({requestKey:command.requestKey,runId:'run'+n}));
 }
 assert.equal(value.status,'completed');assert.equal(value.canContinue,false);assert.equal(value.lastStep.executionConfirmed,true);
});
test('a lost advance response is read from exact child proof, and replay does not review again',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),body=step(o);
 await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,body);const after=await f.api.readReviewOperation(f.user,'study','group',o.operationId);
 assert.equal(after.lastStep.requestKey,body.requestKey);assert.equal(after.lastStep.executionConfirmed,true);assert.equal(after.progress.completed,1);
 await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,body);assert.equal(f.state.nativeCalls.length,1);
 await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,{...body,expectedStateHash:'b'.repeat(64)}),e=>e.status===409);
});
test('two tabs with the same state cannot claim different children',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);
 const values=await Promise.allSettled([f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o,'step-tab-one')),f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o,'step-tab-two'))]);
 assert.equal(values.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.state.nativeCalls.length,1);
});
test('unexpired claim prevents redispatch; after restart and expiry explicit continue uses the same child native key',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);let release;const hold=new Promise(r=>{release=r;});let reached;const entered=new Promise(r=>{reached=r;});
 f.methods.review=async(...args)=>{reached();await hold;return f.nativeReview(...args);};
 const first=f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));await entered;
 let read=await f.make().readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.status,'processing');assert.equal(read.canContinue,false);
 await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(read,'step-too-early')),e=>e.status===409);
 f.state.now+=101;read=await f.make().readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.canContinue,true);
 f.methods.review=f.nativeReview;const resumed=await f.make().advanceReviewOperation(f.user,'study','group',o.operationId,step(read,'step-resume'));
 assert.equal(resumed.progress.completed,1);release();await first;
 assert.deepEqual(f.state.nativeCalls.map(x=>x.runId),['run1','run1']);assert.equal(new Set(f.state.nativeCalls.map(x=>x.requestKey)).size,1);assert.equal(f.state.reviews.length,1);
});
test('native proof survives a missing finished acknowledgement without a GET repair write',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));
 f.state.audits=f.state.audits.filter(a=>a.action!=='researchhub.full.analysis.review.finished');const count=f.state.audits.length;
 const read=await f.make().readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.progress.completed,1);assert.equal(read.lastStep.executionConfirmed,true);assert.equal(f.state.audits.length,count);
 await f.make().advanceReviewOperation(f.user,'study','group',o.operationId,step(read,'step-after-ack'));assert.equal(f.state.reviews.length,2);
 assert(f.state.audits.some(a=>a.action==='researchhub.full.analysis.review.finished'&&a.meta.recovered===true));
});
test('confirmed by another request is blocked rather than counted as this parent success',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);
 for(const r of f.state.runs){r.status='completed';r.reviewStatus='confirmed';}
 const read=await f.api.readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.status,'blocked');assert.equal(read.progress.completed,0);assert.equal(read.canContinue,false);
});
test('changed native command, review version, reviewer, comment or scope cannot prove completion',async()=>{
 for(const corrupt of [f=>{f.state.audits.find(a=>a.action==='research_method_run_review').meta.commandHash='bad';},f=>{f.state.reviews[0].version++;},f=>{f.state.reviews[0].reviewerAccountId='other';},f=>{f.state.reviews[0].comment='changed';},f=>{f.state.reviews[0].researchProjectId='other';}]){
  const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));corrupt(f);
  const read=await f.api.readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.status,'blocked');assert.equal(read.progress.completed,0);
 }
});
test('current source, current native review authority and operation actor are rechecked before writes and GET disclosure',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),writes=f.state.audits.length;
 for(const method of [()=>f.api.readReviewOperation({...f.user,accountId:'other'},'study','group',o.operationId),()=>f.api.advanceReviewOperation({...f.user,authVersion:2},'study','group',o.operationId,step(o))])await assert.rejects(method,e=>e.status===403);
 f.state.authorized=false;await assert.rejects(f.api.readReviewOperation(f.user,'study','group',o.operationId),e=>e.status===403);await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o)),e=>e.status===403);
 f.state.authorized=true;f.state.valid=false;await assert.rejects(f.api.readReviewOperation(f.user,'study','group',o.operationId),e=>e.code==='ANALYSIS_BASIS_STALE');assert.equal(f.state.audits.length,writes);assert.equal(f.state.nativeCalls.length,0);
});
test('native review denial propagates without fabricating a review or successful progress',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),error=Object.assign(Error('denied'),{status:403,code:'METHOD_REVIEW_FORBIDDEN'});f.methods.review=async()=>{throw error;};
 await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o)),e=>e===error);
 const read=await f.api.readReviewOperation(f.user,'study','group',o.operationId);assert.equal(read.progress.completed,0);assert.equal(read.status,'blocked');assert.equal(f.state.reviews.length,0);
});
test('exact step receipt proves the original step even after another step advances the operation',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),first=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o,'step-first'));
 await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(first,'step-second'));
 const count=f.state.audits.length,receipt=await f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'step-first');
 assert.equal(receipt.requestKey,command.requestKey);assert.equal(receipt.receipt.targetId,'group');assert.equal(receipt.stepReceipt.requestKey,'step-first');assert.equal(receipt.stepReceipt.runId,'run1');assert.equal(receipt.stepReceipt.executionConfirmed,true);assert.equal(receipt.lastStep.requestKey,'step-second');assert.equal(f.state.audits.length,count);
 await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'step-missing'),e=>e.status===404);
});
test('each metadata transaction projects sources once and a changed frozen target set fails closed',async()=>{
 const f=fixture();
 // The fixture counts the native authority callback in the same verified context.
 const before=f.state.authorityChecks,o=await f.api.startReviewOperation(f.user,'study','group',command);assert.equal(f.state.authorityChecks-before,1);
 const prior=f.state.authorityChecks;await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));assert.equal(f.state.authorityChecks-prior,2);
 f.state.audits.find(a=>a.id===o.operationId).meta.targets=[];
 await assert.rejects(f.api.readReviewOperation(f.user,'study','group',o.operationId),e=>e.code==='FULL_STUDY_REVIEW_OPERATION_CHANGED');
});
test('start is read-authorized before creating an intent and source revocation during native execution cannot be hidden by a prior child success',async()=>{
 const denied=fixture();denied.state.authorized=false;await assert.rejects(denied.api.startReviewOperation(denied.user,'study','group',command),e=>e.status===403);assert.equal(denied.state.audits.length,0);assert.equal(denied.state.receipts.length,0);
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);f.methods.review=async(...args)=>{await f.nativeReview(...args);f.state.valid=false;};
 await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o)),e=>e.code==='ANALYSIS_BASIS_STALE');
 assert.equal(f.state.reviews.length,1);assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.review.finished'),false);
});
test('a lost native acknowledgement is proved from real audit/review, never from the transport result alone',async()=>{
 const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command);
 f.methods.review=async(...args)=>{await f.nativeReview(...args);throw Object.assign(Error('lost acknowledgement'),{code:'TIMEOUT'});};
 const result=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));assert.equal(result.progress.completed,1);assert.equal(result.stepReceipt.executionConfirmed,true);
 const missing=fixture(),m=await missing.api.startReviewOperation(missing.user,'study','group',command);missing.methods.review=async()=>({status:'completed'});
 const unproved=await missing.api.advanceReviewOperation(missing.user,'study','group',m.operationId,step(m));assert.equal(unproved.status,'blocked');assert.equal(unproved.stepReceipt.executionConfirmed,false);assert.equal(unproved.progress.completed,0);
});
test('already-confirmed children must still match the frozen group binding before they can be excluded',async()=>{
 const f=fixture({preconfirmed:3});f.state.runs[0].inputSummary.snapshotId='foreign-snapshot';
 await assert.rejects(f.api.startReviewOperation(f.user,'study','group',command),e=>e.code==='FULL_STUDY_REVIEW_BINDING_CHANGED');assert.equal(f.state.audits.length,0);
});
test('exact step GET rejects a corrupted receipt digest, audit link, or absent independent claim digest',async()=>{
 for(const corrupt of [(saved)=>{saved.request_hash='0'.repeat(64);},(saved)=>{saved.audit_id='other-audit';},(_saved,claim)=>{delete claim.meta.requestDigest;},(_saved,claim)=>{claim.meta.requestDigest='1'.repeat(64);}]){
  const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),body=step(o);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,body);
  const saved=f.state.receipts.find(r=>r.request_key===body.requestKey),claim=f.state.audits.find(a=>a.id===saved.result.claimId);corrupt(saved,claim);
  const writes=f.state.audits.length;await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,body.requestKey),e=>e.code==='FULL_STUDY_REVIEW_OPERATION_CHANGED');assert.equal(f.state.audits.length,writes);
 }
});
test('distinct Agent/session authority is checked before start and after a successful prefix on reads or advance',async()=>{
 const denied=fixture();denied.state.runs[1].sessionId='session2';denied.state.runs[1].agentId='agent2';denied.state.deniedRows.add('run2');
 await assert.rejects(denied.api.startReviewOperation(denied.user,'study','group',command),e=>e.status===403);assert.equal(denied.state.audits.length,0);
 const f=fixture();f.state.runs[1].sessionId='session2';f.state.runs[1].agentId='agent2';const o=await f.api.startReviewOperation(f.user,'study','group',command),done=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));
 f.state.deniedRows.add('run2');f.state.checkedRows=[];
 await assert.rejects(f.api.readReviewOperation(f.user,'study','group',o.operationId),e=>e.status===403);
 await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'step-request-1'),e=>e.status===403);
 await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(done,'step-next')),e=>e.status===403);
 assert(f.state.checkedRows.includes('run2'));assert.equal(f.state.nativeCalls.length,1);
});
test('authority dedup includes session owner and skill version, and incomplete identities are each checked',async()=>{
 for(const field of ['accountId','sessionId','agentId','skillVersion']){
  const f=fixture();f.state.runs[1][field]=field==='skillVersion'?2:'other';f.state.deniedRows.add('run2');
  await assert.rejects(f.api.startReviewOperation(f.user,'study','group',command),e=>e.status===403);
 }
 const f=fixture();for(const row of f.state.runs)delete row.sessionId;
 await f.api.startReviewOperation(f.user,'study','group',command);assert.deepEqual(f.state.checkedRows,['run1','run2','run3']);
 const good=fixture();await good.api.startReviewOperation(good.user,'study','group',command);assert.deepEqual(good.state.checkedRows,['run1']);
});

const batchStep=(value,key='batch-step')=>({...step(value,key),limit:3});
test('batch capability exists only with the actual native batch method; legacy limit1 remains exact',async()=>{const old=fixture(),legacy=await old.api.startReviewOperation(old.user,'study','group',command);assert(!legacy.batching);await assert.rejects(old.api.advanceReviewOperation(old.user,'study','group',legacy.operationId,batchStep(legacy)));assert.equal(old.state.nativeCalls.length,0);const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);assert.deepEqual(o.batching,{version:'full-study-batch-v1',maxItems:3});const one=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));assert.equal(one.stepReceipt.runId,'run1');assert(!one.batchReceipt);assert.equal(f.state.batchCalls.length,0);});
test('one limit3 freezes ordered members before native execution and exact replay cannot review another batch',async()=>{const f=fixture({batch:true,count:5}),o=await f.api.startReviewOperation(f.user,'study','group',command);f.methods.reviewBatch=async(...args)=>{const claim=f.state.audits.find(a=>a.action==='researchhub.full.analysis.review.claim');assert(claim);assert.equal(claim.meta.limit,3);assert(!Object.hasOwn(claim.meta,'runId'));assert.equal(claim.meta.targetsHash,fullStudyHash(claim.meta.targets));assert(f.state.receipts.some(r=>r.audit_id===claim.id));return f.nativeBatch(...args);};const body=batchStep(o),result=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,body);assert.equal(result.progress.completed,3);assert(!result.stepReceipt);assert(!result.lastStep);assert.equal(result.batchReceipt.executionConfirmed,true);assert.equal(result.lastBatch.targetsHash,result.batchReceipt.targetsHash);assert.deepEqual(result.batchReceipt.targets.map(t=>t.runId),['run1','run2','run3']);assert.equal(f.state.batchCalls.length,1);assert.deepEqual(f.state.batchCalls[0].context,{studyId:'study',rootSnapshotId:'root'});assert.equal(f.state.batchCalls[0].body.requestKey,command.requestKey);const read=await f.make().reviewStepReceipt(f.user,'study','group',o.operationId,body.requestKey);assert.equal(read.batchReceipt.requestKey,body.requestKey);await f.make().advanceReviewOperation(f.user,'study','group',o.operationId,body);assert.equal(f.state.batchCalls.length,1);const last=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(result,'last-two'));assert.equal(last.progress.completed,5);assert.deepEqual(last.batchReceipt.targets.map(t=>t.runId),['run4','run5']);assert.equal(last.batchReceipt.items.length,2);});
test('partial native proof or transport success cannot prove a batch or clear its unknown members',async()=>{const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);f.methods.reviewBatch=async(u,rows,body)=>{await f.nativeReview(u,rows[0].id,{...body,requestKey:'full-review-'+fullStudyHash({requestKey:body.requestKey,runId:rows[0].id})});return{completed:true};};const r=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));assert.equal(r.progress.completed,1);assert.equal(r.status,'blocked');assert.equal(r.batchReceipt.executionConfirmed,false);assert.equal(r.batchReceipt.status,'processing');assert.deepEqual(r.batchReceipt.items.map(x=>x.executionConfirmed),[true,false,false]);assert(!r.stepReceipt);});
test('lease restart resumes the entire original batch including proved members, never the next targets',async()=>{const f=fixture({batch:true,count:5}),o=await f.api.startReviewOperation(f.user,'study','group',command);let entered,release;const hold=new Promise(r=>release=r),started=new Promise(r=>entered=r);f.methods.reviewBatch=async(...args)=>{entered();await hold;return f.nativeBatch(...args);};const first=f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o,'abandoned'));await started;let current=await f.make().readReviewOperation(f.user,'study','group',o.operationId);assert.equal(current.status,'processing');assert.equal(current.lastBatch.executionConfirmed,false);await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(current,'too-early-batch')),e=>e.status===409);const runId='run1';await f.nativeReview(f.user,runId,{...command,requestKey:'full-review-'+fullStudyHash({requestKey:command.requestKey,runId})});f.state.now+=101;current=await f.make().readReviewOperation(f.user,'study','group',o.operationId);assert.equal(current.progress.completed,1);const before=f.state.audits.length;await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(current,'cannot-shrink')),e=>e.status===409);assert.equal(f.state.audits.length,before);f.methods.reviewBatch=f.nativeBatch;const resumed=await f.make().advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(current,'resume-original'));assert.deepEqual(resumed.batchReceipt.targets.map(t=>t.runId),['run1','run2','run3']);assert.equal(resumed.progress.completed,3);release();await first;assert.equal(f.state.reviews.length,3);assert(f.state.batchCalls.every(c=>c.runIds.join(',')==='run1,run2,run3'));assert.equal(new Set(f.state.nativeCalls.filter(c=>c.runId==='run1').map(c=>c.requestKey)).size,1);});
test('batch lost acknowledgement is recovered only from all exact native audits and reviews',async()=>{const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);f.methods.reviewBatch=async(...args)=>{await f.nativeBatch(...args);throw Error('lost transport');};const r=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));assert.equal(r.batchReceipt.executionConfirmed,true);assert.equal(r.status,'completed');const before=f.state.audits.length;await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'missing-step'),e=>e.status===404);assert.equal(f.state.audits.length,before);});
test('batch exact GET enforces current actor, source, proof hash and frozen target bindings',async()=>{const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));await assert.rejects(f.api.reviewStepReceipt({...f.user,accountId:'other'},'study','group',o.operationId,'batch-step'),e=>e.status===403||e.status===404);f.state.valid=false;await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step'),e=>e.code==='ANALYSIS_BASIS_STALE');f.state.valid=true;const c=f.state.audits.find(a=>a.action==='researchhub.full.analysis.review.claim');c.meta.targets[0].snapshotId='foreign';await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step'),e=>e.status===409);});
test('two batch tabs cannot claim disjoint work from the same CAS and old exact receipt stays bound after later batches',async()=>{const f=fixture({batch:true,count:6}),o=await f.api.startReviewOperation(f.user,'study','group',command);let entered,release;const hold=new Promise(r=>release=r),started=new Promise(r=>entered=r);f.methods.reviewBatch=async(...args)=>{entered();await hold;return f.nativeBatch(...args);};const pending=f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o,'batch-tab-one'));await started;await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o,'batch-tab-two')),e=>e.status===409);release();const first=await pending;assert.equal(f.state.batchCalls.length,1);f.methods.reviewBatch=f.nativeBatch;await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(first,'batch-next-three'));const count=f.state.audits.length,old=await f.api.reviewStepReceipt(f.user,'study','group',o.operationId,first.batchReceipt.requestKey);assert.equal(old.progress.completed,6);assert.deepEqual(old.batchReceipt.targets.map(t=>t.runId),['run1','run2','run3']);assert.deepEqual(old.lastBatch.targets.map(t=>t.runId),['run4','run5','run6']);assert.equal(f.state.audits.length,count);});
test('native batch denial leaves no fabricated proofs and errors retain authority/source codes',async()=>{for(const code of ['METHOD_REVIEW_FORBIDDEN','ANALYSIS_BASIS_STALE']){const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command),failure=Object.assign(Error(code),{status:code==='METHOD_REVIEW_FORBIDDEN'?403:409,code});f.methods.reviewBatch=async()=>{throw failure;};await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o)),e=>e===failure);const r=await f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step');assert.equal(r.status,'blocked');assert.equal(r.batchReceipt.executionConfirmed,false);assert(r.batchReceipt.items.every(i=>!i.executionConfirmed));assert.equal(f.state.reviews.length,0);}});
test('batch read-only recovery rejects revoked authority or changed source after committed native results',async()=>{for(const field of ['authorized','valid']){const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);f.methods.reviewBatch=async(...args)=>{await f.nativeBatch(...args);f.state[field]=false;};await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o)),e=>field==='authorized'?e.status===403:e.code==='ANALYSIS_BASIS_STALE');assert.equal(f.state.reviews.length,3);assert(!f.state.audits.some(a=>a.action==='researchhub.full.analysis.review.finished'));await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step'));}});
test('batch receipt independently binds targets hash, digest and claim audit before disclosing proof',async()=>{for(const corrupt of [(saved)=>saved.result.targetsHash='0'.repeat(64),(saved)=>saved.result.batchVersion='other',(saved)=>saved.result.limit=1,(saved)=>saved.audit_id='other',(_saved,c)=>{c.meta.targets.reverse();c.meta.targetsHash=fullStudyHash(c.meta.targets);}]){const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));const saved=f.state.receipts.find(r=>r.request_key==='batch-step'),claim=f.state.audits.find(a=>a.id===saved.result.claimId);corrupt(saved,claim);const before=f.state.audits.length;await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step'),e=>e.status===409);assert.equal(f.state.audits.length,before);}});

test('expired batch cannot replace members with another valid parent subset even with a recomputed claim hash',async()=>{const f=fixture({batch:true,count:6}),o=await f.api.startReviewOperation(f.user,'study','group',command);let entered,release;const hold=new Promise(r=>release=r),started=new Promise(r=>entered=r);f.methods.reviewBatch=async()=>{entered();await hold;throw Error('owned fixture stopped');};const first=f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));await started;const claim=f.state.audits.find(a=>a.action==='researchhub.full.analysis.review.claim'),parent=f.state.audits.find(a=>a.id===o.operationId);claim.meta.targets=structuredClone(parent.meta.targets.slice(3,6));claim.meta.targetsHash=fullStudyHash(claim.meta.targets);f.state.now+=101;const before=f.state.audits.length;await assert.rejects(f.api.readReviewOperation(f.user,'study','group',o.operationId),e=>e.status===409);await assert.rejects(f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o,'forbidden-new-attempt')),e=>e.status===409);assert.equal(f.state.audits.length,before);assert.equal(f.state.nativeCalls.length,0);release();await assert.rejects(first);});
test('a stored batch receipt cannot be downgraded to a representative legacy claim',async()=>{const f=fixture({batch:true}),o=await f.api.startReviewOperation(f.user,'study','group',command);await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,batchStep(o));const claim=f.state.audits.find(a=>a.action==='researchhub.full.analysis.review.claim'),first=claim.meta.targets[0];for(const key of ['batchVersion','targets','targetsHash','limit'])delete claim.meta[key];claim.meta.runId=first.runId;claim.meta.nativeKey=first.nativeKey;await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'batch-step'),e=>e.status===409);});
test('genuine legacy single claim without a digest keeps parent reads compatible but exact step proof still rejects',async()=>{const f=fixture(),o=await f.api.startReviewOperation(f.user,'study','group',command),r=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(o));const c=f.state.audits.find(a=>a.action==='researchhub.full.analysis.review.claim');delete c.meta.requestDigest;const parent=await f.api.readReviewOperation(f.user,'study','group',o.operationId);assert.equal(parent.status,r.status);assert.deepEqual(parent.progress,r.progress);assert.equal((await f.api.reviewOperationReceipt(f.user,'study','group',command.requestKey)).operationId,o.operationId);await assert.rejects(f.api.reviewStepReceipt(f.user,'study','group',o.operationId,'step-request-1'),e=>e.status===409);const next=await f.api.advanceReviewOperation(f.user,'study','group',o.operationId,step(parent,'legacy-next-step'));assert.equal(next.progress.completed,2);});
