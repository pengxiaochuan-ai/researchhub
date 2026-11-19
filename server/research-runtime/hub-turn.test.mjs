import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {fenceAssistantTransactions,createHubTurnRuntime,fenceHubQueue} from './hub-turn.mjs';
import {HUB_CONTEXT_KEY,HUB_TOOL_KB_ID,hubCoreQuestion} from '../../scripts/hub-agent-contract.mjs';

test('assistant fence covers elevated/app/tenant callbacks in the original transaction, with no unguarded array path',async()=>{
 const context=new AsyncLocalStorage(),calls=[];
 const tx={message:{create:async args=>{calls.push('write');return args;}}};
 const client={$transaction:async fn=>fn(tx)};
 const db={app:client,elevated:client,withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)};
 const fenced=fenceAssistantTransactions(db,context,async(actual,turn)=>{assert.equal(actual,tx);assert.equal(turn?.allow,true);calls.push('guard');});
 for(const run of [cb=>fenced.app.$transaction(cb),cb=>fenced.elevated.$transaction(cb),cb=>fenced.withTenantTransaction('t','g','p',cb)]){
  await assert.rejects(run(t=>t.message.create({data:{role:'assistant'}})));assert.equal(calls.length,0);
  await context.run({allow:true},()=>run(t=>t.message.create({data:{role:'assistant'}})));
  assert.deepEqual(calls.splice(0),['guard','write']);
 }
 assert.throws(()=>fenced.elevated.$transaction([]),/CONTEXT_REJECTED/);
});

function harness({revoke=false,modelFailure=false}={}){
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},execution={claim:{kind:'knowledge-chat',taskId:'job'}};
 const opts={requestKey:'request-key',existingUserMessageId:'message',execution,kbIds:[],kbAgent:true};
 const source={sourceRecordId:'rhsr-'+'a'.repeat(40),snippetHash:'b'.repeat(64)},calls=[];
 const tx={message:{create:async args=>{calls.push('assistant');return args;}}},prisma={app:{$transaction:fn=>fn(tx)},elevated:{$transaction:fn=>fn(tx)},withTenantTransaction:(_t,_g,_p,fn)=>fn(tx)};
 class NativeSessions{
  constructor(db,_s,orchestrator){this.db=db;this.orchestrator=orchestrator;}
  async assertKnowledgeSession(){return{agentId:'agent',contextKey:HUB_CONTEXT_KEY};}
  async sendMessage(u,sid,text,options){
   calls.push('native-session');
   const result=await this.orchestrator.run({user:u,userMessage:text,history:[],ctx:{...u,sessionId:sid,requestKey:options.requestKey,execution:options.execution,assertExecution:async()=>calls.push('claim'),onProviderUsage:sample=>calls.push(sample?'known-usage':'usage'),abortSignal:new AbortController().signal}},()=>{});
   return this.db.elevated.$transaction(t=>t.message.create({data:{sessionId:sid,role:'assistant',content:result.finalText,meta:{provenance:result.provenance}}}));
  }
 }
 class NativeOrchestrator{
  constructor(_p,provider,_s,_d,tools){this.provider=provider;this.tools=tools;}
  async run({ctx,user,userMessage}){
   assert.equal(ctx.execution,execution);assert.equal(userMessage,hubCoreQuestion);assert.equal(ctx.kbIds[0],HUB_TOOL_KB_ID);
   assert(ctx.abortSignal);assert(ctx.onProviderUsage);assert(ctx.assertExecution);
   await this.tools.execute(user,'kb_search',JSON.stringify({query:userMessage,kbId:HUB_TOOL_KB_ID}));
   try{await this.provider.chat([{role:'system',content:'evidence'},{role:'user',content:'用户问题：'+hubCoreQuestion+'\nsource'}],{},{});}catch(e){if(!modelFailure)throw e;}
   ctx.onProviderUsage();return{finalText:'来源支持此说明[1]',usage:{totalTokens:1},providerOutcome:'known',usedMock:false};
  }
 }
 const runtime=createHubTurnRuntime({prisma,NativeSessions,NativeOrchestrator,agentId:'agent',tools:{toolDefs:()=>[{function:{name:'kb_search'}}]},
  provider:{chat:async messages=>{assert.match(messages[1].content,/实际问题/);calls.push('provider');if(modelFailure){const e=Error('REAL_PROVIDER_FAILED');if(modelFailure==='known')e.knownUsage={model:'deepseek-v4-pro',promptTokens:100,completionTokens:20,totalTokens:120};throw e;}return{usedMock:false};}},
  modelExecution:modelFailure?(_proof,fn)=>fn():undefined,
  knownUsageSample:u=>({...u,cost:0.001}),
  authorize:async(_u,db)=>{if(db)calls.push('tx-authorization');},
  retrieve:async()=>({mutated:false,result:'[1] 已审核证据',meta:{toolName:'hub_source_search',sources:[source]}}),
  revalidate:async(_u,_s,db)=>{if(db){assert.equal(db,tx);calls.push('tx-source');if(revoke)throw Error('SOURCE_REVOKED');}},
 });
 return{runtime,user,opts,calls};
}
test('Hub turn invokes native session/orchestrator and preserves execution/usage with same-tx source revalidation',async()=>{
 const {runtime,user,opts,calls}=harness();await runtime.sessions.sendMessage(user,'session','实际问题',opts);
 assert(calls.includes('native-session'));assert(calls.includes('provider'));assert(calls.includes('usage'));
 assert.deepEqual(calls.slice(-3),['tx-authorization','tx-source','assistant']);
});
test('source revoked after provider prevents assistant delivery in native publication transaction',async()=>{
 const {runtime,user,opts,calls}=harness({revoke:true});await assert.rejects(runtime.sessions.sendMessage(user,'session','实际问题',opts),/SOURCE_REVOKED/);
 assert(calls.includes('provider'));assert(!calls.includes('assistant'));
});
test('native deterministic fallback cannot disguise a failed paid model execution',async()=>{const {runtime,user,opts,calls}=harness({modelFailure:true});await assert.rejects(runtime.sessions.sendMessage(user,'session','实际问题',opts),/REAL_PROVIDER_FAILED/);assert(!calls.includes('assistant'));});
test('known usage survives a settlement failure and reaches native reconciliation exactly once',async()=>{const{runtime,user,opts,calls}=harness({modelFailure:'known'});await assert.rejects(runtime.sessions.sendMessage(user,'session','实际问题',opts),/REAL_PROVIDER_FAILED/);assert.equal(calls.filter(x=>x==='known-usage').length,1);assert(!calls.includes('assistant'));});
test('bare send/virtual KB passed into worker options cannot bypass the native claim path',async()=>{
 const {runtime,user,opts,calls}=harness();await assert.rejects(runtime.sessions.sendMessage(user,'session','实际问题',{...opts,execution:undefined}),/CONTEXT_REJECTED/);
 await assert.rejects(runtime.sessions.sendMessage(user,'session','实际问题',{...opts,kbIds:[HUB_TOOL_KB_ID]}),/CONTEXT_REJECTED/);assert.deepEqual(calls,[]);
});
test('current Hub admission is rechecked under the native enqueue transaction before any queue writes',async()=>{
 let active=true,writes=0;const tx={};
 const prisma={app:{$transaction:fn=>fn(tx)}};
 const fence=fenceHubQueue(prisma,async(actual,user,sid)=>{assert.equal(actual,tx);assert.equal(user.accountId,'owner');assert.equal(sid,'session');if(!active)throw Error('ADMISSION_REVOKED');});
 const queue=fence.bind({enqueue:()=>fence.prisma.app.$transaction(async()=>{writes++;return{id:'job'};})});
 active=false;await assert.rejects(queue.enqueue({accountId:'owner'},'session',{}),/ADMISSION_REVOKED/);assert.equal(writes,0);
 active=true;assert.deepEqual(await queue.enqueue({accountId:'owner'},'session',{}),{id:'job'});assert.equal(writes,1);
});
test('Hub admin tool intersection remains inside native worker publication and ordinary members keep native checks',async()=>{
 const user={tenantId:'t',accountId:'admin',studyGroupId:'g',researchProjectId:'p',role:'tenant_admin'},tx={};let checked=false;
 class NativeSessions{
  constructor(){}
  effectiveToolsForMember(){throw Error('NATIVE_MEMBER_PATH');}
  async withMessageExecution(u,sid,options,fn,requirements){assert.equal(u,user);assert.equal(sid,'session');assert.equal(options.execution.claim.kind,'knowledge-chat');assert.deepEqual(requirements,{toolKeys:['knowledge.search']});checked=true;return fn(tx,u);}
 }
 const{sessions,context}=createHubTurnRuntime({prisma:{},NativeSessions,NativeOrchestrator:class{},agentId:'agent',authorize:async(actor,actual)=>{assert.equal(actor,user);assert.equal(actual,tx);},adminToolKeys:(_kind,configured)=>configured.filter(k=>k==='knowledge.search')});
 await assert.rejects(sessions.effectiveToolsForMember({}, {...user,role:'researcher'},'research',['knowledge.search']),/NATIVE_MEMBER_PATH/);
 await context.run({user,sessionId:'session',options:{execution:{claim:{kind:'knowledge-chat'}}}},async()=>{assert.deepEqual(await sessions.effectiveToolsForMember({},user,'research',['knowledge.search','knowledge.write']),['knowledge.search']);});assert(checked);
});
