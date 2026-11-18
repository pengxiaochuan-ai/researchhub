import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runBusinessProvider,assertBusinessProviderOutcome} from './business-ai-provider.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {OrchestratorService}=require('./src/orchestrator/orchestrator.service.ts');
const {UsageAccumulator}=require('./src/orchestrator/usage-accumulator.ts');
const {ModelOutcomeUnknownError}=require('./src/orchestrator/deepseek.provider.ts');
const {requiresProviderReconciliation}=require('./src/sessions/sessions.service.ts');
const usage={model:'deepseek-v4-pro',promptTokens:900,completionTokens:300,totalTokens:1200,cacheHitTokens:0};
async function execute(call,validate){
 const partial=[],turn={},provider={chat:()=>runBusinessProvider(turn,call,{validate,recordRejectedUsage:r=>new UsageAccumulator(s=>partial.push(s)).addDeepseek(r.usage,r.route)}),chatWithTools:()=>{throw Error('unexpected tool loop');}};
 const core=new OrchestratorService({},provider,{},{},{toolDefs:()=>[{type:'function',function:{name:'kb_search',description:'synthetic read-only evidence',parameters:{type:'object',properties:{query:{type:'string'}}}}}],execute:async()=>({result:'[1] Synthetic evidence, not clinical data.',mutated:false})});
 let error,result;try{result=await core.run({user:{tenantId:'synthetic',accountId:'synthetic'},userMessage:'只按资料做定性解释',history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:['synthetic'],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536},onProviderUsage:s=>partial.push(s)}});assertBusinessProviderOutcome(turn);}catch(e){error=e;}
 return{error,result,partial,reconcile:requiresProviderReconciliation(error,partial)};
}
test('first dispatched request with unknown outcome survives old synthesis fallback and keeps reconciliation required',async()=>{
 const original=new ModelOutcomeUnknownError('network_or_protocol',{model:'deepseek-v4-pro',fallbackIndex:0});
 const r=await execute(async()=>{throw original;});assert.equal(r.error,original);assert.equal(r.partial.length,0);assert.equal(r.reconcile,true);
});
for(const reason of ['ARTICLE_JSON_INVALID','SOURCE_REVOKED_AFTER_MODEL','QA_MODEL_TRUNCATED'])test('known provider usage is retained when delivery is rejected: '+reason,async()=>{
 const original=Error(reason),r=await execute(async()=>({text:'invalid output',usedMock:false,usage}),()=>{throw original;});
 assert.equal(r.error,original);assert.equal(r.reconcile,true);assert.equal(r.partial.length,1);assert.equal(r.partial[0].totalTokens,1200);assert.equal(r.partial[0].promptTokens,900);
});
test('successful output is counted only by the native accumulator, not twice',async()=>{
 const r=await execute(async()=>({text:'Synthetic qualitative answer [1]',usedMock:false,usage}),()=>{});
 assert.equal(r.error,undefined);assert.equal(r.partial.length,1);assert.equal(r.result.usage.totalTokens,1200);
});
test('predispatch failure with no usage does not invent consumption',async()=>{
 const r=await execute(async()=>{throw Error('SOURCE_REJECTED_BEFORE_DISPATCH');});assert.equal(r.reconcile,false);assert.equal(r.partial.length,0);
});
