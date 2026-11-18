import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {articleBinding,articleContextKey,parseArticleContext,buildArticleEvidencePack,
  assertArticlePackMatches,articleToolResult} from './article-evidence.mjs';

const hash=text=>createHash('sha256').update(text).digest('hex');
const item={id:'pmc-PMC99001001',title:'Synthetic acupuncture study',doi:'10.9999/synthetic',
  articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1',aiReviewVersion:'article:1',
  sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC99001001/',sourceName:'PubMed Central',
  abstract:'Synthetic abstract only.',body:'Methods: synthetic participants. Results: uncertain findings. Discussion: limited scope.',
  tables:[{label:'Table A',rows:[['Design','synthetic']]}],
  abstractDisplayVersion:'article:1',abstractAiReviewVersion:'article:1',
  bodyDisplayVersion:'article:1',bodyAiReviewVersion:'article:1',tableDisplayVersion:'article:1',tableAiReviewVersion:'article:1'};

test('fixed article context round-trips canonical binding and rejects malformed/cross-version aliases',()=>{
  const b=articleBinding(item),key=articleContextKey(b);
  assert.deepEqual(parseArticleContext(key),b);assert(Buffer.byteLength(key)<=768);
  assert.notEqual(key,articleContextKey({...b,reviewVersion:'article:2'}));
  assert.equal(parseArticleContext('hub:lingshu-xinyu'),null);
  for(const value of ['hub-article:v1:?',key+'=',articleContextKey({...b,recordId:'pmc-PMC99001002',articleVersion:'PMC99001002.1'})+'junk'])
    assert.throws(()=>parseArticleContext(value),/ARTICLE_CONTEXT_INVALID/);
  assert.throws(()=>articleContextKey({...b,tenantId:'injected'}),/ARTICLE_BINDING_INVALID/);
});

test('bounded multi-fragment pack seals actual short text and stable offsets, not a fixed 1200 window',()=>{
  const p=buildArticleEvidencePack(item);
  assert.deepEqual(p.binding,articleBinding(item));assert(p.fragments.length>=3&&p.fragments.length<=6);
  assert(p.fragments.reduce((n,f)=>n+f.length,0)<=6000);
  const abstract=p.fragments.find(f=>f.field==='abstract');
  assert.equal(abstract.text,'Synthetic abstract only.');assert.equal(abstract.length,24);
  assert.equal(abstract.textHash,hash(abstract.text));
  assertArticlePackMatches(p,item);assert.deepEqual(buildArticleEvidencePack(item),p);
  assert.match(p.coverage.notice,/非全文/);
});

test('every later fragment, order, locator, metadata, field review and binding are checked',()=>{
  const p=buildArticleEvidencePack(item);
  for(const mutate of [x=>x.fragments[1].text+=' forged',x=>x.fragments[1].offset++,
    x=>x.fragments[1].locator.anchor='invented',x=>x.fragments.reverse(),
    x=>x.binding.articleVersion='PMC99001001.2',x=>x.source.doi='tampered',
    x=>x.coverage.notice='全文审阅']){
    const changed=structuredClone(p);mutate(changed);assert.throws(()=>assertArticlePackMatches(changed,item),/ARTICLE_EVIDENCE_CHANGED/);
  }
  for(const changed of [{bodyAiReviewVersion:'article:2'},{abstract:null},{title:'changed'},
    {rawSha256:'b'.repeat(64)},{reviewVersion:'article:2'}])
    assert.throws(()=>assertArticlePackMatches(p,{...item,...changed}),/ARTICLE_EVIDENCE_CHANGED/);
});

test('selection prefers actual JATS section offsets and never invents locators when absent',()=>{
  const reading={blocks:[{type:'section',id:'part-1',title:'Methods',children:[{type:'p',id:'part-2',content:[{type:'text',text:'Methods: synthetic participants.'}]}]}]};
  const p=buildArticleEvidencePack(item,reading);
  assert(p.fragments.some(f=>f.locator.anchor==='part-2'&&f.locator.section==='Methods'));
  assert(p.omissions.includes('results-section-not-located'));
  assert.equal(p.coverage.sections.methods,'Methods');
  assertArticlePackMatches(p,item,reading);
  assert(buildArticleEvidencePack(item).fragments.every(f=>f.locator.kind==='field-offset'));
});

test('long source stays bounded and missing body is explicit evidence insufficiency',()=>{
  const p=buildArticleEvidencePack({...item,abstract:'A'.repeat(9000),body:'B'.repeat(17000)});
  assert(p.fragments.length<=6&&p.fragments.every(f=>f.length<=1200));
  assert(p.fragments.reduce((n,f)=>n+f.length,0)<=6000);assert(p.omissions.includes('unselected-text'));
  assert.throws(()=>buildArticleEvidencePack({...item,body:null}),/ARTICLE_EVIDENCE_INSUFFICIENT/);
});

test('tool result has exactly one fixed article regardless of question and keeps other articles out',()=>{
  const p=buildArticleEvidencePack(item),r=articleToolResult(p);
  assert.equal(r.mutated,false);assert.equal(r.meta.sources.length,1);
  assert.equal(r.meta.sources[0].pmcRecordId,item.id);assert.equal(r.meta.articleEvidence.packHash,p.packHash);
  assert.match(r.result,/非全文/);assert.match(r.result,/Synthetic abstract/);
  assert.match(r.result,/results-section-not-located/);
  assert(!r.result.includes('99001002'));assert.equal(r.meta.sources[0].snippetHash,hash(item.title));
});

test('new packs use a versioned policy while explicit v1 and unknown-policy rejection protect history',()=>{
  const current=buildArticleEvidencePack(item);
  assert.equal(current.policyVersion,'rh-article-evidence-v2');
  const old=buildArticleEvidencePack(item,null,{policyVersion:'rh-article-evidence-v1'});
  assert.equal(old.policyVersion,'rh-article-evidence-v1');assertArticlePackMatches(old,item);
  assert.throws(()=>buildArticleEvidencePack(item,null,{policyVersion:'invented'}),/ARTICLE_POLICY_INVALID/);
  assert.throws(()=>assertArticlePackMatches({...old,policyVersion:'invented'},item),/ARTICLE_EVIDENCE_CHANGED/);
});

test('xref emphasis and superscript boundaries match the saved field exactly without invented offsets',()=>{
  const body='Clinical assessment Patient has symptoms ( 5 ) and reported distress . Intervention uses X 2 stimulation.';
  const reading={blocks:[{type:'section',title:'Clinical assessment',children:[{type:'p',id:'p-case',content:[
    {text:'Patient has symptoms ('},{type:'xref',text:'5'},{text:') and '},
    {type:'italic',text:'reported distress',content:[{text:'reported distress'}]},{text:'.'}]},
    {type:'section',title:'Intervention protocol',children:[{type:'p',id:'p-intervention',content:[
      {text:'Intervention uses X'},{type:'sup',text:'2',content:[{text:'2'}]},{text:' stimulation.'}]}]}]}]};
  const p=buildArticleEvidencePack({...item,body},reading);
  assert.equal(p.coverage.mapping.matched,2);assert.deepEqual(p.coverage.mapping.failedAnchors,[]);
  for(const f of p.fragments.filter(f=>f.field==='body'))assert.equal(body.slice(f.offset,f.offset+f.length),f.text);
  assert(p.fragments.some(f=>f.locator.anchor==='p-case'));
  assert(p.fragments.some(f=>f.locator.anchor==='p-intervention'));
  const failed=buildArticleEvidencePack({...item,body:'Unrelated saved field.'},reading);
  assert.equal(failed.coverage.mapping.matched,0);assert(failed.omissions.includes('body-mapping-incomplete'));
});

test('complete sentence and table-row windows do not infer from a truncated qualifier or cut cells',()=>{
  const abstract='Background sentence. '.repeat(50)+'Depressive symptoms remained partially unresolved.';
  const tables=[{label:'Outcome table',rows:[['Measure','Baseline','Week'],['PSQI','14','8'],['Long row','x'.repeat(1500),'unknown']]}];
  const p=buildArticleEvidencePack({...item,abstract,tables});
  const a=p.fragments.find(f=>f.field==='abstract');assert(a.text.endsWith('.'));assert.equal(a.complete,true);
  const t=p.fragments.find(f=>f.field==='table');assert(t);assert.equal(t.complete,true);
  assert.deepEqual(JSON.parse('['+t.text+']'),[['Measure','Baseline','Week'],['PSQI','14','8']]);
  assert(p.omissions.includes('table-rows-not-selected'));
  assert(p.fragments.every(f=>f.length<=1200));assert(p.coverage.characters<=6000);
});

test('case roles inherit parent sections and preserve actual limitations before highlights',()=>{
  const rows=[['Clinical assessment','patient','An adult patient presented with chronic symptoms.'],
    ['Intervention protocol','intervention','Acupuncture and stimulation were delivered.'],
    ['Clinical course and outcomes','result','Rating scales improved but symptoms remained unresolved.'],
    ['Discussion','intro','This case suggests potential benefit.'],
    ['Discussion','limits','This single case had no control and lacked objective sleep monitoring.']];
  const reading={blocks:rows.map(([title,id,text])=>({type:'section',title,children:[{type:'p',id,content:[{text}]}]}))};
  const p=buildArticleEvidencePack({...item,title:'Synthetic case report',body:rows.map(r=>r[2]).join(' ')},reading);
  assert.equal(p.coverage.sections.methods,'Clinical assessment');assert.equal(p.coverage.sections.results,'Clinical course and outcomes');
  assert(p.fragments.some(f=>f.locator.anchor==='limits'));assert(p.fragments.some(f=>f.locator.anchor==='intervention'));
  const nested={blocks:[{type:'section',title:'Clinical course and outcomes',children:[{type:'section',title:'Follow-up',children:[{type:'p',id:'follow-up',content:[{text:rows[2][2]}]}]}]}]};
  const n=buildArticleEvidencePack({...item,body:rows[2][2]},nested);
  assert.equal(n.coverage.sections.results,'Follow-up');
});

test('narrative review without independent results reports structure honestly, not missing clinical results',()=>{
  const reading={blocks:[{type:'section',title:'Review methodology',children:[{type:'p',id:'review-method',content:[{text:'This was a selective review.'}]}]},
    {type:'section',title:'Acupuncture',children:[{type:'p',id:'weak',content:[{text:'A weak recommendation applies only to post-treatment anxiety.'}]}]}]};
  const p=buildArticleEvidencePack({...item,abstract:'This review summarizes integrative options.',body:'This was a selective review. A weak recommendation applies only to post-treatment anxiety.'},reading);
  assert(p.fragments.some(f=>f.locator.anchor==='weak'));assert.equal(p.coverage.articleType,'review');
  assert(p.omissions.includes('results-role-not-applicable-review'));assert(!p.omissions.includes('results-section-not-located'));
});
