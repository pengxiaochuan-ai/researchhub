import test from 'node:test';import assert from 'node:assert/strict';
import * as consistency from './direction-consistency.mjs';
import {acceptLiteratureOutput} from './literature-output.mjs';
import {literatureSynthesisInput} from './literature-session.mjs';
const sources=[
 {id:'P1',kind:'pubmed-live',pmid:'123',title:'A randomized controlled trial',coverage:'abstract',text:'We conducted a randomized controlled trial. Outcomes were assessed at baseline and seven months after treatment.'},
 {id:'P2',kind:'pubmed-live',pmid:'124',title:'A systematic review and meta-analysis',coverage:'abstract',text:'We included randomized controlled trials and used a random-effects model.'},
 {id:'P3',kind:'pubmed-live',pmid:'125',title:'Digital training and well-being',coverage:'abstract',text:'Participants were randomly assigned to intervention or control. Outcomes were assessed after six weeks.'},
 {id:'P4',kind:'pubmed-live',pmid:'126',title:'Randomized trial: study protocol',coverage:'abstract',text:'Participants will be randomly assigned. Outcomes will be assessed after twelve months.'},
];
const evidence={hash:'fixed',plan:{outputs:['summary','directions']},selected:sources};
const value=(rationale,limitation='需扩展检索并核对全文。')=>({summary:'这是有限资料。',items:sources.map(s=>({id:s.id,decision:'relevant',reason:'本次材料与问题相关。'})),limitations:'本次仅基于已读摘要。',directions:[{direction:'进一步比较干预方案及随访安排。',rationale,limitation,sourceIds:['P1']}]});
test('facts quote real locations and distinguish reviews, protocols, completed randomization and missing reporting',()=>{
 const facts=consistency.buildDirectionFacts(sources);assert.equal(facts.sources[0].design.kind,'randomized-trial');assert.equal(facts.sources[1].design.kind,'review');assert.equal(facts.sources[2].design.kind,'randomized-trial');assert.equal(facts.sources[3].design.kind,'protocol');
 assert.equal(facts.sources[0].followUp.state,'reported');assert.equal(facts.sources[1].followUp.state,'not-mentioned');assert.notEqual(facts.sources[3].followUp.state,'reported');
 for(const s of facts.sources)for(const q of s.quotes){const original=sources.find(x=>x.id===s.id)[q.field];assert.equal(original.slice(q.offset,q.offset+q.text.length),q.text);assert(q.hash);}
});
test('a global only-one-RCT claim cannot hide an opposing read article by citing only its own source subset',()=>{
 const x=acceptLiteratureOutput(JSON.stringify(value('现有研究仅文献一为随机对照试验。建议进一步严格比较。')),evidence);
 assert(!x.text.includes('仅文献一为随机对照试验'));assert(x.text.includes('建议进一步严格比较'));assert(x.text.includes('Participants were randomly assigned'));assert.equal(x.validation.directionPolicyVersion,'hub-direction-consistency.v3');
 assert(x.validation.directions[0].consistency.rationale.issues.some(i=>i.code==='DESIGN_EXCLUSIVITY_CONTRADICTION'&&i.checkedSourceIds.includes('P3')));
});
test('reported assessments contradict no-follow-up while no long-term threshold or absence inference is invented',()=>{
 const x=acceptLiteratureOutput(JSON.stringify(value('材料提示值得比较不同安排。','当前摘要未提供长期随访数据。原研究未比较长期效果。')),evidence);
 assert(!x.text.includes('当前摘要未提供长期随访数据'));assert(!x.text.includes('原研究未比较长期效果'));assert(x.text.includes('seven months'));assert(!x.text.includes('已证实长期随访'));
});
test('cautious negation and prospective study design are preserved, not mistaken for false absolute claims',()=>{
 const r='并非仅文献一是随机对照试验，文献三同样随机分组。不能断言缺乏长期随访。建议开展更严格的随机对照试验。';
 const x=acceptLiteratureOutput(JSON.stringify(value(r)),evidence);assert(x.text.includes(r));
});
test('wrong premises and their causal tails are withheld together but independent recommendations remain',()=>{
 const r='本领域尚无随机试验，因此可以首次证实疗效。因此证明干预有效。建议先扩大检索并核对证据。';
 const x=acceptLiteratureOutput(JSON.stringify(value(r)),evidence);assert(!x.text.includes('首次证实'));assert(!x.text.includes('因此证明'));assert(x.text.includes('建议先扩大检索'));assert(x.text.includes('待核对'));
});
test('limited evidence is not a field-wide gap; unsafe source references still fail instead of being repaired',()=>{
 const x=acceptLiteratureOutput(JSON.stringify(value('整个领域缺乏干预研究。')),evidence);assert(!x.text.includes('整个领域缺乏干预研究'));assert(x.text.includes('依据不足'));
 const bad=value('可进一步比较。');bad.directions[0].sourceIds=['P99'];assert.throws(()=>acceptLiteratureOutput(JSON.stringify(bad),evidence));
});
test('fixed evidence replay is deterministic and a review that mentions trials is never itself a completed trial',()=>{
 const a=consistency.buildDirectionFacts(sources),b=consistency.buildDirectionFacts(structuredClone(sources));assert.deepEqual(a,b);
 const x=acceptLiteratureOutput(JSON.stringify(value('文献二是随机对照试验。')),evidence);assert(!x.text.includes('文献二是随机对照试验'));assert(x.text.includes('systematic review'));
});
test('server supplies real fixed-source cues only to new direction synthesis, not legacy outputs or interpretation',()=>{
 const input=JSON.parse(literatureSynthesisInput({query:'研究方向',literature:evidence}));assert.deepEqual(input.directionFacts,consistency.buildDirectionFacts(sources));assert(input.directionCheck.includes('not-mentioned不等于'));
 const legacy={...evidence,plan:{outputs:['summary']}};assert(!JSON.parse(literatureSynthesisInput({query:'检索',literature:legacy})).directionFacts);
 const x=acceptLiteratureOutput(JSON.stringify(value('仅文献一是随机试验。')),legacy);assert(!x.validation.directionPolicyVersion);assert(!x.text.includes('原文核对提示'));
});
test('uncertain study design and absent abstract reporting are not silently inferred; negated descriptions survive',()=>{
 const input=[{id:'P1',title:'A non-randomized study',text:'Participants were not randomized. We did not conduct follow-up.'},{id:'P2',title:'Research design',text:'A random-effects model was used.'}];
 const facts=consistency.buildDirectionFacts(input);assert.equal(facts.sources[0].design.kind,'nonrandomized');assert.equal(facts.sources[0].followUp.state,'not-performed');assert.equal(facts.sources[1].design.kind,'uncertain');assert.equal(facts.sources[1].followUp.state,'not-mentioned');
 const e={...evidence,selected:sources};const v=value('文献二并非随机对照试验。');assert(acceptLiteratureOutput(JSON.stringify(v),e).text.includes('文献二并非随机对照试验'));
 const v2=value('本次已读材料没有随机试验。');assert(!acceptLiteratureOutput(JSON.stringify(v2),e).text.includes('本次已读材料没有随机试验'));
});
test('related summary, per-item descriptions and direction titles cannot bypass the same source check',()=>{
 const v=value('建议核对完整方案。');v.summary='整个领域尚无干预研究。';v.items[1].reason='文献二是随机对照试验。';v.directions[0].direction='本领域首次证实干预有效。';
 const x=acceptLiteratureOutput(JSON.stringify(v),evidence);assert(!x.text.includes(v.summary));assert(!x.text.includes(v.items[1].reason));assert(!x.text.includes(v.directions[0].direction));assert(x.validation.answerConsistency.summary.issues.length);
});
test('a local only-one assertion checks the cited set, not just the article named in its predicate',()=>{
 const v=value('本方向所引两篇中仅文献一为随机对照试验。');v.directions[0].sourceIds=['P1','P3'];
 assert(!acceptLiteratureOutput(JSON.stringify(v),evidence).text.includes(v.directions[0].rationale));
});
test('actual model source IDs are checked before rendering them as Chinese article labels',()=>{
 const r='现有研究多为单臂设计，仅P1为随机对照试验但幸福感改善不显著。';
 const x=acceptLiteratureOutput(JSON.stringify(value(r)),evidence);assert(!x.text.includes('仅文献一为随机对照试验'));assert(x.validation.directions[0].consistency.rationale.issues.some(i=>i.code==='DESIGN_EXCLUSIVITY_CONTRADICTION'));
});
test('study design is attributed to the same subject; a review may truthfully include trials',()=>{
 for(const r of ['文献一是随机对照试验，文献二是系统综述。','文献二是系统综述，纳入随机对照试验。','文献二不是随机对照试验。'])assert(acceptLiteratureOutput(JSON.stringify(value(r)),evidence).text.includes(r));
});
test('a suggestion or cautious prefix does not exempt a later unsupported premise',()=>{
 for(const r of ['建议开展更多研究，因为整个领域尚无随机试验。','不能断言整个领域没有研究，但本领域尚无随机试验。'])assert(!acceptLiteratureOutput(JSON.stringify(value(r)),evidence).text.includes(r));
});
test('explicit abstract self-description as a protocol outweighs a trial title; registered protocols of completed studies do not',()=>{
 const a=consistency.buildDirectionFacts([{id:'P1',title:'Acupuncture versus usual care: a randomized controlled trial',text:'This paper describes a study protocol. Participants will be randomly assigned. Outcomes will be assessed after twelve months.'}]).sources[0];
 assert.equal(a.design.kind,'protocol');assert.equal(a.followUp.state,'not-mentioned');assert(a.quotes.some(q=>q.text.includes('describes a study protocol')));
 const b=consistency.buildDirectionFacts([{id:'P1',title:'A randomized controlled trial',text:'We conducted a randomized controlled trial according to a registered protocol. Outcomes were assessed after six weeks.'}]).sources[0];assert.equal(b.design.kind,'randomized-trial');
});
test('Unicode assessment durations count as reported without imposing a long-term cutoff',()=>{
 const facts=consistency.buildDirectionFacts([{id:'P1',title:'Randomized controlled trial',text:'Outcomes were assessed at baseline and 1 and 3\u00a0months after treatment.'}]);assert.equal(facts.sources[0].followUp.state,'reported');assert(facts.sources[0].quotes.some(q=>q.text.includes('3\u00a0months')));
});
test('missing duration in an abstract and unreported longer outcomes are not claims that research did not happen',()=>{
 const e={...evidence,selected:[{...sources[0],text:'Participants were randomized. Outcomes improved during the follow-up period.'}]};
 for(const r of ['当前摘要未说明具体随访时长。','随机对照试验，未报告具体随访时长。','当前摘要未报告更长期结局。'])assert(acceptLiteratureOutput(JSON.stringify({...value(r),items:[{id:'P1',decision:'relevant',reason:r}]}),e).text.includes(r));
 const r='当前摘要未说明具体随访时长。';assert(!acceptLiteratureOutput(JSON.stringify(value(r)),evidence).text.includes(r));
});
test('unjustified follow-up duration labels and unperformed research gaps are not facts, but negative outcomes remain',()=>{
 for(const r of ['现有研究随访时间短，且未系统比较不同方案组合的长期效果。','缺乏针对特定人群的标准化方案。','文献五未单独分析针刺长期效果。','当前材料未同时测量生理和主观结局并分析关联。'])assert(!acceptLiteratureOutput(JSON.stringify(value(r)),evidence).text.includes(r));
 for(const r of ['当前材料未提供跨职业比较。','未发现症状显著改善，个人倦怠反而增加。'])assert(acceptLiteratureOutput(JSON.stringify(value(r)),evidence).text.includes(r));
});
test('an explicitly documented absence is preserved across follow-up synonyms, not removed again by the generic gap check',()=>{
 const e={...evidence,selected:[{...sources[0],text:'We did not conduct follow-up.'}]};
 for(const r of ['文献一未进行随访。','文献一未开展随访。'])assert(acceptLiteratureOutput(JSON.stringify({...value(r),items:[{id:'P1',decision:'relevant',reason:r}]}),e).text.includes(r));
});
