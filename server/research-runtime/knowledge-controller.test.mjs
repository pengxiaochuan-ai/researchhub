import test from 'node:test';import assert from'node:assert/strict';
import {createRuntimeChatController,knowledgeEntryAvailability}from'./chat.mjs';import{runtimeDependencies}from'./dependencies.mjs';
const{require,load}=runtimeDependencies();
test('an unadmitted AI purpose disables only QA, while actual read-permission errors remain forbidden',async()=>{
 assert.deepEqual(await knowledgeEntryAvailability(async()=>{}),{enabled:true});
 const missing=await knowledgeEntryAvailability(async()=>{throw Object.assign(Error('private purpose'),{code:'KNOWLEDGE_AI_SCOPE_NOT_ADMITTED'});});assert.equal(missing.enabled,false);assert.match(missing.message,/尚未开放/);
 const revoked=Object.assign(Error('current read revoked'),{status:403});await assert.rejects(knowledgeEntryAvailability(async()=>{throw revoked;}),error=>error===revoked);
});
function harness(){
 const user={tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project'},session={id:'session',agentId:'agent',contextKey:'kb:private'},calls=[];let restricted=false;
 const source={docId:'doc',kbId:'private',chunkId:'chunk',version:2};
 const chat={agentId:'agent',requireReady:async()=>{},sessions:{assertKnowledgeSession:async(_u,id)=>{if(id!=='session')throw Object.assign(Error('NOT_FOUND'),{status:404});return session;}},read:async(_u,fn)=>fn({message:{findFirst:async()=>({role:'assistant',meta:{provenance:{knowledgeSources:[source]}}})}}),knowledge:{ensure:async(_u,kb)=>{if(kb!=='private')throw Object.assign(Error('FORBIDDEN'),{status:403});return{id:'session'};},evidence:{authorize:async(_u,kb)=>{if(kb!=='private')throw Object.assign(Error('FORBIDDEN'),{status:403});},project:async(_u,kb,items)=>{assert.equal(kb,'private');return items;},status:async()=>restricted?'restricted':'current'}}};
 const queue={enqueue:async(_u,id,input)=>{calls.push({id,input});return{id:'job',status:'queued'};},state:async()=>({messages:[],jobs:[]})};
 const Controller=createRuntimeChatController({require,load,getChat:()=>chat,getQueue:()=>queue});return{controller:new Controller(),req:{user},calls,session,setRestricted:()=>{restricted=true;}};
}
test('original K01 session endpoint uses the real KB branch instead of the not-configured stub',async()=>{const h=harness();assert.deepEqual(await h.controller.ensureKnowledge(h.req,{agentId:'agent',kbId:'private',kbName:'untrusted title'}),{id:'session'});await assert.rejects(h.controller.ensureKnowledge(h.req,{agentId:'agent',kbId:'other'}),e=>e.getStatus()===403);});
test('KB submit preserves exactly its persisted KB and refuses Hub-style or cross-KB inputs',async()=>{
 const h=harness(),body={text:'资料流程是什么',requestKey:'request-key',kbIds:['private']};await h.controller.send(h.req,'session',body);assert.deepEqual(h.calls[0].input.kbIds,['private']);
 for(const kbIds of [[],['other'],['private','other']])await assert.rejects(h.controller.send(h.req,'session',{...body,kbIds}),e=>e.getStatus()===400);
 assert.equal(h.calls.length,1);await assert.rejects(h.controller.send(h.req,'other-session',body),e=>e.getStatus()===404);
});
test('KB citation lookup reads only server-persisted snapshots and refuses a withdrawn source',async()=>{const h=harness();const source=await h.controller.source(h.req,'session','message','1');assert.equal(source.kbId,'private');assert.equal(source.status,'current');h.setRestricted();await assert.rejects(h.controller.source(h.req,'session','message','1'),e=>e.getStatus()===403);});

test('KB status carries explicit request scope into native authorization without changing the login principal',async()=>{
 const original={tenantId:'tenant',accountId:'owner',role:'researcher',authVersion:7};let received;
 const Controller=createRuntimeChatController({require,load,getQueue:()=>({}),getChat:()=>({status:async(u,q)=>{received=u;if(q.kbId&&(!u.studyGroupId||!u.researchProjectId))throw Object.assign(Error('missing scope'),{status:400});return{enabled:true};}})}),controller=new Controller();
 assert.deepEqual(await controller.status({user:original,headers:{'x-study-group-id':'group','x-research-project-id':'project'}},{kbId:'private'}),{enabled:true});
 assert.equal(received.studyGroupId,'group');assert.equal(received.researchProjectId,'project');assert.equal(received.role,'researcher');assert.equal(received.authVersion,7);assert.equal(original.studyGroupId,undefined);assert.equal(original.researchProjectId,undefined);
 for(const headers of[{}, {'x-study-group-id':'group'}, {'x-study-group-id':['group'],'x-research-project-id':'project'}])await assert.rejects(controller.status({user:original,headers},{kbId:'private'}),e=>e.getStatus()===400);
 await controller.status({user:original,headers:{}},{});assert.equal(received,original);
});
