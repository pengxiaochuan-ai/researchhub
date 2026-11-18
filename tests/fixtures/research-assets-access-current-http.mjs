// Read/denial-only verification of the approved C05 family; never creates a grant.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {verifyAssetPublicBaseline} from '../../scripts/research-assets-public-baseline.mjs';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
assert(['--before','--verify'].includes(process.argv[2]),'EXPLICIT_C05_READ_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
async function snapshot(){return read(async t=>{
 const protectedState=await readCatalogProtectedSnapshot(t,ids),initial=await t.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}});
 assert.equal(protectedState.oldAssetsHash,initial.meta.protectedSnapshot.oldAssetsHash);assert.equal(protectedState.roleHash,initial.meta.protectedSnapshot.roleHash);
 const proof=await verifyAssetPublicBaseline(t,{tenantId:ids.tenant,expectedHash:initial.meta.protectedSnapshot.publicDefinitionHash});
 const registry=await t.$queryRawUnsafe('SELECT asset_id,owner_account_id,asset_kind,revision FROM rh_asset.asset_registry WHERE tenant_id=$1 ORDER BY asset_id',ids.tenant);
 const events=await t.$queryRawUnsafe('SELECT asset_id,event_type,asset_revision,request_key FROM rh_asset.asset_event WHERE tenant_id=$1 ORDER BY asset_id,asset_revision',ids.tenant);
 const requests=await t.$queryRawUnsafe('SELECT asset_id,request_id,state,revision,approved_actions FROM rh_asset.access_request WHERE tenant_id=$1 ORDER BY request_id',ids.tenant);
 const [versions]=await t.$queryRawUnsafe('SELECT count(*)::int count FROM rh_asset.version_policy WHERE tenant_id=$1',ids.tenant);
 assert.equal(registry.length,10);assert.equal(versions.count,15);assert(events.length<=240);
 for(const r of registry){assert(r.revision<=24);assert.equal(events.filter(e=>e.asset_id===r.asset_id).length,r.revision);}
 assert.equal(new Set(events.map(e=>e.request_key)).size,events.length);
 const audits=await t.auditLog.count({where:{tenantId:ids.tenant,target:{in:registry.map(r=>r.asset_id)},action:{startsWith:'hub_asset_'}}});assert.equal(audits,events.length);
 return{protectedState,publicFullHash:proof.fullDefinitionHash,registry,events,requests,contentVersions:versions.count,audits};
 });}
const before=await snapshot(),asset=before.registry.find(r=>r.owner_account_id===ids.admin&&r.asset_kind==='protocol');assert(asset);
if(process.argv[2]==='--before'){assert.equal(before.events.length,24);assert.equal(before.requests.length,0);}
else{
 assert(before.requests.length>0);assert(before.events.some(e=>e.event_type==='cited'));assert(before.requests.every(r=>['rejected','revoked'].includes(r.state)));
 const probe=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/a01-usage-probe-20261113.json',import.meta.url),'utf8'));assert.equal(probe.used,true);assert.equal(probe.assetId,asset.asset_id);assert.equal(probe.receipt.revision,5);
 assert.equal(before.events.filter(e=>e.request_key===probe.operationKey).length,1);assert(before.requests.some(r=>r.request_id===probe.receipt.requestId));
}
const origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8')),checks=[];
for(const actor of ['owner','admin']){
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
 const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),user=await(await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}})).json();assert.equal(user.accountId,ids[actor]);
 const api=createAssetCatalogClient({user,scope,fetchImpl:(u,i)=>fetch(origin+u,{...i,headers:{...i.headers,Origin:origin,Cookie:cookie}})});
 const o=await api.get('/research-assets/'+asset.asset_id+'/usage?version=1');assert.equal(o.schemaVersion,'rh-asset-usage.v1');assert.equal(o.canManage,actor==='admin');assert.equal(o.canCite,actor==='admin');
 const collaborations=await api.get('/research-assets/collaborations?page=1&pageSize=20');assert.equal(collaborations.total,before.requests.length);
 const detail=await api.get('/research-assets/catalog/'+asset.asset_id+'/versions/1');assert.equal(detail.bodyAccess,actor==='admin'?'allowed':'restricted');if(actor==='owner')assert(!Object.hasOwn(detail,'contentMd'));
 const input={action:'cite',version:1,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestKey:'c05-http-denied-'+actor};
 await assert.rejects(api.post('/research-assets/'+asset.asset_id+'/access-requests',{...input,action:'ai'}),e=>e.status===400);
 await assert.rejects(api.post('/research-assets/'+asset.asset_id+'/access-requests/not-this-request/decisions',{...input,action:'decide',requestId:'another',expectedRequestRevision:1,conclusion:'approved',actions:['read_body'],reason:'路径身份拒绝验证'}),e=>e.status===400);
 if(actor==='owner')await assert.rejects(api.post('/research-assets/'+asset.asset_id+'/citations',input),e=>e.status===403);
 checks.push({actor,currentUsage:true,requestRows:collaborations.total,bodyAccess:detail.bodyAccess,canCite:o.canCite,pathIdentityAndClosedActions:true});
}
const after=await snapshot();assert.deepEqual(after,before);
const files=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/uploads/uploads.json',import.meta.url),'utf8'));assert.equal(files.items.length,4);assert(files.items.every(x=>x.status==='bound'));
console.log(JSON.stringify({syntheticOnly:true,realHttp:true,runtimePid:runtime.pid,logicalAssets:10,contentVersions:15,successfulEvents:before.events.length,audits:before.audits,requests:before.requests,citations:before.events.filter(e=>e.event_type==='cited').length,boundFiles:4,oldAssetsRolesPublicUnchanged:true,publicFullHash:before.publicFullHash,checks,businessWrites:0,modelsCalled:0},null,2));
