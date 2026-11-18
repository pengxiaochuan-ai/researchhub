import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {HUB_TOOL_KB_ID,assertHubToolResult,hubAnswerProvenance,hubCoreQuestion,bindHubSynthesisQuestion} from './hub-agent-contract.mjs';
import {assertAnswer} from './knowledge-ai-contract.mjs';

const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {OrchestratorService}=require('./src/orchestrator/orchestrator.service.ts');
const {shouldUseKbAnswerFastPath}=require('./src/orchestrator/kb-agent-performance-policy.ts');
test('fixed Hub scope routes a real negated-mutation question through unchanged old retrieval rather than model tool loop',async()=>{
 const question='请仅依据这篇原文选段概括研究设计与主要局限，区分原文发现和研究者需进一步核对的问题，不新增计算。';
 const policy={currentKbId:HUB_TOOL_KB_ID,canSearch:true,hasAttachments:false};assert.equal(shouldUseKbAnswerFastPath({...policy,message:question}),false);assert.equal(shouldUseKbAnswerFastPath({...policy,message:hubCoreQuestion}),true);
 let searches=0,calls=0;
 const tools={toolDefs:()=>[{type:'function',function:{name:'kb_search',parameters:{type:'object',properties:{query:{type:'string'}}}}}],execute:async(_u,_n,args)=>{searches++;assert.equal(JSON.parse(args).query,hubCoreQuestion);return{result:'[1] 当前获准资料',mutated:false};}};
 const provider={chat:async messages=>{calls++;assert(bindHubSynthesisQuestion(messages,question)[1].content.startsWith('用户问题：'+question));return{text:'仅说明资料与局限。[1]',usedMock:false,usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20},route:{model:'deepseek-v4-pro',profileId:'offline',fallbackIndex:0}};},chatWithTools:()=>assert.fail('read-only Hub must not enter tools loop')};
 const result=await new OrchestratorService({},provider,{},{},tools).run({user:{tenantId:'t',accountId:'a'},userMessage:hubCoreQuestion,history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:[HUB_TOOL_KB_ID],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536}}});
 assert.equal(searches,1);assert.equal(calls,1);assert.equal(result.provenance.kbAnswerFastPath,true);
});

test('unchanged research Orchestrator searches Hub evidence before one model synthesis, preserving separate provenance',async()=>{
  const order=[];
  const source={index:1,sourceRecordId:'rhsr-'+'a'.repeat(40),snippetHash:'b'.repeat(64),reviewVersion:'1',aiReviewVersion:'2'};
  const toolResult={result:'[1] 《合成开放来源》｜来源=技术夹具：合成摘要，不是真实科研证据',mutated:false,meta:{toolName:'hub_source_search',sources:[source]}};
  const tools={toolDefs:()=>[{type:'function',function:{name:'kb_search',description:'仅作为旧内核工具槽，实际独立 Hub 检索',parameters:{type:'object',properties:{query:{type:'string'}}}}}],execute:async(_user,name,args)=>{order.push('hub-search');assert.equal(name,'kb_search');assert.equal(JSON.parse(args).kbId,HUB_TOOL_KB_ID);assertHubToolResult(toolResult);return toolResult;}};
  const provider={chat:async()=>{order.push('model');return{text:'合成摘要可供核对，但不能据此推断疗效。[1]',usedMock:false,usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130},route:{model:'deepseek-v4-pro',profileId:'free-test-double',fallbackIndex:0}};},chatWithTools:()=>{throw Error('model-before-evidence');}};
  const core=new OrchestratorService({},provider,{},{},tools);
  const result=await core.run({user:{tenantId:'tenant',accountId:'owner'},userMessage:'这份合成来源能支持哪些定性研究背景？',history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:[HUB_TOOL_KB_ID],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536},kbGrounding:'独立 Hub 已审核公开来源，仅作合成验证'}});
  assert.deepEqual(order,['hub-search','model']);
  assert.equal(result.provenance.kbAnswerFastPath,true);
  assertAnswer(result,[source]);
  const provenance=hubAnswerProvenance([source],[{tool:'hub_source_search'}]);
  assert.equal(provenance.sourceType,'hub-reviewed-publication');
  assert.equal(provenance.knowledgeSources,undefined);
});
