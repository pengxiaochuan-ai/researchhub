import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAssetActivity} from '../src/research-assets-detail.js';
test('review detail accepts a real reason and conclusion together and rejects malformed or non-review assertions',()=>{
 const identityRevision='a'.repeat(64),expected={id:'asset',version:2,identityRevision},item={revision:6,type:'reviewed',version:2,at:'2026-11-16T00:00:00Z',actor:'管理员',reason:'已核对来源',conclusion:'approved'},v={schemaVersion:'rh-asset-activity.v1',...expected,total:1,items:[item],nextCursor:null};
 assertAssetActivity(v,expected);
 for(const change of [{reason:1},{reason:''},{reason:'x'.repeat(2001)},{conclusion:'released'},{type:'created'}])assert.throws(()=>assertAssetActivity({...v,items:[{...item,...change}]},expected));
});
