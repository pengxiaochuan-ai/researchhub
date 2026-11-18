import test from 'node:test';import assert from 'node:assert/strict';
import {assetGovernanceRequestAllowed} from '../src/research-assets-governance.js';
import {assetLifecycleRequestAllowed} from '../src/research-assets-lifecycle.js';
import {assetDetailRequestAllowed,assertAssetActivity} from '../src/research-assets-detail.js';
const id='rhab-11111111-1111-4111-8111-111111111111';
test('business fixed-version routes accept PostgreSQL bounds and keep original legacy path ceilings',()=>{
 for(const[n,check]of [['governance',assetGovernanceRequestAllowed],['lifecycle',assetLifecycleRequestAllowed]]){
  assert(check('GET','/research-assets/'+id+'/'+n+'?version=9'));
  assert(!check('GET','/research-assets/old/'+n+'?version=9'));
  for(const version of ['0','09','1.5','2147483648'])assert(!check('GET','/research-assets/'+id+'/'+n+'?version='+version));
 }
 assert(assetDetailRequestAllowed('GET','/research-assets/'+id+'/versions/9/compare?withVersion=8'));
 assert(assetDetailRequestAllowed('GET','/research-assets/'+id+'/versions/9/activity'));
 assert(!assetDetailRequestAllowed('GET','/research-assets/old/versions/9/activity'));
 assert(!assetDetailRequestAllowed('POST','/research-assets/'+id+'/versions/9/tags'));
});
test('business activity totals can exceed old fixture limits but still validate exact object/version',()=>{
 const v={schemaVersion:'rh-asset-activity.v1',id,version:9,identityRevision:'current',total:25,items:[{type:'revised',version:9,revision:25,actor:'合成作者',at:new Date().toISOString()}],nextCursor:null};
 assert.equal(assertAssetActivity(v,{id,version:9,identityRevision:'current'}),v);
 assert.throws(()=>assertAssetActivity({...v,id:'old'},{id:'old',version:9,identityRevision:'current'}));
});
