// Candidate DDL + read-only predicate checks; always rollback. No accounts,
// members, assets, grants, releases or historical rows are inserted/updated.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readBusinessAssetAdmission,readBusinessSourceProtection} from './research-assets-business-preflight.mjs';
import {businessRecipientMigrationStatements} from '../server/research-assets/business-recipients-migration.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';

assert.deepEqual(process.argv.slice(2),['--rollback-only']);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const directory=new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/',import.meta.url),schema=JSON.parse(readFileSync(new URL('business-registration-base-schema.json',directory))),browser=JSON.parse(readFileSync(new URL('browser-c1/result.json',directory)));
assert.equal(browser.passed,true);assert.equal(browser.assets.length,8);assert.equal(browser.events.length,48);
const statements=businessRecipientMigrationStatements(schema),rollback=Error('EXPECTED_RECIPIENT_DDL_ROLLBACK'),checks=[];let complete=false;
const snapshot=()=>withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return{admission:await readBusinessAssetAdmission(tx,ids),sources:await readBusinessSourceProtection(tx,ids)};},{readOnly:true});
const before=await snapshot();assert.equal(before.admission.ddlFingerprint,schema.ddlFingerprint);
try{await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('rh_asset_business_migration'))");
 for(const sql of statements)await tx.$executeRawUnsafe(sql);
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 for(const label of ['A','B']){
  const asset=browser.assets.find(a=>a.label===label&&a.actor==='owner');
  await bindCatalogContext(tx,ids,ids.admin);await tx.$executeRawUnsafe("SELECT set_config('app.research_project_id',$1,true)",asset.project);
  const allowed=async(recipients,expected)=>{const[r]=await tx.$queryRawUnsafe('SELECT rh_asset.business_recipients_valid($1,$2,$3,$4,$5::text[]) AS allowed',asset.id,ids.tenant,ids.group,asset.project,recipients);assert.equal(r.allowed,expected);};
  await allowed([ids.owner],true);await allowed([ids.admin],true);await allowed([ids.owner,ids.admin],true);await allowed([],true);
  await allowed(['unproved-account'],false);await allowed([ids.owner,ids.owner],false);await allowed([null],false);await allowed(null,false);
  const[badParent]=await tx.$queryRawUnsafe('SELECT rh_asset.business_recipients_valid($1,$2,$3,$4,$5::text[]) AS allowed',before.admission.facts.asset_registry[0].asset_id,ids.tenant,ids.group,asset.project,[ids.owner]);assert.equal(badParent.allowed,false);
  const[dimensions]=await tx.$queryRawUnsafe('SELECT rh_asset.business_recipients_valid($1,$2,$3,$4,ARRAY[ARRAY[$5::text,$6::text]]) AS allowed',asset.id,ids.tenant,ids.group,asset.project,ids.owner,ids.admin);assert.equal(dimensions.allowed,false);
  checks.push(label+': real parent; current member/admin; empty allowed; unknown/duplicate/null/multidimensional/legacy parent denied');
 }
 // Exercise the final CHECK, not only its helper. Force the newly-created
 // candidate helper to deny inside this rollback transaction; no old helper,
 // account, member or asset row is changed. A legacy-recipient OR would fail
 // this test by admitting the business row despite the denial.
 const [constraint]=await tx.$queryRawUnsafe("SELECT pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE conrelid='rh_asset.version_policy'::regclass AND conname='version_policy_discovery_recipient_ceiling_check'");
 const expression=constraint.definition.match(/^CHECK \(([\s\S]*)\)$/)?.[1];assert(expression);
 const business=browser.assets.find(a=>a.actor==='owner'&&a.label==='A');
 await tx.$executeRawUnsafe("SELECT set_config('app.research_project_id',$1,true)",business.project);
 const evaluate=async asset=>{const [r]=await tx.$queryRawUnsafe(`SELECT (${expression}) AS allowed FROM rh_asset.version_policy WHERE asset_id=$1 AND version_no=2`,asset);assert(r);return r.allowed;};
 assert.equal(await evaluate(business.id),true);
 await tx.$executeRawUnsafe('RESET ROLE');
 await tx.$executeRawUnsafe("CREATE OR REPLACE FUNCTION rh_asset.business_recipients_valid(asset text,t text,g text,p text,recipients text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $denied$ SELECT false $denied$");
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 assert.equal(await evaluate(business.id),false,'Final CHECK must not fall back to legacy recipients');
 assert.equal(await evaluate(before.admission.facts.asset_registry[0].asset_id),true,'Legacy expression must remain unchanged');
 checks.push('final installed CHECK denies business when its current helper denies, even for an original recipient; legacy row retains original CHECK');
 await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');complete=true;throw rollback;
});}catch(e){if(e!==rollback)throw e;}
assert(complete);const after=await snapshot();assert.equal(after.admission.protectionHash,before.admission.protectionHash);assert.equal(after.admission.ddlFingerprint,before.admission.ddlFingerprint);assert.deepEqual(after.sources,before.sources);
const counts=await withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return tx.$queryRawUnsafe("SELECT count(*)::int AS assets,(SELECT count(*)::int FROM rh_asset.asset_event WHERE asset_id LIKE 'rhab-%') AS events FROM rh_asset.asset_registry WHERE asset_id LIKE 'rhab-%'");},{readOnly:true});assert.deepEqual(counts,[{assets:8,events:48}]);
const result={passed:true,at:new Date().toISOString(),mode:'candidate-rollback-only',checks,migrationHash:assetDigest(statements),beforeFingerprint:before.admission.ddlFingerprint,afterFingerprint:after.admission.ddlFingerprint,persistentDdlChanges:0,accountChanges:0,roleChanges:0,membershipChanges:0,newBusinessWrites:0,existingAssets:8,existingEvents:48,modelCalls:0,thirdMemberPositive:'awaiting explicit account/role/membership approval'};
writeFileSync(new URL('business-recipients-prediction.json',directory),JSON.stringify(result,null,2));writeFileSync(new URL('business-recipients-candidate.sql',directory),'-- Candidate only; not applied. Preserve the original baseline.\n'+statements.map(s=>s+';').join('\n\n')+'\n');console.log(JSON.stringify(result));
