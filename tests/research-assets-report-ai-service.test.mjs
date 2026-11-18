import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalReportAiService} from '../server/research-assets/report-ai-service.mjs';
test('fragment HTTP body cannot silently override or add a scope/asset/version',()=>{
 let calls=0;const s=createLocalReportAiService({withAccess:()=>{calls++;return{};},assertSources:async()=>true}),valid={fragmentId:'rf-0001-aaaaaaaaaaaa',quoteHash:'a'.repeat(64),startLine:1,endLine:3};
 for(const body of[{...valid,assetId:'other'},{...valid,version:1},{...valid,studyId:'other'},null])assert.throws(()=>s.fragment({},'asset','2',body),e=>e.status===400);assert.equal(calls,0);
});
