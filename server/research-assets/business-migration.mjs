import assert from'node:assert/strict';import{createHash}from'node:crypto';
const expected='03e5cbc329a8ee9fe950095546bc54edd48d6c364be184eceb0129edf697a836';
export function businessMigrationStatements(before){
 const fingerprint=createHash('sha256').update(JSON.stringify({functions:before.functions,constraints:before.constraints,policies:before.policies,triggers:before.triggers})).digest('hex');assert.equal(fingerprint,expected,'BUSINESS_SCHEMA_BASELINE_DRIFT');
 const statements=[];
 statements.push(`CREATE FUNCTION rh_asset.business_parent_matches(a text,t text,g text,p text,o text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $b$
 SELECT a ~ '^rhab-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 AND EXISTS(SELECT 1 FROM public.research_artifact x JOIN public.account u ON u.id=x."ownerAccountId" AND u."tenantId"=t
 JOIN public.research_project r ON r.id=p AND r."tenantId"=t AND r."studyGroupId"=g
 JOIN public.study_group s ON s.id=g AND s."tenantId"=t
 WHERE x.id=a AND x."tenantId"=t AND x."studyGroupId"=g AND x."researchProjectId"=p AND x."ownerAccountId"=o AND x."createdBy"=o
 AND x."typeKey"='research_report' AND x.status='draft' AND x."deletedAt" IS NULL AND x."idempotencyKey"='rh-research-asset:business:v1:'||a
 AND r.status='active' AND s.status='active') $b$`);
 statements.push(`CREATE FUNCTION rh_asset.business_object_matches(a text,t text,g text,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $b$
 SELECT EXISTS(SELECT 1 FROM public.research_artifact x WHERE x.id=a AND rh_asset.business_parent_matches(a,t,g,p,x."ownerAccountId")) $b$`);
 statements.push(`CREATE FUNCTION rh_asset.business_scope_matches(t text,g text,p text,action text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $b$
 SELECT action IN ('artifact.read','artifact.create','artifact.edit','artifact.review','artifact.release','artifact.archive')
 AND t=current_setting('app.tenant_id',true) AND g=current_setting('app.study_group_id',true) AND p=current_setting('app.research_project_id',true)
 AND EXISTS(SELECT 1 FROM public.account a JOIN public.tenant n ON n.id=a."tenantId" JOIN public.study_group s ON s.id=g AND s."tenantId"=t
 JOIN public.research_project r ON r.id=p AND r."tenantId"=t AND r."studyGroupId"=g
 WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=t AND a."authVersion"::text=current_setting('app.auth_version',true)
 AND a.status='active' AND n.status='active' AND s.status='active' AND r.status='active'
 AND (a.role='tenant_admin' OR EXISTS(SELECT 1 FROM public.study_group_membership m JOIN public.permission_role b ON b.id=m."roleId"
 JOIN public.research_project_membership x ON x."accountId"=a.id AND x."tenantId"=t AND x."studyGroupId"=g AND x."researchProjectId"=p AND x.status='active'
 WHERE m."accountId"=a.id AND m."tenantId"=t AND m."studyGroupId"=g AND m.status='active' AND b."tenantId"=t AND b.status='active'
 AND (b."menuPermissions" ? 'artifacts' OR b."menuPermissions" ? '*') AND (b."buttonPermissions" ? 'artifact.read' OR b."buttonPermissions" ? '*') AND (b."buttonPermissions" ? action OR b."buttonPermissions" ? '*')))) $b$`);
 const parent='rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id)',object='rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id)';
 const changes={asset_registry_research_project_id_check:parent,asset_registry_study_group_id_check:parent,asset_registry_owner_account_id_check:parent,asset_registry_revision_check:`(${object} AND revision>0)`,asset_registry_working_version_no_check:`(${object} AND working_version_no>0)`,version_policy_version_no_check:`(${object} AND version_no>0)`,asset_event_asset_revision_check:`(${object} AND asset_revision>0)`};
 for(const[name,addition]of Object.entries(changes)){const c=before.constraints.find(c=>c.name===name);assert(c);const match=c.definition.match(/^CHECK \(([\s\S]*)\)$/);assert(match);statements.push(`ALTER TABLE rh_asset.${c.table_name} DROP CONSTRAINT ${name}`,`ALTER TABLE rh_asset.${c.table_name} ADD CONSTRAINT ${name} CHECK ((${match[1]}) OR ${addition})`);}
 const original=before.functions.find(f=>f.name==='check_registry_parent').definition;
 const limit='OR rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)=0 OR NEW.working_version_no>rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)';assert.equal(original.split(limit).length,2);
 const revised=original.replace(limit,`OR (NOT rh_asset.business_parent_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.owner_account_id) AND (rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)=0 OR NEW.working_version_no>rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)))`).replace('BEGIN\n',`BEGIN
 IF rh_asset.business_parent_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.owner_account_id) THEN
  IF TG_OP='INSERT' AND (NEW.owner_account_id IS DISTINCT FROM actor OR NEW.revision<>1 OR NEW.working_version_no<>1 OR NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.create')) THEN RAISE EXCEPTION 'BUSINESS_CREATE_DENIED' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,CASE WHEN actor=NEW.owner_account_id THEN 'artifact.edit' ELSE 'artifact.read' END) THEN RAISE EXCEPTION 'BUSINESS_UPDATE_DENIED' USING ERRCODE='42501'; END IF;
 END IF;
`);statements.push(revised);
 for(const table of['asset_registry','version_policy','asset_event','access_request']){
  const scoped=action=>`${object} AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'${action}')`;
  statements.push(`CREATE POLICY business_select ON rh_asset.${table} FOR SELECT USING (${scoped('artifact.read')})`);
  if(table==='access_request')continue;
  const insert=table==='asset_registry'?scoped('artifact.create'):table==='version_policy'?`(${scoped('artifact.create')}) OR (${scoped('artifact.edit')})`:scoped('artifact.read');
  statements.push(`CREATE POLICY business_insert ON rh_asset.${table} FOR INSERT WITH CHECK (${insert})`);
  if(table==='asset_registry')statements.push(`CREATE POLICY business_update ON rh_asset.${table} FOR UPDATE USING (${scoped('artifact.read')}) WITH CHECK (${scoped('artifact.read')})`);
 }
 for(const signature of['business_parent_matches(text,text,text,text,text)','business_object_matches(text,text,text,text)','business_scope_matches(text,text,text,text)'])statements.push(`REVOKE ALL ON FUNCTION rh_asset.${signature} FROM PUBLIC`,`GRANT EXECUTE ON FUNCTION rh_asset.${signature} TO aisci_app`);
 return statements;
}
