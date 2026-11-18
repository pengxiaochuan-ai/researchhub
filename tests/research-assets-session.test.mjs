import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
import {realModeRouteState} from '../src/real-mode-route.js';
import {designIdentityMode,createDesignReadFence} from '../src/research-design-session.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
const session=await import('../src/research-assets-session.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
const scope={studyGroupId:'g1',researchProjectId:'p1'},search='?researchAssetId=a1&studyGroupId=g1&researchProjectId=p1&assetVersion=2';
test('fixed asset URLs retain only real Study identifiers and reject duplicate or mixed demo selectors',()=>{
 assert.equal(typeof session.readResearchAssetLocation,'function');
 assert.deepEqual(session.readResearchAssetLocation('a02',search),{scope,assetId:'a1',versionNo:2});
 assert.equal(session.makeResearchAssetUrl(scope,'a1',2),'/pages/a02/?researchAssetId=a1&studyGroupId=g1&researchProjectId=p1&assetVersion=2');
 for(const q of [search+'&assetId=demo',search+'&projectId=demo',search+'&crfMethodAssets=1',search+'&assetVersion=1',search.replace('=2','=02'),search.replace('g1','../x')])assert.throws(()=>session.readResearchAssetLocation('a02',q));
 assert.throws(()=>session.readResearchAssetLocation('a01',search));
});
test('explicit new asset entries never fall back to demo identity or presentation',()=>{
 assert.equal(realModeRouteState('a02',search,{configured:true,explicitDemo:true}),'live');
 assert.equal(realModeRouteState('a02','?researchAssetId=invalid',{configured:false,explicitDemo:true}),'pending');
 assert.equal(designIdentityMode(true,true,'a02',search),true);
});
test('legacy reads remain exact; only the approved named Hub governance transport is additionally admitted',async()=>{
 const calls=[],api=createKnowledgeClient({scope:()=>scope,fetchImpl:async(url,init)=>{calls.push([url,init.method,init.headers]);return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await api.get('/research-assets/a1');await api.get('/research-assets/a1/versions/2');
 for(const path of ['/research-assets','/research-assets/a1/versions/01','/research-assets/a1?owner=u2','/research-assets/a1/export','/research-assets/a1/versions/9007199254740992'])await assert.rejects(api.get(path));
 for(const path of ['/research-assets/a1','/research-assets/a1/versions/2','/research-assets/a1/publish','/research-assets/a1/release','/research-assets/a1/releases?public=1'])await assert.rejects(api.post(path,{}));
 await api.post('/research-assets/a1/releases',{}); // Server still requires current actor/intent, scoped registry, seals and admin.
 assert.equal(calls.length,3);assert.equal(calls[0][2]['X-Study-Group-Id'],'g1');assert.equal(calls[0][2]['X-Research-Project-Id'],'p1');
});
test('read-only header retains action slots but cannot trigger demo sharing or downloads',()=>{
 assert.equal(typeof session.researchAssetHeader,'function');
 const base={title:'资产详情',actions:[['引用','a01'],['分享'],['下载'],['更多操作']],nav:['原导航']};
 const header=session.researchAssetHeader(base,'a02',search);
 assert.deepEqual(header.actions.map(x=>x[0]),['引用','分享','下载','更多操作']);assert(header.actions.every(x=>x[3]===true));
 assert.equal(header.title,'资产详情');assert.deepEqual(base.actions[0],['引用','a01']);
});

test('a wrong-account, wrong-version or malformed response cannot render as a verified asset',()=>{
 assert.equal(typeof session.assertResearchAssetDetail,'function');
 const route=session.readResearchAssetLocation('a02',search),value={schemaVersion:'rh-research-asset-detail.v1',id:'a1',kind:'protocol',title:'合成方案',status:'draft',ownerAccountId:'u1',...scope,version:2,currentVersion:3,isHistorical:true,readOnly:true,metadata:{title:'合成方案',summary:'摘要',purpose:'用途',limitations:'限制',author:'作者'},source:{kind:'author_declared_synthetic',label:'作者整理'},contentMd:'合成正文',versions:[{version:3},{version:2}],hasMoreVersions:false};
 assert.equal(session.assertResearchAssetDetail(value,route,'u1'),value);
 for(const patch of [{id:'other'},{ownerAccountId:'u2'},{studyGroupId:'g2'},{version:3},{status:'released'},{isHistorical:false},{contentMd:null},{metadata:{...value.metadata,title:'不一致'}},{source:{kind:'reviewed'}},{versions:[{version:2},{version:2}]}])assert.throws(()=>session.assertResearchAssetDetail({...value,...patch},route,'u1'),e=>e.status===409);
});
test('read failures use business language instead of exposing framework endpoints or internal errors',()=>{
 assert.equal(typeof session.researchAssetReadMessage,'function');
 assert.equal(session.researchAssetReadMessage({status:404,message:'Cannot GET /api/research-assets/private'}),'未找到可访问的资产或版本，请返回科研资产重新选择。');
 assert.equal(session.researchAssetReadMessage({status:503,message:'database host internal'}),'资产服务暂不可用，请重试；未显示未经核对的内容。');
 assert.equal(session.researchAssetReadMessage({status:409,message:'hash mismatch'}),'资产版本信息无法核对，请重新读取或返回目录。');
});

test('verified probes advance the visible head while older or identity-invalidated responses cannot revive content',async()=>{
 assert.equal(typeof session.readResearchAssetResponse,'function');
 const route=session.readResearchAssetLocation('a02',search.replace('&assetVersion=2',''));
 const response=number=>({schemaVersion:'rh-research-asset-detail.v1',id:'a1',kind:'protocol',title:'合成方案'+number,status:'draft',ownerAccountId:'u1',...scope,version:number,currentVersion:number,isHistorical:false,readOnly:true,metadata:{title:'合成方案'+number,summary:'摘要',purpose:'用途',limitations:'限制',author:'作者'},source:{kind:'author_declared_synthetic',label:'作者整理'},contentMd:'正文'+number,versions:[{version:number}],hasMoreVersions:false});
 let displayed=null,release;const identity=createDesignReadFence(),reads=createDesignReadFence(),identityToken=identity.begin();
 const start=read=>{const token=reads.begin();return session.readResearchAssetResponse({read,route,accountId:'u1',isCurrent:()=>identity.current(identityToken)&&reads.current(token),publish:value=>{displayed=value;}});};
 await start(async()=>response(1));assert.equal(displayed.contentMd,'正文1');
 const slow=start(()=>new Promise(resolve=>{release=resolve;}));
 await start(async()=>response(2));release(response(1));await slow;
 assert.equal(displayed.contentMd,'正文2');assert.equal(displayed.currentVersion,2);
 const pending=start(()=>new Promise(resolve=>{release=resolve;}));identity.invalidate();displayed=null;release(response(3));await pending;
 assert.equal(displayed,null);
});
test('same-account authVersion changes invalidate private reads, not just account switches',()=>{
 assert.equal(typeof session.researchAssetIdentityChanged,'function');
 const expected={accountId:'u1',authVersion:1};
 assert.equal(session.researchAssetIdentityChanged(expected,{id:'u1',authVersion:1,authenticated:true,status:'authenticated'}),false);
 for(const next of [{id:'u1',authVersion:2,authenticated:true},{id:'u2',authVersion:1,authenticated:true},{id:'u1',authenticated:true},{authenticated:false}])assert.equal(session.researchAssetIdentityChanged(expected,next),true);
 assert.equal(session.researchAssetIdentityChanged(expected,{status:'checking'}),false);
});
test('an identity event received while auth/me is pending rejects the older identity before loading content',async()=>{
 assert.equal(typeof session.readResearchAssetIdentity,'function');
 let release,latest=null;
 const pending=session.readResearchAssetIdentity({read:()=>new Promise(resolve=>{release=resolve;}),isCurrent:()=>true,latestIdentity:()=>latest});
 latest={id:'u1',authVersion:2,authenticated:true};release({accountId:'u1',authVersion:1});
 await assert.rejects(pending,e=>e.status===401);
 latest=null;assert.deepEqual(await session.readResearchAssetIdentity({read:async()=>({accountId:'u1',authVersion:1}),isCurrent:()=>true,latestIdentity:()=>latest}),{accountId:'u1',authVersion:1});
 assert.equal(await session.readResearchAssetIdentity({read:async()=>({accountId:'u1',authVersion:1}),isCurrent:()=>false,latestIdentity:()=>latest}),null);
});
test('relogin preserves the exact real asset and fixed version but rejects mixed or external return contexts',()=>{
 const href='/pages/a02/'+search;
 assert.equal(safeAuthenticatedReturnTo(href),href);
 for(const suffix of ['&assetId=demo','&assetVersion=3','&returnTo=https://evil.test','#token=secret'])assert.equal(safeAuthenticatedReturnTo(href+suffix),'/pages/p01/');
});
test('the new family cannot hijack existing synthetic candidate current/history entries or their login return',()=>{
 for(const suffix of ['','&assetVersion=1']){
  const q='?studyGroupId=g1&researchProjectId=p1&assetDraftId=owned'+suffix;
  assert.equal(session.isResearchAssetRoute('a02',q),false);
  assert.equal(realModeRouteState('a02',q,{configured:true}),'live');
  assert.equal(safeAuthenticatedReturnTo('/pages/a02/'+q),'/pages/a02/'+q);
  const mixed=q+'&researchAssetId=new';assert.equal(session.isResearchAssetRoute('a02',mixed),true);
  assert.throws(()=>session.readResearchAssetLocation('a02',mixed));assert.equal(safeAuthenticatedReturnTo('/pages/a02/'+mixed),'/pages/p01/');
 }
 assert.equal(session.isResearchAssetRoute('a02','?assetVersion=1'),true);
});
