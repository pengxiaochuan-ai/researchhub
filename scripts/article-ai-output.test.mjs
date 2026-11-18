import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as api from './article-ai-output.mjs';

const pack={policyVersion:'rh-article-evidence-v2',binding:{recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1'},
  source:{doi:'10.9999/synthetic'},fragments:[{id:'fragment-1',complete:true,text:'Rating scores changed.'}]};
test('single-article qualitative guard rejects copied values, unicode numbers, number words and quantitative relations',async()=>{
  const {assertArticleQualitativeAnswer}=await import('./article-ai-output.mjs');
  for(const text of ['PSQI从14降至8。[1]','评分从１４降至８。[1]','干预四周后改善。[1]','two weeks of intervention [1]','睡眠时长翻倍。[1]'])
    assert.throws(()=>assertArticleQualitativeAnswer(text,pack),/ARTICLE_AI_NUMERIC_REJECTED/,text);
});
test('qualitative explanation permits verified citation and fragment identifiers but not forged fragment references',async()=>{
  const {assertArticleQualitativeAnswer,articleOutputInstructions}=await import('./article-ai-output.mjs');
  assertArticleQualitativeAnswer('单病例作者报告症状变化，但缺少对照，不能推断因果。[1] fragment-1',pack);
  assertArticleQualitativeAnswer('1. 研究类型为病例报告。[1]\n2. 不能外推疗效。[1]',pack);
  assert.throws(()=>assertArticleQualitativeAnswer('有依据。[1] fragment-9',pack),/ARTICLE_AI_NUMERIC_REJECTED/);
  assert.match(articleOutputInstructions(pack),/定性/);assert.match(articleOutputInstructions(pack),/原文数值/);
});
test('saved owner answer is rejected by new quantitative guard without rewriting historical answer',async()=>{
  const {assertArticleQualitativeAnswer}=await import('./article-ai-output.mjs');
  const saved=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-b07-8264b496-4382-4391-bf5f-b00db15c7924/owner-result.json'));
  assert.throws(()=>assertArticleQualitativeAnswer(saved.answer.content,pack),/ARTICLE_AI_NUMERIC_REJECTED/);
});
test('incomplete fragment text is explicitly not admitted as a model claim basis',async()=>{
  const {assertArticleQualitativeAnswer}=await import('./article-ai-output.mjs');
  assert.throws(()=>assertArticleQualitativeAnswer('作者报告改善。[1]',{...pack,fragments:[{id:'fragment-1',complete:false}]}),/ARTICLE_AI_EVIDENCE_INCOMPLETE/);
});
test('written quantities cannot bypass the guard through compound multipliers or Chinese half expressions',async()=>{
  const {assertArticleQualitativeAnswer}=await import('./article-ai-output.mjs');
  for(const text of ['Scores increased threefold. [1]','twenty weeks of intervention [1]','评分减少一半。[1]'])
    assert.throws(()=>assertArticleQualitativeAnswer(text,pack),/ARTICLE_AI_NUMERIC_REJECTED/,text);
});

const rejected=JSON.parse(readFileSync('docs/testing/evidence/article-ai-b08-failed-readback-86779ea9-20f8-4bba-beaf-71d005c5eb57/rejected-response.json'));
test('single-article provider messages preserve all six real fragments beyond legacy synthesis clipping',()=>{
 assert.equal(typeof api.articleModelMessages,'function');const q='只作定性解释并核对局限';
 const messages=api.articleModelMessages('旧受控系统边界',q,rejected.pack),actual=JSON.parse(messages[1].content);
 assert.equal(messages.length,2);assert.equal(actual.question,q);assert.equal(actual.fragments.length,6);
 for(let i=0;i<6;i++)assert.equal(actual.fragments[i].text,rejected.pack.fragments[i].text);
 const proof=api.articleModelInputProof(messages,rejected.pack,q);assert.equal(proof.packHash,rejected.pack.packHash);assert.equal(proof.fragments.length,6);
 assert.throws(()=>api.articleModelInputProof(rejected.actualProviderMessages,rejected.pack,q),/ARTICLE_MODEL_INPUT_CHANGED/);
 const changed=structuredClone(messages);changed[1].content=messages[1].content.slice(0,4000);assert.throws(()=>api.articleModelInputProof(changed,rejected.pack,q),/ARTICLE_MODEL_INPUT_CHANGED/);
});
const response=()=>Object.fromEntries(['researchType','observations','limitations','relevance'].map(k=>[k,{text:'作者报告临床观察，缺少对照，不能推断因果。',fragmentIds:['fragment-1']}]));
test('a sourced single-case description is not rejected merely for saying 一例 or 一名患者',()=>{
 const r=response();r.researchType.text='本文为单病例报告，描述一例慢性产后失眠共病情志障碍患者的临床过程。';
 assert.doesNotThrow(()=>api.renderArticleModelResponse(JSON.stringify(r),rejected.pack));
 r.researchType.text='本文为单病例报告，描述一名患者的临床过程。';assert.doesNotThrow(()=>api.renderArticleModelResponse(JSON.stringify(r),rejected.pack));
 for(const p of [{...rejected.pack,coverage:{articleType:'review'}},{...rejected.pack,source:{...rejected.pack.source,title:'A clinical review'}},{...rejected.pack,fragments:[{...rejected.pack.fragments[0],text:'The article discusses symptoms.'}]}])assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),p),/ARTICLE_AI_NUMERIC_REJECTED/);
 r.researchType.text='纳入两例患者，治疗四周。';assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),rejected.pack),/ARTICLE_AI_NUMERIC_REJECTED/);
 for(const text of ['一例患者接受针灸，另一例患者接受药物治疗。','本文为单病例报告，描述一名患者；另一位患者接受对照治疗。','本文为单病例报告，描述一名患者，观察另一名患者。']){r.researchType.text=text;assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),rejected.pack),/ARTICLE_AI_NUMERIC_REJECTED/);}
});
test('Chinese duration and bare scientific score cannot bypass source evidence by spelling out quantities',()=>{
 for(const text of ['该患者接受四个星期的治疗。','评分降至七。','PSQI评分为七。','随访了八个礼拜。','疗程共四个阶段。','评分降至七左右。','样本量为二十余。','评分降至七且持续稳定。'])assert.throws(()=>api.assertArticleQualitativeAnswer(text,pack),/ARTICLE_AI_NUMERIC_REJECTED/,text);
 for(const text of ['评分变化方向一致。','评分一般，仍需核对。','评分进一步改善。'])assert.doesNotThrow(()=>api.assertArticleQualitativeAnswer(text,pack));
});
test('numeric evidence is rendered from exact complete source context, never model-generated quantities',()=>{
 const p={...pack,packHash:'a'.repeat(64),fragments:[{id:'fragment-1',field:'body',offset:50,length:84,text:'The study enrolled 20 patients. Treatment lasted 4 weeks, followed by 8 weeks of follow-up.',textHash:'b'.repeat(64),complete:true}]};
 assert.equal(typeof api.buildArticleNumericFacts,'function');
 const [fact]=api.buildArticleNumericFacts(p);assert.equal(fact.text,p.fragments[0].text);assert.equal(fact.fragmentId,'fragment-1');
 const r=response();r.observations.numericFactIds=[fact.id];
 const parsed=api.parseArticleModelResponse(JSON.stringify(r),p);assert(parsed.text.includes(p.fragments[0].text));assert.equal(parsed.numericEvidence.length,1);
 assert.deepEqual(parsed.numericEvidence[0].binding,p.binding);assert.equal(parsed.numericEvidence[0].offset,50);assert.equal(parsed.numericEvidence[0].packHash,'a'.repeat(64));
 assert.doesNotThrow(()=>api.assertArticleQualitativeAnswer(parsed.text,p,{numericEvidence:parsed.numericEvidence}));
 for(const text of ['治疗8周后改善。','20名患者全部有效。','有效率为100%。']){const wrong=structuredClone(r);wrong.observations.text=text;assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(wrong),p),/ARTICLE_AI_NUMERIC_REJECTED/);}
 for(const field of ['text','offset','packHash','fragmentId','binding']){const tampered=structuredClone(parsed.numericEvidence);tampered[0][field]=field==='offset'?51:'forged';assert.throws(()=>api.assertArticleQualitativeAnswer(parsed.text,p,{numericEvidence:tampered}),/ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED/);}
});
test('numeric facts require same chosen fragment, same version and complete non-table context',()=>{
 const text='The study enrolled 20 patients and followed them for 8 weeks.',p={...pack,packHash:'c'.repeat(64),fragments:[{id:'fragment-1',field:'body',offset:0,length:text.length,text,complete:true},{id:'fragment-2',field:'body',offset:100,length:24,text:'Only qualitative context.',complete:true}]};
 assert.equal(typeof api.buildArticleNumericFacts,'function');const [fact]=api.buildArticleNumericFacts(p),r=response();r.researchType.numericFactIds=[fact.id];
 r.researchType.fragmentIds=['fragment-2'];assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),p),/ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED/);
 r.researchType.fragmentIds=['fragment-1'];assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),{...p,packHash:'d'.repeat(64)}),/ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED/);
 r.researchType.numericFactIds=['fact-forged'];assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),p),/ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED/);
 assert.deepEqual(api.buildArticleNumericFacts({...p,fragments:[{...p.fragments[0],field:'table'}]}),[]);
 assert.deepEqual(api.buildArticleNumericFacts({...p,fragments:[{...p.fragments[0],complete:false}]}),[]);
});
test('model receives server-owned numeric contexts and version proof, not permission for free numerical rewriting',()=>{
 const m=api.articleModelMessages('受控边界','核对原文数量和适用语境',rejected.pack),data=JSON.parse(m[1].content),proof=api.articleModelInputProof(m,rejected.pack,data.question);
 assert.equal(data.numericPolicyVersion,'rh-article-numeric-evidence.v1');assert(data.numericFacts.length>0);assert.equal(proof.schema,'rh-article-model-input.v2');assert.match(m[0].content,/numericFactIds/);assert.match(m[0].content,/完整.*语境/);
 assert.doesNotMatch(m[0].content,/连原文的一例、一名/);
});
test('explicit case follow-up duration can be transcribed from its chosen full context, not another time role',()=>{
 const r=response();r.limitations={text:'单病例无对照；随访仅四周，长期疗效不确定。',fragmentIds:['fragment-4']};
 const parsed=api.parseArticleModelResponse(JSON.stringify(r),rejected.pack);assert.equal(parsed.numericEvidence.length,1);assert.equal(parsed.numericEvidence[0].fragmentId,'fragment-4');assert.match(parsed.text,/four-week follow-up/);assert.doesNotThrow(()=>api.assertArticleQualitativeAnswer(parsed.text,rejected.pack,{numericEvidence:parsed.numericEvidence}));
 for(const text of ['治疗仅四周，长期疗效不确定。','随访仅八周，长期疗效不确定。','并非随访仅四周，长期疗效不确定。','随访四周以上，长期疗效不确定。']){r.limitations.text=text;assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(r),rejected.pack),/ARTICLE_AI_NUMERIC_REJECTED/);}
 r.limitations.text='单病例无对照；随访仅四周，长期疗效不确定。';r.limitations.fragmentIds=['fragment-2'];assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(r),rejected.pack),/ARTICLE_AI_NUMERIC_REJECTED/);
 const changed=structuredClone(rejected.pack);changed.fragments.find(f=>f.id==='fragment-4').text='The short four-week treatment limits conclusions.';r.limitations.fragmentIds=['fragment-4'];assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(r),changed),/ARTICLE_AI_NUMERIC_REJECTED/);
 for(const source of ['A four-week follow-up was not performed.','There was no four-week follow-up.','The short 1.4-week follow-up limits generalizability.','The short 3–4-week follow-up limits generalizability.','Prior literature recommends a four-week follow-up, but this patient had an eight-week follow-up.']){changed.fragments.find(f=>f.id==='fragment-4').text=source;assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(r),changed),/ARTICLE_AI_NUMERIC_REJECTED/,source);}
 for(const prefix of ['A limitation of a previous case report is described below. ','The following limitation does not apply to this case. ']){changed.fragments.find(f=>f.id==='fragment-4').text=prefix+'The short four-week follow-up limits conclusions regarding long-term efficacy stability.';assert.throws(()=>api.parseArticleModelResponse(JSON.stringify(r),changed),/ARTICLE_AI_NUMERIC_REJECTED/,prefix);}
});
test('model instructions preserve methodology scope and attribute secondary guideline claims',()=>{
 const prompt=api.articleModelMessages('受控边界','说明研究类型与适用范围',rejected.pack)[0].content;
 assert.match(prompt,/叙述性综述本身.*底层研究/);assert.match(prompt,/新兴疗法.*不能扩大/);assert.match(prompt,/综述转述指南/);assert.match(prompt,/不能直接建议临床实施/);
});
test('structured qualitative reply renders verified fragment choices without requiring model-made citation numbering',()=>{
 assert.equal(typeof api.renderArticleModelResponse,'function');const text=api.renderArticleModelResponse(JSON.stringify(response()),rejected.pack);assert.match(text,/## 结论/);assert.match(text,/fragment-1/);assert.match(text,/\[1\]/);
 for(const mutation of ['unknown','missing','extra','numeric','grade','empty','duplicate','embedded']){
  const r=response();if(mutation==='unknown')r.researchType.fragmentIds=['fragment-99'];if(mutation==='missing')delete r.limitations;if(mutation==='extra')r.extra='forged';if(mutation==='numeric')r.observations.text='四周随访后改善';if(mutation==='grade')r.relevance.text='本病例构成弱推荐';if(mutation==='empty')r.limitations.fragmentIds=[];if(mutation==='duplicate')r.researchType.fragmentIds=['fragment-1','fragment-1'];if(mutation==='embedded')r.relevance.text='其他结论[2]';
  assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),rejected.pack),/ARTICLE_AI_/,mutation);
 }
});
test('recommendation grades require the explicitly chosen evidence rather than another fragment or paper',()=>{
 assert.throws(()=>api.assertArticleQualitativeAnswer('属于弱推荐。[1]',rejected.pack),/ARTICLE_AI_RECOMMENDATION_REJECTED/);
 const p={...pack,fragments:[...pack.fragments,{id:'fragment-2',complete:true,text:'Guidelines provide a weak recommendation for post-treatment anxiety in women with breast cancer.'}]};
 const r=response();r.relevance={text:'综述转述针刺用于治疗后焦虑的弱推荐，乳腺癌女性限定不可丢失。',fragmentIds:['fragment-2']};
 assert.doesNotThrow(()=>api.renderArticleModelResponse(JSON.stringify(r),p));r.relevance.fragmentIds=['fragment-1'];assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(r),p),/ARTICLE_AI_RECOMMENDATION_REJECTED/);
});
test('real full-input reply that drops the cited weak recommendation is rejected rather than silently strengthened',()=>{
 const saved=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-b08-remaining-61b6536a-3db1-4790-b708-592a70a8e9f4/admin-result.json'));
 assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(saved.provider.structuredResponse),saved.answer.meta.provenance.articleEvidence),/ARTICLE_AI_RECOMMENDATION_MISSING/);
 const fixed=structuredClone(saved.provider.structuredResponse);fixed.observations.text='综述转述针灸用于治疗后焦虑的弱推荐，尤其针对乳腺癌女性，证据仍有限，不能推断普遍疗效。';fixed.relevance.text='可用于规划癌症相关情绪症状的后续研究；针灸的弱推荐受治疗后焦虑与乳腺癌女性等范围限制，不能代替新研究验证。';
 assert.doesNotThrow(()=>api.renderArticleModelResponse(JSON.stringify(fixed),saved.answer.meta.provenance.articleEvidence));
});
test('hand-reviewed qualitative references preserve limitations and render for each real pack without replacing stored answers',()=>{
 const references=JSON.parse(readFileSync('docs/testing/fixtures/article-qualitative-reference-2026-11-04.json'));
 const admin=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-b08-remaining-61b6536a-3db1-4790-b708-592a70a8e9f4/admin-result.json'));
 for(const [role,p]of [['owner',rejected.pack],['admin',admin.answer.meta.provenance.articleEvidence]]){const text=api.renderArticleModelResponse(JSON.stringify(references[role]),p);assert.match(text,/## 局限与下一步/);assert.doesNotThrow(()=>api.assertArticleQualitativeAnswer(text,p));}
});
test('real case reply cannot translate treatment cessation as stopping a drug not supported by its chosen evidence',()=>{
 const saved=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-acceptance-d8155d12-a8d1-4289-a0e5-593f72f3a32c/owner-result.json')),p=saved.answer.meta.provenance.articleEvidence;
 assert.throws(()=>api.renderArticleModelResponse(JSON.stringify(saved.provider.structuredResponse),p),/ARTICLE_AI_MEDICATION_CESSATION_REJECTED/);
 const reference=structuredClone(saved.provider.structuredResponse);reference.relevance.text='作者报告联合干预结束后的病例观察，不能据此确定普遍安全有效或临床适用性；需随机对照、假对照、客观睡眠记录和延长随访验证。';
 assert.doesNotThrow(()=>api.renderArticleModelResponse(JSON.stringify(reference),p));
 assert.match(api.articleModelMessages('受控边界','核对治疗结束与测量局限',p)[0].content,/treatment cessation.*不能.*停药/);
});
test('fresh real case reply passes current guards without replacing the previous rejected translation',()=>{
 const saved=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-acceptance-6d497178-5479-4500-9ce7-5a1ff731663d/owner-result.json')),p=saved.answer.meta.provenance.articleEvidence;
 assert.equal(api.renderArticleModelResponse(JSON.stringify(saved.provider.structuredResponse),p),saved.answer.content);assert.match(saved.answer.content,/单病例/);assert.match(saved.answer.content,/主观问卷和睡眠日记/);assert.match(saved.answer.content,/部分残留/);assert.doesNotMatch(saved.answer.content,/停药后/);
});
