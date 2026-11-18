import test from 'node:test';
import assert from 'node:assert/strict';
import * as natural from './natural-literature-plan.mjs';
import {routeSkillTask} from './skill-routing.mjs';
const question='查询近1年关于 针灸治疗情志病领域相关的研究报告，论文，并总结新的研究方向';
const answer=()=>({status:'ready',concepts:[{seedId:40,label:'针灸',terms:[]},{seedId:1,label:'情志病',terms:[]}],date:{start:'2025-11-11',end:'2026-11-11'},design:'any',maxResults:6,scope:'hub-and-pubmed',outputs:['summary','directions'],unsupported:[],clarification:null});
const request=()=>natural.createLiteratureRequest(question,{today:'2026-11-11'});
test('original report query enters semantic planning without medical-report clarification',()=>{
 const r=routeSkillTask({text:question,context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true,asOf:'2026-11-11'});
 assert.equal(r.mode,'hub-literature-search');assert.equal(r.taskPlan.schema,'hub-literature-request.v2');assert.equal(r.taskPlan.question,question);
 for(const text of ['查询最新针灸治疗焦虑的研究报告','检索针灸治疗失眠的论文并概括后续研究方向'])assert.equal(routeSkillTask({text,context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true}).taskPlan.schema,'hub-literature-request.v2');
 assert.equal(routeSkillTask({text:'解读报告',context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true}).status,'clarify');
 assert.equal(routeSkillTask({text:'查询这次血常规报告的异常指标',context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true}).skillKey,'doubao-medical-report');
 assert.equal(routeSkillTask({text:'订阅每周针灸最新研究',context:{kind:'hub'},literatureEnabled:true,naturalPlanningEnabled:true}).mode,'unavailable');
});
test('server compiles original date and approved broad-domain retrieval variants, not invented diagnostic equivalence',()=>{
 const p=natural.acceptLiteraturePlan(JSON.stringify(answer()),request());
 assert.equal(p.status,'ready');assert.equal(p.schema,'hub-literature-query.v2');assert.equal(p.semanticEquivalence,false);
 assert(p.pubmedQuery.includes('2025/11/11:2026/11/11[Date - Publication]'));assert(p.pubmedQuery.includes('acupuncture'));assert(p.pubmedQuery.includes('depression'));assert(p.pubmedQuery.includes('insomnia'));assert(p.outputs.includes('directions'));assert.equal(p.requestHash,request().hash);
});
test('model cannot silently discard the date, primary topic, requested count or source ceiling',()=>{
 for(const patch of [{date:null},{date:{start:'2024-11-11',end:'2026-11-11'}},{concepts:[answer().concepts[0]]},{scope:'evil'},{tools:['web_search']},{unsupported:['排除青少年']}])assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),...patch}),request()));
 const r=natural.createLiteratureRequest('仅用Hub不联网，查询针灸抑郁的两篇论文',{today:'2026-11-11'});
 assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null}),r));
 assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,scope:'hub-only',maxResults:6}),r));
});
test('unknown public topic is accepted as structured search variants but query operators and urls never execute',()=>{
 const r=natural.createLiteratureRequest('查询正念干预职业倦怠的论文并总结研究方向',{today:'2026-11-11'});
 const value={...answer(),date:null,concepts:[{seedId:null,label:'正念',terms:['mindfulness']},{seedId:null,label:'职业倦怠',terms:['burnout']}]};
 assert(natural.acceptLiteraturePlan(JSON.stringify(value),r).pubmedQuery.includes('"mindfulness"[Title/Abstract]'));
 for(const term of ['x OR ALL[All Fields]','https://evil.example','x" OR "y','<script>'])assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...value,concepts:[{seedId:null,label:'正念',terms:[term]}]}),r));
});
test('unsupported restrictions remain explicit and model clarification is never called a retrieval',()=>{
 const r=natural.createLiteratureRequest('查询针灸治疗失眠但排除青少年的论文',{today:'2026-11-11'});
 assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,concepts:[answer().concepts[0],{seedId:12,label:'失眠',terms:[]}]}),r));
 assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({status:'clarify',clarification:'希望限定哪类研究人群？'}),request()),e=>e.code==='HUB_LITERATURE_PLAN_CLARIFICATION'&&e.publicMessage.includes('研究人群'));
});
test('explicit trial design cannot be silently dropped from a model plan',()=>{
 const r=natural.createLiteratureRequest('检索针灸的随机对照试验',{today:'2026-11-11'});
 assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,concepts:[answer().concepts[0]],outputs:['summary']}),r));
});
test('common offline wording and month/year date forms retain the user limits',()=>{
 for(const q of ['只使用Hub已审核资料查询针灸论文','无需联网，查询针灸论文','只用本地资料查询针灸论文']){
  const r=natural.createLiteratureRequest(q,{today:'2026-11-11'});assert.equal(r.sourceCeiling,'hub-only');
  assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,concepts:[answer().concepts[0]],outputs:['summary']}),r));
 }
 for(const q of ['查询2025年到2026年针灸论文','查询近12个月针灸论文']){
  const r=natural.createLiteratureRequest(q,{today:'2026-11-11'});assert(r.expectedDate);assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,concepts:[answer().concepts[0]],outputs:['summary']}),r));
 }
});
test('rolling months clamp to month end instead of overflowing into the same month',()=>{
 for(const [today,start]of [['2026-03-31','2026-02-28'],['2024-03-31','2024-02-29']])assert.equal(natural.createLiteratureRequest('查询近1个月针灸论文',{today}).expectedDate.start,start);
});
test('invalid zero-result request is not silently replaced with six',()=>{
 const r=natural.createLiteratureRequest('查询针灸的0篇论文',{today:'2026-11-11'});assert.throws(()=>natural.acceptLiteraturePlan(JSON.stringify({...answer(),date:null,concepts:[answer().concepts[0]],outputs:['summary']}),r));
});
