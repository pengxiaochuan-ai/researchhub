// Current F01/F02 read-only business verification after the named persistent fixtures exist.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertCatalogFixtureInventory,CATALOG_ASSET_PREFIX} from '../../scripts/research-assets-catalog-contract.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {assertAssetRegistrationOptions} from '../../src/research-assets-registration.js';
assert.equal(process.argv[2],'--verify','EXPLICIT_CURRENT_READ_VERIFICATION_REQUIRED');
const{env,ids}=loadCatalogTarget();await assertFixtureTarget(env);assert.equal((await executeCatalogSchema()).action,'verified');
const read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true}),before=await read(tx=>readCatalogProtectedSnapshot(tx,ids));
const rows=await read(tx=>tx.$queryRawUnsafe('SELECT a.id,a."tenantId",a."studyGroupId",a."researchProjectId",a."ownerAccountId",a."createdBy",a.status,a."deletedAt",a."currentVersionNo",a."idempotencyKey",(SELECT count(*)::int FROM rh_asset.asset_event e WHERE e.asset_id=a.id) AS "eventCount" FROM public.research_artifact a WHERE a."tenantId"=$1 AND a."idempotencyKey" LIKE $2 ORDER BY a.id LIMIT 11',ids.tenant,CATALOG_ASSET_PREFIX+'%'));assertCatalogFixtureInventory(rows,ids);assert.equal(rows.length,10);assert.equal(rows.reduce((n,r)=>n+r.currentVersionNo,0),13);assert.equal(rows.reduce((n,r)=>n+r.eventCount,0),13);
const uploads=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/uploads/uploads.json',import.meta.url),'utf8'));assert.equal(uploads.items.length,4);assert(uploads.items.every(x=>x.status==='bound'));assert(uploads.items.reduce((n,r)=>n+r.sizeBytes,0)<=20*1024*1024);
const probe=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/a01-response-probe-20261113.json',import.meta.url),'utf8'));assert.equal(probe.used,true);assert.equal(probe.receipt.version,3);
const eventProof=await read(tx=>tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM rh_asset.asset_event WHERE tenant_id=$1 AND asset_id=$2 AND actor_account_id=$3 AND request_key=$4',ids.tenant,probe.assetId,ids.admin,probe.operationKey));assert.equal(eventProof[0].count,1);
const runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8')),origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},checks=[];
for(const actor of ['owner','admin']){
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
 const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),me=await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}});assert.equal(me.status,200);const user=await me.json();assert.equal(user.accountId,ids[actor]);
 const api=createAssetCatalogClient({user,scope,fetchImpl:(url,init)=>fetch(origin+url,{...init,headers:{...init.headers,Cookie:cookie,Origin:origin}})}),catalog=await api.get('/research-assets/catalog?pageSize=20');assert.equal(catalog.total,actor==='owner'?5:10);assert.equal(catalog.stats.all,catalog.total);
 for(const kind of ['protocol','dataset','instrument','analysis','publication'])assert.equal(catalog.stats[kind],actor==='owner'?1:2);
 let versions=0;
 for(const row of catalog.items){
  for(let v=1;v<=row.currentVersion;v++){
   const d=await api.get('/research-assets/catalog/'+row.id+'/versions/'+v);assert.equal(d.id,row.id);assert.equal(d.version,v);assert.equal(d.bodyAccess,'allowed');assert(d.contentMd.includes('合成'));assert(!JSON.stringify(d).includes('storageKey'));if(v<row.currentVersion)assert(!d.canActions.includes('edit'));if(d.kind==='analysis')assert.equal(d.metadata.analysisNature,'method_description');versions++;
  }
 }
 if(actor==='owner'){
  const admin=rows.find(r=>r.idempotencyKey===CATALOG_ASSET_PREFIX+'admin:protocol');await assert.rejects(api.get('/research-assets/catalog/'+admin.id+'/versions/1'),e=>e.status===404);
  const protocol=rows.find(r=>r.idempotencyKey===CATALOG_ASSET_PREFIX+'owner:protocol');assert.equal((await api.get('/research-assets/catalog/'+protocol.id+'/versions/1')).metadata.purpose,'核对合成方案，准备后续人工评审。');assert((await api.get('/research-assets/catalog/'+protocol.id+'/versions/2')).metadata.purpose.includes('此版补充用途说明'));
 }else{
  const file=probe.assetId,v1=await api.get('/research-assets/catalog/'+file+'/versions/1'),v2=await api.get('/research-assets/catalog/'+file+'/versions/2'),v3=await api.get('/research-assets/catalog/'+file+'/versions/3');assert(v1.contentMd.includes('第二个真实文件登记验证'));assert(!v1.contentMd.includes('修订补充'));assert(v2.contentMd.includes('修订补充'));assert(!v2.contentMd.includes('材料核对说明'));assert(v3.contentMd.includes('材料核对说明'));
  const receipt=await api.get('/research-assets/operations/'+probe.operationKey);assert.equal(receipt.status,'committed');assert.equal(receipt.assetId,probe.assetId);assert.equal(receipt.version,3);assert.equal(receipt.attachmentStatus,'bound');
 }
 const options=assertAssetRegistrationOptions(await api.get('/research-assets/registrable-sources'),{scope,user});assert.equal(options.ownAssets.length,5);assert.equal(options.sources.length,2);assert.equal(options.pendingUploads.length,0);checks.push({actor,visibleAssets:catalog.total,allFiveKinds:true,fixedVersionsRead:versions,currentActorPinned:true});
}
assert.deepEqual(await read(tx=>readCatalogProtectedSnapshot(tx,ids)),before);
console.log(JSON.stringify({syntheticOnly:true,realHttp:true,checks,logicalAssets:10,contentVersions:13,successfulEvents:13,boundFiles:4,unknownOperationStoredOnce:true,oldDataAndRolesUnchanged:true,businessWrites:0,modelCalls:0},null,2));
