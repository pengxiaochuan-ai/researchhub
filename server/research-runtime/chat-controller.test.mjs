import test from 'node:test';import assert from 'node:assert/strict';
import {runtimeDependencies} from './dependencies.mjs';import {createRuntimeChatController} from './chat.mjs';
const {load,require}=runtimeDependencies();
function harness(){
 const user={tenantId:'tenant',accountId:'actor',studyGroupId:'group',researchProjectId:'project',role:'researcher'},id='new-session',messages=[],jobs=[];let sequence=0;
 const native=load('sessions/knowledge-chat-queue.service','createKnowledgeQueueRecords');
 const tx={knowledgeChatJob:{findUnique:async({where})=>jobs.find(x=>x.requestKey===where.tenantId_requestKey.requestKey),create:async({data})=>{const j={...data,id:'job-'+(++sequence),status:'queued',createdAt:new Date(),updatedAt:new Date()};jobs.push(j);return j;}},message:{create:async({data})=>{const m={...data,id:'message-'+sequence};messages.push(m);return m;}},session:{update:async()=>{}},auditLog:{create:async()=>{}}};
 const chat={agentId:'agent',requireReady:async()=>{},sessions:{assertKnowledgeSession:async()=>({agentId:'agent',contextKey:'hub:lingshu-xinyu'})},current:async()=>{},chatBudget:{assertAdmittedSession:(_a,s)=>{if(s!==id)throw Object.assign(Error('historical read only'),{code:'HUB_CHAT_SESSION_NOT_ADMITTED',status:409});},assertCanEnqueue:(_a,replay)=>{if(jobs.length&&!jobs.some(j=>j.sessionId===replay.sessionId&&j.requestKey===replay.requestKey))throw Object.assign(Error('quota'),{code:'HUB_CHAT_BUDGET_EXHAUSTED',status:409});},isAdmittedSession:()=>true,quota:()=>({blocked:jobs.length>0})}};
 const queue={enqueue:(u,s,input)=>native(tx,{user:u,sessionId:s,...input}),state:async()=>({messages,jobs})};const Controller=createRuntimeChatController({require,load,getChat:()=>chat,getQueue:()=>queue});return{controller:new Controller(),req:{user},id,jobs,messages};
}
test('original page commands submit uses the same native queue and preserves idempotency',async()=>{const h=harness(),body={text:'synthetic registry question',requestKey:'same-request-key',kbIds:[],networkIntent:{schema:'hub-network-intent.v1',enabled:false}};
 const a=await h.controller.command(h.req,h.id,body),b=await h.controller.command(h.req,h.id,body);assert.equal(a.id,b.id);assert.equal(h.jobs.length,1);assert.equal(h.messages.length,1);
 await assert.rejects(()=>h.controller.command(h.req,h.id,{...body,text:'conflicting text'}),e=>e.getStatus()===409);
 await assert.rejects(()=>h.controller.command(h.req,h.id,{...body,requestKey:'new-request-key'}),e=>e.getStatus()===409);assert.equal(h.jobs.length,1);
 h.jobs[0].status='completed';const view=await h.controller.commands(h.req,h.id);assert.equal(view.items[0].status,'completed');assert.equal(view.recent[0].requestKey,body.requestKey);
});
test('original page cannot enable network execution or enqueue in a historical session',async()=>{const h=harness(),body={text:'synthetic question',requestKey:'request-key',kbIds:[],networkIntent:{schema:'hub-network-intent.v1',enabled:true}};await assert.rejects(()=>h.controller.command(h.req,h.id,body),e=>e.getStatus()===503);await assert.rejects(()=>h.controller.command(h.req,'historical-session',{...body,networkIntent:{schema:'hub-network-intent.v1',enabled:false}}),e=>e.getStatus()===409);assert.equal(h.jobs.length,0);});
