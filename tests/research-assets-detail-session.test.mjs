import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/research-assets-detail.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
test('only explicit fixed-version comparison, activity and tag writes are admitted',()=>{
 assert.equal(typeof api.assetDetailRequestAllowed,'function');
 for(const path of ['/research-assets/a1/versions/2/compare?withVersion=1','/research-assets/a1/versions/2/activity','/research-assets/a1/versions/2/activity?cursor=abc_123'])assert.equal(api.assetDetailRequestAllowed('GET',path),true);
 assert.equal(api.assetDetailRequestAllowed('POST','/research-assets/a1/versions/2/tags'),true);
 for(const [method,path]of [['POST','/research-assets/a1/versions/2/compare'],['GET','/research-assets/a1/versions/2/compare?withVersion=1&tenant=other'],['GET','/research-assets/a1/versions/9/activity'],['POST','/research-assets/a1/versions/2/tags?role=admin']])assert.equal(api.assetDetailRequestAllowed(method,path),false);
});
test('comparison receipt must match both fixed versions and never accept partial or restricted data',()=>{
 assert.equal(typeof api.assertAssetComparison,'function');const good={schemaVersion:'rh-asset-comparison.v1',id:'a1',identityRevision:'a'.repeat(64),before:{version:1},after:{version:2},changedFields:[],text:{changed:false,prefixLines:1,suffixLines:0,removed:[],added:[]}};
 assert.equal(api.assertAssetComparison(good,{id:'a1',from:1,to:2,identityRevision:'a'.repeat(64)}),good);
 for(const r of [{...good,id:'other'},{...good,before:{version:2}},{...good,identityRevision:'b'.repeat(64)}])assert.throws(()=>api.assertAssetComparison(r,{id:'a1',from:1,to:2,identityRevision:'a'.repeat(64)}));
});
