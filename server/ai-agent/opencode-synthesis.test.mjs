import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import * as synthesis from './opencode-synthesis.mjs';
import {isOwnedOpenCodeRequest} from './opencode-runtime.mjs';
test('actual isolated OpenCode consumes one bound provider result, preserving actual usage and runtime evidence',{timeout:60000},async()=>{
 const nativeFetch=globalThis.fetch, observed=[];
 globalThis.fetch=(url,init)=>{
  assert(isOwnedOpenCodeRequest(url,init),'LOCAL_OUTBOUND_HTTP_DENIED');
  const origin=new URL(url).origin;
  for(const [path,method] of [['/arbitrary','GET'],['/path?remote=1','GET'],['/path','DELETE']])assert.equal(isOwnedOpenCodeRequest(origin+path,{method}),false);
  observed.push({url,init});return nativeFetch(url,init);
 };
 try{
 const result=await synthesis.runOpenCodeSynthesis({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-t06-runtime',instruction:'Only explain the supplied public evidence. Never use tools or make up facts.',text:'PUBLIC_EVIDENCE_TASK: Summarize this public literature record.',authorize:async()=>true,
  providerCall:async messages=>{assert(messages.some(m=>m.content.includes('PUBLIC_EVIDENCE_TASK')));assert.deepEqual(messages.map(m=>m.role),['system','user']);assert(!JSON.stringify(messages).includes('synthetic-t06-runtime'));assert(!JSON.stringify(messages).includes('/Users/'));return{text:'A bounded public evidence explanation.',usedMock:false,usage:{model:'deepseek-v4-pro',promptTokens:10,completionTokens:8,totalTokens:18},route:{model:'deepseek-v4-pro',fallbackIndex:0}};}});
 assert.equal(result.text,'A bounded public evidence explanation.');assert.equal(result.usage.totalTokens,18);assert.equal(result.runtimeEvidence.runtime,'hub-opencode');assert.equal(result.runtimeEvidence.providerCalls,1);
 assert(observed.length>0);for(const r of observed)assert.equal(isOwnedOpenCodeRequest(r.url,r.init),false,'completed child port must be revoked');
 }finally{globalThis.fetch=nativeFetch;}
});
test('cancellation after dispatch preserves the provider unknown-outcome error for normal billing, not a generic harness error',{timeout:60000},async()=>{
 const controller=new AbortController(),unknown=Object.assign(Error('PROVIDER_OUTCOME_UNKNOWN'),{code:'MODEL_OUTCOME_UNKNOWN'});
 await assert.rejects(()=>synthesis.runOpenCodeSynthesis({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-t06-cancel',instruction:'Only explain public evidence. No tools.',text:'PUBLIC_CANCEL_TASK',authorize:async()=>true,signal:controller.signal,providerCall:async()=>{controller.abort();throw unknown;}}),e=>e===unknown);
});
test('a harness retry remains blocked without overwriting the original provider failure',{timeout:120000},async()=>{
 const reason=Object.assign(Error('QA_MODEL_REJECTED'),{code:'QA_MODEL_REJECTED'});let calls=0;
 await assert.rejects(()=>synthesis.runOpenCodeSynthesis({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-t07-provider-failure',instruction:'Only explain public evidence. No tools.',text:'PUBLIC_FAILURE_TASK',authorize:async()=>true,providerCall:async()=>{calls++;throw reason;}}),e=>e===reason);
 assert.equal(calls,1);
});
