import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_SOURCE_DEFINITIONS,assertAssetSourcePreparation} from './research-assets-source-fixtures.mjs';
const ids={tenant:'rh-kb-local-test-tenant',group:'rh-kb-local-test-group',project:'rh-kb-local-test-project',owner:'rh-kb-local-test-owner',admin:'rh-kb-local-test-admin'};
test('F03 preparation is exactly two original synthetic materials, not a generic KB importer',()=>{
 assert.equal(ASSET_SOURCE_DEFINITIONS.length,2);assert.deepEqual(ASSET_SOURCE_DEFINITIONS.map(x=>x.key),['protocol-notes','dictionary-notes']);
 for(const d of ASSET_SOURCE_DEFINITIONS){assert(d.contentMd.includes('原创合成'));assert(d.rightsEvidence.includes('固定快照'));assert(!/HAMD\s*\d|疗效\s*\d/.test(d.contentMd));}
 const state={schemaVersion:'rh-asset-source-preparation.v1',ids,startedAt:'2026-11-12T00:00:00Z',complete:false,items:ASSET_SOURCE_DEFINITIONS.map(d=>({key:d.key,title:d.title,phase:'planned'}))};
 assert.equal(assertAssetSourcePreparation(state,ids),state);
 for(const bad of [{...state,ids:{...ids,project:'other'}},{...state,items:[...state.items,{key:'third'}]},{...state,items:[{...state.items[0],title:'old document'},state.items[1]]},{...state,items:[{...state.items[0],phase:'restore_historical_review'},state.items[1]]}])assert.throws(()=>assertAssetSourcePreparation(bad,ids));
});
