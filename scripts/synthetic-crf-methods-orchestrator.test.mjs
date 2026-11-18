import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';
import{crfAiFixture}from'../tests/fixtures/synthetic-crf-methods-ai.mjs';
import{CRF_AI_REQUEST_TEXT,crfInterpretationModel,crfPrompt,crfToolEvidence,crfProviderMessages,crfProviderOptions,parseCrfMethodInterpretation}from'./synthetic-crf-methods-ai-contract.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url)),{OrchestratorService}=require('./src/orchestrator/orchestrator.service.ts');
test('original KB orchestrator fast path accepts qualitative method citations without scientific numeric guard downgrade',async()=>{
 const f=crfAiFixture(),turn={crf:{...f,config:f.packet.config,modelView:crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,f.sources)}};let calls=0,toolRuns=0;
 const answer=JSON.stringify({items:[{evidenceIds:[f.ids[0]],explanation:'存在缺失，需由研究者核对原始记录。[M1]',question:'是否已说明未测原因？[M1]',sourceRefs:[{kind:'method',index:1}]}]});
 const provider={chat:async()=>{calls++;return{text:answer,usedMock:false,usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150},route:{model:'deepseek-v4-pro',profileId:'local',fallbackIndex:0}};},chatWithTools:()=>{throw Error('unexpected multi-call tool path');}};
 const tools={toolDefs:()=>[{type:'function',function:{name:'kb_search',description:'检索',parameters:{type:'object',properties:{}}}}],execute:async()=>{toolRuns++;return{result:crfToolEvidence(turn)};}};
 const core=new OrchestratorService({},provider,{},{},tools),result=await core.run({user:{tenantId:'tenant',accountId:'owner'},userMessage:CRF_AI_REQUEST_TEXT,history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:['kb'],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536},kbGrounding:crfPrompt(turn)+'\n'+crfToolEvidence(turn)}});
 assert.equal(toolRuns,1);assert.equal(calls,1);assert.equal(result.provenance.kbAnswerFastPath,true);assert.equal(result.provenance.numericBoundaryBlocked,false);assert.equal(result.provenance.dataBoundaryBlocked,false);assert.equal(result.finalText,answer);assert(parseCrfMethodInterpretation(result.finalText,turn.crf));
 assert.equal(crfProviderMessages(turn).length,2);assert.equal(crfProviderOptions(turn,{}).jsonMode,true);
});
