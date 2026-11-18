import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./smart-search-grounding.mjs').catch(()=>({}));
const source={id:'W1',url:'https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety',title:'Acupuncture: Effectiveness and Safety | NCCIH',coverage:'webpage-excerpt',text:'How acupuncture works is not fully understood. Acupuncture has nonspecific effects (effects due to incidental aspects of a treatment rather than its main mechanism of action).',retrievedAt:'2026-11-12T00:00:00Z'};
const quote='How acupuncture works is not fully understood.';
const fact={kind:'source_fact',text:'针灸的作用机制尚未完全阐明。',sourceIds:['W1'],quotes:[{sourceId:'W1',text:quote}]};
const inference={kind:'ai_inference',text:'设计对照时，建议分别考虑特异性和非特异性效应；这不证明原文研究存在盲法缺陷。',sourceIds:['W1'],quotes:[{sourceId:'W1',text:'Acupuncture has nonspecific effects (effects due to incidental aspects of a treatment rather than its main mechanism of action).'}]};
const raw=claims=>JSON.stringify({claims,limitations:'本次只读取网页选段，不能代表全文。'});
function accept(claims,sources=[source]){assert.equal(typeof api.acceptGroundedAnswer,'function');return api.acceptGroundedAnswer(raw(claims),sources);}

test('facts expose their exact supporting excerpt while methodological inference is visibly not a source conclusion',()=>{
 const r=accept([fact,inference]);assert(r.text.includes('原文事实'));assert(r.text.includes('AI推论（非原文结论）'));assert(r.text.includes(quote));assert(r.text.includes(inference.text));assert.equal(r.grounding.claims[0].quotes[0].text,quote);
});
test('the original unsupported NCCIH blinding paragraph is locally withheld, not promoted to inference or allowed to hide other facts',()=>{
 const r=accept([fact,{...fact,text:'由于假针灸对照难以完全盲法，疗效评估存在方法学挑战。',quotes:[{sourceId:'W1',text:'Sham acupuncture procedures are difficult to blind completely.'}]}]);
 assert(r.text.includes(fact.text));assert(!r.text.includes('由于假针灸对照'));assert(r.text.includes('依据不足'));assert.equal(r.grounding.claims[1].status,'withheld');
 const borrowed=accept([fact,{...fact,text:'NCCIH指出假针灸难以完全盲法。',quotes:inference.quotes}]);assert(!borrowed.text.includes('NCCIH指出假针灸'));
});
test('WHO authorization cannot be inferred from third-party repository inclusion, including in limitations',()=>{
 const third={...source,url:'https://repository.gheli.harvard.edu/repository/14380/',title:'Anxiety Disorders',text:'This fact sheet from the World Health Organization describes anxiety disorders.'},f={...fact,text:'该目录收录WHO焦虑障碍资料。',quotes:[{sourceId:'W1',text:third.text}]};
 const r=accept([f,{...f,text:'所有数据均来自WHO官方或经WHO授权的资料。'}],[third]);assert(r.text.includes(f.text));assert(!r.text.includes('所有数据均来自'));assert(r.text.includes('授权关系'));
 const extra=api.acceptGroundedAnswer(JSON.stringify({claims:[f],limitations:'所有数据均来自WHO官方或经WHO授权的资料。'}),[third]);assert(!extra.text.includes('经WHO授权的资料'));assert(extra.text.includes('授权关系'));
});
test('honest unknown authorization is retained, but a negative clause cannot conceal a positive authorization claim',()=>{
 const negative={...inference,text:'目录收录不代表WHO授权；当前选段无法确认授权关系。'};
 assert(accept([fact,negative]).text.includes(negative.text));
 const r=accept([fact,{...inference,text:'目录收录不代表WHO授权，但本资料已经WHO授权。'}]);assert(!r.text.includes('本资料已经WHO授权'));
 for(const text of ['该页面不是WHO官方网页而是WHO授权的转载。','目录收录不等于WHO授权且本资料已经WHO授权。'])assert(!accept([fact,{...inference,text}]).text.includes(text));
});
test('a third-party page cannot become a WHO official page through an unrelated negation or common wording variant',()=>{
 const third={...source,url:'https://repository.gheli.harvard.edu/repository/14380/'};
 for(const text of ['目录收录不代表WHO授权且本页面属于WHO官方页面。','这不是随机网页而是WHO官方网页。','该页面属于WHO官网。','This is the official webpage of WHO.'])assert(!accept([fact,{...inference,text}],[third]).text.includes(text));
 const negative='该页不是WHO官方网页。';assert(accept([fact,{...inference,text:negative}],[third]).text.includes(negative));
});
test('facts require every cited source to carry an exact quote and fabricated IDs remain fatal',()=>{
 const second={...source,id:'W2',text:'A different public source with no claim-specific evidence.'};
 const r=accept([fact,{...fact,text:'两来源共同证明了同一结论。',sourceIds:['W1','W2']}],[source,second]);assert(!r.text.includes('两来源共同证明'));
 assert.throws(()=>accept([{...fact,sourceIds:['W999']}]),/SMART_OUTPUT_INVALID/);
 const forged=accept([fact,{...fact,text:'另一项事实。',quotes:[{sourceId:'W2',text:quote}]}],[source,second]);assert(!forged.text.includes('另一项事实'));
});
test('a supported quote is not borrowed from a different source and neither quotes nor prose may create model URLs',()=>{
 const second={...source,id:'W2',url:'https://example.org/',text:'Different source.'};
 assert(!accept([fact,{...fact,text:'伪引文结论。',sourceIds:['W2'],quotes:[{sourceId:'W2',text:quote}]}],[source,second]).text.includes('伪引文结论'));
 assert.throws(()=>accept([{...fact,text:'见 https://invented.example/'}]),/SMART_OUTPUT_INVALID/);
});
test('missing or malformed grounding cannot silently fall back to the old free-form answer',()=>{
 assert.equal(typeof api.acceptGroundedAnswer,'function');
 for(const value of [{answer:'旧自由文本',sourceIds:['W1'],limitations:'scope'},{claims:[],limitations:'scope'},{claims:[{...fact,kind:'unknown'}],limitations:'scope'}])assert.throws(()=>api.acceptGroundedAnswer(JSON.stringify(value),[source]),/SMART_OUTPUT_INVALID/);
});
test('limitations cannot bypass paragraph grounding with unquoted scientific assertions',()=>{
 const r=api.acceptGroundedAnswer(JSON.stringify({claims:[fact],limitations:'NCCIH指出所有假针灸研究均无法盲法，且已被证明有效。'}),[source]);assert(!r.text.includes('所有假针灸研究'));assert(r.text.includes('网页选段'));
});
test('grounding receipts remain source-bound and cannot be altered after delivery',()=>{
 const r=accept([fact,inference]);assert.equal(typeof api.assertGroundingReceipt,'function');assert.doesNotThrow(()=>api.assertGroundingReceipt(r.validation,[source]));
 const tampered=structuredClone(r.validation);tampered.grounding.claims[0].quotes[0].text='invented';assert.throws(()=>api.assertGroundingReceipt(tampered,[source]));
 assert.throws(()=>api.assertGroundingReceipt(r.validation,[{...source,text:'The source changed.'}]));
});
test('a locally withheld paragraph with both valid and invented quotes remains withheld on refresh without restricting other facts',()=>{
 const text='本段不得作为来源事实交付。',r=accept([fact,{...fact,text,quotes:[...fact.quotes,{sourceId:'W1',text:'An invented extra sentence which the source does not contain.'}]}]);
 assert(!r.text.includes(text));assert(r.text.includes(fact.text));assert.equal(r.grounding.claims[1].status,'withheld');assert.doesNotThrow(()=>api.assertGroundingReceipt(r.validation,[source]));
});
test('whitespace padding and a punctuation-only match do not count as a supporting excerpt',()=>{
 for(const text of ['            ','           .']){
  const r=accept([fact,{...fact,text:'空依据不得交付。',quotes:[{sourceId:'W1',text}]}]);assert(!r.text.includes('空依据不得交付'));assert.equal(r.grounding.claims[1].status,'withheld');assert.doesNotThrow(()=>api.assertGroundingReceipt(r.validation,[source]));
 }
});
