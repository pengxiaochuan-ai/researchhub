import test from 'node:test';
import assert from 'node:assert/strict';
import {hubReportSourceMigration} from './report-source-migration.mjs';
import {hubAssetMigration} from './migration.mjs';

const sql=()=>hubReportSourceMigration({ownerRole:'rh_owner',appRole:'rh_app'}).join('\n');
test('report migration preserves author seals and permissions and is only a delta',()=>{
 const text=sql();
 assert.match(text,/CREATE OR REPLACE FUNCTION rh_hub_asset.source_current/);
 for(const invariant of ["p.source_kind='author' AND p.source_bindings='[]'::jsonb",'r.approved_version_no=e.version_no',"r.release_state NOT IN ('withdrawn','expired')",'p.policy_hash=e.policy_hash'])assert(text.includes(invariant),invariant);
 assert(!text.includes('CREATE TABLE'));
 const family="p.source_kind='author' AND p.source_bindings='[]'::jsonb";
 const original=hubAssetMigration({ownerRole:'rh_owner',appRole:'rh_app'}).find(s=>s.startsWith('CREATE FUNCTION rh_hub_asset.source_current('));
 const replacement=hubReportSourceMigration({ownerRole:'rh_owner',appRole:'rh_app'}).find(s=>s.startsWith('CREATE OR REPLACE FUNCTION rh_hub_asset.source_current('));
 assert.equal(replacement,original.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace(family,`((${family}) OR (p.source_kind='artifact' AND rh_hub_asset.report_basic_current(e)))`),'all existing fixed author identity, rights, hash and permission predicates remain byte-for-byte');
 assert.throws(()=>hubReportSourceMigration({ownerRole:'bad;role',appRole:'app'}));
});
test('explicit source-change branches return unavailable without aborting the directory transaction',()=>{
 const body=hubReportSourceMigration({ownerRole:'rh_owner',appRole:'rh_app'}).find(s=>s.startsWith('CREATE OR REPLACE FUNCTION rh_hub_asset.report_bundle'));
 assert(!body.includes("RAISE EXCEPTION 'HUB_REPORT_SOURCE_INVALID'"));
 assert.match(body,/IF selected\.report_id IS NULL THEN RETURN NULL; END IF/);
 assert.match(body,/IF result IS NULL THEN RETURN NULL; END IF/);
 assert.match(body,/IF rh_hub_asset\.read_source\(entry_key,purpose\) IS DISTINCT FROM base THEN RETURN NULL; END IF/);
 assert(!body.includes('EXCEPTION WHEN'),'unexpected database failures must propagate');
});
test('report reads return a frozen descriptor and never SQL-deliver report body',()=>{
 const text=sql();
 for(const key of ['fixed-report','studyId','reportId','reportVersion','reportHash'])assert(text.includes(key));
 assert.match(text,/IF purpose='cite' OR report_binding IS NOT NULL THEN RETURN/);
 assert.match(text,/purpose NOT IN \('probe','read','cite','copy'\)/);
});
test('raw bundle is entry scoped, real actor bound, purpose authorized and privately granted',()=>{
 const text=sql();
 assert.match(text,/CREATE OR REPLACE FUNCTION rh_hub_asset.report_bundle\(entry_key text,purpose text\) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(text,/base:=rh_hub_asset.read_source\(entry_key,purpose\)/);
 assert.match(text,/'actorId',current_setting\('app.account_id',true\)/);
 assert.match(text,/REVOKE ALL ON FUNCTION rh_hub_asset.report_basic_current\(rh_hub_asset.entry\) FROM PUBLIC/);
 assert(!text.includes('GRANT EXECUTE ON FUNCTION rh_hub_asset.report_basic_current'));
 assert(!text.includes("set_config('app.account_id'"));
 for(const key of ['subjects','enrollments','visits','visitPlans','visitRequirements','assignments','responses','revisions','responseReviews','formVersions','participationEvents','queries','deviations','reportReview','methodReview','planReview','sources'])assert(text.includes("'"+key+"'"),key);
});
test('native source lock order holds scope then sorted capture parents then assignment/form then run/report',()=>{
 const text=sql(),body=text.slice(text.indexOf('CREATE OR REPLACE FUNCTION rh_hub_asset.report_bundle'));
 const markers=['-- plan serialization','-- capture scope','-- sorted subjects','-- enrollments','-- visits','-- assignments','-- selected fixed forms','-- run and fixed report'];
 let previous=-1;for(const marker of markers){const next=body.indexOf(marker);assert(next>previous,marker);previous=next;}
 assert.match(body,/pg_advisory_xact_lock/);assert.match(body,/FOR SHARE/);assert.match(body,/FOR UPDATE/);
 assert.match(body,/jsonb_agg\(to_jsonb\(z\) ORDER BY z\."subjectId",z\.sequence\)/);
 assert.match(body,/FROM public\.form_version z WHERE z\.id=ANY\(form_ids\)[^;]*ORDER BY z\.id FOR SHARE/);
 assert.match(body,/subjectVisitId" IS NULL AND \(q\."subjectId"=ANY\(subject_ids\) OR q\."subjectId" IS NULL\)/);
});
test('report provenance retains the original author native analysis, report and source Study qualification',()=>{
 const text=hubReportSourceMigration({ownerRole:'rh_owner',appRole:'rh_app'}).find(s=>s.startsWith('CREATE OR REPLACE FUNCTION rh_hub_asset.report_basic_current'));
 for(const requirement of ['public.tenant_feature_entitlement','study_operations','public.research_project_membership','public.study_group_membership','rh_research.project_intent',"'workbench'","'artifacts'","'data.analyze'","'artifact.read'",'source_owner.id=e.owner_id',"source_owner.role='tenant_admin' AND source_owner.\"isTenantAdmin\"=true"] )assert(text.includes(requirement),requirement);
 assert(!text.includes("source_role.\"buttonPermissions\"?'*'"),'native report/analyze permissions do not accept wildcard fallback');
});
