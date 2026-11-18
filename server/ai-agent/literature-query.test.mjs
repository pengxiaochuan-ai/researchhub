import test from 'node:test';import assert from 'node:assert/strict';
import * as query from './literature-query.mjs';
test('ordinary source and answer instructions do not block a clear Hub-only research question',()=>{
 const p=query.planLiteratureQuery('只用Hub已审核资料，不联网。检索针灸治疗抑郁的研究，列出来源和研究局限。');
 assert.equal(p.status,'ready');assert.equal(p.scope,'hub-only');assert(p.conceptGroups.some(g=>g.terms.includes('depression')));
 for(const q of ['只用Hub已审核资料，检索针灸治疗抑郁但排除青少年','只用Hub已审核资料，检索针灸治疗抑郁且样本量大于五十'])assert.equal(query.planLiteratureQuery(q).status,'clarify');
});
test('explicit only-Hub source remains offline even without the words already-reviewed',()=>{
 assert.equal(query.planLiteratureQuery('只用Hub检索针灸治疗抑郁').scope,'hub-only');
});
test('natural-language research task preserves question but compiles public concepts, date and design',()=>{
 const p=query.planLiteratureQuery('请在PubMed查找近五年针灸辅助治疗失眠的随机对照试验，简短比较证据。',{today:'2026-11-07'});
 assert.equal(p.status,'ready');assert(p.pubmedQuery.includes('insomnia'));assert(p.pubmedQuery.includes('acupuncture'));assert(p.pubmedQuery.includes('randomized controlled trial[Publication Type]'));assert(p.pubmedQuery.includes('2021/11/07'));assert.equal(p.scope,'hub-and-pubmed');assert.equal(p.question.startsWith('请在'),true);
});
test('Hub-only natural question stays local and common aliases are retrieval variants, not diagnosis mapping',()=>{
 const p=query.planLiteratureQuery('仅依据已审核资料，针灸治疗失眠研究有哪些局限？');assert.equal(p.status,'ready');assert.equal(p.scope,'hub-only');assert.equal(p.localPlan.mode,'mapped');assert(p.localPlan.conceptGroups.some(g=>g.terms.includes('insomnia')));assert.equal(p.semanticEquivalence,false);
});
test('unparsed constraints, unsafe data and ambiguous medical topic do not silently broaden a search',()=>{
 for(const q of ['查找针灸治疗失眠但排除产后患者','查找针灸治疗张三的失眠，电话13800138000','检索卑惵的文献','帮我检索文献'])assert.notEqual(query.planLiteratureQuery(q).status,'ready',q);
});
test('a different public theme and explicit years do not depend on one canned acupuncture question',()=>{
 const p=query.planLiteratureQuery('请检索2020到2024年电针治疗焦虑障碍的系统综述');assert.equal(p.status,'ready');assert(p.pubmedQuery.includes('electroacupuncture'));assert(p.pubmedQuery.includes('anxiety disorder'));assert(p.pubmedQuery.includes('2020:2024'));assert(p.pubmedQuery.includes('systematic review'));
});
test('explicit no-network scope cannot be overridden by a PubMed mention',()=>{
 for(const text of ['不要联网，在PubMed检索针灸治疗失眠','仅依据已审核资料，比较PubMed针灸治疗失眠文献'])assert.notEqual(query.planLiteratureQuery(text).scope,'hub-and-pubmed');
});
test('multiple or conflicting date windows require clarification instead of silently taking the last one',()=>{
 for(const text of ['检索2020到2021年和2023到2024年针灸治疗失眠的文献','检索近五年和近三年针灸治疗失眠的文献'])assert.equal(query.planLiteratureQuery(text).status,'clarify');
});
test('natural 两篇 requests exactly two results without losing the Hub-only restriction',()=>{
 const p=query.planLiteratureQuery('只用Hub已审核资料，不联网。检索针灸治疗抑郁的两篇研究，列出来源与局限。');
 assert.equal(p.status,'ready');assert.equal(p.maxResults,2);assert.equal(p.scope,'hub-only');
});
