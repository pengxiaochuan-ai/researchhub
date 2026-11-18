// Dedicated synthetic target, read-only evidence; never applies schema or creates data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert(process.argv.length===3&&['--before','--after'].includes(process.argv[2]));const mode=process.argv[2];
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const snapshot=await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);const legacy=await readAssetDetailProtectedSnapshot(tx,ids),facts={};
 for(const table of ['asset_registry','version_policy','access_request','asset_event','asset_comment_event','asset_reuse_record'])facts[table]=await tx.$queryRawUnsafe(`SELECT to_jsonb(t) AS row FROM rh_asset.${table} t WHERE tenant_id=$1 ORDER BY to_jsonb(t)::text`,ids.tenant);
 const assetIds=facts.asset_registry.map(x=>x.row.asset_id);assert.equal(assetIds.length,27,'Expected26 catalog/detail plus1 report context registries; StudyB drafts have no asset registry');
 const assets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,OR:[{id:{in:assetIds}},{id:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe'},{idempotencyKey:{startsWith:'rh-research-asset:catalog-20261112:'}},{idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:'}}]},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
 assert.equal(assets.length,32,'Old30 plus new report-context asset and original source report');
 const hash=x=>assetDigest(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v));
 return{legacy,assetCount:assets.length,registryCount:assetIds.length,assetHash:hash(assets),factsHash:hash(facts)};
},{readOnly:true});
const fixed=['pages/shared/layout-overrides.css','src/knowledge-reuse/components/Markdown.tsx','scripts/local-knowledge.mjs','scripts/local-full-study-simulation.mjs'];
const state={...snapshot,fixed:fixed.map(path=>({path,sha256:assetDigest(readFileSync(new URL('../'+path,import.meta.url)))})),ledgerHash:assetDigest(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/ai-budget-20261022.json',import.meta.url)))};
const out=new URL('../docs/planning/research-assets-a02-reading-2026-11-16/evidence/',import.meta.url),before=new URL('protection-before.json',out);
if(mode==='--before'){if(existsSync(before))assert.deepEqual(JSON.parse(readFileSync(before)),state,'Never reset protection baseline');else writeFileSync(before,JSON.stringify(state,null,2));}
else{assert.deepEqual(state,JSON.parse(readFileSync(before)));writeFileSync(new URL('protection-after.json',out),JSON.stringify({passed:true,...state},null,2));}
console.log('A02_READING_PROTECTION_'+mode.slice(2).toUpperCase()+'_PASSED');
