// Candidate only; no automatic migration or account/role/member mutation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const expected='c73e6bafdeba24f287ce803658a5ebe7ecafc9fe07595ed46b40ec3ae277d876';
export function businessRecipientMigrationStatements(before){
 const fingerprint=createHash('sha256').update(JSON.stringify({functions:before.functions,constraints:before.constraints,policies:before.policies,triggers:before.triggers})).digest('hex');
 assert.equal(fingerprint,expected,'BUSINESS_RECIPIENT_SCHEMA_DRIFT');
 const constraint=before.constraints.find(c=>c.table_name==='version_policy'&&c.name==='version_policy_discovery_recipient_ceiling_check');
 const inner=constraint?.definition.match(/^CHECK \(([\s\S]*)\)$/)?.[1];assert(inner,'BUSINESS_RECIPIENT_CHECK_MISSING');
 const helper=`CREATE FUNCTION rh_asset.business_recipients_valid(asset text,t text,g text,p text,recipients text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $b$
 SELECT rh_asset.business_object_matches(asset,t,g,p)
 AND recipients IS NOT NULL AND cardinality(recipients)<=100 AND coalesce(array_ndims(recipients),1)=1
 AND (SELECT count(DISTINCT v) FROM unnest(recipients) AS valueset(v))=cardinality(recipients)
 AND NOT EXISTS(SELECT 1 FROM unnest(recipients) AS valueset(recipient)
 WHERE recipient IS NULL OR recipient !~ '^[A-Za-z0-9_-]{1,160}$' OR NOT EXISTS(
  SELECT 1 FROM public.account a WHERE a.id=recipient AND a."tenantId"=t AND a.status='active'
  AND (a.role='tenant_admin' OR EXISTS(
   SELECT 1 FROM public.study_group_membership m JOIN public.permission_role b ON b.id=m."roleId"
   JOIN public.research_project_membership x ON x."accountId"=a.id AND x."tenantId"=t AND x."studyGroupId"=g AND x."researchProjectId"=p AND x.status='active'
   WHERE m."accountId"=a.id AND m."tenantId"=t AND m."studyGroupId"=g AND m.status='active' AND b."tenantId"=t AND b.status='active'
   AND (b."menuPermissions" ? 'artifacts' OR b."menuPermissions" ? '*')
   AND (b."buttonPermissions" ? 'artifact.read' OR b."buttonPermissions" ? '*'))))) $b$`;
 return[helper,
  'ALTER TABLE rh_asset.version_policy DROP CONSTRAINT version_policy_discovery_recipient_ceiling_check',
  // Prefix selects the fail-closed branch only. The helper must still prove
  // the exact ID/key/full parent; an invalid business parent cannot fall back
  // to the permissive historical two-recipient expression.
  `ALTER TABLE rh_asset.version_policy ADD CONSTRAINT version_policy_discovery_recipient_ceiling_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,discovery_recipient_ceiling) ELSE (${inner}) END)`,
  'REVOKE ALL ON FUNCTION rh_asset.business_recipients_valid(text,text,text,text,text[]) FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION rh_asset.business_recipients_valid(text,text,text,text,text[]) TO aisci_app'
 ];
}
