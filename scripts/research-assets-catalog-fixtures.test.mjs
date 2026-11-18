import test from 'node:test';import assert from 'node:assert/strict';
import {catalogFixtureDefinition,CATALOG_HTTP_FIXTURES} from './research-assets-catalog-fixtures.mjs';
test('F01 completion targets only seven missing named originals, leaving the second valid file to real browser verification',()=>{
 assert.equal(CATALOG_HTTP_FIXTURES.length,7);assert.equal(new Set(CATALOG_HTTP_FIXTURES.map(x=>x.join(':'))).size,7);assert(!CATALOG_HTTP_FIXTURES.some(([a,k])=>a==='admin'&&k==='dataset'));
 const ids={owner:'o',admin:'a'};for(const [actor,kind]of CATALOG_HTTP_FIXTURES){const d=catalogFixtureDefinition(actor,kind,ids);assert.equal(d.kind,kind);assert(d.contentMd.includes('原创合成'));assert(d.metadata.title.endsWith('A01 '+actor+' 20261113'));assert.deepEqual(d.policy.discoveryRecipients,['o','a']);assert(!/实际疗效为|真实患者/.test(d.contentMd));assert.equal(d.sourceKind,'author');}
 assert.throws(()=>catalogFixtureDefinition('another','protocol',ids));assert.throws(()=>catalogFixtureDefinition('owner','unknown',ids));
});
