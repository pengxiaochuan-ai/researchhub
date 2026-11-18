import test from 'node:test';import assert from 'node:assert/strict';
import {readProtocolReviewRange} from '../src/protocol-review-queue.js';
const row=id=>({studyId:'s'+id,studyTitle:'研究',protocol:{id:'p'+id,title:'方案',versionNumber:1,status:'pending_review',updatedAt:'2026-11-13T00:00:00Z'}});
test('continuation rechecks the entire opened range and replaces rows whose current access disappeared',async()=>{
 const old=await readProtocolReviewRange(async()=>({items:[row('old')],nextCursor:null}),'pending',20);assert.equal(old.items.length,1);
 const calls=[],fresh=await readProtocolReviewRange(async path=>{calls.push(path);return path.includes('cursor=next')?{items:[row('new2')],nextCursor:null}:{items:[row('new1')],nextCursor:'next'};},'pending',old.items.length+20);
 assert.deepEqual(fresh.items.map(x=>x.protocol.id),['pnew1','pnew2']);assert(!calls[0].includes('cursor='));assert.equal(fresh.nextCursor,null);
});
test('fresh range errors cannot be mistaken for successful empty data or preserve prior privileged rows',async()=>{
 await assert.rejects(readProtocolReviewRange(async()=>{throw Object.assign(Error('denied'),{status:403});},'processed',20),e=>e.status===403);
 await assert.rejects(readProtocolReviewRange(async()=>({items:[row('same')],nextCursor:'repeat'}),'pending',20),/变化|核对/);
});
