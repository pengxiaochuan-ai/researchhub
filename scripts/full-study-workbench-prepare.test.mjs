import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareFullStudyWorkbench} from './full-study-workbench-prepare.mjs';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const exceptions=require('@nestjs/common');
const {descriptiveReference}=require('./src/research-methods/descriptive-analysis-policy.ts');
const {canonicalManifestHash}=require('./src/research-methods/data-quality-release-policy.ts');
const {FormalDescriptiveRuns}=require('./src/research-methods/formal-descriptive-runs.ts');
const options={descriptiveReference,canonicalManifestHash,exceptions};
const user={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'actor',authVersion:1};
const dto={skillKey:'descriptive-statistics',idempotencyKey:'original-key',input:{studyId:'study',snapshotId:'snapshot'}};
function fixture(change={}){
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},session={id:'session',...scope,accountId:'actor',agentId:'agent',channel:'workbench',contextKey:'descriptive-statistics',deletedAt:null};
 const state={calls:[],inTransaction:false,sourceReads:0,creates:0,existing:null,session:null,fresh:session,agents:[{id:'agent'}],...change};
 const tx={researchMethodRun:{findUnique:async args=>{state.calls.push(['existing',args]);return state.existing;}},agent:{findMany:async args=>{state.calls.push(['agents',args]);return state.agents;}},session:{findFirst:async args=>{state.calls.push(['session',args]);return state.session;},findUnique:async args=>{state.calls.push(['fresh',args]);return state.fresh;},create:async args=>{state.calls.push(['createSession',args]);state.creates++;return{id:'new-session',...args.data};}},$queryRaw:async(strings,...args)=>{state.calls.push(['lock',strings.join(''),args]);return[];}};
 const native={resolver(){return{};},transaction:async(_u,fn)=>{assert.equal(state.inTransaction,false);state.inTransaction=true;try{return await fn(tx);}finally{state.inTransaction=false;}},scope:()=>scope,accountAuthority:async()=>{state.calls.push(['account']);if(state.accountError)throw state.accountError;return{...user,role:'tenant_admin',isTenantAdmin:true};},workerFeature:async()=>{state.calls.push(['feature']);if(state.featureError)throw state.featureError;},agentAuthority:async(_tx,_u,id,version)=>{state.calls.push(['grant',id,version]);if(state.agentErrors?.[id])throw state.agentErrors[id];},authority:async(_tx,_u,row,version)=>{state.calls.push(['authority',row,version]);if(state.authorityError)throw state.authorityError;},current:async()=>{state.sourceReads++;return{basis:{manifestHash:'a'.repeat(64)},manifest:{statisticalUnit:'subject',variables:[{key:'x',valueType:'number'}],rows:[{subjectId:'subject',cells:[{key:'x',missing:null,value:0}]}],rowCount:1,subjectCount:1}};}};
 return{native,state,tx,session};
}
const classify=e=>({name:e.constructor.name,status:e.getStatus?.(),code:e.getResponse?.()?.code??e.code});
async function compare(change,body=dto){
 const a=fixture(change),b=fixture(change);let original,fast,originalError,fastError;
 try{original=await FormalDescriptiveRuns.prototype.prepareWorkbench.call(a.native,user,body);}catch(e){originalError=e;}
 try{fast=await prepareFullStudyWorkbench(b.native,user,body,options);}catch(e){fastError=e;}
 if(originalError){assert(fastError);assert.deepEqual(classify(fastError),classify(originalError));}else{assert.ifError(fastError);assert.deepEqual(fast,original);}
 assert.deepEqual(b.state.calls,a.state.calls);assert.equal(b.state.sourceReads,0);return{a,b,fastError};
}
test('native-equivalent fresh session creation and locked reuse omit only prepare source projection',async()=>{
 const created=await compare({});assert.equal(created.a.state.sourceReads,1);assert.equal(created.b.state.creates,1);
 const f=fixture(),reused=await compare({session:f.session});assert.equal(reused.a.state.sourceReads,1);assert.equal(reused.b.state.creates,0);assert(reused.b.state.calls.some(x=>x[0]==='lock'));
});
test('native account revocation, feature-off and agent/skill errors preserve original rejection and selection semantics',async()=>{
 const denied=new exceptions.ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED'});
 await compare({accountError:denied});await compare({featureError:denied});await compare({agentErrors:{agent:denied}});
 await compare({agents:[]});await compare({agentErrors:{agent:new exceptions.NotFoundException({code:'SKILL_NOT_ASSIGNED'})}});
 const failure=new exceptions.ServiceUnavailableException({code:'SKILL_RUNTIME_UNAVAILABLE'});await compare({agentErrors:{agent:failure}});
 const next=await compare({agents:[{id:'denied'},{id:'agent'}],agentErrors:{denied}});assert.equal(next.b.state.creates,1);
});
test('native reference validation and request key validation happen before any transaction mutation',async()=>{
 for(const body of [{...dto,idempotencyKey:'bad'}, {...dto,input:{studyId:'study'}},{...dto,input:{...dto.input,extra:true}},{...dto,input:{studyId:'../study',snapshotId:'snapshot'}}]){
  const f=await compare({},body);assert(f.fastError);assert.equal(f.b.state.calls.length,0);assert.equal(f.b.state.creates,0);
 }
});
test('existing idempotency binding checks owner, skill, group, project and exact ref before native authority',async()=>{
 const existing={...user,skillKey:'descriptive-statistics',inputSummary:dto.input,agentId:'agent',sessionId:'session',skillVersion:4};
 for(const change of [{accountId:'other'},{skillKey:'other'},{studyGroupId:'other'},{researchProjectId:'other'},{inputSummary:{...dto.input,snapshotId:'different'}},{inputSummary:{...dto.input,extra:true}}])await compare({existing:{...existing,...change}});
 const good=await compare({existing});assert.equal(good.a.state.sourceReads,1);assert.equal(good.b.state.creates,0);assert(good.b.state.calls.some(x=>x[0]==='authority'&&x[2]===4));
 await compare({existing,authorityError:new exceptions.ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED'})});
 await compare({existing,agentErrors:{agent:new exceptions.ConflictException({code:'METHOD_RUN_CHANGED'})}});
});
test('a reused session is locked and reread; changed ownership, scope, deletion or purpose cannot pass',async()=>{
 const f=fixture();for(const change of [{deletedAt:new Date()},{tenantId:'other'},{studyGroupId:'other'},{researchProjectId:'other'},{accountId:'other'},{agentId:'other'},{channel:'other'},{contextKey:'other'}])await compare({session:f.session,fresh:{...f.session,...change}});
 await compare({session:f.session,fresh:null});
});
test('v2 facade calls original create after prepare closes, preserves its source failure, and leaves other skills on original path',async()=>{
 const f=fixture(),sourceError=Object.assign(Error('source changed'),{code:'ANALYSIS_BASIS_STALE'});let called;
 const methods={descriptiveRuns:()=>f.native,create:async(u,body)=>{assert.equal(f.state.inTransaction,false);assert.equal(u,user);called=body;throw sourceError;},createFromWorkbench:async()=>({original:true})};
 const facade=createFullStudyMethodsFacade(methods,options);
 await assert.rejects(facade.createFromWorkbench(user,dto),e=>e===sourceError);
 assert.deepEqual(called,{skillKey:dto.skillKey,sessionId:'new-session',agentId:'agent',idempotencyKey:dto.idempotencyKey,input:dto.input});assert.equal(f.state.sourceReads,0);
 assert.deepEqual(await facade.createFromWorkbench(user,{skillKey:'other'}),{original:true});assert.deepEqual(await methods.createFromWorkbench(user,dto),{original:true});
});
test('composition supplies original helpers and native create, dispatch and publish retain independent live source checks',()=>{
 const composition=readFileSync(new URL('./local-full-study-simulation.mjs',import.meta.url),'utf8');assert.match(composition,/descriptiveReference:load\('research-methods\/descriptive-analysis-policy','descriptiveReference'\)/);
 const source=readFileSync(new URL('../../app/server/src/research-methods/formal-descriptive-runs.ts',import.meta.url),'utf8');assert.match(source,/current=await this\.current\(tx,auth.user,ref,'snapshot'\)/);assert.match(source,/await this\.live\(tx,user,snapshot,'dispatch'\)/);assert.match(source,/await this\.live\(tx,user,dispatch.run,'publish'\)/);
});
test('configured optimized prepare preserves native active-reservation rejection before any Session or source work',async()=>{
 const f=fixture(),error=new exceptions.ConflictException({code:'ANALYSIS_JOB_RESERVED'});f.native.deps={jobAdapter:{}};f.native.legacyBefore=async()=>{f.state.calls.push(['job-first']);throw error;};
 await assert.rejects(prepareFullStudyWorkbench(f.native,user,dto,options),e=>e===error);
 assert.equal(f.state.creates,0);assert.equal(f.state.sourceReads,0);assert.deepEqual(f.state.calls.map(c=>c[0]),['existing','job-first']);
});
test('configured optimized exact existing lookup remains read-only and does not create a new Session',async()=>{
 const f=fixture({existing:{...user,skillKey:'descriptive-statistics',inputSummary:dto.input,agentId:'agent',sessionId:'session',skillVersion:1}});f.native.deps={jobAdapter:{}};f.native.legacyBefore=async()=>{throw Error('must not grant a new operation from an existing lookup');};
 assert.deepEqual(await prepareFullStudyWorkbench(f.native,user,dto,options),{sessionId:'session',agentId:'agent'});assert.equal(f.state.creates,0);
});
