// Pure metadata/savepoint adapters only. No native services, PG, fixture or target execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyHash} from './study-workflow-wf01-qa.mjs';
import {parseWF04PgArgs,withWF04LogicalSavepoint,redactedWF04PgError,assertWF04NativeProof,runWF04PgPrediction,wf04PredictionDelta} from './study-workflow-wf04-pg.mjs';
const windowEnv={STUDY_WORKFLOW_WF04_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'},hash='a'.repeat(64),principal={tenantId:'synthetic-tenant',accountId:'actual-researcher',authVersion:0},c={studyId:'synthetic-study',protocolId:'synthetic-protocol',policyId:'fixed-policy',policyHash:hash,pseudonym:'SYNTHETIC-WF04-B'},subjectId='native-subject-id';
const args=(code,mode)=>['--local-synthetic','--rollback-predict','--case',code,'--mode',mode];
const event={kind:'research_consent',decision:'granted',effectiveAt:'2026-11-17T00:00:00.000Z',evidence:'SYNTHETIC fixture evidence',signer:'SYNTHETIC signer',textVersion:'fixed-version'};
const body=(action='record')=>({requestKey:'original-'+action,expectedPolicyVersionId:c.policyId,expectedPolicyHash:c.policyHash,expectedLastEventId:null,...(action==='record'?{event:structuredClone(event)}:{})});
function result(action='record',input=body(action)){
 const receipt={proofVersion:1,id:'native-operation-id',requestKey:input.requestKey,requestHash:bodyHash(input),actorId:principal.accountId,authVersion:0,studyId:c.studyId,subjectId,protocolId:c.protocolId,policyVersionId:c.policyId,policyHash:c.policyHash,action:'participation.'+action,targetId:subjectId,...(action==='record'?{eventId:'native-event',eventSequence:1,eventKind:event.kind}:{})};
 return{studyId:c.studyId,subject:{id:subjectId,subjectId:c.pseudonym},protocol:{id:c.protocolId,status:'executing'},policy:{id:c.policyId,contentHash:c.policyHash},receipt,...(action==='record'?{event:{id:'native-event',sequence:1,protocolVersionId:c.protocolId,policyVersionId:c.policyId,policyHash:c.policyHash},events:[{id:'native-event',sequence:1,recordedBy:principal.accountId,...structuredClone(event)}]}:{enrollment:{id:'native-enrollment',subjectId,protocolVersionId:c.protocolId,status:'enrolled',createdBy:principal.accountId}})};
}
test('PG entry requires 04+shared windows and exact six frozen modes before dependencies',async()=>{
 assert.deepEqual(parseWF04PgArgs(['--help'],{}),{help:true});for(const [code,mode]of [['A','full'],['B','full'],['D','failed-screening'],['A','records-cas'],['A','enroll-cas'],['A','after-record-core-fault']])assert.deepEqual(parseWF04PgArgs(args(code,mode),windowEnv),{code,mode});
 for(const [code,mode]of [['D','full'],['A','failed-screening'],['B','records-cas'],['B','enroll-cas'],['B','after-record-core-fault'],['A','unknown']])assert.throws(()=>parseWF04PgArgs(args(code,mode),windowEnv));
 let touched=0;await assert.rejects(()=>runWF04PgPrediction({args:args('A','full'),windowEnv:{},readonlyProtection(){touched++;},persist(){touched++;}}),/ROOT_WF04/);assert.equal(touched,0);
});
test('logical request constraints force immediate then deferred; failure rolls back only its savepoint',async()=>{
 const log=[],tx={$executeRawUnsafe:async sql=>log.push(sql)};assert.equal(await withWF04LogicalSavepoint(tx,1,async()=>{log.push('native');return 7;},{windowEnv}),7);assert.deepEqual(log,['SAVEPOINT wf04_native_1','native','SET CONSTRAINTS ALL IMMEDIATE','SET CONSTRAINTS ALL DEFERRED','RELEASE SAVEPOINT wf04_native_1']);
 const fault=Error('synthetic');log.length=0;await assert.rejects(()=>withWF04LogicalSavepoint(tx,2,async()=>{throw fault;},{windowEnv}),e=>e===fault);assert.deepEqual(log,['SAVEPOINT wf04_native_2','ROLLBACK TO SAVEPOINT wf04_native_2','SET CONSTRAINTS ALL DEFERRED','RELEASE SAVEPOINT wf04_native_2']);
 log.length=0;await assert.rejects(()=>withWF04LogicalSavepoint(tx,101,async()=>{}, {windowEnv}));assert.equal(log.length,0);
 const deferred=[];await assert.rejects(()=>withWF04LogicalSavepoint({$executeRawUnsafe:async sql=>{deferred.push(sql);if(sql==='SET CONSTRAINTS ALL IMMEDIATE')throw fault;}},3,async()=>{}, {windowEnv}),e=>e===fault);assert(deferred.includes('ROLLBACK TO SAVEPOINT wf04_native_3'));
});
test('strict record/enroll proof binds body CAS/hash and native actor version zero to exact parents',()=>{
 for(const action of ['record','enroll']){const input=body(action),proof=assertWF04NativeProof(action,input,result(action,input),{principal,c,subjectId});assert.equal(proof.authVersion,0);assert.equal(proof.requestHash,bodyHash(input));assert(!JSON.stringify(proof).includes(event.evidence));
  for(const patch of [{proofVersion:undefined},{actorId:'old-WF02-importer'},{authVersion:1},{studyId:'other-study'},{subjectId:'other-subject'},{protocolId:'other-protocol'},{policyVersionId:'other-policy'},{policyHash:'b'.repeat(64)},{requestHash:'b'.repeat(64)},{requestKey:'replacement'},{action:'participation.'+(action==='record'?'enroll':'record')}]){const output=result(action,input);Object.assign(output.receipt,patch);assert.throws(()=>assertWF04NativeProof(action,input,output,{principal,c,subjectId}));}
  const missing=structuredClone(input);delete missing.expectedLastEventId;assert.throws(()=>assertWF04NativeProof(action,missing,result(action,input),{principal,c,subjectId}),/STRICT_CAS/);
  assert.throws(()=>assertWF04NativeProof(action,{...input,expectedLastEventId:'other-last-fact'},result(action,input),{principal,c,subjectId}),/BINDING/);
 }
});
test('record proof requires exact actual event/fact input and enrollment proof rejects empty or foreign enrollment',()=>{
 for(const alter of [x=>x.event.id='other-event',x=>x.event.policyVersionId='other-policy',x=>x.events=[],x=>x.events[0].recordedBy='other-actor',x=>x.events[0].decision='withdrawn',x=>x.events[0].signer='other-signer',x=>x.events[0].textVersion='other-text',x=>x.events[0].effectiveAt='2026-11-16T00:00:00.000Z',x=>x.receipt.eventSequence=2]){const output=result();alter(output);assert.throws(()=>assertWF04NativeProof('record',body(),output,{principal,c,subjectId}));}
 for(const alter of [x=>x.enrollment=null,x=>x.enrollment.subjectId='other-subject',x=>x.enrollment.protocolVersionId='other-protocol',x=>x.enrollment.status='screening',x=>x.enrollment.createdBy='other-actor']){const output=result('enroll');alter(output);assert.throws(()=>assertWF04NativeProof('enroll',body('enroll'),output,{principal,c,subjectId}));}
});
test('failure metadata never emits connection strings, clinical body, message, stack or arbitrary code',()=>{
 const error={name:'Error',status:409,code:'PARTICIPATION_CHANGED',message:'postgres://private:password@host/db synthetic clinical text',stack:'private stack'};assert.deepEqual(redactedWF04PgError(error),{name:'Error',status:409,code:'PARTICIPATION_CHANGED'});assert.deepEqual(redactedWF04PgError({name:'postgres://secret',status:'409',code:'password=secret'}),{name:'Error',status:null,code:null});
});
test('prediction delta preserves old 13 subjects and every prior mutable full hash while counting only additions',()=>{
 const keys=['subjects','events','enrollments','anchors','visits','fulfillments','tasks','operations','audits'],before={fixed:{approved:[{id:'fixed-protocol',hash:'fixed-full-row'}]},mutable:Object.fromEntries(keys.map(k=>[k,Array.from({length:13},(_,i)=>({id:'old-'+k+'-'+i,hash:'old-full-hash-'+i}))]))},after=structuredClone(before);after.mutable.subjects.push({id:'new-subject',hash:'new-row'});after.mutable.events.push({id:'new-event',hash:'new-row'});after.mutable.operations.push({id:'new-op',hash:'new-row'});
 const delta=wf04PredictionDelta(before,after);assert.deepEqual(delta.subjects,['new-subject']);assert.deepEqual(delta.events,['new-event']);assert.deepEqual(delta.enrollments,[]);assert.deepEqual(delta.tasks,[]);
 for(const key of keys)for(const change of ['hash','delete']){const drift=structuredClone(after);if(change==='hash')drift.mutable[key][0].hash='changed-old-row';else drift.mutable[key].shift();assert.throws(()=>wf04PredictionDelta(before,drift),/OLD_PREDICTION/);}
 const fixedDrift=structuredClone(after);fixedDrift.fixed.approved[0].hash='changed';assert.throws(()=>wf04PredictionDelta(before,fixedDrift),/FIXED_DEFINITIONS/);
});
