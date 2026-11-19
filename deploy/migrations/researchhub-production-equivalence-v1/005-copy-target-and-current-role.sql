CREATE OR REPLACE FUNCTION rh_asset.business_scope_matches(t text, g text, p text, action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT action IN ('artifact.read','artifact.create','artifact.edit','artifact.review','artifact.release','artifact.archive')
 AND t=current_setting('app.tenant_id',true) AND g=current_setting('app.study_group_id',true) AND p=current_setting('app.research_project_id',true)
 AND EXISTS(SELECT 1 FROM public.account a JOIN public.tenant n ON n.id=a."tenantId" JOIN public.study_group s ON s.id=g AND s."tenantId"=t
 JOIN public.research_project r ON r.id=p AND r."tenantId"=t AND r."studyGroupId"=g
 WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=t AND a."authVersion"::text=current_setting('app.auth_version',true)
 AND a.role IN ('researcher','tenant_admin') AND a."isTenantAdmin"=(a.role='tenant_admin') AND a.status='active' AND n.status='active' AND s.status='active' AND r.status='active'
 AND (a.role='tenant_admin' OR EXISTS(SELECT 1 FROM public.study_group_membership m JOIN public.permission_role b ON b.id=m."roleId"
 JOIN public.research_project_membership x ON x."accountId"=a.id AND x."tenantId"=t AND x."studyGroupId"=g AND x."researchProjectId"=p AND x.status='active'
 WHERE m."accountId"=a.id AND m."tenantId"=t AND m."studyGroupId"=g AND m.status='active' AND b."tenantId"=t AND b.status='active'
 AND (b."menuPermissions" ? 'artifacts' OR b."menuPermissions" ? '*') AND (b."buttonPermissions" ? 'artifact.read' OR b."buttonPermissions" ? '*') AND (b."buttonPermissions" ? action OR b."buttonPermissions" ? '*')))) $function$
;
CREATE OR REPLACE FUNCTION rh_asset.check_detail_fact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'rh_asset'
AS $function$
DECLARE e rh_asset.asset_event%ROWTYPE; prior rh_asset.asset_comment_event%ROWTYPE; r rh_asset.asset_registry%ROWTYPE; p rh_asset.version_policy%ROWTYPE; t public.research_artifact%ROWTYPE; manager boolean; saved_project text; business boolean; target_allowed boolean;
BEGIN
 business:=rh_asset.business_object_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id);
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 SELECT * INTO p FROM rh_asset.version_policy WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no;
 SELECT * INTO e FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND asset_revision=NEW.event_revision;
 IF r.asset_id IS NULL OR p.asset_id IS NULL OR e.asset_id IS NULL OR e.version_no<>NEW.version_no OR e.actor_account_id<>NEW.actor_account_id OR NEW.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR e.request_key<>NEW.request_key OR e.request_hash<>NEW.request_hash THEN RAISE EXCEPTION 'ASSET_DETAIL_EVENT_REQUIRED'; END IF;
 IF NOT business AND NOT EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND a."idempotencyKey" LIKE 'rh-research-asset:detail-20261113:%') THEN RAISE EXCEPTION 'ASSET_DETAIL_FAMILY_REQUIRED'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.account a WHERE a.id=NEW.actor_account_id AND a."tenantId"=NEW.tenant_id AND a.role='tenant_admin' AND a.status='active') INTO manager;
 IF TG_TABLE_NAME='asset_comment_event' THEN
  IF NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'comment') OR NOT (EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND rh_asset.detail_comment_slot(NEW.comment_id,NEW.author_account_id,a."idempotencyKey",NEW.version_no,NEW.parent_comment_id)) OR (business AND (NEW.action<>'create' OR (NEW.parent_comment_id IS NULL AND NEW.parent_revision IS NULL) OR EXISTS(SELECT 1 FROM rh_asset.asset_comment_event c WHERE c.comment_id=NEW.parent_comment_id AND c.asset_id=NEW.asset_id AND c.version_no=NEW.version_no AND c.tenant_id=NEW.tenant_id AND c.study_group_id=NEW.study_group_id AND c.research_project_id=NEW.research_project_id AND c.revision=NEW.parent_revision AND c.revision=(SELECT max(z.revision) FROM rh_asset.asset_comment_event z WHERE z.comment_id=c.comment_id) AND c.action IN ('create','edit'))))) THEN RAISE EXCEPTION 'ASSET_COMMENT_SLOT_INVALID'; END IF;
  IF NEW.action='withdraw' AND NEW.actor_account_id<>NEW.author_account_id THEN RAISE EXCEPTION 'ASSET_COMMENT_AUTHOR_REQUIRED'; END IF;
  IF e.event_type<>'comment_changed' OR e.payload->>'commentId' IS DISTINCT FROM NEW.comment_id OR (e.payload->>'commentRevision')::integer IS DISTINCT FROM NEW.revision OR e.payload->>'action' IS DISTINCT FROM NEW.action THEN RAISE EXCEPTION 'ASSET_COMMENT_EVENT_REQUIRED'; END IF;
  SELECT * INTO prior FROM rh_asset.asset_comment_event WHERE comment_id=NEW.comment_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1;
  IF NEW.action='create' THEN
   IF NEW.revision<>1 OR prior.event_id IS NOT NULL OR NEW.author_account_id<>NEW.actor_account_id OR length(trim(NEW.body))=0 THEN RAISE EXCEPTION 'ASSET_COMMENT_CREATE_INVALID'; END IF;
  ELSE
   IF prior.event_id IS NULL OR NEW.revision<>prior.revision+1 OR prior.action IN ('withdraw','moderate') OR NEW.author_account_id<>prior.author_account_id OR NEW.parent_comment_id IS DISTINCT FROM prior.parent_comment_id OR (business AND NEW.parent_revision IS DISTINCT FROM prior.parent_revision) OR NEW.asset_id<>prior.asset_id OR NEW.version_no<>prior.version_no OR (NEW.actor_account_id<>prior.author_account_id AND NOT manager) OR (NEW.action='moderate' AND (NOT manager OR length(trim(coalesce(NEW.reason,'')))=0)) OR (NEW.action IN ('withdraw','moderate') AND NEW.body<>'') OR (NEW.action='edit' AND (NEW.actor_account_id<>prior.author_account_id OR length(trim(NEW.body))=0)) THEN RAISE EXCEPTION 'ASSET_COMMENT_REVISION_INVALID'; END IF;
  END IF;
 ELSE
  IF e.event_type IS DISTINCT FROM (CASE WHEN NEW.kind='copy' THEN 'asset_copy' ELSE 'asset_apply' END) OR e.payload->>'targetArtifactId' IS DISTINCT FROM NEW.target_artifact_id OR NEW.source_hash<>p.content_hash OR NEW.source_policy_hash<>p.policy_hash THEN RAISE EXCEPTION 'ASSET_REUSE_EVENT_REQUIRED'; END IF;
  saved_project:=current_setting('app.research_project_id',true);PERFORM set_config('app.research_project_id',NEW.target_project_id,true);
  SELECT * INTO t FROM public.research_artifact WHERE id=NEW.target_artifact_id;
  SELECT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.target_project_id,'artifact.create') INTO target_allowed;
  PERFORM set_config('app.research_project_id',saved_project,true);
  IF t.id IS NULL OR t."tenantId"<>NEW.tenant_id OR t."studyGroupId"<>NEW.study_group_id OR t."researchProjectId"<>NEW.target_project_id OR t."ownerAccountId"<>NEW.actor_account_id OR t."createdBy"<>NEW.actor_account_id OR t.status<>'draft' OR t."deletedAt" IS NOT NULL OR t."currentVersionNo"<>1 THEN RAISE EXCEPTION 'ASSET_REUSE_TARGET_INVALID'; END IF;
  IF (NOT business AND NOT rh_asset.detail_reuse_slot((SELECT "idempotencyKey" FROM public.research_artifact WHERE id=NEW.asset_id),t."idempotencyKey",NEW.actor_account_id,NEW.kind,NEW.version_no,NEW.target_project_id)) OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,CASE WHEN NEW.kind='copy' THEN 'derive' ELSE 'apply' END) THEN RAISE EXCEPTION 'ASSET_REUSE_SLOT_INVALID'; END IF;
  IF NEW.kind='copy' THEN
   IF (t."typeKey"<>'research_report') OR (NOT business AND (NEW.target_project_id<>'rh-kb-local-b0e2af9d-project' OR t."typeKey"<>'research_report' OR t."idempotencyKey" NOT IN ('rh-research-asset:detail-20261113:owner:protocol:copy','rh-research-asset:detail-20261113:owner:dataset:copy','rh-research-asset:detail-20261113:owner:instrument:copy','rh-research-asset:detail-20261113:admin:protocol:copy','rh-research-asset:detail-20261113:admin:analysis:copy','rh-research-asset:detail-20261113:admin:publication:copy'))) OR (business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM 'rh-research-asset:business:v1:'||t.id OR t."creationRequestHash" IS DISTINCT FROM encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex') OR t."currentVersionNo"<>1 OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_registry rr JOIN rh_asset.version_policy vp ON vp.asset_id=rr.asset_id AND vp.version_no=1 JOIN public.research_artifact_version av ON av.id=vp.artifact_version_id AND av."artifactId"=rr.asset_id AND av."versionNo"=1 WHERE rr.asset_id=t.id AND rr.tenant_id=NEW.tenant_id AND rr.study_group_id=NEW.study_group_id AND rr.research_project_id=NEW.target_project_id AND rr.owner_account_id=NEW.actor_account_id AND rr.asset_kind=r.asset_kind AND rr.working_version_no=1 AND rr.working_state='draft' AND rr.deleted_at IS NULL AND av."tenantId"=rr.tenant_id AND av."studyGroupId"=rr.study_group_id AND av."researchProjectId"=rr.research_project_id AND vp.source_kind='artifact' AND vp.source_bindings=jsonb_build_array(jsonb_build_object('kind','artifact','id',NEW.asset_id,'version',NEW.version_no,'contentHash',NEW.source_hash)) AND vp.content_hash=NEW.source_hash AND av."contentHash"=vp.content_hash AND encode(sha256(convert_to(av."contentMd",'UTF8')),'hex')=vp.content_hash))) THEN RAISE EXCEPTION 'ASSET_COPY_TARGET_INVALID'; END IF;
  ELSE
   IF (t."typeKey"<>'protocol_draft' OR r.asset_kind<>'protocol') OR (NOT business AND (NEW.target_project_id<>'rh-asset-detail-20261113-study-b' OR t."typeKey"<>'protocol_draft' OR r.asset_kind<>'protocol' OR t."idempotencyKey" NOT IN ('rh-research-asset:detail-20261113:application:owner:1','rh-research-asset:detail-20261113:application:owner:2','rh-research-asset:detail-20261113:application:admin:1','rh-research-asset:detail-20261113:application:admin:2'))) OR (business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM 'rhab-reuse:'||encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex'))) THEN RAISE EXCEPTION 'ASSET_APPLICATION_TARGET_INVALID'; END IF;
  END IF;
 END IF;
 RETURN NULL;
END $function$
;
