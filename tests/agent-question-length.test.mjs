import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeSkillTask,bindSkillRoute,routeExecutionInput} from '../server/ai-agent/skill-routing.mjs';
import {createLiteratureRequest} from '../server/ai-agent/natural-literature-plan.mjs';
import {planLiteratureQuery} from '../server/ai-agent/literature-query.mjs';
import {planInterpretation} from '../server/ai-agent/interpretation-plan.mjs';
import {articleResponseMessages,articleResponseInputProof} from '../scripts/article-response-policy.mjs';
import {articleModelMessages,articleModelInputProof} from '../scripts/article-ai-output.mjs';
import {compileHubQuery} from '../server/hub-sources/search-query-plan.mjs';
const input=await import('../src/agent-question.js').catch(()=>({}));
const saved=JSON.parse(readFileSync('docs/testing/fixtures/article-response-sjogren-2026-11-06.json'));
export const longQuestion='请读取公开科研来源并核对原文：'+('请保留问题中的对象与限定条件，不新增计算。\n').repeat(8)+'https://www.who.int/news-room/fact-sheets/detail/anxiety-disorders';
test('shared question boundary preserves full URLs and Unicode through 4000 characters; invalid input is not clipped',()=>{
 assert.equal(input.AGENT_QUESTION_MAX_CHARACTERS,4000);
 for(const n of [99,100,101,999,1000,1001,1199,1200,1201,3999,4000])for(const char of ['研','x','🧪']){
  const q=char.repeat(n);assert.equal(input.agentQuestionError(q),'');assert.equal(input.agentQuestionLength(q),n);
 }
 assert.equal(input.agentQuestionError(longQuestion),'');assert.equal(input.agentQuestionLength(' 研究\n🧪 '),4);
 for(const q of ['',null,{},' \n ','研'])assert(input.agentQuestionError(q));
 assert.match(input.agentQuestionError('🧪'.repeat(4001)),/4000/);
});
test('long questions survive skill routing and execution, including URL at the end and fixed-source continuation',()=>{
 const decision=routeSkillTask({text:longQuestion,context:{kind:'hub'},networkIntent:{schema:'hub-network-intent.v1',enabled:true},smartSearchEnabled:true});
 assert.equal(decision.mode,'hub-smart-search');assert.equal(decision.anchorQuestion,longQuestion);
 const route=bindSkillRoute({user:{},session:{id:'s',contextKey:'hub:test'},text:longQuestion,decision,skill:{key:decision.skillKey},sourceBinding:'fixed',networkIntent:{schema:'hub-network-intent.v1',enabled:true}});
 assert.equal(routeExecutionInput(route,longQuestion).query,longQuestion);
 const follow=routeSkillTask({text:'继续',context:{kind:'hub'},previous:{...decision,jobId:'parent'},networkIntent:{schema:'hub-network-intent.v1',enabled:false},smartSearchEnabled:true});
 const fixed=bindSkillRoute({user:{},session:{id:'s',contextKey:'hub:test'},text:'继续',decision:follow,skill:{key:follow.skillKey},sourceBinding:'fixed'});
 assert.equal(routeExecutionInput(fixed,'继续').query,longQuestion);
 assert.throws(()=>routeSkillTask({text:'x'.repeat(4001),context:{kind:'hub'}}));
});
test('natural and legacy literature plans and fixed interpretation keep long input, not a first-100 prefix',()=>{
 const q='请检索针灸治疗抑郁研究，'+('请简要说明相关文献来源。').repeat(15);
 assert.equal(createLiteratureRequest(q).question,q);
 const literal='针灸 抑郁 '+('相关研究 ').repeat(40);assert.equal(planLiteratureQuery(literal).question,literal.trim());
 const p=planInterpretation('请解释第一篇论文，'+('说明研究局限，').repeat(30),{retrieval:{jobId:'parent',hash:'h',selected:[{id:'P1'}]}});assert.equal(p.status,'ready');assert(p.question.length>100);
});
test('actual new and legacy article model messages retain the entire question and URL',()=>{
 const messages=articleResponseMessages('系统',longQuestion,saved.pack);assert.equal(JSON.parse(messages[1].content).question,longQuestion);assert.doesNotThrow(()=>articleResponseInputProof(messages,saved.pack,longQuestion));
 const old=articleModelMessages('系统',longQuestion,saved.pack);assert.equal(JSON.parse(old[1].content).question,longQuestion);assert.doesNotThrow(()=>articleModelInputProof(old,saved.pack,longQuestion));
 assert.throws(()=>articleResponseMessages('系统','x'.repeat(4001),saved.pack));
 for(const q of ['研'.repeat(4000),'🧪'.repeat(4000)]){assert.equal(JSON.parse(articleResponseMessages('系统',q,saved.pack)[1].content).question,q);assert.equal(JSON.parse(articleModelMessages('系统',q,saved.pack)[1].content).question,q);}
});
test('agent query can be longer while E01 default search and concept limits remain unchanged',()=>{
 const dictionary=JSON.parse(readFileSync('server/hub-sources/search-dictionary-v1.json'));
 assert.throws(()=>compileHubQuery(longQuestion,dictionary),e=>e.code==='HUB_QUERY_INVALID');
 const p=compileHubQuery(longQuestion,dictionary,{maxCharacters:4000});assert.equal(p.originalQuery,longQuestion);assert.equal(p.mode,'literal');assert.equal(p.appliedTerms[0],longQuestion);
 assert.throws(()=>compileHubQuery('x'.repeat(4001),dictionary,{maxCharacters:4000}),e=>e.code==='HUB_QUERY_INVALID');
});
