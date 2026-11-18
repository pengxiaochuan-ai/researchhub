-- D02: owned append-only facts; business writers remain unmounted in Q02.
CREATE FUNCTION rh_asset.detail_actor_can_use(aid text,v integer,purpose text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
 SELECT EXISTS(SELECT 1 FROM rh_asset.asset_registry r JOIN public.account a ON a.id=current_setting('app.account_id',true)
  WHERE r.asset_id=aid AND r.deleted_at IS NULL AND a."tenantId"=r.tenant_id AND a.status='active'
  AND a."authVersion"::text=current_setting('app.auth_version',true)
  AND (a.id=r.owner_account_id OR a.role='tenant_admin' OR (
   EXISTS(SELECT 1 FROM rh_asset.access_request x WHERE x.asset_id=aid AND x.version_no=v AND x.recipient_account_id=a.id AND x.state='approved' AND purpose=ANY(x.approved_actions) AND x.expires_at>clock_timestamp())
   AND EXISTS(SELECT 1 FROM rh_asset.asset_event e WHERE e.asset_id=aid AND e.version_no=v AND e.asset_revision=(SELECT max(z.asset_revision) FROM rh_asset.asset_event z WHERE z.asset_id=aid AND z.version_no=v AND z.event_type IN ('released','withdrawn','scope_narrowed')) AND e.event_type<>'withdrawn' AND coalesce(e.payload->'discoveryRecipients' ? a.id,false))
   AND EXISTS(SELECT 1 FROM rh_asset.asset_event e WHERE e.asset_id=aid AND e.version_no=v AND e.event_type='released' AND (e.payload->>'expiresAt')::timestamptz>clock_timestamp())
  )))
$$
-- statement
CREATE TABLE rh_asset.asset_comment_event (
 event_id text PRIMARY KEY,
 tenant_id text NOT NULL,
 study_group_id text NOT NULL,
 research_project_id text NOT NULL,
 asset_id text NOT NULL,
 version_no integer NOT NULL,
 comment_id text NOT NULL CHECK(comment_id IN ({{COMMENT_KEYS}})),
 parent_comment_id text,
 parent_revision integer CHECK(parent_revision=1),
 author_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 actor_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('create','edit','withdraw','moderate')),
 body text NOT NULL CHECK(length(body)<=2000),
 reason text,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 3),
 event_revision integer NOT NULL,
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,160}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((parent_comment_id IS NULL AND parent_revision IS NULL) OR (parent_comment_id IS NOT NULL AND parent_revision=1 AND parent_comment_id<>comment_id)),
 UNIQUE(tenant_id,study_group_id,research_project_id,asset_id,version_no,comment_id,revision),
 UNIQUE(tenant_id,actor_account_id,request_key),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no) REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no,parent_comment_id,parent_revision) REFERENCES rh_asset.asset_comment_event(tenant_id,study_group_id,research_project_id,asset_id,version_no,comment_id,revision) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,event_revision) REFERENCES rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,asset_revision) DEFERRABLE INITIALLY DEFERRED
)
-- statement
CREATE TABLE rh_asset.asset_reuse_record (
 record_id text PRIMARY KEY,
 tenant_id text NOT NULL,
 study_group_id text NOT NULL,
 research_project_id text NOT NULL,
 asset_id text NOT NULL,
 version_no integer NOT NULL,
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 source_policy_hash text NOT NULL CHECK(source_policy_hash ~ '^[a-f0-9]{64}$'),
 actor_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('copy','apply')),
 target_project_id text NOT NULL REFERENCES public.research_project(id) ON DELETE RESTRICT,
 target_artifact_id text NOT NULL UNIQUE REFERENCES public.research_artifact(id) ON DELETE RESTRICT,
 target_version_no integer NOT NULL CHECK(target_version_no=1),
 mapping_hash text NOT NULL CHECK(mapping_hash ~ '^[a-f0-9]{64}$'),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,160}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 event_revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,actor_account_id,request_key),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no) REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no) ON DELETE RESTRICT,
 FOREIGN KEY(target_artifact_id,target_version_no) REFERENCES public.research_artifact_version("artifactId","versionNo") ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,event_revision) REFERENCES rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,asset_revision) DEFERRABLE INITIALLY DEFERRED
)
-- statement
CREATE FUNCTION rh_asset.check_detail_fact() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
DECLARE e rh_asset.asset_event%ROWTYPE; prior rh_asset.asset_comment_event%ROWTYPE; r rh_asset.asset_registry%ROWTYPE; p rh_asset.version_policy%ROWTYPE; t public.research_artifact%ROWTYPE; manager boolean; saved_project text;
BEGIN
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 SELECT * INTO p FROM rh_asset.version_policy WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no;
 SELECT * INTO e FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND asset_revision=NEW.event_revision;
 IF r.asset_id IS NULL OR p.asset_id IS NULL OR e.asset_id IS NULL OR e.version_no<>NEW.version_no OR e.actor_account_id<>NEW.actor_account_id OR NEW.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR e.request_key<>NEW.request_key OR e.request_hash<>NEW.request_hash THEN RAISE EXCEPTION 'ASSET_DETAIL_EVENT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND a."idempotencyKey" LIKE 'rh-research-asset:detail-20261113:%') THEN RAISE EXCEPTION 'ASSET_DETAIL_FAMILY_REQUIRED'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.account a WHERE a.id=NEW.actor_account_id AND a."tenantId"=NEW.tenant_id AND a.role='tenant_admin' AND a.status='active') INTO manager;
 IF TG_TABLE_NAME='asset_comment_event' THEN
  IF e.event_type<>'comment_changed' OR e.payload->>'commentId' IS DISTINCT FROM NEW.comment_id OR (e.payload->>'commentRevision')::integer IS DISTINCT FROM NEW.revision OR e.payload->>'action' IS DISTINCT FROM NEW.action THEN RAISE EXCEPTION 'ASSET_COMMENT_EVENT_REQUIRED'; END IF;
  SELECT * INTO prior FROM rh_asset.asset_comment_event WHERE comment_id=NEW.comment_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1;
  IF NEW.action='create' THEN
   IF NEW.revision<>1 OR prior.event_id IS NOT NULL OR NEW.author_account_id<>NEW.actor_account_id OR length(trim(NEW.body))=0 THEN RAISE EXCEPTION 'ASSET_COMMENT_CREATE_INVALID'; END IF;
  ELSE
   IF prior.event_id IS NULL OR NEW.revision<>prior.revision+1 OR prior.action IN ('withdraw','moderate') OR NEW.author_account_id<>prior.author_account_id OR NEW.parent_comment_id IS DISTINCT FROM prior.parent_comment_id OR NEW.asset_id<>prior.asset_id OR NEW.version_no<>prior.version_no OR (NEW.actor_account_id<>prior.author_account_id AND NOT manager) OR (NEW.action='moderate' AND (NOT manager OR length(trim(coalesce(NEW.reason,'')))=0)) OR (NEW.action IN ('withdraw','moderate') AND NEW.body<>'') OR (NEW.action='edit' AND (NEW.actor_account_id<>prior.author_account_id OR length(trim(NEW.body))=0)) THEN RAISE EXCEPTION 'ASSET_COMMENT_REVISION_INVALID'; END IF;
  END IF;
 ELSE
  IF e.event_type IS DISTINCT FROM (CASE WHEN NEW.kind='copy' THEN 'asset_copy' ELSE 'asset_apply' END) OR e.payload->>'targetArtifactId' IS DISTINCT FROM NEW.target_artifact_id OR NEW.source_hash<>p.content_hash OR NEW.source_policy_hash<>p.policy_hash THEN RAISE EXCEPTION 'ASSET_REUSE_EVENT_REQUIRED'; END IF;
  saved_project:=current_setting('app.research_project_id',true);PERFORM set_config('app.research_project_id',NEW.target_project_id,true);
  SELECT * INTO t FROM public.research_artifact WHERE id=NEW.target_artifact_id;
  PERFORM set_config('app.research_project_id',saved_project,true);
  IF t.id IS NULL OR t."tenantId"<>NEW.tenant_id OR t."studyGroupId"<>NEW.study_group_id OR t."researchProjectId"<>NEW.target_project_id OR t."ownerAccountId"<>NEW.actor_account_id OR t."createdBy"<>NEW.actor_account_id OR t.status<>'draft' OR t."deletedAt" IS NOT NULL OR t."currentVersionNo"<>1 THEN RAISE EXCEPTION 'ASSET_REUSE_TARGET_INVALID'; END IF;
  IF NEW.kind='copy' THEN
   IF NEW.target_project_id<>'{{PROJECT_ID}}' OR t."typeKey"<>'research_report' OR t."idempotencyKey" NOT IN ({{COPY_KEYS}}) THEN RAISE EXCEPTION 'ASSET_COPY_TARGET_INVALID'; END IF;
  ELSE
   IF NEW.target_project_id<>'rh-asset-detail-20261113-study-b' OR t."typeKey"<>'protocol_draft' OR r.asset_kind<>'protocol' OR t."idempotencyKey" NOT IN ({{APPLICATION_KEYS}}) THEN RAISE EXCEPTION 'ASSET_APPLICATION_TARGET_INVALID'; END IF;
  END IF;
 END IF;
 RETURN NULL;
END $$
-- statement
CREATE CONSTRAINT TRIGGER comment_fact_commit AFTER INSERT ON rh_asset.asset_comment_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_asset.check_detail_fact()
-- statement
CREATE CONSTRAINT TRIGGER reuse_fact_commit AFTER INSERT ON rh_asset.asset_reuse_record DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_asset.check_detail_fact()
-- statement
CREATE TRIGGER comment_immutable BEFORE UPDATE OR DELETE ON rh_asset.asset_comment_event FOR EACH ROW EXECUTE FUNCTION rh_asset.reject_change()
-- statement
CREATE TRIGGER reuse_immutable BEFORE UPDATE OR DELETE ON rh_asset.asset_reuse_record FOR EACH ROW EXECUTE FUNCTION rh_asset.reject_change()
-- statement
ALTER TABLE rh_asset.asset_comment_event ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.asset_comment_event FORCE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.asset_reuse_record ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.asset_reuse_record FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY scope_rows ON rh_asset.asset_comment_event USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id) AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body')) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id) AND rh_asset.detail_actor_can_use(asset_id,version_no,'comment') AND actor_account_id=current_setting('app.account_id',true))
-- statement
CREATE POLICY scope_rows ON rh_asset.asset_reuse_record USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id) AND (actor_account_id=current_setting('app.account_id',true) OR EXISTS(SELECT 1 FROM public.account a WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=tenant_id AND a.role='tenant_admin' AND a.status='active')) AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body')) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id) AND actor_account_id=current_setting('app.account_id',true) AND rh_asset.detail_actor_can_use(asset_id,version_no,CASE WHEN kind='copy' THEN 'derive' ELSE 'apply' END))
-- statement
CREATE INDEX comment_fixed_time ON rh_asset.asset_comment_event(tenant_id,asset_id,version_no,created_at,event_id)
-- statement
CREATE INDEX reuse_source_time ON rh_asset.asset_reuse_record(tenant_id,asset_id,version_no,created_at,record_id)
-- statement
REVOKE ALL ON rh_asset.asset_comment_event,rh_asset.asset_reuse_record FROM PUBLIC
-- statement
GRANT SELECT,INSERT ON rh_asset.asset_comment_event,rh_asset.asset_reuse_record TO aisci_app
-- statement
REVOKE ALL ON FUNCTION rh_asset.detail_actor_can_use(text,integer,text),rh_asset.check_detail_fact() FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_asset.detail_actor_can_use(text,integer,text),rh_asset.check_detail_fact() TO aisci_app
