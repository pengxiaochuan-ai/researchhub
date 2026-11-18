import test from 'node:test';import assert from 'node:assert/strict';import {createFullStudyRuns} from './full-study-runs.mjs';import {fullStudyHash} from './full-study-projection.mjs';
import * as sourceGuard from './full-study-batch-source.mjs';
function fixture({empty=false}={}){
 const user={tenantId:'t',accountId:'actor',authVersion:1},s={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},basis={studyId:'study',snapshotId:'root',manifestHash:'a'.repeat(64),planId:'plan'},variable={key:'phq',label:'PHQ',valueType:'number',formVersionId:'form',fieldKey:'total',unit:'分'},slice={sliceId:'slice1',kind:'timepoint',armCode:'MDD_TARGET',logicalVisit:'V1',variable,status:empty?'no_valid_data':'ready',denominators:{population:2,eligible:2,valid:empty?0:2,missing:empty?2:0,notApplicable:0},sources:[],rows:[]},manifest={schemaVersion:'full-study-simulation-root-v2',studyId:'study',scope:s,slices:[slice],caseMetadata:{caseId:'case',scope:s,subjects:[{id:'subject'}]},quality:{modalities:{files:[]}}};
 const sliceManifest={schemaVersion:'full-study-simulation-slice-v2',rootSnapshotId:'root',sliceId:'slice1'},sliceHash=fullStudyHash(sliceManifest),sliceBasis={...basis,snapshotId:'slice-snapshot',manifestHash:sliceHash};
 const state={audits:[],receipts:[],runs:[],reviews:[],calls:0,inTransaction:false,valid:true,canCancel:true,cancelCalls:0,authorizationCalls:0,sourceProofs:0,transactions:0,guardCalls:0};
 const match=(row,where)=>Object.entries(where).every(([k,v])=>typeof v==='object'&&v!==null?'in'in v?v.in.includes(row[k]):true:row[k]===v);
 const tx={auditLog:{createMany:async({data})=>{state.audits.push({id:data.id??'audit'+state.audits.length,...data});return{count:1};},findFirst:async({where})=>state.audits.find(a=>match(a,where))??null,findMany:async({where})=>state.audits.filter(a=>match(a,where))},researchMethodRun:{findMany:async({where})=>state.runs.filter(r=>match(r,where)),findFirst:async({where})=>state.runs.find(r=>match(r,where))},researchMethodReview:{findFirst:async({where})=>state.reviews.filter(r=>match(r,where)).at(-1)},$executeRaw:async(strings,...v)=>{if(strings.join('').includes('INSERT INTO rh_research.operation'))state.receipts.push({id:v[0],request_key:v[3],request_hash:v[4],action:v[5],target_id:v[6],result:JSON.parse(v[7]),audit_id:v[8]});return 1;},$queryRaw:async(strings,...v)=>{const q=strings.join('');if(q.includes('rh_research.operation'))return state.receipts.filter(r=>r.request_key===v[2]);if(q.includes('SELECT id,manifest,manifest_hash'))return empty?[]:[{id:'slice-snapshot',manifest:sliceManifest,manifest_hash:sliceHash}];return[];}};
 const analysis={assertCurrent:async(_t,_u,_s,_st,snapshot,_phase,proof)=>{if(!proof?.has('root')){state.sourceProofs++;proof?.set('root',{});}if(!state.valid)throw Object.assign(Error('stale'),{status:409,code:'ANALYSIS_BASIS_STALE'});return snapshot==='root'?{basis,manifest}:{basis:sliceBasis,manifest:sliceManifest};}};
 analysis.withRootSourceGuard=(...args)=>{state.guardCalls++;return sourceGuard.createFullStudyRootSourceGuard({authorize:async()=>{},validateCase:async()=>manifest.caseMetadata,assertCurrent:(...a)=>analysis.assertCurrent(...a)})(...args);};
 const methods={createFromWorkbench:async(_u,dto)=>{assert.equal(state.inTransaction,false);state.calls++;const outputs={manifestHash:sliceHash,rowCount:2,statisticalUnit:'subject',columns:{phq:{type:'number',total:2,observed:2,missing:0,status:'available',min:0,max:4,mean:2,median:2,sampleStdDev:Math.sqrt(8)}}},numericEvidence=[];const walk=(v,p='')=>{if(typeof v==='number')numericEvidence.push({name:p,value:v,assumptions:['manifestHash:'+sliceHash]});else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p?p+'.'+k:k);};walk(outputs);const r={id:'method'+state.calls,...s,skillKey:'descriptive-statistics',idempotencyKey:dto.idempotencyKey,inputSummary:dto.input,status:'needs_review',reviewStatus:'pending_review',skillVersion:1,executorVersion:'descriptive-v1',inputHash:'b'.repeat(64),environment:{llm:false,workerVersion:'t19-1'},dataSources:{analysisBasis:sliceBasis},artifactRefs:{outputs},numericEvidence};state.runs.push(r);return r;},review:async(_u,id,body)=>{const r=state.runs.find(r=>r.id===id);r.status=body.conclusion==='confirmed'?'completed':'needs_review';r.reviewStatus=body.conclusion;state.reviews.push({...s,runId:id,conclusion:body.conclusion,comment:body.comment});return r;},getDescriptiveReviewReceipt:async()=>({}),cancel:async(_u,id)=>{state.cancelCalls++;state.runs.find(r=>r.id===id).status='cancelled';}};
 methods.getDescriptiveCapabilities=async()=>({capabilities:{canReview:true,canCancel:state.canCancel}});
 const authorizeCancelInTransaction=async()=>{assert.equal(state.inTransaction,true);state.authorizationCalls++;if(!state.canCancel)throw Object.assign(Error('forbidden'),{status:403});};
 methods.authorizeReviewInTransaction=async()=>{assert.equal(state.inTransaction,true);assert.deepEqual(state.transactionOptions,{includeOfficial:true});};
 const studies={withResearchStudyTransaction:async(_u,_st,_op,fn,options)=>{assert.equal(state.inTransaction,false);state.transactions++;state.transactionOptions=options;state.inTransaction=true;const backup=structuredClone({audits:state.audits,receipts:state.receipts,runs:state.runs,reviews:state.reviews});let value;try{value=await fn(tx,{...s,executionProjectId:'p'});await state.beforeCommit?.();}catch(error){Object.assign(state,backup);throw error;}finally{state.inTransaction=false;}if(state.afterCommitFailure){const error=state.afterCommitFailure;state.afterCommitFailure=null;throw error;}return value;}};
 return{api:createFullStudyRuns({studies,analysis,methods,authorizeCancelInTransaction}),user,state,tx,s,methods,analysis,studies};
}

async function batchGroup(){
 const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'batch-create',snapshotId:'root'}),g=f.state.audits.find(a=>a.id===created.id),{manifest}=await f.analysis.assertCurrent(null,null,null,null,'root'),first=manifest.slices[0];
 for(let i=2;i<=5;i++){manifest.slices.push({...structuredClone(first),sliceId:'slice'+i});g.meta.slices.push({sliceId:'slice'+i,methodKey:'batch-key-'+i,snapshotId:'snapshot'+i});}
 f.methods.createBatchFromWorkbench=async(_u,items,options)=>{assert.equal(f.state.inTransaction,false);assert.equal(options.rootSnapshotId,'root');return Promise.all(items.map(async dto=>{const r=await f.methods.createFromWorkbench(_u,dto);r.dataSources.analysisBasis={...r.dataSources.analysisBasis,snapshotId:dto.input.snapshotId};return r;}));};
 f.state.runs[0].accountId=f.user.accountId;const original=f.methods.createBatchFromWorkbench;f.methods.createBatchFromWorkbench=async(...args)=>{const rs=await original(...args);rs.forEach(r=>{r.accountId=f.user.accountId;});return rs;};f.methods.verifyProcessRunInTransaction=async(_tx,_u,r)=>r;f.analysis.withBatchResolver=async(tx,u,scope,studyId,rootId,targets,phase,fn)=>fn({assertCurrent:(...args)=>f.analysis.assertCurrent(...args)},tx,await f.analysis.assertCurrent(tx,u,scope,studyId,rootId));
 f.methods.createBatchAndProve=async(...args)=>{await f.methods.createBatchFromWorkbench(...args.slice(0,3));return{kind:'existing'};};
 const current=await f.api.read(f.user,'study',created.id);return{...f,created,current};
}
async function exactJobGroup(){
 const f=fixture();f.user.authVersion=0;const created=await f.api.create(f.user,'study',{requestKey:'job-link-source',snapshotId:'root'}),a=f.state.audits.find(v=>v.id===created.id),operator={agentId:'agent',skillId:'skill',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',configurationHash:'a'.repeat(64)},targets=a.meta.slices.map(t=>({...t,targetId:t.sliceId,runId:null,inputHash:null}));
 (await f.analysis.assertCurrent(null,null,null,null,'root')).basis.planReviewId='review';
 const job={id:'analysis-job-bound',tenant_id:'t',study_group_id:'g',research_project_id:'p',study_id:'study',snapshot_id:'root',actor_id:'actor',actor_auth_version:0,branch:'full',plan_id:'plan',review_id:'review',manifest_hash:a.meta.manifestHash,native_create_key:a.meta.requestKey,operator_ref:operator,operator_hash:fullStudyHash(operator),checkpoint:{version:1,runGroupId:a.id,targets,pending:null,finishedClaimIds:[]}};
 a.meta.researchAnalysisJob={version:1,jobId:job.id,bindingHash:fullStudyHash({jobId:job.id,scope:f.s,studyId:'study',snapshotId:'root',nativeCreateKey:job.native_create_key,operator,jobTargetsHash:fullStudyHash(targets.map(({targetId,sliceId,snapshotId,methodKey})=>({targetId,sliceId,snapshotId,methodKey})))})};
 let queries=0;const expectedJobId=job.id,query=f.tx.$queryRaw;f.tx.$queryRaw=async(strings,...values)=>{const sql=strings.join('');if(sql.includes('rh_analysis.execution_job')){queries++;assert(sql.startsWith('SELECT '));assert(!/FOR UPDATE|lease_|INSERT|UPDATE/.test(sql));for(const value of [expectedJobId,'t','g','p','study','root','actor',0,a.id])assert(values.includes(value));return f.jobRows;}return query(strings,...values);};f.jobRows=[job];Object.assign(f,{created,a,job});Object.defineProperty(f,'queries',{get:()=>queries});return f;
}
test('authorized group exposes only an exactly bound Job id, including original author version0 and a different current reader',async()=>{
 const f=await exactJobGroup(),before=structuredClone({audits:f.state.audits,receipts:f.state.receipts,runs:f.state.runs}),value=await f.api.read({...f.user,accountId:'reader',authVersion:5},'study',f.created.id);assert.equal(value.jobId,f.job.id);assert.equal(f.queries,1);assert.equal(value.capabilities.canProcessRun,false);assert.equal(value.capabilities.canCancel,false);assert(!JSON.stringify(value).includes('lease_token'));assert(!JSON.stringify(value).includes('operator_ref'));assert.deepEqual({audits:f.state.audits,receipts:f.state.receipts,runs:f.state.runs},before);
 const receipt=await f.api.receipt(f.user,'study','job-link-source');assert.equal(receipt.jobId,f.job.id);
});
test('forged, missing, cross-scope/source/author/version/checkpoint or marker bindings yield no Job link',async()=>{
 for(const change of [f=>f.jobRows=[],f=>f.jobRows.push(structuredClone(f.job)),f=>f.job.id='other',f=>f.job.tenant_id='other',f=>f.job.study_group_id='other',f=>f.job.research_project_id='other',f=>f.job.study_id='other',f=>f.job.snapshot_id='other',f=>f.job.actor_id='other',f=>f.job.actor_auth_version=1,f=>f.job.checkpoint.runGroupId='other',f=>f.job.native_create_key='other',f=>f.job.operator_hash='f'.repeat(64),f=>f.job.checkpoint.targets[0].methodKey='other',f=>f.a.meta.researchAnalysisJob.bindingHash='f'.repeat(64),f=>f.job.plan_id='other',f=>f.job.review_id='other']){const f=await exactJobGroup();change(f);assert.equal((await f.api.read(f.user,'study',f.created.id)).jobId,null);}
});
test('legacy or malformed-marker groups never query a Job table and authorization failure precedes the link lookup',async()=>{
 const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'legacy-no-job-link',snapshotId:'root'}),query=f.tx.$queryRaw;let jobs=0;f.tx.$queryRaw=async(s,...v)=>{if(s.join('').includes('rh_analysis.execution_job'))jobs++;return query(s,...v);};assert.equal(created.jobId,null);assert.equal((await f.api.read(f.user,'study',created.id)).jobId,null);f.state.audits.find(v=>v.id===created.id).meta.researchAnalysisJob={jobId:'bad-marker'};assert.equal((await f.api.read(f.user,'study',created.id)).jobId,null);assert.equal(jobs,0);
 const bound=await exactJobGroup();bound.state.valid=false;await assert.rejects(bound.api.read(bound.user,'study',bound.created.id),e=>e.code==='ANALYSIS_BASIS_STALE');assert.equal(bound.queries,0);
});
test('Job-bound group disables original process/cancel capabilities and writes while original review qualification is preserved',async()=>{
 const f=await batchGroup(),a=f.state.audits.find(a=>a.id===f.created.id);a.meta.researchAnalysisJob={version:1,jobId:'job',bindingHash:'a'.repeat(64)};const value=await f.api.read(f.user,'study',f.created.id);assert.equal(value.capabilities.canProcessRun,false);assert.equal(value.capabilities.canCancel,false);
 const before=structuredClone({audits:f.state.audits,receipts:f.state.receipts,runs:f.state.runs});await assert.rejects(f.api.process(f.user,'study',f.created.id,{requestKey:'legacy-job-new-key',expectedStateHash:value.stateHash,limit:3}),e=>e.code==='ANALYSIS_JOB_RESERVED');await assert.rejects(f.api.cancel(f.user,'study',f.created.id),e=>e.code==='ANALYSIS_JOB_RESERVED');assert.deepEqual({audits:f.state.audits,receipts:f.state.receipts,runs:f.state.runs},before);
 const whole=fixture(),g=await whole.api.create(whole.user,'study',{requestKey:'whole-job-source',snapshotId:'root'}),was=await whole.api.read(whole.user,'study',g.id);whole.state.audits.find(a=>a.id===g.id).meta.researchAnalysisJob={jobId:'job'};const after=await whole.api.read(whole.user,'study',g.id);assert.equal(after.capabilities.canReview,was.capabilities.canReview);assert.equal(after.capabilities.canCancel,false);
});
test('configured full root reservation guard runs before source/group/Session creation; Job branch remains private',async()=>{
 const f=fixture(),error=Object.assign(Error('reserved'),{code:'ANALYSIS_JOB_RESERVED',status:409}),never=()=>{throw Error('internal entry was not requested');},methods={...f.methods,authorizeJobOperatorInTransaction:never,prepareJobBatchInTransaction:never,resumeJobBatch:never,settleJobBatchInTransaction:never},calls=[];
 const api=createFullStudyRuns({studies:f.studies,analysis:f.analysis,methods,jobAdapter:{beforeLocks:async(_tx,actor,op)=>{calls.push({actor,op});throw error;}}});await assert.rejects(api.create(f.user,'study',{requestKey:'legacy-root-active-job',snapshotId:'root'}),e=>e===error);assert.equal(calls.length,1);assert.equal(f.state.sourceProofs,0);assert.equal(f.state.audits.length,0);assert.equal(f.state.runs.length,0);assert.equal(f.state.calls,0);assert(api.jobBranch);assert.equal(Object.keys(api).includes('jobBranch'),false);
});
test('only proved final batch POST joins capability reads; running, GET and original single process retain the public path',async()=>{
 const f=await batchGroup();let joined=0;
 f.methods.withDescriptiveCapabilities=async(actor,ids,consume)=>{assert.equal(f.state.inTransaction,false);assert.deepEqual(ids,f.state.runs.map(r=>r.id));joined++;return consume(id=>f.methods.getDescriptiveCapabilities(actor,id));};
 const middle=await f.api.process(f.user,'study',f.created.id,{requestKey:'caps-middle',expectedStateHash:f.current.stateHash,limit:3});assert.equal(middle.remaining,1);assert.equal(joined,0);
 const final=await f.api.process(f.user,'study',f.created.id,{requestKey:'caps-final',expectedStateHash:middle.stateHash,limit:3});assert.equal(final.remaining,0);assert.equal(final.capabilities.canReview,true);assert.equal(joined,1);
 await f.api.read(f.user,'study',f.created.id);assert.equal(joined,1);
 const single=fixture();single.methods.withDescriptiveCapabilities=()=>{throw Error('single must stay public');};await single.api.create(single.user,'study',{requestKey:'caps-single',snapshotId:'root'});
});
test('joined capability authority/conflict failure rolls back before narrow source fallback and never returns partial flags',async()=>{
 for(const code of ['METHOD_AUTHORIZATION_REVOKED','METHOD_RUN_CHANGED','AUTH_SESSION_EXPIRED']){
  const f=await batchGroup(),middle=await f.api.process(f.user,'study',f.created.id,{requestKey:'caps-first-'+code,expectedStateHash:f.current.stateHash,limit:3});let rolledBack=false,fallback=false;
  f.methods.withDescriptiveCapabilities=async()=>{rolledBack=true;throw Object.assign(Error(code),{code,status:code==='METHOD_AUTHORIZATION_REVOKED'?403:code==='METHOD_RUN_CHANGED'?409:401});};
  f.analysis.configuration=async()=>{assert(rolledBack);fallback=true;return{studyId:'study'};};
  const command=f.api.process(f.user,'study',f.created.id,{requestKey:'caps-second-'+code,expectedStateHash:middle.stateHash,limit:3});
  if(code==='AUTH_SESSION_EXPIRED')await assert.rejects(command,e=>e.code===code);else{const value=await command;assert.deepEqual(value.capabilities,{canReview:false,canCancel:false,canProcessRun:false});}
  assert(rolledBack);assert.equal(fallback,code==='METHOD_AUTHORIZATION_REVOKED');
 }
});
test('explicit limit3 freezes at most3 members, preserves original keys and does not redispatch on replay',async()=>{const f=await batchGroup(),body={requestKey:'batch-process',expectedStateHash:f.current.stateHash,limit:3},r=await f.api.process(f.user,'study',f.created.id,body);assert.equal(r.remaining,1);assert.equal(r.batchReceipt.targets.length,3);assert.equal(r.batchReceipt.executionConfirmed,true);assert.deepEqual(r.batchReceipt.targets.map(t=>t.methodKey),['batch-key-2','batch-key-3','batch-key-4']);assert.equal(f.state.calls,4);await f.api.process(f.user,'study',f.created.id,body);assert.equal(f.state.calls,4);await assert.rejects(f.api.process(f.user,'study',f.created.id,{...body,limit:1}),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');});
test('precreated queued/running rows remain running and never grant review or another dispatch',async()=>{const f=await batchGroup();const base=f.state.runs[0];for(const status of ['queued','running']){f.state.runs.push({...structuredClone(base),id:'pending-'+status,idempotencyKey:'batch-key-2',status,inputSummary:{studyId:'study',snapshotId:'snapshot2'}});const r=await f.api.read(f.user,'study',f.created.id);assert.equal(r.status,'running');assert.equal(r.capabilities.canReview,false);assert.equal(r.capabilities.canProcessRun,false);f.state.runs.pop();}});
test('new batch rejects stale CAS and unfinished legacy claim before invoking the native batch',async()=>{const f=await batchGroup();await assert.rejects(f.api.process(f.user,'study',f.created.id,{requestKey:'batch-stale',expectedStateHash:'f'.repeat(64),limit:3}),e=>e.code==='FULL_STUDY_RUN_STATE_CHANGED');f.state.audits.push({id:'unclosed',...f.s,target:f.created.id,action:'researchhub.full.analysis.process.claim',meta:{}});await assert.rejects(f.api.process(f.user,'study',f.created.id,{requestKey:'batch-wait',expectedStateHash:f.current.stateHash,limit:3}),e=>e.code==='FULL_STUDY_PROCESS_PENDING');assert.equal(f.state.calls,1);});
test('batch GET cannot confirm partial members or reuse a different manifest, digest, or receipt version',async()=>{
 const f=await batchGroup(),key='batch-get-proof';await f.api.process(f.user,'study',f.created.id,{requestKey:key,expectedStateHash:f.current.stateHash,limit:3});
 f.state.runs.find(r=>r.idempotencyKey==='batch-key-3').status='running';let value=await f.api.processReceipt(f.user,'study',f.created.id,key);assert.equal(value.executionConfirmed,false);assert.equal(value.batchReceipt.items.filter(x=>x.executionConfirmed).length,2);assert.equal(value.group.status,'running');assert.equal(f.state.calls,4);
 const claim=f.state.audits.find(a=>a.meta?.requestKey===key),saved=f.state.receipts.find(x=>x.request_key===key),before=structuredClone(claim.meta);
 claim.meta.targets[1]={sliceId:'slice5',methodKey:'batch-key-5',snapshotId:'snapshot5'};claim.meta.targetsHash=fullStudyHash(claim.meta.targets);
 await assert.rejects(f.api.processReceipt(f.user,'study',f.created.id,key),e=>e.code==='FULL_STUDY_PROCESS_RECEIPT_CHANGED');claim.meta=before;
 claim.meta.batchVersion='legacy';await assert.rejects(f.api.processReceipt(f.user,'study',f.created.id,key),e=>e.code==='FULL_STUDY_PROCESS_RECEIPT_CHANGED');claim.meta=structuredClone(before);
 saved.request_hash='f'.repeat(64);await assert.rejects(f.api.processReceipt(f.user,'study',f.created.id,key),e=>e.code==='FULL_STUDY_PROCESS_RECEIPT_CHANGED');
});
test('explicit next batch reconciles a lost finish only after all previous native members are proved, without redispatch',async()=>{const f=await batchGroup(),key='batch-finish-lost';await f.api.process(f.user,'study',f.created.id,{requestKey:key,expectedStateHash:f.current.stateHash,limit:3});const claim=f.state.audits.find(a=>a.meta?.requestKey===key);f.state.audits=f.state.audits.filter(a=>a.meta?.claimId!==claim.id);const before=await f.api.processReceipt(f.user,'study',f.created.id,key);assert.equal(before.executionConfirmed,true);assert(!f.state.audits.some(a=>a.meta?.claimId===claim.id));const current=await f.api.read(f.user,'study',f.created.id),next=await f.api.process(f.user,'study',f.created.id,{requestKey:'batch-after-lost',expectedStateHash:current.stateHash,limit:3});assert.equal(next.remaining,0);assert.equal(f.state.calls,5);assert.equal(f.state.audits.filter(a=>a.meta?.claimId===claim.id&&a.meta.recovered===true).length,1);});
test('legacy limit1 cannot bypass an unresolved native batch row after the HTTP attempt finished',async()=>{for(const status of ['queued','running']){const f=await batchGroup();f.state.runs.push({...structuredClone(f.state.runs[0]),id:'unresolved-row',idempotencyKey:'batch-key-2',status,inputSummary:{studyId:'study',snapshotId:'snapshot2'}});f.state.audits.push({id:'closed-batch',...f.s,target:f.created.id,action:'researchhub.full.analysis.process.claim',meta:{batchVersion:'full-study-batch-v1'}},{id:'failed-return',...f.s,target:f.created.id,action:'researchhub.full.analysis.process.finished',meta:{claimId:'closed-batch',status:'failed'}});const current=await f.api.read(f.user,'study',f.created.id);await assert.rejects(f.api.process(f.user,'study',f.created.id,{requestKey:'legacy-after-'+status,expectedStateHash:current.stateHash,limit:1}),e=>e.code==='FULL_STUDY_PROCESS_PENDING');assert.equal(f.state.calls,1);}});
test('a batch failed before any native row cannot be stolen and falsely proved by another attempt',async()=>{const f=await batchGroup(),error=Error('interrupted before creating any native row'),native=f.methods.createBatchFromWorkbench;f.methods.createBatchFromWorkbench=async()=>{throw error;};const body={requestKey:'batch-unexecuted-A',limit:3,expectedStateHash:f.current.stateHash};await assert.rejects(f.api.process(f.user,'study',f.created.id,body),e=>e===error);assert.equal((await f.api.processReceipt(f.user,'study',f.created.id,body.requestKey)).executionConfirmed,false);f.methods.createBatchFromWorkbench=native;await assert.rejects(f.api.process(f.user,'study',f.created.id,{...body,requestKey:'batch-different-B'}),e=>e.code==='FULL_STUDY_PROCESS_PENDING');assert.equal(f.state.calls,1);assert.equal((await f.api.processReceipt(f.user,'study',f.created.id,body.requestKey)).executionConfirmed,false);});
test('explicit same-key POST repairs final lost finish with no new targets or Worker call',async()=>{const f=await batchGroup(),first={requestKey:'batch-before-last',limit:3,expectedStateHash:f.current.stateHash},a=await f.api.process(f.user,'study',f.created.id,first),last={requestKey:'batch-last-finish-lost',limit:3,expectedStateHash:a.stateHash};await f.api.process(f.user,'study',f.created.id,last);const claim=f.state.audits.find(a=>a.meta?.requestKey===last.requestKey);f.state.audits=f.state.audits.filter(a=>a.meta?.claimId!==claim.id);assert.equal((await f.api.processReceipt(f.user,'study',f.created.id,last.requestKey)).executionConfirmed,true);await f.api.process(f.user,'study',f.created.id,last);assert.equal(f.state.calls,5);assert.equal(f.state.audits.filter(a=>a.meta?.claimId===claim.id&&a.meta.recovered).length,1);});
test('real Methods dependency runs outside transaction; create replay and process replay do not redispatch',async()=>{const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-one',snapshotId:'root'});assert.equal(f.state.calls,1);assert.equal(created.status,'needs_review');assert.equal((await f.api.create(f.user,'study',{requestKey:'create-one',snapshotId:'root'})).id,created.id);assert.equal(f.state.calls,1);const state=await f.api.read(f.user,'study',created.id);await f.api.process(f.user,'study',created.id,{requestKey:'process-no-more',expectedStateHash:state.stateHash,limit:1});assert.equal(f.state.calls,1);});
test('no valid data creates no Methods run and cannot manufacture confirmed numeric outputs',async()=>{const f=fixture({empty:true}),created=await f.api.create(f.user,'study',{requestKey:'create-empty',snapshotId:'root'});assert.equal(created.status,'no_valid_data');assert.equal(f.state.calls,0);const bundle=await f.api.confirmedBundle(f.user,'study',created.id);assert.equal(bundle.slices[0].status,'no_valid_data');assert.equal(bundle.slices[0].actualRun,undefined);});
test('confirmed bundle requires genuine per-slice review and preserves run+basis for report; source change blocks',async()=>{const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-bundle',snapshotId:'root'});await assert.rejects(f.api.confirmedBundle(f.user,'study',created.id),e=>e.code==='FULL_STUDY_METHOD_REVIEW_REQUIRED');await f.api.review(f.user,'study',created.id,{requestKey:'review-bundle',conclusion:'confirmed',comment:'核对真实数值'});const bundle=await f.api.confirmedBundle(f.user,'study',created.id);assert.equal(bundle.slices[0].actualRun.id,f.state.runs[0].id);assert.equal(bundle.slices[0].outputs.columns.phq.mean,2);assert.equal(bundle.slices[0].basis.snapshotId,'slice-snapshot');f.state.valid=false;await assert.rejects(f.api.confirmedBundle(f.user,'study',created.id),e=>e.code==='ANALYSIS_BASIS_STALE');});
test('an unclosed durable process claim blocks another dispatch even when no Methods row exists yet',async()=>{const f=fixture({empty:true}),created=await f.api.create(f.user,'study',{requestKey:'create-claim',snapshotId:'root'});f.state.audits.push({id:'pending',...f.s,target:created.id,accountId:f.user.accountId,action:'researchhub.full.analysis.process.claim',meta:{methodKey:'other'}});await assert.rejects(f.api.process(f.user,'study',created.id,{requestKey:'process-concurrent',expectedStateHash:created.stateHash,limit:1}),e=>e.code==='FULL_STUDY_PROCESS_PENDING');assert.equal(f.state.calls,0);});

test('cancel rejects a different group actor without persisting cancellation',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-other',snapshotId:'root'});
 await assert.rejects(f.api.cancel({...f.user,accountId:'other'},'study',g.id),e=>e.status===403);
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
 assert.equal(f.state.cancelCalls,0);
});
test('cancel checks all current native capabilities before its durable fence',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-denied',snapshotId:'root'});f.state.canCancel=false;
 await assert.rejects(f.api.cancel(f.user,'study',g.id),e=>e.status===403);
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
 assert.equal(f.state.cancelCalls,0);
});
test('cancel repeats native authority inside the fence; revoked rights leave no group audit',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-race',snapshotId:'root'});
 f.methods.getDescriptiveCapabilities=async()=>{f.state.canCancel=false;return{capabilities:{canCancel:true}};};
 await assert.rejects(f.api.cancel(f.user,'study',g.id),e=>e.status===403);
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
 assert.equal(f.state.cancelCalls,0);
});
test('cancel native authorization precedes audit and public cancellation; pending claims still fence',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-success',snapshotId:'root'});
 const cancelled=await f.api.cancel(f.user,'study',g.id);assert.equal(cancelled.status,'cancelled');
 assert.equal(f.state.authorizationCalls,1);assert.equal(f.state.cancelCalls,1);
 const f2=fixture(),g2=await f2.api.create(f2.user,'study',{requestKey:'cancel-pending',snapshotId:'root'});
 f2.state.audits.push({id:'claim',...f2.s,target:g2.id,action:'researchhub.full.analysis.process.claim',meta:{}});
 await assert.rejects(f2.api.cancel(f2.user,'study',g2.id),e=>e.code==='FULL_STUDY_PROCESS_PENDING');
 assert.equal(f2.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
});
test('a group without a child still rejects stale actor identity and never fabricates method cancellation',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-not-started',snapshotId:'root'});f.state.runs=[];
 await assert.rejects(f.api.cancel({...f.user,authVersion:2},'study',g.id),e=>e.status===403);
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
 const cancelled=await f.api.cancel(f.user,'study',g.id);assert.equal(cancelled.status,'cancelled');assert.equal(f.state.cancelCalls,0);
});
test('cancel fails closed when its trusted native transaction callback is unavailable',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-missing-callback',snapshotId:'root'});
 const api=createFullStudyRuns({studies:{withResearchStudyTransaction:async(_u,_st,_op,fn)=>fn(f.tx,{...f.s,executionProjectId:'p'})},analysis:{assertCurrent:async()=>({basis:{manifestHash:g.manifestHash},manifest:{schemaVersion:'full-study-simulation-root-v2'}})},methods:f.methods});
 await assert.rejects(api.cancel(f.user,'study',g.id),e=>e.code==='FULL_STUDY_CANCEL_AUTHORITY_UNAVAILABLE');
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
});
test('a child changed after capability read is rejected before native cancellation or group audit',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-state-race',snapshotId:'root'});
 f.methods.getDescriptiveCapabilities=async()=>{f.state.runs[0].status='completed';return{capabilities:{canCancel:true}};};
 await assert.rejects(f.api.cancel(f.user,'study',g.id),e=>e.code==='FULL_STUDY_RUN_STATE_CHANGED');
 assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.run.cancel'),false);
 assert.equal(f.state.cancelCalls,0);
});
test('cancel capability follows the same original-actor boundary as the command',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'cancel-cap-actor',snapshotId:'root'});
 const other=await f.api.read({...f.user,accountId:'other'},'study',g.id);
 assert.equal(other.capabilities.canCancel,false);assert.equal(other.capabilities.canProcessRun,false);
});

test('capability reads use one current group projection while public Methods capabilities stay outside it',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'read-proof-once',snapshotId:'root'});f.state.sourceProofs=0;let methodChecks=0;
 f.methods.getDescriptiveCapabilities=async()=>{assert.equal(f.state.inTransaction,false);methodChecks++;return{capabilities:{canReview:true,canCancel:true}};};
 await f.api.read(f.user,'study',g.id);assert.equal(f.state.sourceProofs,1);assert.equal(methodChecks,1);
});

test('analysis readers retain group metadata when only Methods execution capability is forbidden',async()=>{const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-read-only',snapshotId:'root'});let checked=0;f.analysis.configuration=async()=>{checked++;return{studyId:'study'};};f.methods.getDescriptiveCapabilities=async()=>{throw Object.assign(Error('chat permission absent'),{status:403,code:'METHOD_AUTHORIZATION_REVOKED'});};const read=await f.api.read(f.user,'study',created.id);assert.equal(read.id,created.id);assert.deepEqual(read.capabilities,{canReview:false,canCancel:false,canProcessRun:false});assert.equal(checked,1);f.analysis.configuration=async()=>{throw Object.assign(Error('revoked'),{status:403,code:'FULL_STUDY_FORBIDDEN'});};await assert.rejects(f.api.read(f.user,'study',created.id),e=>e.code==='FULL_STUDY_FORBIDDEN');f.methods.getDescriptiveCapabilities=async()=>{throw Object.assign(Error('expired'),{status:401,code:'AUTH_SESSION_EXPIRED'});};await assert.rejects(f.api.read(f.user,'study',created.id),e=>e.code==='AUTH_SESSION_EXPIRED');});
test('concurrent native capability changes revalidate current sources and never mask stale data',async()=>{const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-read-race',snapshotId:'root'});f.methods.getDescriptiveCapabilities=async()=>{throw Object.assign(Error('changed while reading'),{status:409,code:'METHOD_RUN_CHANGED'});};const read=await f.api.read(f.user,'study',created.id);assert.equal(read.id,created.id);assert.deepEqual(read.capabilities,{canReview:false,canCancel:false,canProcessRun:false});f.state.valid=false;await assert.rejects(f.api.read(f.user,'study',created.id),e=>e.code==='ANALYSIS_BASIS_STALE');});

test('create uses its initial state and returns first process metadata without redundant root projections',async()=>{
 const f=fixture();let caps=0;f.methods.getDescriptiveCapabilities=async()=>{assert.equal(f.state.inTransaction,false);caps++;return{capabilities:{canReview:true,canCancel:true}};};
 const result=await f.api.create(f.user,'study',{requestKey:'create-once',snapshotId:'root'});
 assert.equal(result.status,'needs_review');assert.equal(result.slices[0].methodRunId,'method1');
 assert.equal(f.state.sourceProofs,2);assert.equal(caps,1);
});
test('process reuses its finished transaction projection, then checks capabilities outside the transaction',async()=>{
 const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-process-once',snapshotId:'root'});f.state.runs=[];
 const before=await f.api.read(f.user,'study',created.id);f.state.sourceProofs=0;
 const result=await f.api.process(f.user,'study',created.id,{requestKey:'process-once',expectedStateHash:before.stateHash,limit:1});
 assert.equal(f.state.sourceProofs,2);assert.equal(result.slices[0].methodRunId,'method2');assert.equal(result.remaining,0);
});
test('source revocation during Methods execution still blocks the finished audit and returned metadata',async()=>{
 const f=fixture(),execute=f.methods.createFromWorkbench;f.methods.createFromWorkbench=async(...args)=>{await execute(...args);f.state.valid=false;};
 await assert.rejects(f.api.create(f.user,'study',{requestKey:'create-revoked',snapshotId:'root'}),e=>e.code==='ANALYSIS_BASIS_STALE');
 assert.equal(f.state.calls,1);assert.equal(f.state.audits.some(a=>a.action==='researchhub.full.analysis.process.finished'),false);
});
test('a native execution failure retains its finished audit and original error without constructing success metadata',async()=>{
 const f=fixture(),failure=Object.assign(Error('native failed'),{code:'EXECUTOR_FAILED'});
 f.methods.createFromWorkbench=async()=>{f.tx.researchMethodRun.findMany=async()=>{throw Error('must not construct success metadata');};throw failure;};
 await assert.rejects(f.api.create(f.user,'study',{requestKey:'create-native-failed',snapshotId:'root'}),e=>e===failure);
 assert.equal(f.state.audits.filter(a=>a.action==='researchhub.full.analysis.process.finished').length,1);
});

async function capabilityGroup({pending=false}={}){
 const f=fixture(),created=await f.api.create(f.user,'study',{requestKey:'create-many-caps',snapshotId:'root'}),g=f.state.audits.find(a=>a.id===created.id);
 const {manifest}=await f.analysis.assertCurrent(null,null,null,null,'root'),first=manifest.slices[0],firstRun=f.state.runs[0];
 for(let i=2;i<=4;i++){
  const sliceId='slice'+i,methodKey='method-key-'+i;manifest.slices.push({...first,sliceId});g.meta.slices.push({sliceId,snapshotId:'snapshot'+i,methodKey});
  if(!pending||i<4)f.state.runs.push({...firstRun,id:'method'+i,idempotencyKey:methodKey,inputSummary:{...firstRun.inputSummary,snapshotId:'snapshot'+i},dataSources:{analysisBasis:{...firstRun.dataSources.analysisBasis,snapshotId:'snapshot'+i}}});
 }
 const calls=[];f.methods.getDescriptiveCapabilities=async(_u,id)=>{assert.equal(f.state.inTransaction,false);calls.push(id);return{capabilities:{canReview:true,canCancel:true}};};
 return{...f,created,calls};
}
test('running group stops after cancellation OR succeeds and a nonactor with no group review needs no Methods calls',async()=>{
 const f=await capabilityGroup({pending:true}),result=await f.api.read(f.user,'study',f.created.id);
 assert.equal(result.capabilities.canReview,false);assert.equal(result.capabilities.canCancel,true);assert.equal(result.capabilities.canProcessRun,true);assert.deepEqual(f.calls,['method1']);
 f.calls.length=0;const other=await f.api.read({...f.user,accountId:'other'},'study',f.created.id);
 assert.deepEqual(other.capabilities,{canReview:false,canCancel:false,canProcessRun:false});assert.deepEqual(f.calls,[]);
});
test('ready group must check every pending child before granting review even after cancel is already true',async()=>{
 const f=await capabilityGroup(),result=await f.api.read(f.user,'study',f.created.id);
 assert.equal(result.capabilities.canReview,true);assert.equal(result.capabilities.canCancel,true);assert.deepEqual(f.calls,['method1','method2','method3','method4']);
});
test('review false prefix never grants review and only stops once the independent cancellation result is known',async()=>{
 const f=await capabilityGroup();f.methods.getDescriptiveCapabilities=async(_u,id)=>{f.calls.push(id);return{capabilities:{canReview:id!=='method1',canCancel:id==='method3'}};};
 const result=await f.api.read(f.user,'study',f.created.id);assert.equal(result.capabilities.canReview,false);assert.equal(result.capabilities.canCancel,true);assert.deepEqual(f.calls,['method1','method2','method3']);
 f.calls.length=0;f.methods.getDescriptiveCapabilities=async(_u,id)=>{f.calls.push(id);return{capabilities:{canReview:false,canCancel:true}};};
 assert.equal((await f.api.read(f.user,'study',f.created.id)).capabilities.canReview,false);assert.deepEqual(f.calls,['method1']);
});
test('review operation wiring requests official authority before tenant at transaction entry; old reads retain default lane',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'create-op-options',snapshotId:'root'});
 f.tx.researchMethodReview.findMany=async()=>[];
 const op=await f.api.startReviewOperation(f.user,'study',g.id,{requestKey:'parent-op-options',conclusion:'confirmed',comment:'核对'});
 assert.equal(op.status,'ready');assert.deepEqual(f.state.transactionOptions,{includeOfficial:true});
 await f.api.readReviewOperation(f.user,'study',g.id,op.operationId);assert.deepEqual(f.state.transactionOptions,{includeOfficial:true});
 await f.api.read(f.user,'study',g.id);assert.equal(f.state.transactionOptions,undefined);
 for(const method of ['reviewOperationReceipt','reviewStepReceipt','advanceReviewOperation','processReceipt'])assert.equal(typeof f.api[method],'function');
});
test('group response includes only the full source snapshot verified in that same transaction without another projection',async()=>{
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'create-inline-source',snapshotId:'root'}),native=f.analysis.assertCurrent;
 let verified;f.analysis.assertCurrent=async(...args)=>{verified={...await native(...args),qualityGate:{id:'gate',version:1,status:'released'},internal:'not part of snapshot'};return verified;};f.state.sourceProofs=0;
 const read=await f.api.read(f.user,'study',g.id);
 assert.equal(f.state.sourceProofs,1);assert.deepEqual(Object.keys(read.sourceSnapshot).sort(),['basis','manifest','qualityGate']);
 assert.deepEqual(read.sourceSnapshot,{basis:verified.basis,manifest:verified.manifest,qualityGate:verified.qualityGate});
 assert.equal(read.sourceSnapshot.basis.studyId,read.studyId);assert.equal(read.sourceSnapshot.basis.planId,read.planId);assert.equal(read.sourceSnapshot.basis.snapshotId,read.snapshotId);assert.equal(read.sourceSnapshot.basis.manifestHash,read.manifestHash);
 read.sourceSnapshot.manifest.slices[0].variable.label='changed externally';assert.equal(verified.manifest.slices[0].variable.label,'PHQ');
});
test('group cannot return an inline snapshot for a different study, plan or root and still rejects current source revocation',async()=>{
 for(const field of ['studyId','planId','snapshotId','manifestHash']){
  const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'create-binding-'+field,snapshotId:'root'}),native=f.analysis.assertCurrent;
  f.analysis.assertCurrent=async(...args)=>{const value=await native(...args);return{...value,basis:{...value.basis,[field]:'other'}};};
  await assert.rejects(f.api.read(f.user,'study',g.id),e=>e.code==='ANALYSIS_BASIS_STALE');
 }
 const f=fixture(),g=await f.api.create(f.user,'study',{requestKey:'create-inline-stale',snapshotId:'root'});f.state.valid=false;
 await assert.rejects(f.api.read(f.user,'study',g.id),e=>e.code==='ANALYSIS_BASIS_STALE');
});
test('new computation claims persist the exact original request digest independently of the operation receipt',async()=>{
 const f=fixture();await f.api.create(f.user,'study',{requestKey:'create-claim-digest',snapshotId:'root'});
 const claim=f.state.audits.find(a=>a.action==='researchhub.full.analysis.process.claim'),saved=f.state.receipts.find(r=>r.request_key===claim.meta.requestKey);
 assert.match(claim.meta.requestDigest,/^[a-f0-9]{64}$/);assert.equal(claim.meta.requestDigest,saved.request_hash);
});
test('first group header and original single claim commit together before native execution',async()=>{const f=fixture(),original=f.methods.createFromWorkbench;let metadataCommitted=false;f.state.beforeCommit=()=>{if(f.state.transactions===1){assert.equal(f.state.audits.filter(a=>a.action==='researchhub.full.analysis.run.group').length,1);assert.equal(f.state.audits.filter(a=>a.action==='researchhub.full.analysis.process.claim').length,1);assert.deepEqual(f.state.receipts.map(r=>r.action).sort(),['full.analysis.run.create','full.analysis.run.process']);metadataCommitted=true;}};f.methods.createFromWorkbench=async(...args)=>{assert(metadataCommitted);assert.equal(f.state.transactions,1);return original(...args);};const created=await f.api.create(f.user,'study',{requestKey:'atomic-create',snapshotId:'root'});assert.equal(f.state.guardCalls,1);assert.equal(created.status,'needs_review');assert.equal(f.state.calls,1);assert.equal(f.state.transactions,2);});
test('claim audit/receipt and metadata commit failures roll back header and both receipts with zero native work',async()=>{for(const kind of ['claim','receipt','commit']){const f=fixture(),failure=Error(kind),audit=f.tx.auditLog.createMany,execute=f.tx.$executeRaw;if(kind==='claim')f.tx.auditLog.createMany=async q=>{if(q.data.action==='researchhub.full.analysis.process.claim')throw failure;return audit(q);};if(kind==='receipt')f.tx.$executeRaw=async(t,...v)=>{if(t.join('').includes('INSERT INTO rh_research.operation')&&v[5]==='full.analysis.run.process')throw failure;return execute(t,...v);};if(kind==='commit')f.state.beforeCommit=()=>{throw failure;};await assert.rejects(f.api.create(f.user,'study',{requestKey:'rollback-'+kind,snapshotId:'root'}),e=>e===failure);assert.equal(f.state.calls,0);assert.deepEqual(f.state.audits,[]);assert.deepEqual(f.state.receipts,[]);}});
test('unknown committed initial claim remains GET-only accepted on create replay with no native redispatch',async()=>{const f=fixture(),failure=Error('commit acknowledgment lost'),body={requestKey:'lost-create-commit',snapshotId:'root'};f.state.afterCommitFailure=failure;await assert.rejects(f.api.create(f.user,'study',body),e=>e===failure);assert.equal(f.state.calls,0);assert.equal(f.state.receipts.length,2);const first=f.state.audits.find(a=>a.action==='researchhub.full.analysis.process.claim');assert(first);const read=await f.api.create(f.user,'study',body);assert.equal(read.status,'running');assert.equal(f.state.calls,0);assert.equal(f.state.audits.filter(a=>a.action==='researchhub.full.analysis.process.claim').length,1);const saved=f.state.receipts.find(r=>r.action==='full.analysis.run.process');const receipt=await f.api.processReceipt(f.user,'study',read.id,saved.request_key);assert.equal(receipt.status,'processing');assert.equal(receipt.executionConfirmed,false);assert.equal(f.state.calls,0);});
test('older injected analysis dependencies keep fresh source checks rather than accepting an unguarded proof',async()=>{const f=fixture();delete f.analysis.withRootSourceGuard;const created=await f.api.create(f.user,'study',{requestKey:'old-analysis-dependency',snapshotId:'root'});assert.equal(created.status,'needs_review');assert.equal(f.state.sourceProofs,3);assert.equal(f.state.calls,1);});
test('source protection fails before any header or claim metadata can persist',async()=>{const f=fixture(),failure=Object.assign(Error('unprotected task'),{code:'FULL_STUDY_BATCH_SOURCE_UNPROTECTED'});f.analysis.withRootSourceGuard=async()=>{throw failure;};await assert.rejects(f.api.create(f.user,'study',{requestKey:'unprotected-first-create',snapshotId:'root'}),e=>e===failure);assert.equal(f.state.calls,0);assert.deepEqual(f.state.audits,[]);assert.deepEqual(f.state.receipts,[]);});
