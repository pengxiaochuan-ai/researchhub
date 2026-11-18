import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionJobs} from './execution-jobs.mjs';
import {requestHash,researchError} from '../research-studies/contract.mjs';

const hash='a'.repeat(64),actor={tenantId:'tenant',accountId:'actor',authVersion:0};
function fixture(){
 const h={state:{jobs:[],audits:[],cancellations:[]},reads:0,authorizations:0,denied:false,insertFails:false};
 const context={tenantId:'tenant',studyId:'study',studyGroupId:'group',executionProjectId:'project'};
 const repository={
  lockRequest:async()=>{},findByRequest:async(_tx,s,u,k)=>h.state.jobs.find(r=>r.tenant_id===s.tenantId&&r.study_id===s.studyId&&r.actor_id===u.accountId&&r.request_key===k)??null,
  findById:async(_tx,s,id)=>h.state.jobs.find(r=>r.id===id&&r.study_id===s.studyId&&r.tenant_id===s.tenantId)??null,
  insert:async(_tx,row)=>{if(h.insertFails)throw Error('insert failed');h.state.jobs.push(structuredClone(row));return row;},
  audit:async(_tx,row)=>h.state.audits.push(structuredClone(row)),
  cancellationReceipt:async(_tx,s,u,key)=>h.state.cancellations.find(r=>r.tenant_id===s.tenantId&&r.actor_id===u.accountId&&r.request_key===key)??null,
  saveCancellation:async(_tx,row)=>h.state.cancellations.push(structuredClone(row)),
  requestCancellation:async(_tx,row,cancel)=>{Object.assign(row,{status:'cancelling',lease_generation:row.lease_generation+1,cancellation:cancel});return row;},
 };
 const studies={withResearchStudyTransaction:async(u,id,op,fn,options)=>{
  assert.deepEqual(options,{includeOfficial:true});assert.equal(op,'read');assert.equal(id,'study');
  if(h.denied)throw Object.assign(Error('not readable'),{status:404});
  const before=structuredClone(h.state);try{return await fn({$executeRaw:async(strings,...values)=>{assert(strings.join('').includes("app.auth_version"));assert.equal(values[2],String(u.authVersion));}},context);}catch(e){h.state=before;throw e;}
 }};
 // Deliberate offline, read-only dry authority; this is not native/HTTP execution evidence.
 const authority={
  resolveFixedBasisInTransaction:async(_tx,u,s,snapshotId)=>{h.reads++;return{branch:'ordinary',snapshotId,planId:'plan',reviewId:'review',manifestHash:hash};},
  authorizeOperatorInTransaction:async()=>{h.authorizations++;return{agentId:'agent',skillId:'skill',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'1.0.0',configurationHash:hash};},
  authorizeCancellationInTransaction:async()=>{h.authorizations++;},
 };
 let sequence=0;
 h.options={studies,authority,repository,deployment:{deploymentId:'deployment',allowedTenantIds:['tenant']},id:()=>`id-${++sequence}`};
 h.api=createExecutionJobs(h.options);h.actor=actor;return h;
}
const body={requestKey:'request-0001',snapshotId:'snapshot'};
test('admission authVersion0 is durable and same key replays without a second authority/Session/Run side effect',async()=>{
 const h=fixture(),a=await h.api.create(actor,'study',body),b=await h.api.create(actor,'study',body);
 assert.equal(a.job.status,'queued');assert.equal(a.receipt.authVersion,0);assert.equal(a.receipt.requestHash,requestHash({action:'analysis.job.create',studyId:'study',body}));
 assert.deepEqual(b,a);assert.equal(h.state.jobs.length,1);assert.equal(h.state.audits.length,1);assert.equal(h.authorizations,1);assert.equal(h.reads,1);
 assert.equal(h.state.jobs[0].checkpoint.targets.length,1);assert.equal(h.state.jobs[0].checkpoint.targets[0].runId,null);
 assert.equal(h.state.jobs[0].native_create_key,'analysis-job-native-'+requestHash({jobId:a.job.id}));assert.equal(h.state.jobs[0].checkpoint.targets[0].methodKey,h.state.jobs[0].native_create_key);
 assert(!JSON.stringify(a).includes('lease_token'));assert(!JSON.stringify(a).includes('native_create_key'));
});
test('accepted key is unique across authVersions; current readable history is not an old-version receipt',async()=>{
 const h=fixture(),accepted=await h.api.create(actor,'study',body),newActor={...actor,authVersion:1};
 await assert.rejects(h.api.create(newActor,'study',body),e=>e.status===409&&e.code==='ANALYSIS_JOB_ACTOR_CHANGED');
 await assert.rejects(h.api.receipt(newActor,'study',body.requestKey),e=>e.status===409&&e.code==='ANALYSIS_JOB_ACTOR_CHANGED');
 assert.equal((await h.api.read(newActor,'study',accepted.job.id)).job.id,accepted.job.id);assert.equal(h.state.jobs.length,1);
});
test('same key changed body and injected capability fields are rejected without writes',async()=>{
 const h=fixture();await h.api.create(actor,'study',body);
 await assert.rejects(h.api.create(actor,'study',{...body,snapshotId:'other'}),e=>e.status===409);
 for(const extra of [{jobFence:{}},{force:true},{actorId:'other'},{operatorRef:{}}])await assert.rejects(h.api.create(actor,'study',{...body,...extra}),e=>e.status===400);
 assert.equal(h.state.jobs.length,1);assert.equal(h.state.audits.length,1);
});
test('unknown receipt and revoked current read access perform no business write',async()=>{
 const h=fixture();await assert.rejects(h.api.receipt(actor,'study','unknown-key'),e=>e.status===404);assert.equal(h.state.jobs.length,0);
 const a=await h.api.create(actor,'study',body);h.denied=true;
 await assert.rejects(h.api.read(actor,'study',a.job.id),e=>e.status===404);assert.equal(h.state.jobs.length,1);assert.equal(h.authorizations,1);
});
test('empty tenant/deployment and missing native-read authority fail before opening a transaction',()=>{
 const h=fixture();
 for(const deployment of [{deploymentId:'deployment',allowedTenantIds:[]},{deploymentId:'',allowedTenantIds:['tenant']},{deploymentId:'deployment',allowedTenantIds:['']}])assert.throws(()=>createExecutionJobs({...h.options,deployment}));
 assert.throws(()=>createExecutionJobs({...h.options,authority:{}}));
});
test('failed insertion rolls back the admission audit; failed authorization creates neither',async()=>{
 const h=fixture();h.insertFails=true;await assert.rejects(h.api.create(actor,'study',body));assert.deepEqual(h.state,{jobs:[],audits:[],cancellations:[]});
 h.insertFails=false;h.options.authority.authorizeOperatorInTransaction=async()=>{throw Object.assign(Error('denied'),{status:403});};
 await assert.rejects(h.api.create(actor,'study',body),e=>e.status===403);assert.equal(h.state.jobs.length,0);assert.equal(h.state.audits.length,0);
});
test('fixed basis and operator output are strictly metadata; malformed or cross-snapshot output cannot be admitted',async()=>{
 for(const mutate of [a=>a.resolveFixedBasisInTransaction=async()=>({branch:'ordinary',snapshotId:'wrong',planId:'plan',reviewId:'review',manifestHash:hash}),a=>a.authorizeOperatorInTransaction=async()=>({agentId:'agent',skillKey:'descriptive-statistics',skillVersion:1})]){
  const h=fixture();mutate(h.options.authority);await assert.rejects(h.api.create(actor,'study',body));assert.equal(h.state.jobs.length,0);assert.equal(h.state.audits.length,0);
 }
});
test('full admission freezes unique slice references and derived keys without a group, Run or value payload',async()=>{
 const h=fixture();h.options.authority.resolveFixedBasisInTransaction=async()=>({branch:'full',snapshotId:'snapshot',planId:'plan',reviewId:'review',manifestHash:hash,slices:[{sliceId:'s1',snapshotId:'child-1'},{sliceId:'s2',snapshotId:'child-2'}]});
 const result=await h.api.create(actor,'study',body),r=h.state.jobs[0];assert.equal(result.job.branch,'full');assert.equal(r.checkpoint.runGroupId,null);assert.equal(r.checkpoint.targets.length,2);
 for(const t of r.checkpoint.targets){assert.equal(t.runId,null);assert.equal(t.methodKey,'analysis-job-native-slice-'+requestHash({studyId:'study',actor:'actor',requestKey:r.native_create_key,snapshotId:t.snapshotId}));assert(t.methodKey.startsWith('analysis-job-native-'));}
 assert(!JSON.stringify(result).includes('child-1'));assert(!JSON.stringify(result).includes('operator_ref'));
});
test('cancel admission is original-key metadata idempotent and fences once without running native settlement',async()=>{
 const h=fixture(),created=await h.api.create(actor,'study',body),b={requestKey:'cancel-0001'};
 const first=await h.api.cancel(actor,'study',created.job.id,b),second=await h.api.cancel(actor,'study',created.job.id,b);
 assert.deepEqual(second,first);assert.equal(h.state.jobs[0].status,'cancelling');assert.equal(h.state.jobs[0].lease_generation,1);assert.equal(h.state.cancellations.length,1);
 assert.equal((await h.api.cancellationReceipt(actor,'study',created.job.id,b.requestKey)).receipt.requestKey,b.requestKey);
 await assert.rejects(h.api.cancel(actor,'study',created.job.id,{requestKey:'cancel-0002'}),e=>e.status===409);
 await assert.rejects(h.api.cancellationReceipt({...actor,authVersion:1},'study',created.job.id,b.requestKey),e=>e.status===409);
 assert.equal(h.state.jobs[0].lease_generation,1);
});
test('read/cancel/cancelReceipt reject invalid jobId before entering a transaction or ORM',async()=>{
 const h=fixture();let calls=0;h.options.studies.withResearchStudyTransaction=async()=>{calls++;throw Error('ORM must not be reached');};
 for(const jobId of [undefined,null,{},17,'','a'.repeat(161),'bad/path']){
  for(const call of [()=>h.api.read(actor,'study',jobId),()=>h.api.cancel(actor,'study',jobId,{requestKey:'cancel-0001'}),()=>h.api.cancellationReceipt(actor,'study',jobId,'cancel-0001')])await assert.rejects(async()=>call(),e=>e.status===400&&e.code==='RESEARCH_INPUT_INVALID');
 }
 assert.equal(calls,0);
});

test('new admission rejects unavailable health before heavy source or any audit/Job write',async()=>{
 const h=fixture();let checks=0;const api=createExecutionJobs({...h.options,assertAdmissionReady(){checks++;throw researchError(503,'ANALYSIS_JOB_CONSUMER_UNAVAILABLE','unavailable');}});
 await assert.rejects(api.create(actor,'study',body),e=>e.status===503);assert.equal(checks,1);assert.equal(h.reads,0);assert.equal(h.authorizations,0);assert.deepEqual(h.state,{jobs:[],audits:[],cancellations:[]});
});
test('health lost while actual source promise is pending is rechecked immediately before audit/insert',async()=>{
 const h=fixture(),resolve=h.options.authority.resolveFixedBasisInTransaction;let ready=true,checks=0,entered,release;const atSource=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
 h.options.authority.resolveFixedBasisInTransaction=async(...args)=>{entered();await hold;return resolve(...args);};const api=createExecutionJobs({...h.options,assertAdmissionReady(){checks++;if(!ready)throw researchError(503,'ANALYSIS_JOB_CONSUMER_UNAVAILABLE','unavailable');}}),pending=api.create(actor,'study',body);await atSource;ready=false;release();await assert.rejects(pending,e=>e.status===503);assert.equal(checks,2);assert.equal(h.reads,1);assert.deepEqual(h.state,{jobs:[],audits:[],cancellations:[]});
});
test('unavailable consumer never blocks original-key create/receipt/read or authorized cancellation',async()=>{
 const h=fixture();let ready=true,checks=0;const api=createExecutionJobs({...h.options,assertAdmissionReady(){checks++;if(!ready)throw researchError(503,'ANALYSIS_JOB_CONSUMER_UNAVAILABLE','unavailable');}}),created=await api.create(actor,'study',body);assert.equal(checks,2);ready=false;
 assert.deepEqual(await api.create(actor,'study',body),created);assert.deepEqual(await api.receipt(actor,'study',body.requestKey),created);assert.equal((await api.read(actor,'study',created.job.id)).job.id,created.job.id);const cancel=await api.cancel(actor,'study',created.job.id,{requestKey:'cancel-health-off'});assert.equal(cancel.status,'cancelling');assert.deepEqual(await api.cancellationReceipt(actor,'study',created.job.id,'cancel-health-off'),cancel);assert.equal(checks,2);assert.equal(h.state.jobs.length,1);assert.equal(h.reads,1);
});
test('async presenter receives current Study-bound actor0/Scope4 and one original physical transaction',async()=>{
 const h=fixture(),run=h.options.studies.withResearchStudyTransaction,principal={...actor,studyGroupId:'jwt-other-group',researchProjectId:'jwt-other-project'},seen=[];let txCount=0,activeTx;
 h.options.studies.withResearchStudyTransaction=(u,id,op,fn,options)=>{txCount++;return run(u,id,op,async(tx,c)=>{activeTx=tx;return fn(tx,c);},options);};
 const api=createExecutionJobs({...h.options,async presentInTransaction(tx,bound,s,row){await Promise.resolve();assert.equal(tx,activeTx);assert.equal(bound.authVersion,0);assert.equal(bound.studyGroupId,'group');assert.equal(bound.researchProjectId,'project');assert.deepEqual(s,{tenantId:'tenant',studyId:'study',studyGroupId:'group',researchProjectId:'project'});seen.push(row.id);return{id:row.id,status:row.status,progress:{total:1,published:0}};}}),created=await api.create(principal,'study',body),originalState=structuredClone(h.state);
 assert.deepEqual(created.job.progress,{total:1,published:0});assert.equal(created.receipt.authVersion,0);assert.equal(created.receipt.requestHash,requestHash({action:'analysis.job.create',studyId:'study',body}));assert.deepEqual(await api.create(principal,'study',body),created);assert.deepEqual(await api.receipt(principal,'study',body.requestKey),created);assert.deepEqual((await api.read(principal,'study',created.job.id)).job,created.job);assert.equal(txCount,4);assert.deepEqual(seen,Array(4).fill(created.job.id));assert.deepEqual(h.state,originalState);
});
test('presenter failure rolls back new admission and optional internal callbacks must be callable',async()=>{
 const h=fixture();for(const delta of [{presentInTransaction:{}},{assertAdmissionReady:{}}])assert.throws(()=>createExecutionJobs({...h.options,...delta}));const expected=Error('present failed'),api=createExecutionJobs({...h.options,presentInTransaction:async()=>{throw expected;}});await assert.rejects(api.create(actor,'study',body),e=>e===expected);assert.deepEqual(h.state,{jobs:[],audits:[],cancellations:[]});
});
test('a read-only readiness callback returning false cannot silently admit a new Job',async()=>{const h=fixture(),api=createExecutionJobs({...h.options,assertAdmissionReady:()=>false});await assert.rejects(api.create(actor,'study',body),e=>e.status===503&&e.code==='ANALYSIS_JOB_CONSUMER_UNAVAILABLE');assert.equal(h.reads,0);assert.deepEqual(h.state,{jobs:[],audits:[],cancellations:[]});});
