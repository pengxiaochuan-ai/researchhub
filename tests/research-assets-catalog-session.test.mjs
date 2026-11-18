import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCatalogAssetUrl,readCatalogAssetLocation,safeCatalogReturn,readCatalogListLocation,catalogRequestAllowed,assertCatalogAssetDetail,assertCatalogList,catalogScopes,catalogAssetHeader,createCatalogSelectionFence,catalogEntryActions,catalogBreadcrumbReturn,catalogOwnsPageAction,catalogPreviewDuringRefresh} from '../src/research-assets-catalog-session.js';
import {assertResearchAssetDetail} from '../src/research-assets-session.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {createKnowledgeClient} from '../src/knowledge-session.js';
import {realModeRouteState} from '../src/real-mode-route.js';
import {designIdentityMode} from '../src/research-design-session.js';
const scope={studyGroupId:'g',researchProjectId:'p'};
const back='/pages/a01/?studyGroupId=g&researchProjectId=p&q=%E9%92%88%E7%81%B8&page=2&pageSize=5&selectedAssetId=asset&selectedVersion=1&scroll=720';
test('catalog detail keeps exact fixed version and strictly safe same-Study list return',()=>{
 const url=makeCatalogAssetUrl(scope,'asset',1,back),route=readCatalogAssetLocation('a02',url.split('?')[1]);
 assert.deepEqual(route,{scope,assetId:'asset',versionNo:1,returnTo:back});assert.equal(safeSessionReturn(url),url);assert.equal(safeSessionReturn(back),back);
 for(const target of ['https://evil.example/pages/a01/','//evil.example/pages/a01/','/pages/a01/#token','/pages/a01/?assetReturnTo=x','/pages/a01/?studyGroupId=wrong&researchProjectId=p','/pages/a01/?page=1&page=2','/pages/a01/?selectedVersion=1'])assert.throws(()=>safeCatalogReturn(target,scope));
 assert.throws(()=>readCatalogAssetLocation('a02',url.split('?')[1]+'&assetDraftId=old'));assert.throws(()=>readCatalogAssetLocation('a02',url.split('?')[1]+'&assetVersion=2'));
 const list=readCatalogListLocation(back.split('?')[1]);assert.equal(list.query.page,2);assert.equal(list.selection.version,1);assert.equal(list.scroll,720);
});
test('catalog transport only allows exact read routes and validated query grammar',async()=>{
 const path='/research-assets/catalog?q='+encodeURIComponent('针灸 方法')+'&page=2&pageSize=5';
 assert(catalogRequestAllowed('GET',path));assert(catalogRequestAllowed('GET','/research-assets/asset/preview?version=1&tab=basic'));
 for(const [m,p]of [['POST','/research-assets/catalog'],['GET','/research-assets/catalog?page=1&page=2'],['GET','/research-assets/catalog?scope=public'],['GET','/research-assets/asset/preview?version=1&token=x'],['GET','/research-assets/catalog/asset?bad=1'],['GET','/research-assets/catalog/asset/versions/01']])assert.equal(catalogRequestAllowed(m,p),false,p);
 let calls=0;const api=createKnowledgeClient({scope:()=>scope,fetchImpl:async(url,init)=>{calls++;assert.equal(url,'/api'+path);assert.equal(init.headers['X-Research-Project-Id'],'p');return new Response(JSON.stringify({total:0}),{headers:{'Content-Type':'application/json'}});}});
 assert.equal((await api.get(path)).total,0);assert.equal(calls,1);
});
test('v2 accepts an allowed other owner but rejects hidden body, wrong version and legacy schema',()=>{
 const route={scope,assetId:'asset',versionNo:1},value={schemaVersion:'rh-research-asset-detail.v2',id:'asset',kind:'protocol',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'other',version:1,currentVersion:2,isHistorical:true,readOnly:true,bodyAccess:'restricted',metadata:{title:'已获准摘要',summary:'摘要'},versions:[{version:1},{version:2}],canActions:['read','versions'],identityRevision:'a'.repeat(64)};
 assert.equal(assertCatalogAssetDetail(value,route),value);
 for(const change of [{contentMd:'SECRET'},{version:2},{studyGroupId:'other'},{canActions:['export']},{schemaVersion:'rh-research-asset-detail.v1'},{bodyAccess:'allowed'},{versions:[{version:1},{version:1}]}])assert.throws(()=>assertCatalogAssetDetail({...value,...change},route));
 assert.throws(()=>assertResearchAssetDetail(value,route,'other'));
});
test('selection and identity invalidation discard delayed previews, including same-id different-version',async()=>{
 const fence=createCatalogSelectionFence();const a=fence.begin('a',1,'identity-a');let resolve;
 const pending=new Promise(r=>{resolve=r;}).then(value=>fence.current(a)?value:null);
 const b=fence.begin('a',2,'identity-a');resolve('SECRET');assert.equal(await pending,null);assert(fence.current(b));
 fence.invalidate();assert(!fence.current(b));
});
test('only verified catalog counts render and filtered URLs remain real while old candidate selectors remain separate',()=>{
 const route=readCatalogListLocation('?studyGroupId=g&researchProjectId=p&pageSize=5');
 const value={schemaVersion:'rh-research-asset-catalog.v1',scope,identityRevision:'a'.repeat(64),stats:{all:0,protocol:0,dataset:0,instrument:0,analysis:0,publication:0},filterOptions:{domains:[]},total:0,page:1,pageSize:5,items:[]};
 assert.equal(assertCatalogList(value,route),value);
 for(const bad of [{total:1},{stats:{...value.stats,all:1}},{scope:{...scope,researchProjectId:'foreign'}},{identityRevision:''},{page:2}])assert.throws(()=>assertCatalogList({...value,...bad},route));
 assert.equal(realModeRouteState('a01','?studyGroupId=g&researchProjectId=p&page=2',{configured:true}),'entry');
 assert.equal(realModeRouteState('a01','?assetDrafts=1&studyGroupId=g&researchProjectId=p',{configured:true}),'live');
});
test('catalog uses the minimized auth profile Study list without inventing permission fields',()=>{
 const user={accountId:'o',role:'researcher',studyGroups:[{id:'g',name:'研究组',role:{key:'researcher',name:'科研人员'},researchProjects:[{id:'p',name:'合成研究'}]}]};
 assert.deepEqual(catalogScopes(user),[{...scope,label:'研究组 / 合成研究'}]);assert.deepEqual(catalogScopes({studyGroups:[]}),[]);
});
test('even invalid catalog selectors cannot fall back to demo identity or the V1 private-only header',()=>{
 assert.equal(realModeRouteState('a02','?assetCatalog=1',{configured:true,explicitDemo:true}),'live');
 assert.equal(designIdentityMode(true,true,'a02','?assetCatalog=1'),true);
 const base={title:'旧资产',actions:[['引用'],['分享'],['下载']]};const value=catalogAssetHeader(base,'a02','?assetCatalog=1');
 assert.equal(value.title,'资产详情');assert(!value.description.includes('本人'));assert(value.actions.every(x=>x[3]));assert.equal(base.title,'旧资产');
});
test('original upload position is enabled, fixed detail breadcrumb keeps safe full catalog context, and edit remains scoped',()=>{
 assert.deepEqual(catalogEntryActions(),[['知识资料','k01'],['上传资产',null,true]]);
 const url=makeCatalogAssetUrl(scope,'asset',1,back);assert.equal(catalogBreadcrumbReturn('a02',url.split('?')[1],'a01'),back);assert.equal(catalogBreadcrumbReturn('a02','?assetCatalog=1&assetReturnTo=https://bad.example','a01'),'/pages/a01/');assert.equal(catalogBreadcrumbReturn('s10','?assetCatalog=1','a01'),null);
 const value={schemaVersion:'rh-research-asset-detail.v2',id:'asset',kind:'protocol',...scope,ownerAccountId:'owner',version:1,currentVersion:1,isHistorical:false,readOnly:true,bodyAccess:'allowed',metadata:{title:'原创方案',summary:'摘要'},versions:[{version:1}],canActions:['read','versions','edit'],identityRevision:'a'.repeat(64),contentMd:'原创正文'};
 assert.equal(assertCatalogAssetDetail(value,{scope,assetId:'asset',versionNo:1}),value);assert.throws(()=>assertCatalogAssetDetail({...value,currentVersion:2,isHistorical:true},{scope,assetId:'asset',versionNo:1}));
});
test('real A01 upload must not fall into legacy view=local demo navigation, without swallowing other actions',()=>{
 assert(catalogOwnsPageAction({real:true,pageId:'a01',search:'?studyGroupId=g&researchProjectId=p',label:'上传资产'}));
 for(const changed of [{real:false},{pageId:'a02'},{search:'?assetDrafts=1'},{search:'?view=local'},{label:'我的资产候选'}])assert.equal(catalogOwnsPageAction({real:true,pageId:'a01',search:'',label:'上传资产',...changed}),false);
});
test('background list and explicit preview commit together; pending reads keep the prior snapshot, identity changes clear immediately',()=>{
 const preview={id:'asset',version:1,canActions:['read','versions','edit']},catalog={identityRevision:'identity',items:[{id:'asset',version:1,canActions:preview.canActions}]},previous={status:'ready',catalog,preview};
 assert.deepEqual(catalogPreviewDuringRefresh(previous,catalog,{id:'asset',version:1}),{catalog,preview,previewStatus:'ready'});
 for(const changed of [{...catalog,items:[]},{...catalog,items:[{...catalog.items[0],version:2}]},{...catalog,items:[{...catalog.items[0],canActions:['read','versions']}]}])assert.deepEqual(catalogPreviewDuringRefresh(previous,changed,{id:'asset',version:1}),{catalog,preview,previewStatus:'ready'});
 assert.deepEqual(catalogPreviewDuringRefresh(previous,{...catalog,identityRevision:'new-identity'},{id:'asset',version:1}),{});
 assert.deepEqual(catalogPreviewDuringRefresh(previous,catalog,{id:'asset',version:2}),{});
});
