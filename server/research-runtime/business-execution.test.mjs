import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessExecution} from './business-execution.mjs';
test('each actual dispatch revalidates the current task, including an internal fallback',async()=>{
 let revoked=false,requests=0;
 const execution=createBusinessExecution({raw:{}}),fetch=execution.guardFetch(async()=>{requests++;return{};});
 await execution.withExecution({assertExecution:async()=>{if(revoked)throw Error('revoked');}},async()=>{
  assert.equal(execution.active,true);await fetch('https://configured-provider.example');revoked=true;
  await assert.rejects(fetch('https://configured-provider.example'),/revoked/);
 });
 assert.equal(requests,1);assert.equal(execution.active,false);
 await fetch('http://unrelated-local-service');assert.equal(requests,2);
});
test('business execution requires a current native task proof without acceptance account or call limits',async()=>{
 let checks=0,calls=0;const raw={hasKey:true,chat:async()=>({usedMock:false,n:++calls})};
 const execution=createBusinessExecution({raw});
 await assert.rejects(execution.provider.chat([],{}),/CURRENT_EXECUTION_REQUIRED/);
 const proof={assertExecution:async()=>{checks++;}};
 for(let i=0;i<8;i++)assert.equal((await execution.withExecution(proof,()=>execution.provider.chat([],{}))).n,i+1);
 assert(checks>=16);assert.equal(calls,8);
 await assert.rejects(execution.provider.chat([],{}),/CURRENT_EXECUTION_REQUIRED/);
});
test('revoked native task never dispatches and failure releases asynchronous execution context',async()=>{
 let calls=0;const execution=createBusinessExecution({raw:{chat:async()=>{calls++;throw Error('provider-failed');}}});
 await assert.rejects(execution.withExecution({assertExecution:async()=>{throw Error('revoked');}},()=>execution.provider.chat([],{})),/revoked/);assert.equal(calls,0);
 await assert.rejects(execution.withExecution({assertExecution:async()=>{}},()=>execution.provider.chat([],{})),/provider-failed/);
 await assert.rejects(execution.provider.chat([],{}),/CURRENT_EXECUTION_REQUIRED/);assert.equal(calls,1);
});
test('revocation after a provider response rejects delivery while preserving known usage for native billing',async()=>{
 let revoked=false;const usage={promptTokens:4,completionTokens:2};
 class ReconciliationRequired extends Error{constructor(detail,route){super(detail);this.route=route;}}
 const route={model:'configured-model',fallbackIndex:0};
 const execution=createBusinessExecution({unknownError:(d,r)=>new ReconciliationRequired(d,r),raw:{chat:async()=>{revoked=true;return{usage,route,finalText:'must not escape'};}}});
 await assert.rejects(execution.withExecution({assertExecution:async()=>{if(revoked)throw Error('revoked');}},()=>execution.provider.chat([],{})),error=>error instanceof ReconciliationRequired&&error.knownUsage===usage&&error.route===route&&!error.finalText);
});

test('native accounting wraps the actual configured HTTP attempt before any response is delivered',async()=>{
 const events=[],execution=createBusinessExecution({raw:{}}),send=execution.guardFetch(async()=>{events.push('http');return 'response';});
 await execution.withExecution({assertExecution:async()=>{},dispatch:async(operation,model)=>{assert.equal(model,'configured-route');events.push('protected');const response=await operation();events.push('receipt');return response;}},async()=>assert.equal(await send('https://configured.example',{body:JSON.stringify({model:'configured-route'})}),'response'));
 assert.deepEqual(events,['protected','http','receipt']);
});
test('article request contract validates before protection and observes the actual protected response',async()=>{const events=[],execution=createBusinessExecution({raw:{}}),send=execution.guardFetch(async()=>{events.push('http');return new Response('{}')});await execution.withExecution({assertExecution:async()=>{},validateRequest:async(url,body)=>{assert.equal(body.model,'route');events.push('input')},dispatch:async fn=>{events.push('protect');return fn()},observeResponse:async response=>{assert.equal(response.status,200);events.push('response')}},()=>send('https://api.deepseek.com/chat/completions',{body:'{"model":"route"}'}));assert.deepEqual(events,['input','protect','http','response']);let sent=0;await assert.rejects(execution.withExecution({assertExecution:async()=>{},validateRequest:()=>{throw Error('invalid article input')},dispatch:()=>{sent++}},()=>send('https://api.deepseek.com/chat/completions',{body:'{}'})),/invalid article input/);assert.equal(sent,0);});
