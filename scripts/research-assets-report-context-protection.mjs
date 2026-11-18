import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const mode=process.argv[2];assert(['--before','--after'].includes(mode)&&process.argv.length===3);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url);
const json=v=>JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x);
const state=await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);const legacy=await readAssetDetailProtectedSnapshot(tx,ids);
 const sources=await tx.researchArtifact.findMany({where:{id:c.reportId,tenantId:ids.tenant},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}}});
 assert.equal(sources.length,1);
 const oldAssets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,OR:[{idempotencyKey:{startsWith:'rh-research-asset:catalog-20261112:'}},{idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:'}}]},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});assert.equal(oldAssets.length,30);
 const owned={};for(const table of ['asset_registry','version_policy','access_request','asset_event','asset_comment_event','asset_reuse_record'])owned[table]=await tx.$queryRawUnsafe(`SELECT to_jsonb(t) AS row FROM rh_asset.${table} t WHERE tenant_id=$1 AND asset_id<>$2 ORDER BY to_jsonb(t)::text`,ids.tenant,c.assetId);
 const current=await tx.$queryRawUnsafe('SELECT to_jsonb(r) AS row FROM rh_asset.asset_registry r WHERE asset_id=$1',c.assetId);
 return{legacy,sourceHash:assetDigest(json(sources)),protectedAssetsHash:assetDigest(json(oldAssets)),oldFactsHash:assetDigest(owned),newRegistry:current};
},{readOnly:true});
const shared=['scripts/local-knowledge.mjs','scripts/local-full-study-simulation.mjs'].map(path=>({path,hash:assetDigest(readFileSync(new URL('../'+path,import.meta.url)))}));
const ledger=readFileSync(new URL('../../.tmp/researchhub-knowledge-local/ai-budget-20261022.json',import.meta.url));
const result={...state,shared,ledgerHash:assetDigest(ledger)};
if(mode==='--before'){assert.equal(state.newRegistry.length,0);const path=new URL('protection-before.json',out);if(existsSync(path))assert.deepEqual(result,JSON.parse(readFileSync(path)),'Do not reset an existing protection baseline');else writeFileSync(path,JSON.stringify(result,null,2));}
else{
 const before=JSON.parse(readFileSync(new URL('protection-before.json',out)));
 for(const key of ['legacy','sourceHash','protectedAssetsHash','oldFactsHash','ledgerHash','shared'])assert.deepEqual(result[key],before[key],key+' changed; do not reset the baseline');
 assert.equal(state.newRegistry.length,1);const r=state.newRegistry[0].row;assert.equal(r.working_state,'approved');assert.equal(r.working_version_no,2);assert.equal(r.release_state,'unreleased');assert.equal(r.released_version_no,null);assert(r.revision<=12);
 writeFileSync(new URL('protection-after.json',out),JSON.stringify({passed:true,...result},null,2));
}
console.log('REPORT_CONTEXT_PROTECTION_'+mode.slice(2).toUpperCase()+'_PASSED');
