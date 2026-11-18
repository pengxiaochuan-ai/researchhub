import test from 'node:test';import assert from 'node:assert/strict';
import {assertUsageOptions,buildAssetUsageInput} from '../src/research-assets-usage.js';
import {assertAssetView} from '../src/research-assets-views.js';
import {catalogOwnsPageAction,catalogAssetHeader} from '../src/research-assets-catalog-session.js';
const user={tenantId:'t',accountId:'owner'},scope={studyGroupId:'g',researchProjectId:'p'},target={assetId:'asset',version:1,action:'request'};
const o={schemaVersion:'rh-asset-usage.v1',scope:{tenantId:'t',...scope},assetId:'asset',version:1,title:'合成材料',expectedRevision:3,identityRevision:'a'.repeat(64),contentHash:'b'.repeat(64),policyHash:'c'.repeat(64),sourceValid:true,releaseActive:true,canManage:false,canRequest:true,canShare:false,canCite:false,actors:[],requests:[],recipients:[],allowedActions:['read_body','cite','comment','download','ai','derive','apply','export']};
test('detail options expose independently checked purposes, legacy missing field stays closed',()=>{
 assertUsageOptions(o,{user,scope,target});assert.deepEqual(buildAssetUsageInput(o,target,{actions:['ai','comment'],purpose:'解释原创合成材料',ttlDays:1},'detail-key-123').actions,['ai','comment']);
 assert.throws(()=>buildAssetUsageInput({...o,allowedActions:undefined},target,{actions:['ai'],purpose:'解释',ttlDays:1},'detail-key-123'));
 assert.throws(()=>assertUsageOptions({...o,allowedActions:['root']},{user,scope,target}));
});
test('same visible directory permits real recommendations beyond ten without accepting arbitrary totals',()=>{
 const v={schemaVersion:'rh-asset-recommendations.v1',scope,identityRevision:o.identityRevision,total:19,items:[],nextCursor:null};assertAssetView(v,'recommendations',{scope,identityRevision:o.identityRevision});assert.throws(()=>assertAssetView({...v,total:27},'recommendations',{scope,identityRevision:o.identityRevision}));
});
test('A02 native header actions are owned by real page and keep original action order and start disabled pending the current read',()=>{
 const search='?assetCatalog=1&researchAssetId=asset&assetVersion=1&studyGroupId=g&researchProjectId=p';assert(catalogOwnsPageAction({real:true,pageId:'a02',search,label:'引用'}));
 const c={actions:[['引用'],['分享'],['下载'],['复用此资产']]},v=catalogAssetHeader(c,'a02',search);assert.deepEqual(v.actions.map(x=>x[0]),c.actions.map(x=>x[0]));assert.equal(v.actions[0][3],true);assert.equal(v.actions[2][3],true);
});
