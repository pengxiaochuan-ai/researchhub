import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReviewQueue, nextPendingKey, nextPendingAfterSave } from '../src/source-review-queue.js';
const items=[
  {key:'a',kind:'pmc',title:'First paper',subtitle:'PMC123',state:{status:'public'}},
  {key:'b',kind:'external',title:'针灸指南',subtitle:'GUIDE-1',state:{status:'partial'}},
  {key:'c',kind:'pmc',title:'Second paper',subtitle:'PMC456',state:{status:'pending'}},
  {key:'d',kind:'workbook',title:'PubMed',subtitle:'初始工作簿',state:{status:'unavailable'}},
];
test('pending queue includes incomplete reviews but not unavailable or already decided content',()=>{
  assert.deepEqual(filterReviewQueue(items,{status:'pending'}).map(x=>x.key),['b','c']);
  assert.deepEqual(filterReviewQueue(items,{kind:'pmc',status:'all',q:'pmc456'}).map(x=>x.key),['c']);
  assert.deepEqual(filterReviewQueue(items,{status:'decided'}).map(x=>x.key),['a']);
});
test('next pending stays within current category/search and never selects current object',()=>{
  assert.equal(nextPendingKey(items,'a',{}),'b');
  assert.equal(nextPendingKey(items,'c',{}),'b');
  assert.equal(nextPendingKey(items,'c',{kind:'pmc'}),null);
  assert.equal(nextPendingKey(items,'a',{q:'notfound'}),null);
});
test('after save uses refreshed pending states within the exact visible filter, never jumps to decided or unavailable',()=>{
  assert.equal(nextPendingAfterSave(items,'a',{kind:'pmc',status:'all'}),'c');
  assert.equal(nextPendingAfterSave(items,'a',{kind:'pmc',status:'decided'}),null);
  assert.equal(nextPendingAfterSave(items,'a',{kind:'pmc',status:'pending',q:'notfound'}),null);
  const fresh=items.map(x=>x.key==='c'?{...x,state:{status:'tenant'}}:x);
  assert.equal(nextPendingAfterSave(fresh,'a',{kind:'pmc'}),null);
  assert.equal(nextPendingAfterSave(items,'removed-key',{kind:'pmc'}),'c');
});
test('public display with unapproved AI is decided, not a pending or hidden object',()=>{
  const rows=[{key:'clinical',kind:'external',state:{status:'public_display'}}];
  assert.equal(filterReviewQueue(rows,{status:'pending'}).length,0);
  assert.equal(filterReviewQueue(rows,{status:'decided'}).length,1);
});
