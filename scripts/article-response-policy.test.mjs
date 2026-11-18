import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArticleResponse,verifyArticleResponse,articleResponseMessages,articleResponseInputProof} from './article-response-policy.mjs';
import * as responsePolicy from './article-response-policy.mjs';
import {assertAnswer} from './knowledge-ai-contract.mjs';
const saved=JSON.parse(readFileSync('docs/testing/fixtures/article-response-sjogren-2026-11-06.json'));
const fresh=()=>structuredClone(saved.response),parse=(r,p=saved.pack)=>parseArticleResponse(JSON.stringify(r),p);
const section=(r,key)=>r.validation.sections.find(s=>s.key===key);
test('model input supplies an explicit nested output shape; flat output without selected sources is not silently repaired',()=>{
 const m=articleResponseMessages('原Agent系统提示','概括设计与局限，不新增计算',saved.pack),body=JSON.parse(m[1].content);
 assert.deepEqual(Object.keys(body.responseShape).sort(),['limitations','observations','relevance','researchType']);
 for(const value of Object.values(body.responseShape)){assert.equal(typeof value.text,'string');assert(Array.isArray(value.fragmentIds));}
 assert.match(m[0].content,/不能是字符串/);
 const flat=Object.fromEntries(Object.keys(body.responseShape).map(k=>[k,'没有片段归属的解释']));assert.throws(()=>parse(flat),/ARTICLE_AI_SCHEMA_REJECTED/);
 assert.doesNotThrow(()=>articleResponseInputProof(m,saved.pack,'概括设计与局限，不新增计算'));
});
test('system source quote URLs survive delivery without exposing them to the model-link sanitizer',()=>{
 assert.equal(typeof responsePolicy.articleCoreText,'function','missing validated core projection');
 const {articleCoreText,restoreArticleCoreResult}=responsePolicy;
 const p=structuredClone(saved.pack);p.fragments[0].text='Trial with 30 participants. Registered at https://clinicaltrials.gov/study/NCT12345678.';
 const facts=JSON.parse(articleResponseMessages('系统','核对注册来源',p)[1].content).numericFacts;
 const raw=fresh();raw.researchType.numericFactIds=[facts.find(f=>f.fragmentId==='fragment-1').id];
 const accepted=parse(raw,p),core=articleCoreText(accepted);
 assert(!core.includes('https://clinicaltrials.gov'));assert(accepted.text.includes('https://clinicaltrials.gov'));
 const result={finalText:core,provenance:{dataBoundaryBlocked:false,numericBoundaryBlocked:false}};
 const delivered=restoreArticleCoreResult(result,accepted,p);
 assert.equal(delivered.finalText,accepted.text);assert.deepEqual(delivered.provenance,result.provenance);
 assert.throws(()=>restoreArticleCoreResult({...result,finalText:core+'改写'},accepted,p),/ARTICLE_MODEL_RESULT_CHANGED/);
 for(const key of ['dataBoundaryBlocked','numericBoundaryBlocked'])assert.throws(()=>restoreArticleCoreResult({...result,provenance:{[key]:true}},accepted,p),/ARTICLE_MODEL_RESULT_CHANGED/);
 const altered=structuredClone(accepted);altered.text+='伪造';assert.throws(()=>restoreArticleCoreResult(result,altered,p),/ARTICLE_RESPONSE_CHANGED/);
 const last=fresh();delete last.researchType.numericFactIds;delete last.observations.numericFactIds;delete last.limitations.numericFactIds;last.relevance.numericFactIds=raw.researchType.numericFactIds;last.relevance.fragmentIds=['fragment-1'];
 const trailing=parse(last,p);assert.equal(articleCoreText(trailing),trailing.citationText.trim());
});
test('real Sjogren response preserves sourced term, bibliographic year and research count without whole-answer rejection',()=>{
 const r=parse(fresh());assert.match(r.text,/Th17\/Treg/);assert.match(r.text,/2025年meta分析/);assert.match(r.text,/一项RCT/);
 assert.deepEqual(new Set(section(r,'observations').checks.map(c=>c.kind)),new Set(['term','citation-year','study-count']));
 assert.doesNotThrow(()=>verifyArticleResponse(r.validation,saved.pack,r.text));
 const jsonb=value=>JSON.parse(JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v));
 assert.doesNotThrow(()=>verifyArticleResponse(jsonb(r.validation),jsonb(saved.pack),r.text));
});
test('lookalike term and wrong bibliographic year remain local issues, not repaired into facts',()=>{
 for(const text of ['Th170/Treg平衡有临床依据。','一篇2024年meta分析报告疗效。','一项2025年RCT报告疗效。']){const raw=fresh();raw.observations.text='作者讨论潜在机制。'+text;const r=parse(raw);assert.match(r.text,/作者讨论潜在机制/);assert(!r.text.includes(text));assert.equal(section(r,'observations').action,'annotated');assert.match(r.text,/待核对/);}
 const p=structuredClone(saved.pack);p.fragments[2].text='Follow-up ended in 2025.';const raw=fresh();raw.observations.text='2025年meta分析报告疗效。';assert.equal(section(parse(raw,p),'observations').action,'withheld');
});
test('wrong or unverified measurement and new calculation suppress only the affected complete sentence',()=>{
 for(const text of ['治疗8周后改善。','评分从14降到8，因此有效率为100%。','随访时长翻倍。','样本量为二十余。']){const raw=fresh();raw.limitations.text='现有研究缺少盲法。'+text;const r=parse(raw);assert.match(r.text,/现有研究缺少盲法/);assert(!r.text.includes(text));assert.match(r.text,/待核对/);assert.equal(section(r,'limitations').action,'annotated');}
});
test('same study count with different object or unsupported count is not silently accepted',()=>{
 for(const text of ['两项RCT未发现针灸优于假针灸。','一项队列研究发现疗效。','两篇RCT报告疗效。','三篇meta分析报告疗效。','十二篇队列研究报告疗效。','两篇2025年meta分析报告疗效。']){const raw=fresh();raw.observations.text=text;assert.equal(section(parse(raw),'observations').action,'withheld');}
});
test('opposite-sign terms, negated bibliography and compound count tails are not verified',()=>{
 for(const [source,text]of [['CD4+ cells were observed.','CD4-细胞被观察到。'],['H2O was observed.','H2o被观察到。'],['No 2025 meta-analysis exists.','2025年meta分析报告疗效。'],['twenty-one randomized controlled trial found no superiority.','一项RCT报告疗效。']]){const p=structuredClone(saved.pack);p.fragments[0].text=source;const raw=fresh();raw.observations={text,fragmentIds:['fragment-1']};assert.equal(section(parse(raw,p),'observations').action,'withheld',text);}
});
test('term prefixes cannot borrow a source identity before extra charge signs or Greek suffixes',()=>{
 for(const [source,text]of [['CD4+ cells were observed.','CD4++细胞被观察到。'],['IL17 cells were observed.','IL17α细胞被观察到。']]){const p=structuredClone(saved.pack);p.fragments[0].text=source;const raw=fresh();raw.observations={text,fragmentIds:['fragment-1']};assert.equal(section(parse(raw,p),'observations').action,'withheld');}
});
test('punctuation-only replies cannot become successful scientific delivery',()=>{
 for(const text of ['。','[1].','!!!']){const raw=fresh();for(const part of Object.values(raw)){part.text=text;delete part.numericFactIds;}assert.throws(()=>parse(raw),/ARTICLE_NO_DELIVERABLE_SECTIONS/);}
});
test('known numbering and duplicate IDs repair deterministically, unknown citations cannot be invented',()=>{
 const raw=fresh();raw.researchType.text+='[1]';raw.researchType.fragmentIds.push('fragment-1');const r=parse(raw);assert(section(r,'researchType').issues.some(i=>i.code==='CITATION_REBUILT'));
 raw.researchType.fragmentIds=['fragment-99'];const bad=parse(raw);assert.equal(section(bad,'researchType').action,'withheld');assert(!bad.text.includes(raw.researchType.text.replace('[1]','')));assert.match(bad.text,/临床方面/);
 for(const part of Object.values(raw))part.fragmentIds=['fragment-99'];assert.throws(()=>parse(raw),/ARTICLE_NO_DELIVERABLE_SECTIONS/);
});
test('invalid model fact ID is a local warning but forged server receipt still stops delivery',()=>{
 const raw=fresh();raw.observations.numericFactIds=['numeric-forged'];const r=parse(raw);assert.match(r.text,/Th17\/Treg/);assert(section(r,'observations').issues.some(i=>i.code==='NUMERIC_REFERENCE_UNVERIFIED'));
 const receipt=structuredClone(r.validation);receipt.sections[1].action='verified';assert.throws(()=>verifyArticleResponse(receipt,saved.pack,r.text),/ARTICLE_RESPONSE_CHANGED/);
 assert.throws(()=>verifyArticleResponse(r.validation,saved.pack,r.text+' forged'),/ARTICLE_RESPONSE_CHANGED/);
 const p=structuredClone(saved.pack);p.fragments[0].text+=' changed';assert.throws(()=>verifyArticleResponse(r.validation,p,r.text),/ARTICLE_RESPONSE_CHANGED/);
});
test('unsupported recommendation and known medication mistranslation are local rather than whole-answer failures',()=>{
 const raw=fresh();raw.relevance.text='本研究构成强推荐。';const r=parse(raw);assert.equal(section(r,'relevance').action,'withheld');assert.match(r.text,/Th17\/Treg/);assert(!r.text.includes(raw.relevance.text));
 const p=structuredClone(saved.pack);p.fragments[0].text="The patient's symptoms improved after treatment cessation.";raw.relevance={text:'停药后症状改善。',fragmentIds:['fragment-1']};assert.equal(section(parse(raw,p),'relevance').action,'withheld');
});
test('protocol and incomplete evidence failures do not become fake success',()=>{
 const fenced=parseArticleResponse('```json\n'+JSON.stringify(fresh())+'\n```',saved.pack);assert.doesNotThrow(()=>verifyArticleResponse(fenced.validation,saved.pack,fenced.text));
 assert.throws(()=>parseArticleResponse('not json',saved.pack),/ARTICLE_AI_JSON_INVALID/);
 const raw=fresh();delete raw.limitations;assert.throws(()=>parse(raw),/ARTICLE_AI_SCHEMA_REJECTED/);
 const p=structuredClone(saved.pack);p.fragments[0].complete=false;assert.throws(()=>parse(fresh(),p),/ARTICLE_AI_EVIDENCE_INCOMPLETE/);
});
test('hypothesis is labeled, model cannot submit its own trusted verification flags',()=>{
 const raw=fresh();raw.relevance.kind='hypothesis';const r=parse(raw);assert.match(r.text,/AI推断.*原文未直接证实/);
 raw.relevance.verified=true;assert.throws(()=>parse(raw),/ARTICLE_AI_SCHEMA_REJECTED/);
});
test('new actual input contract binds policy and all full fragments without old blanket numerical prohibition',()=>{
 const m=articleResponseMessages('原科研Agent系统提示','解释研究设计与局限',saved.pack),p=articleResponseInputProof(m,saved.pack,'解释研究设计与局限');
 assert.equal(p.schema,'rh-article-response-input.v4');assert.equal(p.responsePolicyVersion,'rh-article-response.v4');assert.equal(JSON.parse(m[1].content).fragments.length,6);assert.match(m[0].content,/计算工具/);assert.match(m[0].content,/Th17/);
 const changed=structuredClone(m);changed[1].content=changed[1].content.slice(0,4000);assert.throws(()=>articleResponseInputProof(changed,saved.pack,'解释研究设计与局限'),/ARTICLE_MODEL_INPUT_CHANGED/);
});
test('article-internal reference numbers inside verified source quotations are not mistaken for Hub source indices',()=>{
 const p=structuredClone(saved.pack);p.fragments[0].text+=' Prior trial [132].';const data=JSON.parse(articleResponseMessages('边界','核对引用',p)[1].content),raw=fresh();raw.observations.text='作者讨论机制与局限。';raw.observations.numericFactIds=[data.numericFacts.find(f=>f.fragmentId==='fragment-1').id];const r=parse(raw,p),result={providerOutcome:'known',usedMock:false,usage:{totalTokens:1},finalText:r.citationText};assert.doesNotThrow(()=>assertAnswer(result,[p.source]));assert.match(r.text,/132/);
});
test('too many valid model quote choices are bounded locally rather than rejecting the entire interpretation',()=>{
 const data=JSON.parse(articleResponseMessages('边界','解释研究',saved.pack)[1].content),raw=fresh();raw.researchType.numericFactIds=data.numericFacts.slice(0,3).map(f=>f.id);raw.researchType.fragmentIds=data.numericFacts.slice(0,3).map(f=>f.fragmentId);raw.researchType.text='研究者讨论研究设计与局限。';const r=parse(raw);assert.match(r.text,/研究者讨论研究设计/);assert(r.numericEvidence.length<=2);assert.equal(section(r,'researchType').action,'continue');assert(section(r,'researchType').issues.some(i=>i.code==='NUMERIC_REFERENCE_LIMITED'));
});
test('bibliographic year before its explicit study counter is supported without borrowing another year or count',()=>{
 const raw=fresh();raw.observations.text='2025年一项meta分析报告疗效。';assert.match(parse(raw).text,/2025年一项meta分析/);raw.observations.text='2025年两项meta分析报告疗效。';assert.equal(section(parse(raw),'observations').action,'withheld');
});
