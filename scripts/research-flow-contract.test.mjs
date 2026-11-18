import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parsePlanCandidate,renderCandidate,stagePrompt} from './research-plan-contract.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {buildResearchStudyPlanDraft}=require('../../app/server/src/research-evidence/research-study-plan.ts');
const sources=[{docId:'synthetic-flow',version:1,quote:'合成材料拟探索针灸辅助常规治疗成人抑郁障碍，对照、结局和时间待研究者确认。'}];
const pico={question:'针灸辅助常规治疗是否具有研究可行性？',p:'成人抑郁障碍',i:'针灸辅助常规治疗',c:'常规治疗（研究者候选意图）',o:'抑郁症状变化（评估时点待方法学确认）'};
const model={title:'合成研究候选',hypothesis:'仅为尚待验证的研究意图[1]。',design:'沿用已确认PICO，具体方法尚待确认[1]。',limitations:['对照条件、结局指标、评估时点和研究设计均未确定，无法形成可执行方案[1]']};
test('unscoped material-missing statement from actual E2E cannot be accepted as current PICO status',()=>{
 assert.throws(()=>parsePlanCandidate(JSON.stringify(model),sources,pico,buildResearchStudyPlanDraft),/PLAN_LIMITATION_SCOPE_INVALID/);
});
test('confirmed intent and original-material gaps stay separate from unresolved methodology',()=>{
 const scoped={...model,limitations:['资料证据局限：原合成资料未提供对照与结局的证据，不能作为疗效结论[1]。']};
 const candidate=parsePlanCandidate(JSON.stringify(scoped),sources,pico,buildResearchStudyPlanDraft),body=renderCandidate(pico,candidate);
 assert.ok(candidate.outline.design.populationFrame.includes(pico.p));
 assert.ok(candidate.outline.design.comparatorFrame.includes(pico.c));
 assert.ok(candidate.outline.design.outcomeFrame.includes(pico.o));
 assert.equal(candidate.outline.analysisPlan.analysisPopulation,candidate.outline.design.populationFrame);
 assert.ok(candidate.outline.unresolvedMethodParameters.includes('已确认结局方向的操作定义、评估时点与证据来源'));
 assert.ok(!candidate.outline.unresolvedMethodParameters.includes('主要结局及其来源'));
 assert.match(body,/原资料证据局限（不撤销已确认PICO意图）/);
 assert.match(body,/材料未报告不等于研究者尚未确认/);
 assert.ok(body.includes(pico.c)&&body.includes(pico.o));
 assert.match(stagePrompt('protocol',pico),/每条limitations必须以“资料证据局限：”开头/);
});
