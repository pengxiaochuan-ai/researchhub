import test from 'node:test';import assert from 'node:assert/strict';import * as output from './literature-output.mjs';
const evidence={plan:{question:'针灸 抑郁',pubmedQuery:'acupuncture AND depression',scope:'hub-and-pubmed'},external:{totalCount:9,returned:1,searchedAt:'2026-11-07T00:00:00Z'},selected:[{id:'P1',kind:'pubmed-live',pmid:'123',title:'Original title',doi:'10.1234/test',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/123/',coverage:'abstract'}]};
test('system renders actual bibliography and selection reasons, never model supplied titles or urls',()=>{
 const x=output.acceptLiteratureOutput(JSON.stringify({summary:'这是有限范围的检索结果。',items:[{id:'P1',decision:'uncertain',reason:'需核对人群与干预的匹配度。'}],limitations:'当前仅有摘要，不能推断全文结论。'}),evidence);
 assert(x.text.includes('[Original title](https://pubmed.ncbi.nlm.nih.gov/123/)'));assert(x.text.includes('未进入Hub审核资料库'));assert(x.text.includes('共命中9条'));assert(x.text.includes('按本次请求读取其中1篇题录/摘要'));assert(x.text.includes('需核对'));
});
test('forged citation ids and invented links cannot become delivered references',()=>{
 for(const value of [{summary:'s',items:[{id:'P99',decision:'relevant',reason:'r'}],limitations:'l'},{summary:'见https://evil.example',items:[{id:'P1',decision:'relevant',reason:'r'}],limitations:'l'}])assert.throws(()=>output.acceptLiteratureOutput(JSON.stringify(value),evidence));
});
test('a mixed numeric sentence retains unchanged qualitative clauses and discloses omitted quantitative content',()=>{
 const x=output.acceptLiteratureOutput(JSON.stringify({summary:'P1为假针刺对照，但人群特异；随访6周时主要结局未优于对照，仍需更多证据。',items:[{id:'P1',decision:'relevant',reason:'为肿瘤相关失眠试验；样本60例，但外推性有限。'}],limitations:'仅3篇摘要，未阅读全文。'}),evidence);
 assert(x.validation.summary.includes('文献一为假针刺对照'));assert(x.validation.summary.includes('仍需更多证据'));assert(x.validation.items[0].reason.includes('外推性有限'));assert(x.validation.limitations.includes('未阅读全文'));assert(x.text.includes('含数值的部分未展示'));assert(!x.validation.summary.includes('6周'));assert(!x.validation.summary.includes('P1'));
});
test('requested research directions are explicit hypotheses with real source links, never fabricated source ids',()=>{
 const e={...evidence,plan:{...evidence.plan,outputs:['summary','directions']}};
 const value={summary:'这是有限证据。',items:[{id:'P1',decision:'relevant',reason:'与问题相关。'}],limitations:'只读摘要。',directions:[{direction:'比较不同对照条件下的效果。',rationale:'目前材料对干预特异性仍有不确定性。',limitation:'需要先核对全文及更多证据。',sourceIds:['P1']}]};
 const result=output.acceptLiteratureOutput(JSON.stringify(value),e);assert(result.text.includes('候选研究方向'));assert(result.text.includes('待验证'));assert.equal(result.validation.directions.length,1);
 for(const ids of [[],['P99']])assert.throws(()=>output.acceptLiteratureOutput(JSON.stringify({...value,directions:[{...value.directions[0],sourceIds:ids}]}),e));
 assert.throws(()=>output.acceptLiteratureOutput(JSON.stringify({...value,directions:[]}),e));
});
