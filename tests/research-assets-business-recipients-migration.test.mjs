import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {businessRecipientMigrationStatements} from '../server/research-assets/business-recipients-migration.mjs';
const before=()=>JSON.parse(readFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-registration-base-schema.json',import.meta.url)));
test('recipient migration is one business-only helper and one preserved legacy CHECK, without row or role mutations',()=>{
 const sql=businessRecipientMigrationStatements(before());assert.equal(sql.length,5);
 assert(sql.some(s=>s.includes('CREATE FUNCTION rh_asset.business_recipients_valid')));
 const check=sql.find(s=>s.startsWith('ALTER TABLE')&&s.includes('ADD CONSTRAINT'));
 assert(check.includes("CASE WHEN asset_id LIKE 'rhab-%' THEN rh_asset.business_recipients_valid"));
 assert(check.includes('ELSE (rh_asset.recipients_valid(discovery_recipient_ceiling)) END'));
 assert(!check.includes(' OR rh_asset.business_recipients_valid'));
 assert(!sql.some(s=>/ALTER ROLE|CREATE ROLE|INSERT INTO|UPDATE public|DROP POLICY|scope_matches\(/.test(s)));
 assert.equal(sql.filter(s=>s.startsWith('ALTER TABLE')).length,2);
});
test('business recipient admission binds a real parent and current same-tenant Study read rights, never two named IDs',()=>{
 const sql=businessRecipientMigrationStatements(before())[0];
 for(const expected of ['business_object_matches','a."tenantId"=t',"a.status='active'","a.role='tenant_admin'",'study_group_membership','research_project_membership',"'artifact.read'",'cardinality(recipients)<=100','array_ndims','count(DISTINCT'])assert(sql.includes(expected),expected);
 assert(!sql.includes('rh-kb-local-'));assert(sql.includes('SECURITY INVOKER'));assert(sql.includes('SET search_path'));
});
test('unexpected current DDL drift rejects generation rather than rebuilding a new baseline',()=>{
 const value=before();value.functions[0].definition+=' changed';assert.throws(()=>businessRecipientMigrationStatements(value),/DRIFT/);
});
