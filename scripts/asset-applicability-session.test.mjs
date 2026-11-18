import test from 'node:test';import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
import {designIdentityMode} from '../src/research-design-session.js';
const api=await import('../src/asset-applicability-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const scope={studyGroupId:'group',researchProjectId:'study'},q='assetApplicability=1&studyGroupId=group&researchProjectId=study';
test('self_check_uses_verified_root_plan_identity_not_asset_identity',()=>{assert.equal(typeof api.isApplicabilitySelfCheck,'function');assert(api.isApplicabilitySelfCheck({sourceAsset:{id:'different-asset'},sourceRoot:{planId:'plan'},targetPlan:{id:'plan'}}));assert(!api.isApplicabilitySelfCheck({sourceAsset:{id:'same'},sourceRoot:{planId:'original'},targetPlan:{id:'same'}}));assert(!api.isApplicabilitySelfCheck({sourceAsset:{id:'same'},targetPlan:{id:'same'}}));});
test('new applicability entry rejects duplicate mixed unknown query and keeps fixed history',()=>{
 assert.equal(typeof api.readAssetApplicabilityLocation,'function');
 assert.deepEqual(api.readAssetApplicabilityLocation('a02',q),{scope,recordId:null,versionNo:null});
 assert.deepEqual(api.readAssetApplicabilityLocation('a02',q+'&applicabilityId=record&applicabilityVersion=30'),{scope,recordId:'record',versionNo:30});
 for(const extra of ['&assetDrafts=1','&crfMethodAssets=1','&researchPlanId=plan','&assetApplicability=1','&x=1','&applicabilityVersion=1','&applicabilityId=%2Fbad','&applicabilityId=r&applicabilityVersion=01','&applicabilityId=r&applicabilityVersion=31'])assert.throws(()=>api.readAssetApplicabilityLocation('a02',q+extra));
 assert(api.isAssetApplicabilityRoute('a02','applicabilityVersion=2'));assert.throws(()=>api.readAssetApplicabilityLocation('a02','applicabilityVersion=2'));assert(api.isAssetApplicabilityRoute('a01',q),'wrong asset page must intercept new marker and reject instead of demo fallback');assert.throws(()=>api.readAssetApplicabilityLocation('a01',q));
 assert(designIdentityMode(true,true,'a02',q));
});
test('fixed source target and record return links preserve exact version never jump head',()=>{
 assert.equal(api.makeAssetApplicabilityUrl(scope,'r',2),'/pages/a02/?assetApplicability=1&studyGroupId=group&researchProjectId=study&applicabilityId=r&applicabilityVersion=2');
 assert.equal(new URL(api.applicabilitySourceUrl(scope,{id:'a',versionNo:3}),'http://local').searchParams.get('crfMethodAssetVersion'),'3');
 assert.equal(api.applicabilityTargetPath({id:'p',versionNo:4}),'/research-plan-drafts/p/versions/4');
 assert.throws(()=>api.applicabilitySourceUrl(scope,{id:'//bad',versionNo:3}));
});
test('exact API allowlist does not open generic writes governance encoded IDs or duplicate query',()=>{
 assert.equal(typeof api.assetApplicabilityRequestAllowed,'function');
 for(const [m,p]of [['GET','/asset-applicability-drafts?limit=20&before=r'],['POST','/asset-applicability-drafts'],['GET','/asset-applicability-drafts/r/versions/30'],['POST','/asset-applicability-drafts/r/opinions'],['POST','/asset-applicability-drafts/r/jobs'],['GET','/sessions/s/knowledge-sources/m/A1'],['GET','/sessions/s/knowledge-sources/m/T20']])assert(api.assetApplicabilityRequestAllowed(m,p),m+p);
 for(const [m,p]of [['DELETE','/asset-applicability-drafts/r'],['POST','/asset-applicability-drafts/r/export'],['GET','/asset-applicability-drafts?limit=21'],['GET','/asset-applicability-drafts?limit=1&limit=1'],['GET','/asset-applicability-drafts/r?x=1'],['GET','/asset-applicability-drafts/%61'],['GET','//evil/asset-applicability-drafts'],['GET','/asset-applicability-drafts/r/../q'],['GET','/sessions/s/knowledge-sources/m/A0'],['POST','/sessions/s/knowledge-sources/m/A1']])assert(!api.assetApplicabilityRequestAllowed(m,p),m+p);
});
test('transport reaches real new family and typed sources only within same authorized scope',async()=>{
 const seen=[],client=createKnowledgeClient({scope:()=>scope,fetchImpl:async(path,init)=>{seen.push({path,init});return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await client.get('/asset-applicability-drafts?limit=20');await client.get('/sessions/s/knowledge-sources/m/A1');await client.post('/asset-applicability-drafts/r/opinions',{baseVersionNo:2});
 assert.equal(seen.length,3);assert.equal(seen[2].init.headers['X-Research-Project-Id'],'study');await assert.rejects(()=>client.post('/asset-applicability-drafts/r/publish',{}));assert.equal(seen.length,3);
});
test('opinion validation preserves partial map and requires reasons without inventing changes',()=>{
 assert.equal(typeof api.validateApplicabilityOpinions,'function');
 const old={question:{decision:'reference',reason:'仅参考'}},drafts={question:{decision:'reference',reason:'仅参考'},visits:{decision:'revise',reason:'核对访视'}};
 assert.deepEqual(api.validateApplicabilityOpinions(old,drafts),{changes:[{ruleId:'visits',decision:'revise',reason:'核对访视'}],errors:{}});
 assert.deepEqual(api.validateApplicabilityOpinions({}, {question:{decision:'reference',reason:''}}).errors,{question:'请选择意见并填写1–1000字理由。'});
 assert.equal(api.displayApplicabilityValue({present:true,value:false}),'否（false）');assert.equal(api.displayApplicabilityValue({present:true,value:0}),'0');assert.equal(api.displayApplicabilityValue({present:false,value:null}),'未声明／未检查');
});
