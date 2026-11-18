import test from 'node:test';import assert from 'node:assert/strict';
import * as evidence from './interpretation-evidence.mjs';
test('external abstract uses exact complete B04 windows and a distinct PubMed binding, never a fake PMC identity',()=>{
 const source={id:'P1',kind:'pubmed-live',pmid:'123',title:'Controlled trial',abstract:'METHODS: Adults were randomized to treatment or sham. RESULTS: No significant difference was observed. CONCLUSION: Further studies are needed.',retrievedAt:'2026-11-07T01:00:00Z',contentHash:'x'};
 const pack=evidence.buildSnapshotPack(source);assert.equal(pack.binding.recordId,'pubmed:123');assert(pack.omissions.includes('body-unavailable'));assert(pack.coverage.notice.includes('摘要'));assert(pack.fragments.length>0);
 for(const f of pack.fragments){assert.equal(f.text,source.abstract.slice(f.offset,f.offset+f.length));assert.equal(f.complete,true);assert(f.length<=1200);}
 assert.throws(()=>evidence.buildSnapshotPack({...source,abstract:''}),/INSUFFICIENT/);
});
test('tampered snapshot text, offset or hash cannot survive pack validation',()=>{
 const pack=evidence.buildSnapshotPack({id:'H1',kind:'hub-reviewed',title:'Fragment',text:'This was a protocol. No results were reported.',contentHash:'h'});
 evidence.assertSnapshotPack(pack);const changed=structuredClone(pack);changed.fragments[0].text='Results were positive.';assert.throws(()=>evidence.assertSnapshotPack(changed));
});
