import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createFullStudySourcePairReader} from './full-study-source-pair.mjs';

function fixture(mode){
 const deps=runtimeDependencies(),scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},user={accountId:'actor',tenantId:'tenant',authVersion:1},binding={subjectId:'subject',enrollmentId:'enrollment',subjectVisitId:'visit',formVersionId:'form'};
 const row={id:'revision',hashVersion:'formal-response-v1',...scope,responseId:'response',assignmentId:'assignment',formVersionId:'form',subjectId:'subject',enrollmentId:'enrollment',subjectVisitId:'visit',protocolVersionId:'protocol',policyVersionId:'policy',policyHash:'2'.repeat(64),revisionNo:2,previousRevisionId:'previous',answers:{q1:0,optional:null},score:{complete:true,total:0},scoreAlgorithm:'numeric-sum-v1',source:'researcher',actorKind:'account',actorId:'actor',reason:'synthetic',changes:null,sourceSubmittedAt:null,createdAt:new Date('2026-11-13T00:00:00Z')};
 const hash=deps.load('study-operations/formal-response-policy','formalResponseHash');
 const {id,...envelope}=row;row.contentHash=hash({...envelope,createdAt:row.createdAt.toISOString()});
 const ref={responseId:row.responseId,assignmentId:row.assignmentId,revisionNo:row.revisionNo,contentHash:row.contentHash};
 const current={assignment:{id:'assignment',...binding,formVersion:{id:'form'}},response:{id:'response',status:'submitted',version:2,ref,locked:true,review:'review_approved',legacyUnversioned:false}};
 const state={reads:0,policies:0,revisions:0,denied:false,badPolicy:false,tamper:false,attemptWrite:false,mode,captured:null,late:null},tx={studyEnrollment:{findFirst:async()=>({protocolVersionId:'protocol'})},formResponse:{update:async()=>{throw Error('write reached database');}},$executeRaw:async()=>1,$queryRaw:async strings=>{const sql=strings.join('');if(sql.includes('FROM public.form_response_revision')){state.revisions++;const copy=structuredClone(row);if(state.tamper)copy.answers.q1=1;return[copy];}if(sql.includes('FROM public.study_execution_policy_version')){state.policies++;return state.badPolicy?[]:[{id:'policy'}];}throw Error('unexpected SQL');}};
 const read=async(readTx,readUser,readScope,assignmentId)=>{state.reads++;if(state.denied)throw Object.assign(Error('revoked'),{status:403});assert.equal(readUser.accountId,'actor');assert.deepEqual(readScope,scope);assert.equal(assignmentId,'assignment');if(state.attemptWrite)await readTx.formResponse.update({});return structuredClone(current);};
 const compiler=deps.require.extensions['.ts'],requireWithCompiler=Object.assign(spec=>deps.require(spec),{extensions:{...deps.require.extensions,'.ts':(mod,file)=>{compiler(mod,file);const original=mod.exports.readFormalResponseRevisionInTransaction;mod.exports.readFormalResponseRevisionInTransaction=async(t,u,s,a,r)=>{const query=mod.require('./formal-response-query');state.captured=query.readFormalResponseInTransaction;if(state.mode==='actor')u={...u,accountId:'other'};if(state.mode==='authVersion')u={...u,authVersion:2};if(state.mode==='scope')s={...s,studyGroupId:'other'};if(state.mode==='tx')t={...t};if(state.mode==='assignment')await query.readFormalResponseInTransaction(t,u,s,'other');if(state.mode==='ref')r.contentHash='3'.repeat(64);if(state.mode==='double')await query.readFormalResponseInTransaction(t,u,s,a);const value=await original(t,u,s,a,r);if(state.mode==='late'){const resume=AsyncLocalStorage.snapshot();state.late=()=>resume(()=>query.readFormalResponseInTransaction(t,u,s,a));}return value;};}}});
 const load=(path,name)=>path==='study-operations/formal-response-query'&&name==='readFormalResponseInTransaction'?read:deps.load(path,name);
 const reader=createFullStudySourcePairReader({require:requireWithCompiler,load});
 return{reader,tx,user,scope,binding,state,current,row,deps};
}

test('one guarded current read feeds native immutable revision/policy/envelope checks without global patch',async()=>{
 const f=fixture(),original=f.deps.load('study-operations/formal-response-history','readFormalResponseRevisionInTransaction');
 const result=await f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding);
 assert.equal(f.state.reads,1);assert.equal(f.state.revisions,1);assert.equal(f.state.policies,1);assert.deepEqual(result.current.response.ref,result.fixed.ref);assert.equal(result.fixed.score.total,0);assert.equal(result.fixed.answers.optional,null);
 result.current.response.ref.contentHash='bad';assert.equal(f.current.response.ref.contentHash,f.row.contentHash);
 assert.equal(f.deps.load('study-operations/formal-response-history','readFormalResponseRevisionInTransaction'),original);
});
test('noneligible or mismatched current binding preserves current and skips fixed source work',async()=>{
 for(const field of ['locked','ref','status','review']){const f=fixture();f.current.response[field]=field==='locked'?false:field==='ref'?null:'other';const result=await f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding);assert.equal(result.fixed,null);assert.equal(f.state.revisions,0);}
 const f=fixture();const result=await f.reader.readPair(f.tx,f.user,f.scope,'assignment',{...f.binding,subjectId:'other'});assert.equal(result.fixed,null);assert.equal(f.state.revisions,0);
});
test('native policy and immutable envelope failures remain fatal',async()=>{
 for(const kind of ['badPolicy','tamper']){const f=fixture();f.state[kind]=true;await assert.rejects(f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding),e=>e.getResponse?.().code==='FORM_REVISION_INTEGRITY_INVALID');assert.equal(f.state.reads,1);}
});
test('current authorization failure happens before witness and source work',async()=>{
 const f=fixture();f.state.denied=true;await assert.rejects(f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding),e=>e.status===403);assert.equal(f.state.revisions,0);f.state.denied=false;assert((await f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding)).fixed);assert.equal(f.state.reads,2);
});
test('physical tx, actor, auth version, scope, assignment, ref and second consume cannot reuse witness',async()=>{
 for(const mode of ['tx','actor','authVersion','scope','assignment','ref','double']){const f=fixture(mode);await assert.rejects(f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding),e=>e.code==='FULL_STUDY_PAIR_CONTEXT_CHANGED',mode);}
});
test('pair forbids its own source writes and invalidates late async witness access',async()=>{
 const f=fixture();f.state.attemptWrite=true;await assert.rejects(f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding),e=>e.code==='FULL_STUDY_PAIR_WRITE_REJECTED');
 const g=fixture('late');await g.reader.readPair(g.tx,g.user,g.scope,'assignment',g.binding);await g.state.late();assert.equal(g.state.reads,2);
});
test('parallel pairs and repeated calls have no shared source result or witness',async()=>{
 const f=fixture();const results=await Promise.all([f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding),f.reader.readPair(f.tx,f.user,f.scope,'assignment',f.binding)]);assert.equal(f.state.reads,2);assert.equal(f.state.revisions,2);assert.notEqual(results[0].current,results[1].current);assert.notEqual(results[0].fixed,results[1].fixed);
});
