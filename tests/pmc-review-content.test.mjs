import test from 'node:test';import assert from 'node:assert/strict';
import {pmcContentInventory,reviewQueueCounts,nextReviewLabel} from '../src/pmc-review-content.js';
test('format copies are not author supplements; manifest identifies the exact missing PDF',()=>{
  const item={abstract:'text',body:'body',tables:[],mediaRefs:[],assets:[{assetKind:'jats',componentRef:'jats'},{assetKind:'jats',componentRef:'PMC123.1.xml'},{assetKind:'supplement',componentRef:'PMC123.1.txt'}],componentManifest:[{kind:'xml',name:'PMC123.1.xml'},{kind:'text',name:'PMC123.1.txt'},{kind:'pdf',name:'PMC123.1.pdf'}]};
  const r=pmcContentInventory(item,{tables:[],media:[],supplements:[],presence:{body:true,abstract:true}});assert.equal(r.images.length,0);assert.equal(r.supplements.length,0);assert.equal(r.technical.length,3);
  assert.deepEqual(r.missing.map(x=>x.name),['PMC123.1.pdf']);assert.equal(r.pdf.label,'未取得（不影响已解析正文）');
  assert.equal(r.figures.label,'原文未列出图片');assert.equal(r.tables.label,'原文未列出表格');
});
test('an unverified source is not claimed to contain no figures or tables; the actual structured source wins over old flattening',()=>{
  const initial=pmcContentInventory({tables:[],mediaRefs:[],body:'old plain text'});assert.match(initial.tables.label,/待核对/);assert.match(initial.figures.label,/待核对/);
  const ready=pmcContentInventory({tables:[],mediaRefs:[],assets:[]},{tables:[{refId:'T1'}],media:[{refId:'F1',href:'a.webp'}],supplements:[],presence:{body:true,abstract:false}});
  assert.match(ready.tables.label,/1/);assert.match(ready.figures.label,/0\/1/);
});
test('actual supplemental references and missing figures are separate, unknown files are not called author supplements',()=>{
  const r=pmcContentInventory({mediaRefs:[{kind:'image',href:'a.webp'},{kind:'supplement',href:'appendix.docx'}],assets:[{assetKind:'supplement',componentRef:'appendix.docx'},{assetKind:'supplement',componentRef:'unknown.bin'}],componentManifest:[{kind:'media',name:'a.webp'}]});
  assert.equal(r.supplements.length,1);assert.equal(r.technical.length,1);assert.match(r.figures.label,/0\/1/);
});
test('all counts share current kind and search; status is the only varying dimension',()=>{
  const items=[{kind:'pmc',title:'Match',state:{status:'pending'}},{kind:'pmc',title:'Match',state:{status:'public'}},{kind:'external',title:'Match',state:{status:'pending'}},{kind:'pmc',title:'Other',state:{status:'pending'}}];
  assert.deepEqual(reviewQueueCounts(items,{kind:'pmc',q:'Match'}),{all:2,pending:1,decided:1});
  assert.equal(nextReviewLabel('pending'),'跳过，查看下一篇 →');assert.equal(nextReviewLabel('public'),'下一篇待审核 →');
});
