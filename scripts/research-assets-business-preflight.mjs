// Explicit, read-only admission. No migration, fixture, role or worker mutation.
import assert from'node:assert/strict';import{createHash}from'node:crypto';import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{fileURLToPath}from'node:url';
import{loadCatalogTarget,bindCatalogContext,readCatalogDefinitionRows}from'./research-assets-catalog-schema.mjs';import{assertFixtureTarget,withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
import{assetDigest}from'./research-assets-registration-contract.mjs';
import{REPORT_AI_CONSENT_SCHEMA_HASH}from'../server/research-assets/report-ai-consent-migration.mjs';
const json=v=>JSON.stringify(v,(_key,x)=>typeof x==='bigint'?x.toString():x);
const digest=v=>createHash('sha256').update(json(v)).digest('hex');
export async function readBusinessSourceProtection(tx,ids){
 const rows=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,NOT:{id:{startsWith:'rhab-'}},OR:[{researchProjectId:'rh-asset-detail-20261113-study-b'},{id:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe'}]},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
 const roles=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:{in:[ids.owner,ids.admin]}},include:{role:true},orderBy:{accountId:'asc'}});
 const files=['../scripts/local-knowledge.mjs','../scripts/local-full-study-simulation.mjs','../../.tmp/researchhub-knowledge-local/ai-budget-20261022.json'].map(path=>({path,hash:createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex')}));
 return{sourceIds:rows.map(r=>r.id),sourceHash:digest(rows),rolesHash:digest(roles),files};
}
export async function readBusinessAssetAdmission(tx,ids){
 const functions=await tx.$queryRawUnsafe("SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_asset' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)");
 const constraints=await tx.$queryRawUnsafe("SELECT c.relname AS table_name,x.conname AS name,pg_get_constraintdef(x.oid,true) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_asset' ORDER BY c.relname,x.conname");
 const policies=await tx.$queryRawUnsafe("SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='rh_asset' ORDER BY tablename,policyname");
 const triggers=await tx.$queryRawUnsafe("SELECT c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_asset' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname");
 const tables=['asset_registry','version_policy','asset_event','access_request','asset_comment_event','asset_reuse_record'],facts={};
 // Keep the original protected set, including any unexpected legacy row.
 // New business facts are counted separately; never reset the old baseline.
 for(const table of tables)facts[table]=await tx.$queryRawUnsafe(`SELECT asset_id,md5(to_jsonb(t)::text) AS fingerprint FROM rh_asset.${table} t WHERE tenant_id=$1 AND asset_id NOT LIKE 'rhab-%' ORDER BY asset_id,to_jsonb(t)::text`,ids.tenant);
 const assetIds=[...new Set(facts.asset_registry.map(r=>r.asset_id))];
 const artifacts=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,id:{in:assetIds}},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
 const accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,status:true,authVersion:true},orderBy:{id:'asc'}});
 const projectIds=[ids.project,'rh-asset-detail-20261113-study-b'];
 const projects=await tx.researchProject.findMany({where:{tenantId:ids.tenant,id:{in:projectIds}},select:{id:true,studyGroupId:true,status:true},orderBy:{id:'asc'}});
 const memberships=await tx.researchProjectMembership.findMany({where:{tenantId:ids.tenant,researchProjectId:{in:projectIds},accountId:{in:[ids.owner,ids.admin]}},select:{researchProjectId:true,accountId:true,roleKey:true,status:true,isDefault:true},orderBy:[{researchProjectId:'asc'},{accountId:'asc'}]});
 assert.equal(accounts.length,2);assert.equal(projects.length,2);assert(projects.every(p=>p.status==='active'&&p.studyGroupId===ids.group));
 return{schema:'rh-assets-business-admission.v1',scope:{tenantId:ids.tenant,studyGroupId:ids.group,projectIds},functions,constraints,policies,triggers,facts,artifactCount:artifacts.length,artifactHash:digest(artifacts),accounts,projects,memberships,protectionHash:digest({facts,artifactHash:digest(artifacts),accounts,projects,memberships}),ddlFingerprint:digest({functions,constraints,policies,triggers}),dataWrites:0,modelCalls:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert.deepEqual(process.argv.slice(2),['--read-only']);const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const result=await withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return readBusinessAssetAdmission(tx,ids);},{readOnly:true});
 const directory=new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/',import.meta.url);mkdirSync(directory,{recursive:true});const path=new URL('business-preflight.json',directory);
 if(existsSync(path)){const old=JSON.parse(readFileSync(path,'utf8')),applied=new URL('business-schema-applied.json',directory);let expected=existsSync(applied)?JSON.parse(readFileSync(applied,'utf8')).afterFingerprint:old.ddlFingerprint;
  const recipient=new URL('business-recipients-applied.json',directory);if(existsSync(recipient)){const r=JSON.parse(readFileSync(recipient));assert(r.passed);assert.equal(r.beforeFingerprint,expected,'Migration chain drift');expected=r.afterFingerprint;}
  assert.equal(result.protectionHash,old.protectionHash,'Do not reset existing protected facts');
  const aq=new URL('../docs/planning/research-assets-agent-qa-2026-11-16/evidence/aq02-schema-applied.json',import.meta.url);
  if(existsSync(aq)){
   const receipt=JSON.parse(readFileSync(aq));assert(receipt.passed);assert.equal(receipt.schemaHash,REPORT_AI_CONSENT_SCHEMA_HASH);
   // Preserve the original business migration chain; exclude only precisely
   // named AQ02 objects, then separately verify the entire new definition set.
   assert.equal(digest({functions:result.functions.filter(x=>x.name!=='check_ai_consent_event'),constraints:result.constraints.filter(x=>x.table_name!=='ai_use_consent_event'),policies:result.policies.filter(x=>x.tablename!=='ai_use_consent_event'),triggers:result.triggers.filter(x=>x.table_name!=='ai_use_consent_event')}),expected,'Old definitions changed');
   const definitions=await withFixtureTransaction(env,'direct',tx=>readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true}),{readOnly:true});assert.equal(assetDigest(definitions),receipt.afterDefinitionHash,'AQ02 definitions differ from explicit migration receipt');
  }else assert.equal(result.ddlFingerprint,expected,'DDL differs from its recorded migration');}else writeFileSync(path,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({passed:true,database:'wp01_test_full_baseline',functions:result.functions.length,constraints:result.constraints.length,policies:result.policies.length,triggers:result.triggers.length,protectedCounts:Object.fromEntries(Object.entries(result.facts).map(([k,v])=>[k,v.length])),projects:result.projects,dataWrites:0,modelCalls:0}));
}
