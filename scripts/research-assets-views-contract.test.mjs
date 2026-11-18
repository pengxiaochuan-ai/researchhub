import test from 'node:test';import assert from 'node:assert/strict';import {parseAssetCollaborationQuery,parseAssetViewQuery} from './research-assets-views-contract.mjs';
test('collaboration filter preserves strict scalar, duplicate-key and unknown-key rejection',()=>{
 assert.equal(parseAssetCollaborationQuery({collaborationView:'received'}).view,'received');
 for(const q of [{kind:['all']},{collaborationView:['all']},{includePrivate:'true'},new URLSearchParams('page=1&page=2')])assert.throws(()=>parseAssetCollaborationQuery(q),e=>e.status===400);
});
test('recommendation selection and cursor cannot enter another view or use incomplete version scope',()=>{
 assert.deepEqual(parseAssetViewQuery('recommendations',{assetId:'a',version:'1'}).selection,{id:'a',version:1});
 for(const [type,q]of [['graph',{cursor:'a'}],['usage',{assetId:'a',version:'1'}],['recommendations',{assetId:'a'}]])assert.throws(()=>parseAssetViewQuery(type,q),e=>e.status===400);
});
