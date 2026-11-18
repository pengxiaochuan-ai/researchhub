import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArticleResponse,verifyArticleResponse} from './article-response-policy.mjs';
const saved=JSON.parse(readFileSync('docs/testing/fixtures/article-response-sjogren-2026-11-06.json'));
saved.pack.fragments[0].text='This single-center RCT was approved by the ethics committee.';
const raw=text=>({...structuredClone(saved.response),researchType:{text,fragmentIds:['fragment-1'],kind:'interpretation'}});
const v4=text=>parseArticleResponse(JSON.stringify(raw(text)),saved.pack,{policy:'rh-article-response.v4'});
test('mixed sentence keeps the original non-result leading clauses but not the numerical claim',()=>{
 const r=v4('本研究为随机对照试验；随访仅至14天，无法评估长期疗效。');
 assert(r.text.includes('本研究为随机对照试验。'));assert(!r.text.includes('随访仅至14天'));
 const s=r.validation.sections[0];assert.equal(s.action,'annotated');assert(s.checks.some(c=>c.kind==='qualitative-prefix'));assert.doesNotThrow(()=>verifyArticleResponse(r.validation,saved.pack,r.text));
});
test('contrast, conditions, null results and efficacy claims must not be severed from numerical context',()=>{
 for(const text of ['治疗有效，但仅纳入8例。','研究提示改善，差异不显著（p=0.8）。','如果治疗8周，研究设计合理。','研究采用随机分组，但只有8人完成。','研究提示显著优于对照，评分降低8分。','未排除失访偏倚，纳入8人。','该方案可改善预后，样本8例。','干预降低复发风险，随访14天。','研究采用随机分组，而非按就诊顺序分组，样本8例。','未发现显著疗效，评分降低8分。','本研究为随机对照试验，前提是样本达到8人。','本研究为随机对照试验，是否成立取决于8周后的核查。','该干预可缓解症状，纳入8人。','联合治疗具有优势，样本8例。','干预呈现统计学差异，样本8人。'])assert.equal(v4(text).validation.sections[0].action,'withheld',text);
});
test('punctuation inside parentheses and quotations does not create a safe boundary',()=>{
 for(const text of ['研究设计（分组，8人），未明确盲法。','作者称“研究设计，8人有效”，需要复验。','研究设计（分组，8人。',"作者称'研究设计，8人有效'，需要复验。",'作者称『研究设计，8人有效』，需要复验。',"本研究为随机对照试验，备注'8人。",'本研究为随机对照试验，备注『8人。'])assert.equal(v4(text).validation.sections[0].action,'withheld',text);
});
test('v3 is rebuilt unchanged, v4 cannot be relabeled as a historical receipt',()=>{
 const text='本研究为随机对照试验，随访14天。',body=JSON.stringify(raw(text));
 const old=parseArticleResponse(body,saved.pack,{policy:'rh-article-response.v3'});assert.equal(old.validation.schema,'rh-article-response.v3');assert.equal(old.validation.sections[0].action,'withheld');assert.doesNotThrow(()=>verifyArticleResponse(old.validation,saved.pack,old.text));
 const current=v4(text);assert.equal(current.validation.schema,'rh-article-response.v4');assert.equal(current.validation.sections[0].action,'annotated');assert.throws(()=>verifyArticleResponse({...current.validation,schema:'rh-article-response.v3'},saved.pack,current.text));
 assert.throws(()=>parseArticleResponse(body,saved.pack,{policy:'unknown'}));
});
test('a later-sentence prefix has an exact original offset and repaired citation text is not rescued',()=>{
 const text='作者说明研究背景。本研究为随机对照试验，随访14天。',r=v4(text),c=r.validation.sections[0].checks.find(c=>c.kind==='qualitative-prefix');
 assert.equal(c.offset,'作者说明研究背景。'.length);assert.equal(text.slice(c.offset,c.cutAt),'本研究为随机对照试验');assert.equal(c.text,'本研究为随机对照试验。');
 assert(!v4('本研究[1]采用随机分组，随访14天。').validation.sections[0].checks.some(c=>c.kind==='qualitative-prefix'));
});
test('unknown or contradicted source descriptions are not rescued as verified qualitative prose',()=>{
 const pack=structuredClone(saved.pack);pack.fragments[0].text='The prior literature suggested a trial; no current randomized study was performed.';
 const r=parseArticleResponse(JSON.stringify(raw('本研究为随机对照试验，随访14天。')),pack);
 assert.equal(r.validation.sections[0].action,'withheld');assert.equal(v4('作者认为方案合理，样本8例。').validation.sections[0].action,'withheld');
 for(const source of ['This single-center RCT was not performed.','Prior authors wrote: This single-center RCT was approved by the ethics committee.','This single-center RCT was approved by a committee but not performed.']){
  pack.fragments[0].text=source;assert.equal(parseArticleResponse(JSON.stringify(raw('本研究为单中心随机对照试验，随访14天。')),pack).validation.sections[0].action,'withheld');
 }
 pack.fragments[0].text='It is incorrect that all outcome measures were subjective scales and lacked objective or biomarker-based endpoints.';
 assert.equal(parseArticleResponse(JSON.stringify(raw('所有结局均为主观量表，缺乏客观或生物标志物终点；随访14天。')),pack).validation.sections[0].action,'withheld');
});
