import test from 'node:test';import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
import {readCrfMethodsLocation} from '../src/crf-methods-session.js';
import {designIdentityMode} from '../src/research-design-session.js';
const api=await import('../src/crf-method-assets-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const root='/research-plan-drafts/p/synthetic-collections/c/method-runs/r/report-drafts/report/asset-drafts';
test('new route never falls back to legacy or demo and forces real identity',()=>{
 const scope={studyGroupId:'g',researchProjectId:'p'};
 assert.equal(typeof api.readCrfMethodAssetLocation,'function');
 for(const page of ['a01','a02']){const url=api.makeCrfMethodAssetUrl(page,scope,page==='a02'?'candidate':undefined);const p=new URL(url,'http://local');assert.equal(api.readCrfMethodAssetLocation(page,p.search).scope.researchProjectId,'p');assert(designIdentityMode(true,true,page,p.search));if(page==='a02')assert.equal(p.searchParams.get('crfMethodAssetId'),'candidate');}
 for(const search of ['crfMethodAssetId=x','crfMethodAssetVersion=1']){assert(api.isCrfMethodAssetsRoute('a02',search));assert.throws(()=>api.readCrfMethodAssetLocation('a02',search));}
 for(const search of ['crfMethodAssets=0','crfMethodAssets=1&assetDrafts=1','crfMethodAssets=1&crfMethodAssets=1','crfMethodAssets=1&projectId=x','crfMethodAssets=1&studyGroupId=g&researchProjectId=p&versionNo=31']){assert(api.isCrfMethodAssetsRoute('a01',search));assert.throws(()=>api.readCrfMethodAssetLocation('a01',search));}
 assert.throws(()=>api.makeCrfMethodAssetUrl('a02',scope,'https://evil',1));assert.throws(()=>api.makeCrfMethodAssetUrl('a01',scope,'candidate'));
});
test('fixed report pair requires exact report id/version/run and never changes original method URL',()=>{
 const scope={studyGroupId:'g',researchProjectId:'p'},url=api.makeCrfMethodReportUrl(scope,'plan','collection','run','report',2),p=new URL(url,'http://local'),v=readCrfMethodsLocation('s06',p.search);
 assert.equal(v.methodReportId,'report');assert.equal(v.methodReportVersion,2);assert.equal(v.runId,'run');
 for(const suffix of ['&methodReportId=report','&methodReportVersion=31','&compareRunId=other'])assert.throws(()=>readCrfMethodsLocation('s06',p.search+suffix));
 p.searchParams.delete('runId');assert.throws(()=>readCrfMethodsLocation('s06',p.search));p.searchParams.set('runId','run');p.searchParams.delete('methodReportVersion');assert.throws(()=>readCrfMethodsLocation('s06',p.search));
});
test('new header does not inherit fixed demo asset labels or actions',()=>{
 const original={concept:'Asset Detail',tags:['AS-demo'],actions:[['分享']]},v=api.crfMethodAssetsHeader(original,'a02','crfMethodAssets=1');assert.equal(v.concept,undefined);assert.deepEqual(v.tags,[]);assert.deepEqual(v.actions,[]);assert.equal(api.crfMethodAssetsHeader(original,'a02','assetDraftId=old'),original);
});
test('read verification failure is distinct from CAS mutation and only integrity 409 hides frozen content',()=>{
 assert.deepEqual(api.crfMethodAssetReadFailure({status:409,message:'来源无法核对'}),{state:'invalid',message:'来源无法核对'});assert.deepEqual(api.crfMethodAssetReadFailure({status:503,message:'暂时不可用'}),{state:'unverified',message:'暂时不可用'});assert.deepEqual(api.crfMethodAssetReadFailure({status:0,message:'网络断开'}),{state:'unverified',message:'网络断开'});
});
test('integrity failure from either independent read wins over an older temporary failure',()=>{
 const network={state:'unverified',message:'网络'},integrity={state:'invalid',message:'校验'};assert.equal(api.crfMethodAssetReadState(network,integrity),integrity);assert.equal(api.crfMethodAssetReadState(integrity,network),integrity);assert.equal(api.crfMethodAssetReadState(null,null),null);
});
test('reuse option presentation preserves string object and mixed legitimate choices',()=>{
 assert.equal(api.formatCrfMethodAssetOptions(['a','b']),'a，b');assert.equal(api.formatCrfMethodAssetOptions([{label:'类别',value:'x'}]),'类别=x');assert.equal(api.formatCrfMethodAssetOptions(['0',{label:'否',value:'false'}]),'0，否=false');
});
test('new exact API whitelist covers only own candidate operations, with bounded query and versions',()=>{
 assert.equal(typeof api.crfMethodAssetRequestAllowed,'function','new exact candidate API whitelist missing');
 for(const [method,path] of [['POST',root],['GET','/crf-method-asset-drafts'],['GET','/crf-method-asset-drafts?before=asset&limit=20'],['GET','/crf-method-asset-drafts/asset'],['GET','/crf-method-asset-drafts/asset/versions/30'],['POST','/crf-method-asset-drafts/asset/notes'],['POST','/crf-method-asset-drafts/asset/derivations']])assert(api.crfMethodAssetRequestAllowed(method,path),method+path);
 for(const [method,path] of [['GET','/crf-method-asset-drafts?limit=21'],['GET','/crf-method-asset-drafts?limit=01'],['GET','/crf-method-asset-drafts?limit=20&limit=20'],['GET','/crf-method-asset-drafts/a?extra=1'],['GET','/crf-method-asset-drafts/a/versions/31'],['POST',root+'?extra=1'],['DELETE','/crf-method-asset-drafts/a'],['POST','/crf-method-asset-drafts/a/export'],['GET','https://evil/crf-method-asset-drafts'],['GET','//evil/crf-method-asset-drafts'],['GET','/crf-method-asset-drafts/a/../b'],['GET','/crf-method-asset-drafts/%61']])assert(!api.crfMethodAssetRequestAllowed(method,path),method+path);
});
test('knowledge transport allows new candidate requests without opening generic artifact or export',async()=>{
 const seen=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'study'}),fetchImpl:async(path,init)=>{seen.push({path,init});return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await client.post(root,{baseReportVersionNo:2,requestKey:'request-001'});await client.get('/crf-method-asset-drafts?limit=20');assert.equal(seen.length,2);assert.equal(seen[0].init.headers['X-Research-Project-Id'],'study');
 await assert.rejects(()=>client.post('/research-artifacts/a/export',{}));assert.equal(seen.length,2);
});
test('32KiB middleware route includes encoded IDs, mixed case and trailing slash on notes/derive only',()=>{
 assert.equal(typeof api.crfMethodAssetBodyRoute,'function');const r=api.crfMethodAssetBodyRoute();
 for(const p of ['/api/crf-method-asset-drafts/a/notes','/API/crf-method-asset-drafts/%61/derivations/'])assert(r.test(p));
 for(const p of ['/api/research-artifacts/a/notes','/api/crf-method-asset-drafts/a/export','/api/crf-method-asset-drafts/a'])assert(!r.test(p));
});
