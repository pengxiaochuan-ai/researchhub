import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnrollmentService} from './enrollment.mjs';
import {requestHash} from '../research-studies/contract.mjs';

const hash='a'.repeat(64);
function fixture(){
 const user={tenantId:'t',accountId:'u',authVersion:0,role:'tenant_admin',isTenantAdmin:true};
 const fresh={...user,role:'researcher',isTenantAdmin:false};
 const ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p'};
 let context={actor:fresh,subject:{id:'s',subjectId:'S'},enrollment:null,protocol:{id:'pr',status:'executing',versionNumber:1},policy:{id:'po',contentHash:hash,sections:{}},events:[]},saved,authorized=true,executing=true,records=0,enrolls=0,audits=[];
 const calls=[];
 const tx={$queryRaw:async()=>[],subject:{findFirst:async()=>({id:'s'})},auditLog:{createMany:async({data})=>{audits.push(data);return {count:1};}}};
 const studies={withResearchStudyTransaction:async(_user,_study,_operation,fn)=>fn(tx,ctx)};
 const core={authorize:async()=>{if(!authorized)throw Object.assign(Error('revoked'),{status:403});return fresh;},context:async()=>{if(!authorized)throw Object.assign(Error('revoked'),{status:403});if(!executing)throw Error('NO_EXECUTING_PROTOCOL');return context;},evaluate:()=>[],record:async(_tx,actor,_scope,_subject,event)=>{records++;calls.push(actor);const value={id:'event-'+records,sequence:context.events.length+1,protocolVersionId:'pr',policyVersionId:'po',policyHash:hash,recordedBy:actor.accountId,...event};context={...context,events:[...context.events,value]};return value;},enroll:async actor=>{enrolls++;calls.push(actor);context={...context,enrollment:{id:'en',status:'enrolled',subjectId:'s',protocolVersionId:'pr'}};}};
 const receipts={getReceipt:async(_tx,actor)=>{calls.push(actor);return saved;},saveReceipt:async(_tx,actor,data)=>{calls.push(actor);saved={id:data.id,request_hash:data.hash,action:data.action,target_id:data.target,result:data.result};}};
 const service=createEnrollmentService({studies,core,receipts});
 const body={requestKey:'original_request',expectedPolicyVersionId:'po',expectedPolicyHash:hash,expectedLastEventId:null,event:{kind:'screening',decision:'passed',method:'manual',effectiveAt:'2026-11-17T00:00:00.000Z',evidence:'synthetic screening'}};
 return {user,fresh,body,service,calls,read:input=>service.receipt(user,'study','s',body.requestKey,input),record:input=>service.record(user,'study','s',input??body),enroll:input=>service.enroll(user,'study','s',input??{requestKey:'enroll_original',expectedPolicyVersionId:'po',expectedPolicyHash:hash,expectedLastEventId:null}),get context(){return context;},set context(value){context=value;},get saved(){return saved;},set saved(value){saved=value;},get records(){return records;},get enrolls(){return enrolls;},get audits(){return audits;},set authorized(value){authorized=value;},set executing(value){executing=value;}};
}

test('record uses scoped last-event CAS after locks and before any native write',async()=>{
 const f=fixture();f.context={...f.context,events:[{id:'other-screening',kind:'screening',decision:'failed',sequence:1}]};
 await assert.rejects(f.record(),e=>e.status===409&&e.code==='PARTICIPATION_CHANGED');assert.equal(f.records,0);assert.equal(f.audits.length,0);
 const result=await f.record({...f.body,expectedLastEventId:'other-screening'});assert.equal(result.event.id,'event-1');
});
test('enroll CAS also rejects a fact appended after the ready view',async()=>{
 const f=fixture();f.context={...f.context,events:[{id:'other-withdrawal',kind:'research_consent',decision:'withdrawn',sequence:4}]};
 await assert.rejects(f.enroll(),e=>e.code==='PARTICIPATION_CHANGED');assert.equal(f.enrolls,0);
 const result=await f.enroll({requestKey:'enroll_original',expectedPolicyVersionId:'po',expectedPolicyHash:hash,expectedLastEventId:'other-withdrawal'});assert.equal(result.enrollment.status,'enrolled');
});
test('saved original success precedes last-event and policy CAS but changed body conflicts',async()=>{
 const f=fixture(),result=await f.record();f.context={...f.context,policy:{...f.context.policy,id:'later-policy'},events:[...f.context.events,{id:'later-event',sequence:2}]};
 assert.deepEqual(await f.record(),result);assert.equal(f.records,1);
 await assert.rejects(f.record({...f.body,expectedLastEventId:'later-event'}),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');
});
test('legacy body without last-event retains native single-action compatibility',async()=>{
 const f=fixture(),{expectedLastEventId,...body}=f.body;f.context={...f.context,events:[{id:'old',sequence:1}]};assert.equal((await f.record(body)).event.id,'event-1');
});
test('last-event accepts only explicit null or a valid nonempty bounded opaque ID',async()=>{
 for(const value of ['',undefined,1,false,{},[], 'bad/id','x'.repeat(161)]){const f=fixture();await assert.rejects(async()=>f.record({...f.body,expectedLastEventId:value}),e=>e.code==='RESEARCH_INPUT_INVALID');assert.equal(f.records,0);}
});
test('new proof and audit use native DB actor, including legal authVersion zero',async()=>{
 const f=fixture(),result=await f.record(),p=result.receipt;
 assert.deepEqual(p,{proofVersion:1,id:f.saved.id,requestKey:f.body.requestKey,requestHash:requestHash(f.body),actorId:'u',authVersion:0,studyId:'study',subjectId:'s',protocolId:'pr',policyVersionId:'po',policyHash:hash,action:'participation.record',targetId:'s',eventId:'event-1',eventSequence:1,eventKind:'screening'});
 assert.ok(f.calls.every(actor=>actor.role==='researcher'&&actor.authVersion===0&&actor.isTenantAdmin===false));assert.equal(f.audits[0].meta.requestHash,requestHash(f.body));assert.equal(f.audits[0].meta.authVersion,0);
});
test('enrollment receives the same strict proof with the original fixed policy',async()=>{
 const f=fixture(),result=await f.enroll();assert.equal(result.receipt.proofVersion,1);assert.equal(result.receipt.action,'participation.enroll');assert.equal(result.receipt.protocolId,'pr');assert.equal(result.receipt.policyVersionId,'po');assert.equal(result.receipt.authVersion,0);
});
test('native actor mismatch never mints or reads a strict proof',async()=>{
 for(const actor of [{accountId:'other'},{authVersion:1},{tenantId:'other'}]){const f=fixture();Object.assign(f.fresh,actor);await assert.rejects(f.record(),e=>e.status===401);assert.equal(f.records,0);await assert.rejects(f.read({action:'record',requestHash:requestHash(f.body)}),e=>e.status===401);}
});
test('strict historical receipt reads original proof without requiring an executing protocol',async()=>{
 const f=fixture(),result=await f.record();f.executing=false;assert.deepEqual(await f.read({action:'record',requestHash:requestHash(f.body)}),result);
});
test('strict receipt rejects changed hash, action and every incomplete binding',async()=>{
 const f=fixture();await f.record();const original=structuredClone(f.saved),query={action:'record',requestHash:requestHash(f.body)};
 await assert.rejects(f.read({...query,requestHash:'b'.repeat(64)}),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');await assert.rejects(f.read({...query,action:'enroll'}),e=>e.status===404);
 for(const [key,value]of Object.entries({proofVersion:undefined,id:'other',requestHash:'b'.repeat(64),actorId:'other',authVersion:1,studyId:'other',subjectId:'other',protocolId:'other',policyVersionId:'other',policyHash:'b'.repeat(64),action:'participation.enroll',targetId:'other',requestKey:'different_key'})){
  f.saved=structuredClone(original);f.saved.result.receipt[key]=value;await assert.rejects(f.read(query),e=>[404,409].includes(e.status),key);
 }
});
test('strict receipt checks snapshot protocol and policy, and never upgrades legacy proof',async()=>{
 const f=fixture(),result=await f.record(),original=structuredClone(f.saved),query={action:'record',requestHash:requestHash(f.body)};
 for(const changes of [{protocol:{...result.protocol,id:'other'}},{policy:{...result.policy,id:'other'}},{policy:{...result.policy,contentHash:'b'.repeat(64)}},{subject:{...result.subject,id:'other'}}]){f.saved=structuredClone(original);Object.assign(f.saved.result,changes);await assert.rejects(f.read(query),e=>e.code==='RESEARCH_RECEIPT_UNCONFIRMED');}
 f.saved=structuredClone(original);f.saved.result.receipt={id:original.id,requestKey:f.body.requestKey,action:'participation.record',targetId:'s'};assert.deepEqual(await f.read(),f.saved.result);await assert.rejects(f.read(query),e=>e.code==='RESEARCH_RECEIPT_UNCONFIRMED');assert.equal(f.saved.result.receipt.proofVersion,undefined);
});
test('strict proof checks the exact native event and enrollment fact, not just its envelope',async()=>{
 const f=fixture();await f.record();const original=structuredClone(f.saved),query={action:'record',requestHash:requestHash(f.body)};
 for(const edit of [value=>value.receipt.eventId='other',value=>value.receipt.eventSequence=9,value=>value.receipt.eventKind='research_consent',value=>value.event.protocolVersionId='other',value=>value.event.policyVersionId='other',value=>value.event.policyHash='b'.repeat(64),value=>value.events[0].recordedBy='other',value=>value.events[0].kind='data_use_consent',value=>value.events.push({...value.events[0]})]){f.saved=structuredClone(original);edit(f.saved.result);await assert.rejects(f.read(query),e=>e.code==='RESEARCH_RECEIPT_UNCONFIRMED');}
 const e=fixture();await e.enroll();const enrolled=structuredClone(e.saved),enrollQuery={action:'enroll',requestHash:e.saved.request_hash};
 for(const change of [null,...['withdrawn','grouped','in_progress'].map(status=>({id:'en',status,subjectId:'s',protocolVersionId:'pr'})),{id:'en',status:'enrolled',subjectId:'other',protocolVersionId:'pr'},{id:'en',status:'enrolled',subjectId:'s',protocolVersionId:'other'}]){e.saved=structuredClone(enrolled);e.saved.result.enrollment=change;await assert.rejects(e.service.receipt(e.user,'study','s','enroll_original',enrollQuery),x=>x.code==='RESEARCH_RECEIPT_UNCONFIRMED');}
});
test('strict receipt validates query before authorization and preserves missing or revoked as unresolved',async()=>{
 const f=fixture();for(const input of [{requestHash:'bad',action:'record'},{requestHash:hash},{action:'unknown'},{action:'record',requestHash:hash,extra:true}])await assert.rejects(async()=>f.read(input),e=>e.code==='RESEARCH_INPUT_INVALID');
 await assert.rejects(f.read({action:'record',requestHash:hash}),e=>e.status===404);f.authorized=false;await assert.rejects(f.read({action:'record',requestHash:hash}),e=>e.status===403);
});
test('saved new proof cannot be replayed by a later authVersion or inconsistent envelope',async()=>{
 const f=fixture();await f.record();f.user.authVersion=1;f.fresh.authVersion=1;await assert.rejects(f.record(),e=>e.code==='RESEARCH_RECEIPT_UNCONFIRMED');assert.equal(f.records,1);
});
