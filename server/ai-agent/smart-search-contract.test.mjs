import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./smart-search-contract.mjs').catch(()=>({}));
test('search source IDs come only from actual parsed public result URLs, keeping duplicates and unsafe URLs out',()=>{
 assert.equal(typeof api.parseWebCandidates,'function');const candidates=api.parseWebCandidates('Title: Public guideline\nURL: https://example.org/guide\nExcerpt: public text\nTitle: duplicate\nURL: https://example.org/guide\nTitle: private\nURL: https://127.0.0.1/');
 assert.equal(candidates.length,1);assert.equal(candidates[0].url,'https://example.org/guide');assert.equal(candidates[0].title,'Public guideline');
});
test('server renders canonical source links and reading scope, rejects invented references and URLs',()=>{
 assert.equal(typeof api.acceptWebAnswer,'function');const sources=[{id:'W1',url:'https://example.org/guide',title:'Public guideline',coverage:'webpage-excerpt',text:'source text',textHash:'a'}];
 const raw=JSON.stringify({answer:'公开指南提供了相关说明。[W1]',sourceIds:['W1'],limitations:'仅依据当前网页选段。'}),r=api.acceptWebAnswer(raw,sources);
 assert(r.text.includes('https://example.org/guide'));assert(r.text.includes('已读取网页选段'));assert(!r.text.includes('[W1]'));assert.equal(typeof r.validation.textHash,'string');
 for(const patch of [{sourceIds:['W2']},{answer:'参考[W2]'},{answer:'参考[99]'},{answer:'https://invented.example/'},{sourceIds:[]}])assert.throws(()=>api.acceptWebAnswer(JSON.stringify({...JSON.parse(raw),...patch}),sources));
 assert.throws(()=>api.acceptWebAnswer(raw,[{...sources[0],text:''}]));
});
test('public search parameters cannot contain credentials, personal identifiers or internal context',()=>{
 assert.equal(typeof api.safePublicQuery,'function');
 assert.equal(api.safePublicQuery('acupuncture depression guideline'),'acupuncture depression guideline');
 for(const q of ['mail owner@example.org','token sk-1234567890abcdefg','subject ID patient-0001','/Users/mac/private','研究对象身份证110101199001011234'])assert.throws(()=>api.safePublicQuery(q));
});
test('bare valid source IDs are rendered consistently and unknown IDs cannot slip through prose',()=>{
 const sources=[{id:'W1',url:'https://example.org/one',title:'Read source',text:'evidence',coverage:'webpage-excerpt'},{id:'W2',url:'https://example.org/two',title:'Candidate',text:'snippet',coverage:'search-snippet'}],raw={answer:'W1支持这一说明。[W1]',sourceIds:['W1'],limitations:'W2只取得搜索摘要。'};
 const result=api.acceptWebAnswer(JSON.stringify(raw),sources);assert(!/\bW\d+\b/.test(result.text));assert(result.text.includes('[1]支持'));assert(result.text.includes('候选'));assert.throws(()=>api.acceptWebAnswer(JSON.stringify({...raw,limitations:'W999仅作候选'}),sources));
});
test('search-only completion is a labelled candidate list, not an invented full-text synthesis',()=>{
 const result=api.webCandidateAnswer([{id:'W1',url:'https://example.org/',title:'Actual candidate',text:'Actual search snippet',coverage:'search-snippet',retrievedAt:'2026-11-12T00:00:00Z'}]);assert.equal(result.validation.status,'candidate-only');assert(result.text.includes('未完成正文解读'));assert(result.text.includes('仅搜索摘要'));assert(!result.text.includes('证明有效'));
});
test('a frozen candidate-only follow-up cannot be upgraded into body interpretation without actual webpage evidence',()=>{
 const source={id:'W1',url:'https://example.org/',title:'Candidate',text:'A real search snippet',coverage:'search-snippet'},raw=JSON.stringify({answer:'模型尝试进一步综合。[W1]',sourceIds:['W1'],limitations:'摘要有限'});
 assert.equal(api.acceptSmartDelivery(raw,[source]).validation.status,'candidate-only');
 assert.notEqual(api.acceptSmartDelivery(raw,[{...source,coverage:'webpage-excerpt'}]).validation.status,'candidate-only');
});
