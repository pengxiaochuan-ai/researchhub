import test from 'node:test';import assert from 'node:assert/strict';
import {readCatalogListLocation} from '../src/research-assets-catalog-session.js';
import {assetUsageRequestAllowed} from '../src/research-assets-usage.js';
import * as catalogSession from '../src/research-assets-catalog-session.js';
const view=await import('../src/research-assets-views.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const life=await import('../src/research-assets-lifecycle.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const scope={studyGroupId:'g',researchProjectId:'p'},user={tenantId:'t',accountId:'owner',authVersion:5},hash='a'.repeat(64);
test('switching main or preview tabs clears the former ready snapshot before rendering the new kind',()=>{
 assert.equal(typeof catalogSession.catalogRenderState,'function');const old={status:'ready',routeKey:'?tab=graph',mainView:{value:{nodes:[],edges:[]}}};
 assert.equal(catalogSession.catalogRenderState(old,'?tab=graph'),old);assert.deepEqual(catalogSession.catalogRenderState(old,'?tab=contributions'),{status:'loading'});
 const privatePreview={status:'ready',routeKey:'?previewTab=basic',preview:{metadata:{title:'私有旧选择'}}};assert(!catalogSession.catalogRenderState(privatePreview,'?previewTab=relations').preview);
});
test('four collaboration views preserve the original page and safe return query',()=>{
 assert.equal(readCatalogListLocation('?tab=collaborations&collaborationView=received').collaborationView,'received');assert(assetUsageRequestAllowed('GET','/research-assets/collaborations?collaborationView=requested&page=1'));
 assert.throws(()=>readCatalogListLocation('?collaborationView=private'));assert.equal(assetUsageRequestAllowed('GET','/research-assets/collaborations?collaborationView=private'),false);
});
test('auxiliary views admit only scoped read routes and bounded real cursors',()=>{
 assert.equal(typeof view.assetViewRequestAllowed,'function','C06 view boundary missing');
 assert(view.assetViewRequestAllowed('GET','/research-assets/graph?page=1&pageSize=20'));assert(view.assetViewRequestAllowed('GET','/research-assets/recommendations?assetId=a&version=1'));
 for(const path of ['/research-assets/graph?includePrivate=true','/research-assets/usage?window=all','/research-assets/recommendations?assetId=a','/research-assets/trash?page=1&page=2'])assert.equal(view.assetViewRequestAllowed('GET',path),false);
 assert.equal(view.assetViewRequestAllowed('POST','/research-assets/graph'),false);
});
test('wrong Study, unknown identity and malformed trend totals clear views rather than render zeros',()=>{
 assert.equal(typeof view.assertAssetView,'function','C06 DTO boundary missing');
 const valid={schemaVersion:'rh-asset-recommendations.v1',scope:{tenantId:'t',...scope},identityRevision:hash,total:0,items:[],nextCursor:null};assert(view.assertAssetView(valid,'recommendations',{scope,identityRevision:hash}));
 assert.throws(()=>view.assertAssetView({...valid,scope:{...valid.scope,researchProjectId:'other'}},'recommendations',{scope,identityRevision:hash}));assert.throws(()=>view.assertAssetView({...valid,identityRevision:'b'.repeat(64)},'recommendations',{scope,identityRevision:hash}));
});
test('preview relations require fixed source targets and citation facts, never placeholder success',()=>{
 assert.equal(typeof view.assertAssetPreviewExtras,'function','fixed preview projection boundary missing');
 assert.throws(()=>view.assertAssetPreviewExtras({version:1},'relations',scope));assert.throws(()=>view.assertAssetPreviewExtras({version:1,citations:{total:1,items:[]}},'citations',scope));assert(view.assertAssetPreviewExtras({version:1,relations:{items:[]}},'relations',scope));
});
test('recycle unknown result freezes writes and recovers only its original receipt',async()=>{
 assert.equal(typeof life.createAssetLifecycleFlow,'function','C06 recycle state missing');let writes=0;const target={assetId:'a',version:1,action:'trash'},o={schemaVersion:'rh-asset-lifecycle.v1',scope:{tenantId:'t',...scope},assetId:'a',version:1,title:'本人草稿',action:'trash',allowed:true,expectedRevision:1,identityRevision:hash,contentHash:hash,policyHash:hash},receipt={status:'committed',assetId:'a',version:1,revision:2,operation:'trashed'};
 const flow=life.createAssetLifecycleFlow({user,scope,makeKey:()=> 'original-key',api:{get:async p=>p.includes('/operations/')?receipt:o,post:async()=>{writes++;throw Object.assign(Error('503'),{status:503});}}});
 await flow.open(target);flow.change('阶段完成');flow.close();await flow.open(target);assert.equal(flow.state().reason,'阶段完成');await flow.save();assert.equal(flow.state().phase,'unknown');await flow.save();assert.equal(writes,1);await flow.lookup();assert.equal(flow.state().phase,'committed');assert.equal(writes,1);
});
test('recycle confirmation returns focus to the persistent More button, or active tab after restoration removes its row',()=>{
 assert.equal(typeof life.lifecycleFocusTarget,'function');const more={isConnected:true,disabled:false},tab={isConnected:true,disabled:false},removed={isConnected:false},root={querySelector:s=>s.includes('aria-expanded')?more:tab};
 assert.equal(life.lifecycleFocusTarget(removed,root,'trash'),more);assert.equal(life.lifecycleFocusTarget(removed,root,'restore'),tab);more.disabled=true;assert.equal(life.lifecycleFocusTarget(removed,root,'trash'),tab);
});
test('read unavailability preserves recycle reason but cannot accept a late successful recycle',async()=>{
 let finish,commits=0;const target={assetId:'a',version:1,action:'trash'},o={schemaVersion:'rh-asset-lifecycle.v1',scope:{tenantId:'t',...scope},assetId:'a',version:1,title:'本人草稿',action:'trash',allowed:true,expectedRevision:1,identityRevision:hash,contentHash:hash,policyHash:hash};
 const f=life.createAssetLifecycleFlow({user,scope,api:{get:async()=>o,post:()=>new Promise(r=>{finish=r;})},onCommitted:()=>commits++});await f.open(target);f.change('未提交理由');const pending=f.save();f.pause();finish({status:'committed',assetId:'a',version:1,revision:2,operation:'trashed'});await pending;assert.equal(commits,0);assert.equal(f.state().phase,'unknown');assert.equal(f.state().reason,'未提交理由');f.invalidate();assert.equal(f.state().reason,'');
});
