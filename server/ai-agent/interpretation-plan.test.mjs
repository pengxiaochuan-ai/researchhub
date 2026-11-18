import test from 'node:test';import assert from 'node:assert/strict';
import * as interpretation from './interpretation-plan.mjs';
import {routeSkillTask} from './skill-routing.mjs';
const retrieval={jobId:'owned-search',hash:'evidence-hash',selected:[{id:'H1',title:'Hub paper'},{id:'P1',pmid:'123',title:'Protocol'},{id:'P2',pmid:'456',title:'Completed trial'}]};
test('single ordinal and exact PMID select only actual returned papers; multiple selection never silently truncates',()=>{
 assert.deepEqual(interpretation.planInterpretation('解读第三篇的研究局限',{retrieval}).selectedIds,['P2']);
 assert.deepEqual(interpretation.planInterpretation('解读PMID123',{retrieval}).selectedIds,['P1']);
 assert.deepEqual(interpretation.planInterpretation('比较上述三篇论文',{retrieval}).selectedIds,['H1','P1','P2']);
 for(const text of ['解读第四篇','解读PMID999','解读这篇','解读上述四篇论文','比较上述文献并计算合并效应','解读第三篇患者张三的病历'])assert.equal(interpretation.planInterpretation(text,{retrieval}).status,'clarify',text);
});
test('S02 interpretation follows an owned real retrieval, not a new search or the legacy fixed-article adapter',()=>{
 const decision=routeSkillTask({text:'解读第三篇的研究局限',context:{kind:'hub'},interpretationEnabled:true,retrieval});
 assert.equal(decision.mode,'hub-literature-interpretation');assert.equal(decision.skillKey,'doubao-medical-literature-interpretation');assert.equal(decision.taskPlan.parentJobId,'owned-search');assert.equal(decision.taskPlan.parentEvidenceHash,'evidence-hash');
 assert(!decision.requiredTools.includes('pubmed_search_articles'));
 assert.equal(routeSkillTask({text:'解读第一篇的研究方案',context:{kind:'hub'},interpretationEnabled:true,retrieval}).mode,'hub-literature-interpretation');
 assert.notEqual(routeSkillTask({text:'解读第三篇并检索其他论文',context:{kind:'hub'},interpretationEnabled:true,retrieval,literatureEnabled:true}).mode,'hub-literature-interpretation');
 assert.equal(routeSkillTask({text:'解读第三篇',context:{kind:'hub'},interpretationEnabled:true}).status,'clarify');
 assert.equal(routeSkillTask({text:'解释这篇文章',context:{kind:'article'},interpretationEnabled:true}).mode,'existing-fixed-article');
});
test('continuation keeps the prior selection and parent hash, even when a new retrieval exists',()=>{
 const taskPlan=interpretation.planInterpretation('解读第三篇的研究局限',{retrieval});
 const next=interpretation.planInterpretation('继续',{retrieval,priorPlan:taskPlan,continuation:true});assert.deepEqual(next.selectedIds,['P2']);assert.equal(next.parentEvidenceHash,'evidence-hash');
 assert.equal(interpretation.planInterpretation('继续',{retrieval:{...retrieval,hash:'changed'},priorPlan:taskPlan,continuation:true}).status,'clarify');
});
test('partially consumed selection syntax and exclusions clarify rather than charging for the wrong set',()=>{
 for(const text of ['比较第一篇和PMID123','比较第一、第二篇','比较第一篇和最后一篇','解读第二篇但不要第三篇'])assert.equal(interpretation.planInterpretation(text,{retrieval}).status,'clarify',text);
 assert.deepEqual(interpretation.planInterpretation('比较第一篇和第二篇',{retrieval}).selectedIds,['H1','P1']);
});
