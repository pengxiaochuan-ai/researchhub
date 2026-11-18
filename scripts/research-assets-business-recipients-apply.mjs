// Explicit, approved local migration. No accounts, memberships or assets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readBusinessAssetAdmission,readBusinessSourceProtection} from './research-assets-business-preflight.mjs';
import {businessRecipientMigrationStatements} from '../server/research-assets/business-recipients-migration.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--apply-approved-member-recipient-check']);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const directory=new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,directory)));
const base=read('business-registration-base-schema.json'),original=read('business-preflight.json'),sources=read('business-source-protection.json'),prediction=read('business-recipients-prediction.json'),statements=businessRecipientMigrationStatements(base),receipt=new URL('business-recipients-applied.json',directory);
assert(!existsSync(receipt),'Do not reapply or replace a receipt');assert(prediction.passed);assert.equal(prediction.migrationHash,assetDigest(statements));assert(prediction.checks.some(x=>x.startsWith('final installed CHECK denies')));
const result=await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('rh_asset_business_migration'))");
 const before=await readBusinessAssetAdmission(tx,ids);assert.equal(before.ddlFingerprint,base.ddlFingerprint);assert.equal(before.protectionHash,original.protectionHash);assert.deepEqual(await readBusinessSourceProtection(tx,ids),sources);
 for(const sql of statements)await tx.$executeRawUnsafe(sql);
 const after=await readBusinessAssetAdmission(tx,ids);assert.equal(after.protectionHash,before.protectionHash);assert.deepEqual(await readBusinessSourceProtection(tx,ids),sources);
 assert.deepEqual(after.policies,before.policies);assert.deepEqual(after.triggers,before.triggers);
 for(const f of before.functions)assert.deepEqual(after.functions.find(x=>x.name===f.name&&x.args===f.args),f);
 assert.equal(after.functions.length,before.functions.length+1);
 for(const c of before.constraints)if(c.name!=='version_policy_discovery_recipient_ceiling_check')assert.deepEqual(after.constraints.find(x=>x.name===c.name&&x.table_name===c.table_name),c);
 return{passed:true,at:new Date().toISOString(),migrationHash:assetDigest(statements),beforeFingerprint:before.ddlFingerprint,afterFingerprint:after.ddlFingerprint,protectedHash:after.protectionHash,accountChanges:0,roleChanges:0,membershipChanges:0,businessWrites:0,modelCalls:0};
});writeFileSync(receipt,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
