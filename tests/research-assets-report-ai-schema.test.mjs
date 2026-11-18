import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{prepareReportAiConsentMigration}from'../server/research-assets/report-ai-consent-migration.mjs';
const sql=readFileSync(new URL('../server/research-assets/report-ai-consent-schema.sql',import.meta.url),'utf8');
test('candidate migration adds one owned append-only ledger and never alters old tables, accounts or content',()=>{
 const p=prepareReportAiConsentMigration({schemaExists:true,tableExists:false});assert.equal(p.statements.length,13);assert.equal(p.requiresExplicitApproval,true);assert.deepEqual(p.objects,{tables:1,functions:1,triggers:2,policies:2,indexes:1,localAdmissionConstraints:1});assert.equal(p.permissions,'SELECT,INSERT on rh_asset.ai_use_consent_event');assert.equal(p.schemaHash.length,64);
 assert.throws(()=>prepareReportAiConsentMigration({schemaExists:false,tableExists:false}));assert.throws(()=>prepareReportAiConsentMigration({schemaExists:true,tableExists:true}));
 assert.throws(()=>prepareReportAiConsentMigration({schemaExists:true,tableExists:false,sql:sql+'\n-- @statement\nALTER TABLE public.account ADD COLUMN accidental text;'}));
 assert.throws(()=>prepareReportAiConsentMigration({schemaExists:true,tableExists:false,sql:sql.replace('GRANT SELECT,INSERT','GRANT ALL')}));
});
test('candidate references the actual five-column fixed policy parent, uses least privileges and rejects omitted FORCE RLS',()=>{
 assert.match(sql,/FOREIGN KEY\(tenant_id,study_group_id,research_project_id,asset_id,version_no\) REFERENCES rh_asset\.version_policy\(tenant_id,study_group_id,research_project_id,asset_id,version_no\)/);
 assert(!sql.includes('FOR UPDATE'));
 assert.throws(()=>prepareReportAiConsentMigration({schemaExists:true,tableExists:false,sql:sql.replace('FORCE ROW LEVEL SECURITY','ENABLE ROW LEVEL SECURITY')}));
});
