import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeTurnRuntime,bindKnowledgeSynthesisQuestion} from './knowledge-turn.mjs';
import {hubCoreQuestion} from '../../scripts/hub-agent-contract.mjs';

function harness({revoke=false,noEvidence=false,failModel=false,wrongCitation=false,missingLedger=false,numericBlocked=false}={}){
 const calls=[],user={tenantId:'t',accountId:'owner',studyGroupId:'g',researchProjectId:'p',authVersion:0};
 const execution={claim:{kind:'knowledge-chat',taskId:'job'}},options={kbIds:['kb1'],requestKey:'original-key',existingUserMessageId:'message',execution,kbAgent:true};
 const sources=[{docId:'doc1',kbId:'kb1',chunkId:'chunk1',version:1}],tx={message:{create:async args=>{calls.push('assistant');return args.data;}}};
 const prisma={app:{$transaction:fn=>fn(tx)},elevated:{$transaction:fn=>fn(tx)},withTenantTransaction:(_t,_g,_p,fn)=>fn(tx)};
 class Sessions{
  constructor(db,_storage,orchestrator){this.db=db;this.orchestrator=orchestrator;}
  async assertKnowledgeSession(){return{agentId:'agent',tenantId:'t',accountId:'owner',studyGroupId:'g',researchProjectId:'p',channel:'knowledge',contextKey:'kb:kb1'};}
  async sendMessage(actor,id,text,opts){
   calls.push('native-session');const result=await this.orchestrator.run({user:actor,userMessage:text,ctx:{...actor,sessionId:id,requestKey:opts.requestKey,execution:opts.execution,assertExecution:async()=>calls.push('claim'),onProviderUsage:()=>calls.push('usage')}},()=>{});
   return this.db.elevated.$transaction(t=>t.message.create({data:{sessionId:id,role:'assistant',content:result.finalText,meta:{provenance:result.provenance}}}));
  }
 }
 class Orchestrator{
  constructor(_pool,provider,_skill,_data,tools){this.provider=provider;this.tools=tools;}
  async run({user,userMessage,ctx}){
   assert.equal(userMessage,hubCoreQuestion);assert.deepEqual(ctx.kbIds,['kb1']);assert.equal(ctx.execution,execution);
   await this.tools.execute(user,'kb_search',JSON.stringify({kbId:'kb1',query:hubCoreQuestion}));
   try{await this.provider.chat([{role:'system',content:'仅依据工具结果'},{role:'user',content:'用户问题：'+hubCoreQuestion+'\n[1] 合成依据'}],{},{});}catch(error){if(!failModel)throw error;}
   return{finalText:wrongCitation?'说明[2]':'说明[1]',providerOutcome:'known',usedMock:false,usage:{totalTokens:1},...(numericBlocked?{provenance:{numericBoundaryBlocked:true,rejectedNumericTokens:['never-persist']}}:{})};
  }
 }
 const evidence={authorize:async(_u,kb,actual)=>{assert.equal(kb,'kb1');if(actual)assert.equal(actual,tx);calls.push(actual?'tx-auth':'auth');},prepare:async(_u,kb,text)=>{calls.push('retrieve');assert.equal(kb,'kb1');assert.equal(text,'请列出资料局限');if(noEvidence)throw Error('QA_NO_EVIDENCE');return{sources,tool:{mutated:false,result:'[1] 合成依据'}};},validate:async(_u,kb,actualSources,actual)=>{assert.equal(kb,'kb1');assert.deepEqual(actualSources,sources);if(actual){assert.equal(actual,tx);calls.push('tx-source');if(revoke)throw Error('SOURCE_REVOKED');}}};
 const runtime=createKnowledgeTurnRuntime({prisma,NativeSessions:Sessions,NativeOrchestrator:Orchestrator,agentId:'agent',evidence,tools:{toolDefs:()=>[{function:{name:'kb_search'}}]},provider:{chat:async messages=>{calls.push('provider');assert.match(messages[1].content,/请列出资料局限/);assert.match(messages[0].content,/建议只能复述/);assert.match(messages[0].content,/不能为自行添加/);assert.match(messages[0].content,/本次检索材料/);if(failModel)throw Error('PROVIDER_FAILED');return{usedMock:false};}},modelExecution:missingLedger?undefined:(_proof,fn)=>fn()});
 return{runtime,user,options,calls};
}
test('KB readonly turn reuses native orchestration and commits canonical sources under the actual transaction',async()=>{
 const h=harness(),result=await h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',h.options);
 assert.equal(h.calls.filter(c=>c==='retrieve').length,1);assert.equal(h.calls.filter(c=>c==='provider').length,1);
 assert.deepEqual(h.calls.slice(-3),['tx-auth','tx-source','assistant']);assert.equal(result.meta.provenance.knowledgeSources[0].docId,'doc1');assert.equal(result.meta.provenance.hubSources,undefined);
});
test('no reviewed evidence produces no provider call or assistant result',async()=>{
 const h=harness({noEvidence:true});await assert.rejects(h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',h.options),/QA_NO_EVIDENCE/);assert(!h.calls.includes('provider'));assert(!h.calls.includes('assistant'));
});
test('revocation in the native publication transaction rejects already generated output',async()=>{
 const h=harness({revoke:true});await assert.rejects(h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',h.options),/SOURCE_REVOKED/);assert(h.calls.includes('provider'));assert(!h.calls.includes('assistant'));
});
test('native fallback cannot mask provider failure and invalid citations are never published',async()=>{
 for(const flags of [{failModel:true},{wrongCitation:true}]){const h=harness(flags);await assert.rejects(h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',h.options),flags.failModel?/PROVIDER_FAILED/:/QA_CITATION_INVALID/);assert(!h.calls.includes('assistant'));}
});
test('unbound KB, extra KB and missing worker execution reject before native execution',async()=>{
 for(const patch of [{kbIds:[]},{kbIds:['other']},{kbIds:['kb1','other']},{execution:undefined},{attachments:[{}]}]){const h=harness();await assert.rejects(h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',{...h.options,...patch}));assert(!h.calls.includes('native-session'));assert(!h.calls.includes('provider'));}
});
test('final synthesis restores the actual question and rejects unexpected native prompt formats',()=>{
 assert.throws(()=>bindKnowledgeSynthesisQuestion([{role:'user',content:'unexpected'}],'question'),/KNOWLEDGE_SYNTHESIS_INPUT_CHANGED/);
});
test('a missing bounded model execution dependency fails closed before any provider can execute',()=>{
 assert.throws(()=>harness({missingLedger:true}),/KNOWLEDGE_BOUNDED_EXECUTION_REQUIRED/);
});
test('delivery diagnosis retains only existing static reason enums, without rejected content or values',async()=>{
 const h=harness({numericBlocked:true});await assert.rejects(h.runtime.sessions.sendMessage(h.user,'session','请列出资料局限',h.options),e=>e.message==='HUB_ANSWER_NOT_DELIVERABLE:NUMERIC_BOUNDARY'&&!e.message.includes('never-persist'));assert(!h.calls.includes('assistant'));
});
