import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./attempts.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const binding={tenantId:'tenant',accountId:'owner',reservationId:'reservation',jobId:'job',sessionId:'session',executionToken:'token',workerOwner:'worker',model:'deepseek-v4-pro'};
const event=(action,attemptId,extra={})=>({action:'hub.token.'+action,meta:{schema:'rh-token-attempt.v1',...binding,attemptId,...extra}});
const samples=()=>[event('attempt.started','one'),event('attempt.completed','one',{usage:{promptTokens:90,completionTokens:30,totalTokens:120},httpStatus:200}),event('execution.sealed',null,{attemptIds:['one']})];
test('verified consumption requires a seal and complete valid receipts, never a partial array',()=>{
 assert.equal(typeof api.verifiedUsage,'function','complete usage verifier missing');
 assert.equal(api.verifiedUsage(samples(),binding).totalTokens,120);
 for(const events of [[],samples().slice(0,2),[...samples(),event('attempt.started','two')],samples().map(e=>e.action.endsWith('completed')?event('attempt.unknown','one'):e)])assert.equal(api.verifiedUsage(events,binding),null);
});
test('duplicate receipts cannot double debit; conflicting receipts and foreign bindings fail closed',()=>{
 assert.equal(typeof api.verifiedUsage,'function');const events=samples();
 assert.equal(api.verifiedUsage([...events.slice(0,2),events[1],events[2]],binding).callCount,1);
 for(const patch of [{accountId:'other'},{executionToken:'stale'},{httpStatus:500},{usage:{promptTokens:90,completionTokens:30,totalTokens:119}}])assert.equal(api.verifiedUsage([events[0],{...events[1],meta:{...events[1].meta,...patch}},events[2]],binding),null);
 assert.equal(api.verifiedUsage([events[0],events[1],{...events[1],meta:{...events[1].meta,usage:{promptTokens:91,completionTokens:30,totalTokens:121}}},events[2]],binding),null);
});
test('multiple models preserve each call count, while a single unknown keeps the whole run pending',()=>{
 const e=samples().slice(0,2),second=[event('attempt.started','two',{model:'other-model'}),event('attempt.completed','two',{model:'other-model',httpStatus:200,usage:{promptTokens:20,completionTokens:10,totalTokens:30}})];
 const sealed=event('execution.sealed',null,{attemptIds:['one','two']}),u=api.verifiedUsage([...e,...second,sealed],binding);
 assert.equal(u.totalTokens,150);assert.equal(u.callCount,2);assert.equal(u.byModel['other-model'].calls,1);assert.equal(u.model,'deepseek-v4-pro');
 assert.equal(api.verifiedUsage([...e,second[0],event('attempt.unknown','two',{model:'other-model'}),sealed],binding),null);
 for(const usage of [{promptTokens:-1,completionTokens:1,totalTokens:0},{promptTokens:2147483648,completionTokens:0,totalTokens:2147483648},{promptTokens:0.5,completionTokens:0.5,totalTokens:1}])assert.equal(api.verifiedUsage([e[0],event('attempt.completed','one',{httpStatus:200,usage}),samples()[2]],binding),null);
});
