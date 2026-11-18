// Explicit read-only C07 proof. No fixtures, grants, model calls or probe re-arming.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCatalogTarget,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {LOCAL_ASSET_FIXTURE_PREFIX} from './research-assets-fixture-guard.mjs';
assert.equal(process.argv[2],'--verify','EXPLICIT_C07_POSTFLIGHT_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const dir=new URL('../../../.tmp/researchhub-assets-local/',import.meta.url),json=name=>JSON.parse(readFileSync(new URL(name,dir),'utf8'));
const preparation=json('source-preparation.json'),manifest=json('source-manifest.json'),trashProbe=json('a01-c07-trash-probe.json'),readProbe=json('a01-c07-read-window.json');
assert(trashProbe.used&&readProbe.endedAt&&readProbe.calls.length>0);
const read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
const proof=await read(async t=>{
 const kb=await t.knowledgeBase.findUnique({where:{id:manifest.kbId}});assert.equal(assetDigest(kb),preparation.snapshot.kbHash);
 const oldDocs=await t.knowledgeDoc.findMany({where:{id:{in:preparation.snapshot.oldDocIds}},select:{id:true,title:true,version:true,contentMd:true,reviewed:true,status:true,safetyLevel:true,trashedAt:true},orderBy:{id:'asc'}});
 assert.equal(assetDigest(oldDocs.map(d=>({...d,trashedAt:d.trashedAt?.toISOString()??null}))),preparation.snapshot.oldDocsHash);
 const docs=await t.knowledgeDoc.findMany({where:{id:{in:manifest.items.map(x=>x.id)}},select:{id:true,version:true,reviewed:true,status:true,contentMd:true}});assert.equal(docs.length,2);
 for(const d of docs)assert(d.version===2&&d.reviewed&&d.status==='published'&&manifest.items.find(x=>x.id===d.id).versions.some(v=>v.version===2&&v.contentHash===assetDigest(d.contentMd)));
 const count=await t.$queryRawUnsafe('SELECT count(*)::int n FROM rh_asset.asset_event WHERE tenant_id=$1 AND asset_id=$2 AND request_key=$3',ids.tenant,trashProbe.assetId,trashProbe.operationKey);assert.equal(count[0].n,1);
 const rows=await t.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:LOCAL_ASSET_FIXTURE_PREFIX}},select:{id:true,idempotencyKey:true,title:true,ownerAccountId:true,currentVersionNo:true}});assert.equal(rows.length,10);assert(rows.every(x=>x.currentVersionNo===2));
 const citations=await t.$queryRawUnsafe("SELECT request_key FROM rh_asset.asset_event WHERE tenant_id=$1 AND actor_account_id=$2 AND event_type='cited'",ids.tenant,ids.owner);assert.equal(citations.length,2);
 const [counts]=await t.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM rh_asset.asset_registry WHERE tenant_id=$1) assets,(SELECT count(*)::int FROM rh_asset.version_policy WHERE tenant_id=$1) versions,(SELECT count(*)::int FROM rh_asset.asset_event WHERE tenant_id=$1) events,(SELECT count(*)::int FROM rh_asset.asset_registry WHERE tenant_id=$1 AND deleted_at IS NOT NULL) trashed',ids.tenant);assert.deepEqual(counts,{assets:10,versions:15,events:39,trashed:0});
 return{counts,old:await readCatalogProtectedSnapshot(t,ids),sources:docs.map(({id,version,reviewed,status})=>({id,version,reviewed,status})),items:rows.map(r=>({id:r.id,actor:r.ownerAccountId===ids.owner?'owner':'admin',title:r.title,kind:r.idempotencyKey.split(':').at(-1)})),citationKeys:citations.map(x=>x.request_key),unknownTrashCommittedOnce:true};
});
const runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8')),origin='http://127.0.0.1:19501',checks=[];
for(const actor of ['owner','admin']){
 const l=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(l.status,201);const cookie=l.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');
 const headers={Cookie:cookie,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 for(const item of proof.items){const r=await fetch(origin+'/api/research-assets/'+item.id+'/versions/1',{headers});assert.equal(r.status,item.actor===actor?200:404);if(r.ok){const d=await r.json();assert.equal(d.schemaVersion,'rh-research-asset-detail.v1');assert.equal(d.version,1);assert.equal(d.currentVersion,2);}}
 const overview=await fetch(origin+'/api/my-research/overview',{headers});assert.equal(overview.status,200);const p=await overview.json();assert([...p.drafts,...p.activity].every(x=>!proof.items.some(a=>a.id===x.id)));
 if(actor==='owner')for(const key of proof.citationKeys){const r=await fetch(origin+'/api/research-assets/operations/'+key,{headers});assert.equal(r.status,200);const result=await r.json();assert.equal(result.status,'committed');assert.equal(result.contentAccess,'restricted');assert(!Object.hasOwn(result,'citation'));}
 checks.push({actor,oldV1OwnFixedReads:5,otherOwnerRefused:5,p01ExcludesAssetFamily:true,currentP01OwnDraftCount:p.summary.ownDraftCount,...(actor==='owner'?{revokedCitationReceiptsRedacted:2}:{})});
}
assert.deepEqual(await read(t=>readCatalogProtectedSnapshot(t,ids)),proof.old);
console.log(JSON.stringify({syntheticOnly:true,runtimePid:runtime.pid,businessWrites:0,modelCalls:0,counts:proof.counts,oldKbAndDocsUnchanged:true,sources:proof.sources,unknownTrashCommittedOnce:proof.unknownTrashCommittedOnce,readFailureWindowEnded:true,checks},null,2));
