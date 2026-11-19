import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assetProductionStatements,runtimeReuseKey} from './asset-production-ddl.mjs';
const snapshot=()=>JSON.parse(readFileSync(new URL('./fixtures/asset-production-baseline.json',import.meta.url)));
test('production asset delta retains legacy slots and adds exact business parents and current permissions',()=>{
 const statements=assetProductionStatements(snapshot()),sql=statements.join('\n');
 assert.equal(statements.length,24);assert(sql.includes("CASE WHEN asset_id LIKE 'rhab-%'"));assert(sql.includes('business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id)'));
 assert(sql.includes('detail_comment_slot'));assert(sql.includes('detail_reuse_slot'));assert(sql.includes("rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.target_project_id,'artifact.create')"));
 assert(sql.includes('c.revision=NEW.parent_revision'));assert(sql.includes("NEW.action<>'create' OR"));assert(sql.includes('business AND NEW.parent_revision IS DISTINCT FROM prior.parent_revision'));
 assert(sql.includes("f.\"artifactVersionId\""));assert(sql.includes("NEW.source_hash<>p.content_hash"));assert(sql.includes('NEW.source_policy_hash<>p.policy_hash'));
 assert(sql.includes("left(f.\"storageKey\",length(p.tenant_id||'/hub-assets/'))=p.tenant_id||'/hub-assets/'"));
 assert(sql.includes("string_to_array(f.\"storageKey\",'/')"));assert(!sql.includes("f.\"storageKey\" LIKE p.tenant_id"));
 assert(sql.includes('runtime_business_insert'));assert(!/DROP\s+(?:SCHEMA|TABLE|ROLE)/i.test(sql));assert(!sql.includes('DISABLE ROW LEVEL SECURITY'));
});
test('unknown or duplicate source definitions stop generation rather than widening an approximate match',()=>{
 const s=snapshot();s.functions=s.functions.filter(x=>x.name!=='check_detail_fact');assert.throws(()=>assetProductionStatements(s),/ASSET_PRODUCTION_SCHEMA_DRIFT/);
 const other=snapshot();other.functions.push(other.functions[0]);assert.throws(()=>assetProductionStatements(other),/ASSET_PRODUCTION_SCHEMA_DRIFT/);
});
test('reuse key binds source version, actor, target, operation and exact request',()=>{
 const p={kind:'copy',assetId:'rhab-00000000-0000-4000-8000-000000000001',version:1,targetProjectId:'new-project',accountId:'owner',requestKey:'request_0001'},original=runtimeReuseKey(p);
 assert.match(original,/^rhab-reuse:[a-f0-9]{64}$/);
 for(const change of [{kind:'apply'},{version:2},{targetProjectId:'other'},{accountId:'admin'},{requestKey:'request_0002'}])assert.notEqual(runtimeReuseKey({...p,...change}),original);
 assert.equal(runtimeReuseKey({...p}),original);
});
