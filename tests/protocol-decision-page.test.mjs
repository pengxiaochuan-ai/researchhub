import test from 'node:test';import assert from 'node:assert/strict';
import {parseDecisionPage} from '../src/protocol-review-queue.js';
const row={studyId:'s',studyTitle:'研究',protocol:{id:'p',title:'方案',versionNumber:1,status:'draft'},decision:{id:'a',kind:'returned',createdAt:'2026-11-13T00:00:00.000Z',actorName:null,reason:'补充'}};
test('history projection uses the recorded decision while current protocol can be a draft',()=>{const p=parseDecisionPage({items:[row],nextCursor:null});assert.equal(p.items[0].decision.kind,'returned');assert.match(p.items[0].href,/reviewTab=processed/);});
test('malformed, duplicate, stale cursor, and inferred decision rows are never successful empty history',()=>{
 for(const value of [{items:[row,row],nextCursor:null},{items:[{...row,decision:{...row.decision,createdAt:null}}],nextCursor:null},{items:[{...row,decision:{...row.decision,kind:'draft'}}],nextCursor:null},{items:[],nextCursor:123}])assert.throws(()=>parseDecisionPage(value));
 assert.throws(()=>parseDecisionPage({items:[],nextCursor:'same'},'same'));
});
