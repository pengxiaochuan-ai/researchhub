import test from 'node:test';
import assert from 'node:assert/strict';
import {routeSkillTask,bindSkillRoute,assertSkillRoute,routeDigest} from './skill-routing.mjs';
import * as routing from './skill-routing.mjs';

test('ordinary Hub introductions, capability questions and conversation do not demand article clarification',()=>{
 for(const text of ['介绍下你自己','你有什么能力','你能帮我做哪些科研工作？','你能帮我做什么研究工作？','你有哪些科研能力？','能帮我完成哪些研究任务？','刚才你说可以检索，怎么用？','你好','谢谢你的帮助','帮我处理一下']){
  const r=routeSkillTask({text,context:{kind:'hub'},literatureEnabled:true,interpretationEnabled:true});
  assert.equal(r.status,'selected',text);assert.equal(r.mode,'hub-general-conversation',text);assert.equal(r.skillKey,null);assert.deepEqual(r.requiredTools,[]);
 }
 for(const text of ['介绍下你自己，然后检索针灸治疗抑郁的论文','你能帮我检索针灸治疗抑郁的论文吗'])assert.notEqual(routeSkillTask({text,context:{kind:'hub'},literatureEnabled:true}).mode,'hub-general-conversation');
 assert.equal(routeSkillTask({text:'订阅针灸研究',context:{kind:'hub'},literatureEnabled:true}).mode,'unavailable');
 assert.equal(routeSkillTask({text:'解读报告',context:{kind:'hub'},literatureEnabled:true}).status,'clarify');
});

test('purpose and object distinguish all nine skills, not a generic report keyword',()=>{
 const cases=[
  ['查找针灸治疗焦虑的随机试验','doubao-medical-literature-search'],
  ['解释这篇论文的设计与局限','doubao-medical-literature-interpretation'],
  ['只翻译本文摘要，不解释','doubao-medical-literature-translation'],
  ['根据已有证据完善PICO和研究方案','doubao-medical-protocol-design'],
  ['根据DOI核对PMID及题录','pubmed-medical-literature'],
  ['订阅每两周针灸治疗失眠的最新研究进展','doubao-medical-literature-monitoring'],
  ['作为医生讨论这个虚构病例的治疗证据','doubao-clinical-decision-support'],
  ['解释合成血常规报告的异常指标','doubao-medical-report'],
  ['作为家属想通俗了解失眠的证据','doubao-answer-with-medical-evidence'],
 ];
 for(const[text,key]of cases)assert.equal(routeSkillTask({text,context:{kind:'hub'}}).skillKey,key,text);
 assert.equal(routeSkillTask({text:'生成本研究的统计分析报告',context:{kind:'hub'}}).status,'clarify');
});

test('article context keeps interpretation closed but cannot swallow a new translation or search purpose',()=>{
 const context={kind:'article',bindingHash:'fixed'};
 assert.equal(routeSkillTask({text:'研究设计可靠吗？',context}).mode,'existing-fixed-article');
 assert.equal(routeSkillTask({text:'翻译本篇全文包括表格',context}).skillKey,'doubao-medical-literature-translation');
 assert.equal(routeSkillTask({text:'寻找其他相关文章',context}).mode,'unavailable');
 assert.equal(routeSkillTask({text:'不要检索，解释这篇文章的方法',context}).skillKey,'doubao-medical-literature-interpretation');
 assert.equal(routeSkillTask({text:'比较我选择的三篇论文',context}).mode,'unavailable');
});

test('follow-up inherits server-owned purpose but an explicit new intent wins',()=>{
 const previous={skillKey:'doubao-medical-literature-translation',anchorQuestion:'翻译摘要',jobId:'owned-prior'};
 assert.equal(routeSkillTask({text:'继续',context:{kind:'article'},previous}).skillKey,previous.skillKey);
 assert.equal(routeSkillTask({text:'现在解释这篇文章的研究局限',context:{kind:'article'},previous}).skillKey,'doubao-medical-literature-interpretation');
 assert.equal(routeSkillTask({text:'继续',context:{kind:'hub'}}).mode,'hub-general-conversation');
});

test('only a scoped Hub answer or existing fixed article has a ready compatibility adapter',()=>{
 assert.equal(routeSkillTask({text:'已审核资料对针灸治疗失眠有哪些观察？',context:{kind:'hub'}}).mode,'existing-reviewed-hub');
 assert.equal(routeSkillTask({text:'在PubMed搜索最近随机试验',context:{kind:'hub'}}).mode,'unavailable');
 const r=routeSkillTask({text:'请解读这篇文章',context:{kind:'article'}});
 assert.deepEqual(r.requiredTools,['hub_article_evidence']);
});

const user={tenantId:'t',accountId:'a',authVersion:0,studyGroupId:'g',researchProjectId:'p'};
const session={id:'s',agentId:'agent',contextKey:'article-binding'};
const skill={id:'released',key:'doubao-medical-literature-interpretation',version:1,sourceHash:'a'.repeat(64)};
const decision=()=>routeSkillTask({text:'解释研究局限',context:{kind:'article'}});
test('a persisted route binds identity, session, question, fixed source and effective published version',()=>{
 const args={user,session,text:'解释研究局限',decision:decision(),skill,sourceBinding:'article-v1'};
 const route=bindSkillRoute(args);
 assert.doesNotThrow(()=>assertSkillRoute(route,{...args,availableTools:['hub_article_evidence']}));
 for(const patch of [{user:{...user,accountId:'b'}},{session:{...session,id:'other'}},{text:'改成翻译'},{skill:{...skill,version:2}},{sourceBinding:'article-v2'},{availableTools:[]}])assert.throws(()=>assertSkillRoute(route,{...args,availableTools:['hub_article_evidence'],...patch}));
 assert.throws(()=>assertSkillRoute({...route,skill:{...route.skill,key:'forged'}},{...args,availableTools:['hub_article_evidence']}));
 assert.equal(routeDigest(JSON.parse(JSON.stringify(route))),routeDigest(route));
});

test('external, multi-article, patient and scheduled intents cannot hide behind an existing answer adapter',()=>{
 for(const text of ['请搜索这篇文章的后续研究','解释这篇论文，并寻找其他相关论文','解读这四篇论文','请解释这5篇文章','解读这10篇论文','请解释这100篇文章','解读一百篇论文'])assert.notEqual(routeSkillTask({text,context:{kind:'article'}}).mode,'existing-fixed-article',text);
 assert.equal(routeSkillTask({text:'我是一名患者，最近失眠，应该怎么办？',context:{kind:'hub'}}).skillKey,'doubao-answer-with-medical-evidence');
 assert.equal(routeSkillTask({text:'请每周给我更新一次针灸治疗失眠的研究',context:{kind:'hub'}}).skillKey,'doubao-medical-literature-monitoring');
 assert.equal(routeSkillTask({text:'帮我处理一下',context:{kind:'hub'}}).mode,'hub-general-conversation');
});

test('continuation sends the bound prior user task to retrieval and model, never the isolated word continue',()=>{
 const text='继续',decision=routeSkillTask({text,context:{kind:'article'},previous:{skillKey:skill.key,anchorQuestion:'解释研究局限',jobId:'prior-owned'}});
 const route=bindSkillRoute({user,session,text,decision,skill,sourceBinding:'article-v1'});
 const execution=routing.routeExecutionInput(route,text);
 assert.equal(execution.query,'解释研究局限');assert(execution.continuationInstruction.includes('继续'));assert(!execution.continuationInstruction.includes('疗效'));
 assert.throws(()=>routing.routeExecutionInput(route,'另一个问题'));
});
test('enabled literature routing compiles the real public task, while old routes and article interpretation stay unchanged',()=>{
 const r=routeSkillTask({text:'在PubMed检索针灸治疗失眠的论文',context:{kind:'hub'},literatureEnabled:true});assert.equal(r.mode,'hub-literature-search');assert(r.taskPlan.pubmedQuery.includes('insomnia'));assert(r.requiredTools.includes('pubmed_fetch_articles'));
 const local=routeSkillTask({text:'仅依据已审核资料，针灸治疗失眠研究有哪些局限？',context:{kind:'hub'},literatureEnabled:true});assert.equal(local.taskPlan.scope,'hub-only');assert(!local.requiredTools.includes('pubmed_search_articles'));
 const bad=routeSkillTask({text:'检索针灸治疗失眠但排除产后患者',context:{kind:'hub'},literatureEnabled:true});assert.equal(bad.status,'clarify');
 assert.equal(routeSkillTask({text:'解释这篇文章',context:{kind:'article'},literatureEnabled:true}).mode,'existing-fixed-article');
});
test('continuing an old Hub-only task does not silently enable external search',()=>{
 const decision=routeSkillTask({text:'继续',context:{kind:'hub'},literatureEnabled:true,previous:{jobId:'legacy',skillKey:'doubao-medical-literature-search',anchorQuestion:'针灸 抑郁',mode:'existing-reviewed-hub'}});
 assert.equal(decision.mode,'existing-reviewed-hub');assert(!decision.requiredTools.includes('pubmed_search_articles'));
});
