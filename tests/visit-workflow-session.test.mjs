import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../src/visit-workflow-session.js';
const hash='a'.repeat(64),scope={tenantId:'tenant',actor:'actor',authVersion:5,studyId:'study',visitId:'visit'};
const ref=id=>({assignmentId:id,responseId:'response-'+id,revisionNo:1,contentHash:hash});
const row=id=>({assignmentId:id,formVersionId:'form-'+id,formVersion:{id:'form-'+id,schema:{fields:[{key:'x',label:'观察',type:'number'}]}},title:'表单'+id,required:true,mode:'researcher',response:{status:'submitted',version:2,ref:ref(id),review:null,locked:false,answers:{x:0}},capabilities:{canReview:true,canLock:false},action:'review_lock',unavailable:null});
const summary=()=>({schemaVersion:'visit-workflow-v1',studyId:'study',visitId:'visit',visit:{id:'visit'},items:[row('a'),row('b')],summaryHash:hash,canStartBatch:true,maxBatchItems:20});
const batch=()=>({schemaVersion:'visit-workflow-v1',studyId:'study',visitId:'visit',batchId:'batch',status:'ready',stateHash:hash,canContinue:true,items:summary().items.map(x=>({assignmentId:x.assignmentId,title:x.title,expectedRef:x.response.ref,initialVersion:2,action:x.action,status:'pending',result:null,error:null})),completedCount:0,remainingCount:2,advanceReceipts:[],receipt:{requestKey:'create',action:'visit.review.batch.create',targetId:'visit'}});
test('summary eligibility uses actual current response and action capability; selection is explicit and bounded',()=>{
 const s=summary();assert(ui.validVisitWorkflowSummary(s,scope));assert.deepEqual(ui.visitReviewSelection(s,['b']),[{assignmentId:'b',expectedVersion:2,expectedRef:ref('b')}]);
 for(const selected of [[],['a','a'],['other']])assert.throws(()=>ui.visitReviewSelection(s,selected));
 s.items[0].capabilities.canReview=false;assert.equal(ui.reviewItemEligible(s.items[0]),false);assert.throws(()=>ui.visitReviewSelection(s,['a']));
 s.items[0].action='lock';s.items[0].capabilities.canLock=true;s.items[0].response.review='review_approved';assert(ui.reviewItemEligible(s.items[0]));s.items[0].response.locked=true;assert(!ui.reviewItemEligible(s.items[0]));
});
test('source-bound summary refuses wrong study/visit, duplicated rows, incomplete fields or unknown modes',()=>{
 for(const change of [s=>s.studyId='other',s=>s.visitId='other',s=>s.items.push(s.items[0]),s=>s.items[0].formVersion.id='wrong',s=>delete s.items[0].response.ref.contentHash,s=>s.items[0].mode='other']){const s=summary();change(s);assert(!ui.validVisitWorkflowSummary(s,scope));}
});
test('batch requires truthful member totals, exact completed refs and create receipt',()=>{
 assert(ui.validVisitReviewBatch(batch(),scope));
 for(const change of [b=>b.remainingCount=0,b=>b.completedCount=1,b=>b.items[0].status='completed',b=>b.receipt.targetId='other',b=>b.items.push(b.items[0])]){const b=batch();change(b);assert(!ui.validVisitReviewBatch(b,scope));}
});
test('markers contain only scoped IDs/hashes, never answers, cause or request body',async()=>{
 const s=summary(),items=ui.visitReviewSelection(s,['a','b']);const m=await ui.makeVisitReviewMarker(scope,'create',{requestKey:'create',items});
 assert(ui.validVisitReviewMarker(m,scope));assert(!['body','answers','reason','items'].some(k=>k in m));assert(!ui.validVisitReviewMarker({...m,authVersion:4},scope));assert(!ui.validVisitReviewMarker({...m,extra:'x'},scope));assert(await ui.visitReviewResultProved(batch(),m));
 const bad=batch();bad.items[0].initialVersion=3;assert(!(await ui.visitReviewResultProved(bad,m)));
});
test('advance proof binds original key/state/member/ref and rejects a terminal state without original receipt',async()=>{
 const b=batch(),m=await ui.makeVisitReviewMarker(scope,'advance',{requestKey:'step',batch:b});assert(!(await ui.visitReviewResultProved(b,m)));
 b.items[0].status='completed';b.items[0].result={ref:ref('a'),version:4,locked:true};b.completedCount=1;b.remainingCount=1;
 assert(!(await ui.visitReviewResultProved(b,m)));
 b.advanceReceipts=[{requestKey:'step',expectedStateHash:hash,assignmentId:'a',claimId:'claim',expectedRef:ref('a'),initialVersion:2,action:'review_lock',nativeKeys:Object.fromEntries(await Promise.all(['review','lock'].map(async kind=>[kind,'visit-'+kind+'-'+await ui.visitReviewInputHash({requestKey:'step',assignmentId:'a',kind})]))),commandDigest:await ui.visitReviewInputHash({studyId:'study',visitId:'visit',batchId:'batch',body:{requestKey:'step',expectedStateHash:hash}}),executionConfirmed:true,failureConfirmed:false,status:'completed',result:{ref:ref('a'),version:4,locked:true},receipt:{requestKey:'step',action:'visit.review.batch.advance',targetId:'batch'}}];assert(await ui.visitReviewResultProved(b,m));
 for(const change of [v=>v.advanceReceipts[0].requestKey='other',v=>v.advanceReceipts[0].expectedStateHash='b'.repeat(64),v=>v.advanceReceipts[0].assignmentId='b',v=>v.advanceReceipts[0].status='unknown',v=>v.advanceReceipts[0].result.ref.contentHash='b'.repeat(64)]){const v=structuredClone(b);change(v);assert(!(await ui.visitReviewResultProved(v,m)));}
});
test('next capture follows required order, never occupies a dual/H5 mode or auto-starts optional items',()=>{
 const v={id:'visit',status:'in_progress',capabilities:{canAssign:true},assignments:[],fulfillments:[],visitPlan:{requirements:[{id:'one',kind:'form_response',required:true,config:{formVersionId:'form1',allowedCaptureModes:['researcher','patient_h5']}},{id:'two',kind:'form_response',required:true,config:{formVersionId:'form2',allowedCaptureModes:['researcher']}}]}};
 assert.equal(ui.nextVisitCapture(v).kind,'requirement');v.visitPlan.requirements[0].config.allowedCaptureModes=['researcher'];assert.deepEqual(ui.nextVisitCapture(v),{kind:'assign',requirementId:'one',formVersionId:'form1'});
 v.assignments=[{id:'a',mode:'researcher',formVersionId:'form1',response:{status:'draft'}}];assert.equal(ui.nextVisitCapture(v).assignmentId,'a');v.assignments[0].response.status='submitted';assert.equal(ui.nextVisitCapture(v).formVersionId,'form2');
 v.visitPlan.requirements[1].required=false;assert.equal(ui.nextVisitCapture(v).kind,'review');v.status='completed';assert.equal(ui.nextVisitCapture(v).kind,'review');
});
test('complete summary may contain100 explicit rows but a selected batch is capped at20; unavailable rows stay visible',()=>{
 const s=summary();s.items=Array.from({length:100},(_,i)=>row('item'+i));assert(ui.validVisitWorkflowSummary(s,scope));assert.equal(ui.visitReviewSelection(s,s.items.slice(0,20).map(x=>x.assignmentId)).length,20);assert.throws(()=>ui.visitReviewSelection(s,s.items.slice(0,21).map(x=>x.assignmentId)));
 s.items[0]={...s.items[0],formVersion:null,response:null,capabilities:{},action:null,unavailable:{code:'SOURCE_CHANGED',message:'来源变化'}};assert(ui.validVisitWorkflowSummary(s,scope));assert(!ui.reviewItemEligible(s.items[0]));s.items.push(row('too-many'));assert(!ui.validVisitWorkflowSummary(s,scope));
});
test('automatic processing uses each current CAS, pauses on block, and explicit block continuation advances only once',async()=>{
 const make=n=>{const b=batch();b.stateHash=String(n).padStart(64,'b');for(let i=0;i<n;i++){b.items[i].status='completed';b.items[i].result={ref:ref(b.items[i].assignmentId),version:4,locked:true};}b.completedCount=n;b.remainingCount=2-n;b.status=n===2?'completed':'ready';b.canContinue=n<2;return b;};
 const calls=[];const done=await ui.processVisitReviewBatch(make(0),async previous=>{calls.push(previous.stateHash);return make(calls.length);});assert.equal(done.status,'completed');assert.deepEqual(calls,[make(0).stateHash,make(1).stateHash]);
 const blocked=batch();blocked.status='blocked';blocked.items[0].status='blocked';blocked.items[0].error={code:'FAILED',message:'失败'};blocked.stateHash='c'.repeat(64);assert(ui.validVisitReviewBatch(blocked,scope));let count=0;await ui.processVisitReviewBatch(blocked,async()=>{count++;return null;});assert.equal(count,0);await ui.processVisitReviewBatch(blocked,async()=>{count++;return null;},()=>{},()=>true,true);assert.equal(count,1);
 let live=true;await ui.processVisitReviewBatch(make(0),async()=>{live=false;return make(1);},()=>{},()=>live);assert.equal(live,false);
 await assert.rejects(()=>ui.processVisitReviewBatch(make(0),async()=>{const b=make(1);b.items[1].expectedRef.contentHash='c'.repeat(64);return b;}),e=>e.unknown);
});
test('known failed advance requires its exact finish proof; aggregate blocked or unknown cannot erase pending marker',async()=>{
 const b=batch(),m=await ui.makeVisitReviewMarker(scope,'advance',{requestKey:'failed',batch:b});b.status='blocked';b.stateHash='b'.repeat(64);b.items[0].status='blocked';b.items[0].error={code:'FAILED',message:'失败'};
 assert(!(await ui.visitReviewBlockedProved(b,m)));
 const step={requestKey:'failed',expectedStateHash:hash,assignmentId:'a',claimId:'claim',expectedRef:ref('a'),initialVersion:2,action:'review_lock',nativeKeys:Object.fromEntries(await Promise.all(['review','lock'].map(async kind=>[kind,'visit-'+kind+'-'+await ui.visitReviewInputHash({requestKey:'failed',assignmentId:'a',kind})]))),commandDigest:await ui.visitReviewInputHash({studyId:'study',visitId:'visit',batchId:'batch',body:{requestKey:'failed',expectedStateHash:hash}}),status:'blocked',executionConfirmed:false,failureConfirmed:true,result:null,receipt:{requestKey:'failed',action:'visit.review.batch.advance',targetId:'batch'}};b.advanceReceipts=[step];assert(await ui.visitReviewBlockedProved(b,m));
 for(const change of [s=>s.failureConfirmed=false,s=>s.requestKey='other',s=>s.expectedStateHash='b'.repeat(64),s=>s.commandDigest='c'.repeat(64),s=>s.nativeKeys.lock='wrong',s=>s.status='unknown']){const v=structuredClone(b);change(v.advanceReceipts[0]);assert(!(await ui.visitReviewBlockedProved(v,m)));}
});
const storageFixture=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
test('only typed preacceptance rejection for the original phase is recoverable; no broad4xx or postcommit inference',()=>{
 const cases=[['create','VISIT_WORKFLOW_SUMMARY_CHANGED',true],['create','VISIT_WORKFLOW_MEMBER_CHANGED',true],['advance','VISIT_WORKFLOW_BATCH_CHANGED',true],['advance','VISIT_WORKFLOW_MEMBER_CHANGED',false],['create','VISIT_WORKFLOW_BATCH_CHANGED',false]];
 for(const[action,code,want]of cases){const e={status:409,code,rejectedBeforeAcceptance:true};assert.equal(ui.visitReviewRejectedBeforeAcceptance(e,{action}),want);assert(!ui.visitReviewRejectedBeforeAcceptance({...e,rejectedBeforeAcceptance:false},{action}));assert(!ui.visitReviewRejectedBeforeAcceptance({...e,status:503},{action}));}
});
test('shared minimal markers are isolated by tenant, actor, auth version and visit; a competing pending marker is never overwritten or cleared',async()=>{
 const store=storageFixture(),m=await ui.makeVisitReviewMarker(scope,'create',{requestKey:'create',items:ui.visitReviewSelection(summary(),['a','b'])});ui.persistVisitReviewMarker(store,m);
 for(const change of [{tenantId:'other'},{actor:'other'},{authVersion:6},{studyId:'other'},{visitId:'other'}])assert.deepEqual(ui.readVisitReviewStorage(store,{...scope,...change}),{pending:null,parent:null});
 const other={...m,requestKey:'other'};assert.throws(()=>ui.persistVisitReviewMarker(store,other));assert.equal(ui.clearVisitReviewMarker(store,scope,other),false);assert.equal(ui.readVisitReviewStorage(store,scope).pending.requestKey,'create');assert(ui.clearVisitReviewMarker(store,scope,m));
 const raw=JSON.stringify(m);for(const key of ['answers','reason','body','items'])assert(!Object.hasOwn(m,key),key);assert(!raw.includes('观察'));
});
test('a fresh tab restores shared create or parent markers with GET only;404 never deletes original pending or sendsPOST',async()=>{
 const store=storageFixture(),m=await ui.makeVisitReviewMarker(scope,'create',{requestKey:'create',items:ui.visitReviewSelection(summary(),['a','b'])});ui.persistVisitReviewMarker(store,m);const calls=[];
 const recovered=await ui.readStoredVisitReview({storage:store,scope,request:async(...args)=>{calls.push(args);return batch();}});assert.equal(recovered.pending.requestKey,'create');assert.equal(recovered.batch.batchId,'batch');assert.deepEqual(calls,[[ui.visitWorkflowRoot(scope)+'/batch-receipts/create']]);assert.equal(ui.readVisitReviewStorage(store,scope).pending.requestKey,'create');
 await assert.rejects(()=>ui.readStoredVisitReview({storage:store,scope,request:async()=>{throw Object.assign(Error('not found'),{status:404});}}));assert(ui.readVisitReviewStorage(store,scope).pending);
 ui.clearVisitReviewMarker(store,scope,m);store.setItem(ui.visitReviewParentKey(scope),JSON.stringify({version:1,...scope,batchId:'batch',membersHash:m.membersHash}));calls.length=0;await ui.readStoredVisitReview({storage:store,scope,request:async(...args)=>{calls.push(args);return batch();}});assert.deepEqual(calls,[[ui.visitWorkflowRoot(scope)+'/batches/batch']]);
});
test('cross-tab WebLock rejects the competing writer without waiting or posting; read-only recovery does not require a write',async()=>{
 let held=false,release;const locks={request:async(name,options,fn)=>{assert.equal(name,'scope');assert.equal(options.ifAvailable,true);if(held)return fn(null);held=true;try{return await fn({name});}finally{held=false;}}};let writes=0;
 const first=ui.withVisitReviewLock(locks,'scope',async()=>{writes++;await new Promise(resolve=>release=resolve);return'first';},()=>null);const second=await ui.withVisitReviewLock(locks,'scope',async()=>{writes++;return'second';},()=> 'busy');assert.equal(second,'busy');assert.equal(writes,1);release();assert.equal(await first,'first');
});

test('attention uses exact active requirements and explicit score flags without inventing missing or normal scores',()=>{
 const visit={visitPlan:{requirements:[{id:'req',kind:'form_response',required:true,config:{formVersionId:'form-a'}}]},fulfillments:[{visitRequirementId:'req',status:'missing'}]},item=row('a');
 assert.deepEqual(ui.visitReviewAttention(item,visit),[]);
 item.response=null;assert.deepEqual(ui.visitReviewAttention(item,visit),['必采尚未提交']);
 for(const status of ['waived','not_applicable','unknown']){visit.fulfillments[0].status=status;assert.deepEqual(ui.visitReviewAttention(item,visit),[]);}
 visit.fulfillments=[];assert.deepEqual(ui.visitReviewAttention(item,visit),[]);visit.fulfillments=[{visitRequirementId:'other',status:'missing'}];assert.deepEqual(ui.visitReviewAttention(item,visit),[]);
 item.unavailable={code:'UNAVAILABLE',message:'来源待核'};assert.deepEqual(ui.visitReviewAttention(item,visit),['暂不可核对']);delete item.unavailable;item.response=row('a').response;
 for(const score of [undefined,null,{total:0},{total:999},{processingStatus:'unknown'},{processingStatus:'constructor'},{processingStatus:'toString'},{missingRequired:'1'},{missingRequired:-1},{unresolvedItems:null}]){item.response.score=score;assert.deepEqual(ui.visitReviewAttention(item,visit),[]);}
 for(const [score,label]of [[{processingStatus:'incomplete_data'},'资料待补齐'],[{processingStatus:'awaiting_policy'},'待规则确认'],[{processingStatus:'review_required'},'评分依据待复核'],[{scoreComplete:false},'评分尚未完成'],[{missingRequired:1},'有待核条目'],[{unresolvedItems:[{key:'x',status:'not_applicable'}]},'有待核条目']]){item.response.score=score;assert.deepEqual(ui.visitReviewAttention(item,visit),[label]);}
 item.response.score={total:0};item.capabilities={canReview:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}};assert.deepEqual(ui.visitReviewAttention(item,visit),[]);
});
test('attention rows default to all with stable groups and never mutate the source or native eligibility',()=>{
 const s=summary();s.items=[row('a'),row('b'),row('c'),row('d')];s.items[1].response.score={scoreComplete:false};s.items[3].unavailable={code:'X',message:'暂不可核对'};s.items[3].response=null;s.items[3].action=null;
 const before=structuredClone(s),eligibility=s.items.map(ui.reviewItemEligible);
 assert.deepEqual(ui.visitReviewRows(s).map(x=>x.item.assignmentId),['b','d','a','c']);assert.deepEqual(ui.visitReviewRows(s,'attention').map(x=>x.item.assignmentId),['b','d']);
 assert.deepEqual(s,before);assert.deepEqual(s.items.map(ui.reviewItemEligible),eligibility);
});
test('review view binding requires current session scope and exact URL and includes in-place score/source changes',()=>{
 const s=summary(),session={actor:'actor',authVersion:5,verified:true},route={studyId:'study',visitId:'visit'},url='/pages/s09/?formalCapture=1&studyId=study&visitId=visit#visit-review';
 const binding=()=>ui.visitReviewViewBinding(s,scope,session,route,url),original=binding();assert.equal(typeof original,'string');
 s.items[0].response.score={scoreComplete:false};assert.notEqual(binding(),original);const scored=binding();s.items[0].response.score.scoreComplete=true;assert.notEqual(binding(),scored);
 for(const override of [{actor:'other'},{authVersion:6},{verified:false}])assert.equal(ui.visitReviewViewBinding(s,scope,{...session,...override},route,url),null);
 assert.equal(ui.visitReviewViewBinding(s,scope,session,{...route,studyId:'other'},url),null);assert.equal(ui.visitReviewViewBinding(s,scope,session,route,url.replace('visitId=visit','visitId=other')),null);
 const zero={...scope,authVersion:0};assert.equal(typeof ui.visitReviewViewBinding(s,zero,{...session,authVersion:0},route,url),'string');
 delete s.items[0].response.score;const absent=binding();s.items[0].response.score=null;assert.notEqual(binding(),absent);
});
