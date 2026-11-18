import test from 'node:test';import assert from 'node:assert/strict';
import {routeSkillTask,bindSkillRoute,assertSkillRoute} from './skill-routing.mjs';
const on={schema:'hub-network-intent.v1',enabled:true},off={...on,enabled:false};
const route=(text,networkIntent=off,extra={})=>routeSkillTask({text,networkIntent,smartSearchEnabled:true,context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true,...extra});
test('OFF cannot schedule explicit live PubMed, website, recent or URL requests',()=>{
 for(const q of ['请在PubMed检索针灸论文','全网搜索针灸指南','查询近一年针灸论文','读取https://www.who.int/的说明']){const r=route(q);assert.equal(r.status,'clarify',q);assert.match(r.question,/智能搜索/);}
 const local=route('检索针灸治疗抑郁的资料');assert.equal(local.mode,'existing-reviewed-hub');assert.deepEqual(local.requiredTools,['hub_source_search']);
 for(const text of ['检索并解读针灸治疗抑郁的研究','查询针灸研究，并比较证据局限']){const r=route(text);assert.equal(r.mode,'existing-reviewed-hub');assert.deepEqual(r.requiredTools,['hub_source_search']);}
});
test('ON enables the new web branch, preserves explicit PubMed, and obeys narrower Hub-only wording',()=>{
 assert.equal(route('查询公开的针灸临床指南',on).mode,'hub-smart-search');
 assert.equal(route('在PubMed查询针灸治疗失眠的论文',on).mode,'hub-literature-search');
 assert.equal(route('只用Hub资料，不联网，检索针灸治疗抑郁',on).mode,'existing-reviewed-hub');
 for(const text of ['仅检索Hub已审核资料，查询针灸治疗抑郁的研究','只查询Hub资料，不访问外部网站','不要联网搜索，只检索Hub资料'])assert.equal(route(text,on).mode,'existing-reviewed-hub',text);
 assert.equal(route('介绍下你自己',on).mode,'hub-general-conversation');
 assert.equal(route('解释这篇文章的方法',on,{context:{kind:'article'}}).mode,'existing-fixed-article');
});
test('negative new-search wording and source-number follow-ups stay on fixed web evidence with no network tools',()=>{
 const previous={mode:'hub-smart-search',jobId:'parent',skillKey:'doubao-medical-literature-search',anchorQuestion:'WHO抑郁介绍'};
 for(const text of ['继续解释这些来源的适用范围，不新增检索','请说明第一条来源的局限','比较上述来源，不要再联网搜索']){const r=route(text,off,{previous});assert.equal(r.mode,'hub-smart-search',text);assert.equal(r.scope,'fixed-web-snapshot');assert.deepEqual(r.requiredTools,['hub_web_snapshot']);}
 assert.equal(route('重新检索WHO抑郁指南',on,{previous}).scope,'public-web');
});
test('network route receipt binds consent without invalidating old routes',()=>{
 const user={tenantId:'t',accountId:'a'},session={id:'s',agentId:'a',contextKey:'hub:x'},decision=route('查询公开针灸指南',on),skill={id:'k',key:'doubao-medical-literature-search',version:1,sourceHash:'x'};
 const args={user,session,text:'查询公开针灸指南',decision,skill,sourceBinding:'x',networkIntent:on};const r=bindSkillRoute(args);
 assert.equal(r.schema,'hub-medical-router.v2');assert.equal(typeof r.networkIntentHash,'string');
 assert.throws(()=>assertSkillRoute(r,{...args,networkIntent:off,availableTools:decision.requiredTools}));
});
