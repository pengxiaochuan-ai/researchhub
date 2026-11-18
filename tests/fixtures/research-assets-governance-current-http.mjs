// Post-C04 exact stage verification; no successful business writes or model calls.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {verifyAssetPublicBaseline} from '../../scripts/research-assets-public-baseline.mjs';
assert(['--verify','--diagnose'].includes(process.argv[2]),'EXPLICIT_GOVERNANCE_CURRENT_READ_REQUIRED');const diagnosis=process.argv[2]==='--diagnose';
const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true}),before=await read(t=>readCatalogProtectedSnapshot(t,ids));
const initial=await read(t=>t.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}}));
assert.equal(before.oldAssetsHash,initial.meta.protectedSnapshot.oldAssetsHash);assert.equal(before.roleHash,initial.meta.protectedSnapshot.roleHash);
const publicProof=await read(t=>verifyAssetPublicBaseline(t,{tenantId:ids.tenant,expectedHash:initial.meta.protectedSnapshot.publicDefinitionHash}));
const publicDefinitionMatchesD01=publicProof.proof.matched;
const data=await read(async t=>({registry:await t.$queryRawUnsafe('SELECT * FROM rh_asset.asset_registry WHERE tenant_id=$1 ORDER BY owner_account_id,asset_kind',ids.tenant),events:await t.$queryRawUnsafe('SELECT asset_id,event_type,asset_revision,actor_account_id,request_key,payload FROM rh_asset.asset_event WHERE tenant_id=$1 ORDER BY asset_id,asset_revision',ids.tenant),versions:await t.$queryRawUnsafe('SELECT count(*)::int count FROM rh_asset.version_policy WHERE tenant_id=$1',ids.tenant)}));
assert.equal(data.registry.length,10);assert.equal(data.events.length,24);assert.equal(data.versions[0].count,15);
const owner=data.registry.find(r=>r.owner_account_id===ids.owner&&r.asset_kind==='protocol'),admin=data.registry.find(r=>r.owner_account_id===ids.admin&&r.asset_kind==='protocol');
assert.equal(owner.working_version_no,4);assert.equal(owner.revision,10);assert.equal(owner.working_state,'draft');assert.equal(owner.release_state,'withdrawn');assert.equal(owner.released_version_no,null);
assert.equal(admin.working_version_no,1);assert.equal(admin.revision,4);assert.equal(admin.working_state,'approved');assert.equal(admin.release_state,'released');
const probe=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/a01-governance-probe-20261113.json',import.meta.url),'utf8'));assert.equal(probe.used,true);assert.equal(probe.assetId,owner.asset_id);assert.equal(data.events.filter(e=>e.request_key===probe.operationKey).length,1);
const selfReviews=data.events.filter(e=>e.event_type==='reviewed'&&e.payload.conclusion==='approved');assert.equal(selfReviews.length,2);assert(selfReviews.every(e=>e.payload.selfReview===true&&e.payload.contentChecked===true&&e.payload.rightsChecked===true));
await read(async t=>{assert.equal(await t.researchArtifactReview.count({where:{artifactId:{in:[owner.asset_id,admin.asset_id]}}}),3);assert.equal(await t.auditLog.count({where:{tenantId:ids.tenant,target:{in:data.registry.map(r=>r.asset_id)},action:{startsWith:'hub_asset_'}}}),24);});
const uploads=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/uploads/uploads.json',import.meta.url),'utf8'));assert.equal(uploads.items.length,4);assert(uploads.items.every(x=>x.status==='bound'));
const runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8')),origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},checks=[];
for(const actor of ['owner','admin']){
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
 const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),me=await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}}),user=await me.json();assert.equal(user.accountId,ids[actor]);
 const api=createAssetCatalogClient({user,scope,fetchImpl:(url,init)=>fetch(origin+url,{...init,headers:{...init.headers,Cookie:cookie,Origin:origin}})});
 const catalog=await api.get('/research-assets/catalog?pageSize=20');assert.equal(catalog.total,actor==='owner'?6:10);
 const working=catalog.items.find(r=>r.id===owner.asset_id);assert.equal(working.version,4);assert.equal(working.state,'draft');assert.equal(working.scope,'private');
 const old=await api.get('/research-assets/catalog/'+owner.asset_id+'/versions/3');assert.equal(old.state,'withdrawn');assert.equal(old.isHistorical,true);assert(!old.canActions.includes('withdraw'));assert(!old.canActions.includes('edit'));assert(!old.metadata.purpose.includes('不覆盖已发布第三版'));
 const draft=await api.get('/research-assets/catalog/'+owner.asset_id+'/versions/4');assert(draft.metadata.purpose.includes('不覆盖已发布第三版'));
 const released=await api.get('/research-assets/catalog/'+admin.asset_id+'/versions/1');assert.equal(released.state,'released');
 if(actor==='owner'){
  assert.equal(released.bodyAccess,'restricted');assert(!Object.hasOwn(released,'contentMd'));assert(!released.canActions.some(x=>['edit','review','release','withdraw'].includes(x)));
  await assert.rejects(api.get('/research-assets/'+admin.asset_id+'/governance?version=1'),e=>e.status===404);
  const o=await api.get('/research-assets/'+owner.asset_id+'/governance?version=4');
  const review={action:'review',version:4,expectedRevision:o.expectedRevision,requestKey:'gov-current-forbidden-review',contentHash:o.contentHash,policyHash:o.policyHash,identityRevision:o.identityRevision,conclusion:'approved',reason:'受控权限拒绝验证',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:true};
  await assert.rejects(api.post('/research-assets/'+owner.asset_id+'/reviews',review),e=>e.status===403);
 }else{
  assert.equal(released.bodyAccess,'allowed');const receipt=await api.get('/research-assets/operations/'+probe.operationKey);assert.equal(receipt.operation,'withdrawn');assert.equal(receipt.revision,10);
  const o=await api.get('/research-assets/'+owner.asset_id+'/governance?version=4');assert.equal(o.selfReview,true);assert.deepEqual(o.actions,['submit']);
  // Singular development-only spelling is not retained as a second lifecycle route.
  const forbidden=await fetch(origin+'/api/research-assets/'+owner.asset_id+'/withdraw',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project,'X-ResearchHub-Actor':user.accountId,'X-ResearchHub-Auth-Version':String(user.authVersion),'X-ResearchHub-Request':'asset-catalog-v1'},body:JSON.stringify({})});assert.equal(forbidden.status,404);
 }
 checks.push({actor,visibleAssets:catalog.total,privateV4SeparateFromWithdrawnV3:true,releasedBodyAccess:released.bodyAccess});
}
const after=await read(t=>readCatalogProtectedSnapshot(t,ids));assert.deepEqual({...after,publicDefinitionHash:undefined},{...before,publicDefinitionHash:undefined});
assert.equal((await read(t=>verifyAssetPublicBaseline(t,{tenantId:ids.tenant,expectedHash:initial.meta.protectedSnapshot.publicDefinitionHash}))).fullDefinitionHash,publicProof.fullDefinitionHash);
assert.equal((await read(t=>t.$queryRawUnsafe('SELECT count(*)::int count FROM rh_asset.asset_event WHERE tenant_id=$1',ids.tenant)))[0].count,24);
console.log(JSON.stringify({syntheticOnly:true,realHttp:true,runtimePid:runtime.pid,checks,logicalAssets:10,contentVersions:15,successfulEvents:24,boundFiles:4,reviewRows:3,auditRows:24,withdrawalStoredOnce:true,oldTenAssetsTwentyVersionsAndRolesUnchanged:true,publicDefinitionMatchesD01,publicProof,rawHashMatchesD01:before.publicDefinitionHash===initial.meta.protectedSnapshot.publicDefinitionHash,initialPublicHash:initial.meta.protectedSnapshot.publicDefinitionHash,currentPublicHash:before.publicDefinitionHash,gate:publicDefinitionMatchesD01?'passed':'blocked_public_schema_drift',diagnosisOnly:diagnosis,businessWrites:0,modelsCalled:0},null,2));
