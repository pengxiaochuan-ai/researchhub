-- Owned local synthetic asset extension. Tokens are bound only by the guarded migration.
CREATE SCHEMA rh_asset
-- statement
REVOKE ALL ON SCHEMA rh_asset FROM PUBLIC
-- statement
CREATE FUNCTION rh_asset.scope_matches(t text,g text,p text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT t='{{TENANT_ID}}' AND g='{{GROUP_ID}}' AND p='{{PROJECT_ID}}'
 AND t=current_setting('app.tenant_id',true)
 AND g=current_setting('app.study_group_id',true)
 AND p=current_setting('app.research_project_id',true)
 AND EXISTS (
  SELECT 1 FROM public.account a JOIN public.tenant n ON n.id=a."tenantId"
  JOIN public.study_group s ON s.id=g AND s."tenantId"=t
  JOIN public.research_project r ON r.id=p AND r."tenantId"=t AND r."studyGroupId"=g
  WHERE a.id=current_setting('app.account_id',true) AND a.id IN ('{{OWNER_ID}}','{{ADMIN_ID}}')
   AND a."tenantId"=t AND a.status='active' AND n.status='active' AND s.status='active' AND r.status='active'
   AND a."authVersion"::text=current_setting('app.auth_version',true)
   AND (a.role='tenant_admin' OR EXISTS (
    SELECT 1 FROM public.study_group_membership m JOIN public.permission_role b ON b.id=m."roleId"
    JOIN public.research_project_membership x ON x."accountId"=a.id AND x."tenantId"=t AND x."studyGroupId"=g AND x."researchProjectId"=p AND x.status='active'
    WHERE m."accountId"=a.id AND m."tenantId"=t AND m."studyGroupId"=g AND m.status='active'
      AND b."tenantId"=t AND b.status='active' AND b."menuPermissions" ? 'artifacts' AND b."buttonPermissions" ? 'artifact.read')))
$$
-- statement
CREATE FUNCTION rh_asset.recipients_valid(recipients text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT recipients IS NOT NULL AND cardinality(recipients)<=2
 AND recipients <@ ARRAY['{{OWNER_ID}}','{{ADMIN_ID}}']::text[]
 AND cardinality(recipients)=(SELECT count(DISTINCT x) FROM unnest(recipients) x)
$$
-- statement
CREATE TABLE rh_asset.asset_registry (
 asset_id text PRIMARY KEY REFERENCES public.research_artifact(id) ON DELETE RESTRICT,
 tenant_id text NOT NULL CHECK(tenant_id='{{TENANT_ID}}'),
 study_group_id text NOT NULL CHECK(study_group_id='{{GROUP_ID}}'),
 research_project_id text NOT NULL CHECK(research_project_id='{{PROJECT_ID}}'),
 owner_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 asset_kind text NOT NULL CHECK(asset_kind IN ('protocol','dataset','instrument','analysis','publication')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 24),
 working_version_no integer NOT NULL DEFAULT 1 CHECK(working_version_no BETWEEN 1 AND 8),
 submitted_version_no integer,
 approved_version_no integer,
 released_version_no integer,
 working_state text NOT NULL DEFAULT 'draft' CHECK(working_state IN ('draft','in_review','changes_requested','approved')),
 release_state text NOT NULL DEFAULT 'unreleased' CHECK(release_state IN ('unreleased','released','withdrawn','expired')),
 ever_submitted boolean NOT NULL DEFAULT false,
 deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,study_group_id,research_project_id,asset_id),
 UNIQUE(tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind),
 CHECK(owner_account_id IN ('{{OWNER_ID}}','{{ADMIN_ID}}')),
 CHECK(submitted_version_no IS NULL OR submitted_version_no BETWEEN 1 AND working_version_no),
 CHECK(approved_version_no IS NULL OR approved_version_no BETWEEN 1 AND working_version_no),
 CHECK(released_version_no IS NULL OR released_version_no BETWEEN 1 AND working_version_no),
 CHECK(working_state<>'in_review' OR submitted_version_no=working_version_no),
 CHECK(working_state<>'approved' OR approved_version_no=working_version_no),
 CHECK(release_state<>'released' OR released_version_no IS NOT NULL),
 CHECK(deleted_at IS NULL OR (working_state='draft' AND NOT ever_submitted AND release_state='unreleased'))
)
-- statement
CREATE TABLE rh_asset.version_policy (
 tenant_id text NOT NULL,
 study_group_id text NOT NULL,
 research_project_id text NOT NULL,
 asset_id text NOT NULL,
 version_no integer NOT NULL CHECK(version_no BETWEEN 1 AND 8),
 artifact_version_id text NOT NULL UNIQUE REFERENCES public.research_artifact_version(id) ON DELETE RESTRICT,
 metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object' AND length(trim(metadata->>'title')) BETWEEN 1 AND 160),
 source_kind text NOT NULL CHECK(source_kind IN ('author','knowledge','artifact','upload')),
 source_bindings jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(source_bindings)='array' AND jsonb_array_length(source_bindings)<=8),
 rights_evidence text NOT NULL DEFAULT '' CHECK(length(rights_evidence)<=4000),
 discovery_recipient_ceiling text[] NOT NULL DEFAULT '{}' CHECK(rh_asset.recipients_valid(discovery_recipient_ceiling)),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 policy_hash text NOT NULL CHECK(policy_hash ~ '^[a-f0-9]{64}$'),
 created_by text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id) REFERENCES rh_asset.asset_registry(tenant_id,study_group_id,research_project_id,asset_id) ON DELETE RESTRICT
)
-- statement
ALTER TABLE rh_asset.asset_registry ADD CONSTRAINT registry_working_policy
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,working_version_no)
 REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no) DEFERRABLE INITIALLY DEFERRED
-- statement
CREATE TABLE rh_asset.asset_event (
 tenant_id text NOT NULL,
 study_group_id text NOT NULL,
 research_project_id text NOT NULL,
 asset_id text NOT NULL,
 version_no integer NOT NULL,
 asset_revision integer NOT NULL CHECK(asset_revision BETWEEN 1 AND 24),
 actor_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN ('created','revised','submitted','reviewed','released','scope_narrowed','withdrawn','requested','decided','grant_revoked','cited','trashed','restored')),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,160}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=65536),
 result_receipt jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(result_receipt)='object' AND octet_length(result_receipt::text)<=32768),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,study_group_id,research_project_id,asset_id,asset_revision),
 UNIQUE(tenant_id,actor_account_id,request_key),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no) REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no) ON DELETE RESTRICT
)
-- statement
CREATE TABLE rh_asset.access_request (
 request_id text PRIMARY KEY,
 tenant_id text NOT NULL,
 study_group_id text NOT NULL,
 research_project_id text NOT NULL,
 asset_id text NOT NULL,
 version_no integer NOT NULL,
 initiator_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 recipient_account_id text NOT NULL REFERENCES public.account(id) ON DELETE RESTRICT,
 requested_actions text[] NOT NULL CHECK(cardinality(requested_actions) BETWEEN 1 AND 2 AND requested_actions <@ ARRAY['read_body','cite']::text[]),
 approved_actions text[] NOT NULL DEFAULT '{}' CHECK(approved_actions <@ requested_actions),
 purpose text NOT NULL CHECK(length(trim(purpose)) BETWEEN 1 AND 2000),
 state text NOT NULL CHECK(state IN ('pending','approved','rejected','revoked')),
 decision_mode text NOT NULL CHECK(decision_mode IN ('request','direct_share')),
 decided_by text REFERENCES public.account(id) ON DELETE RESTRICT,
 decision_reason text,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 event_revision integer NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days'),
 CHECK(rh_asset.recipients_valid(ARRAY[initiator_account_id,recipient_account_id]) OR initiator_account_id=recipient_account_id),
 CHECK(recipient_account_id IN ('{{OWNER_ID}}','{{ADMIN_ID}}')),
 CHECK(initiator_account_id IN ('{{OWNER_ID}}','{{ADMIN_ID}}')),
 CHECK(decided_by IS NULL OR decided_by IN ('{{OWNER_ID}}','{{ADMIN_ID}}')),
 CHECK(state NOT IN ('approved','rejected','revoked') OR (decided_by IS NOT NULL AND length(trim(decision_reason))>0)),
 CHECK(state<>'approved' OR cardinality(approved_actions)>0),
 UNIQUE(tenant_id,study_group_id,research_project_id,request_id),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no) REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,event_revision) REFERENCES rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,asset_revision) DEFERRABLE INITIALLY DEFERRED
)
-- statement
CREATE FUNCTION rh_asset.check_registry_parent() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
DECLARE a public.research_artifact%ROWTYPE; actor text:=current_setting('app.account_id',true); admin boolean;
BEGIN
 SELECT * INTO a FROM public.research_artifact WHERE id=NEW.asset_id FOR SHARE;
 IF NOT FOUND OR a."tenantId"<>NEW.tenant_id OR a."studyGroupId"<>NEW.study_group_id OR a."researchProjectId"<>NEW.research_project_id
  OR a."ownerAccountId"<>NEW.owner_account_id OR a."createdBy"<>NEW.owner_account_id OR a."typeKey"<>'research_report' OR a.status<>'draft' OR a."deletedAt" IS NOT NULL
  OR a."idempotencyKey"<>('rh-research-asset:catalog-20261112:' || CASE NEW.owner_account_id WHEN '{{OWNER_ID}}' THEN 'owner' ELSE 'admin' END || ':' || NEW.asset_kind)
  OR a."currentVersionNo"<>NEW.working_version_no THEN RAISE EXCEPTION 'ASSET_PARENT_INVALID' USING ERRCODE='23514'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.account WHERE id=actor AND "tenantId"=NEW.tenant_id AND role='tenant_admin' AND status='active') INTO admin;
 IF actor IS NULL OR (actor<>NEW.owner_account_id AND NOT admin) THEN RAISE EXCEPTION 'ASSET_ACTOR_INVALID' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND NOT admin AND ((NEW.working_state IN ('approved','changes_requested') AND NEW.working_state IS DISTINCT FROM OLD.working_state) OR (NEW.approved_version_no IS NOT NULL AND NEW.approved_version_no IS DISTINCT FROM OLD.approved_version_no) OR NEW.release_state IS DISTINCT FROM OLD.release_state OR NEW.released_version_no IS DISTINCT FROM OLD.released_version_no) THEN RAISE EXCEPTION 'ASSET_ADMIN_ACTION_REQUIRED' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.study_group_id<>OLD.study_group_id OR NEW.research_project_id<>OLD.research_project_id OR NEW.owner_account_id<>OLD.owner_account_id OR NEW.asset_id<>OLD.asset_id OR NEW.asset_kind<>OLD.asset_kind OR NEW.revision<>OLD.revision+1 OR (OLD.ever_submitted AND NOT NEW.ever_submitted)) THEN RAISE EXCEPTION 'ASSET_REGISTRY_CAS_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$
-- statement
CREATE TRIGGER registry_parent BEFORE INSERT OR UPDATE ON rh_asset.asset_registry FOR EACH ROW EXECUTE FUNCTION rh_asset.check_registry_parent()
-- statement
CREATE FUNCTION rh_asset.check_policy_parent() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
DECLARE v public.research_artifact_version%ROWTYPE; a rh_asset.asset_registry%ROWTYPE; b jsonb;
BEGIN
 SELECT * INTO a FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_POLICY_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 SELECT * INTO v FROM public.research_artifact_version WHERE id=NEW.artifact_version_id;
 IF NOT FOUND OR v."artifactId"<>NEW.asset_id OR v."tenantId"<>NEW.tenant_id OR v."studyGroupId"<>NEW.study_group_id OR v."researchProjectId"<>NEW.research_project_id OR v."versionNo"<>NEW.version_no OR v."contentHash"<>NEW.content_hash OR NEW.version_no<>a.working_version_no OR v."createdBy"<>NEW.created_by OR NEW.created_by<>current_setting('app.account_id',true) THEN RAISE EXCEPTION 'ASSET_POLICY_PARENT_INVALID' USING ERRCODE='23514'; END IF;
 b:=v."contentBlocks"->0;
 IF jsonb_typeof(v."contentBlocks")<>'array' OR jsonb_array_length(v."contentBlocks")<>1 OR b->>'type' IS DISTINCT FROM 'rh-research-asset-catalog.v2' OR b->>'assetKind' IS DISTINCT FROM a.asset_kind OR b->>'versionNo' IS DISTINCT FROM NEW.version_no::text OR b->>'ownerAccountId' IS DISTINCT FROM a.owner_account_id OR b->'metadata' IS DISTINCT FROM NEW.metadata OR b->'sourceBindings' IS DISTINCT FROM NEW.source_bindings OR b->>'rightsEvidence' IS DISTINCT FROM NEW.rights_evidence OR b->'discoveryRecipientCeiling' IS DISTINCT FROM to_jsonb(NEW.discovery_recipient_ceiling) OR b->>'policyHash' IS DISTINCT FROM NEW.policy_hash THEN RAISE EXCEPTION 'ASSET_POLICY_BINDING_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$
-- statement
CREATE TRIGGER policy_parent BEFORE INSERT ON rh_asset.version_policy FOR EACH ROW EXECUTE FUNCTION rh_asset.check_policy_parent()
-- statement
CREATE FUNCTION rh_asset.reject_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'ASSET_APPEND_ONLY' USING ERRCODE='42501'; END $$
-- statement
CREATE TRIGGER policy_immutable BEFORE UPDATE OR DELETE ON rh_asset.version_policy FOR EACH ROW EXECUTE FUNCTION rh_asset.reject_change()
-- statement
CREATE TRIGGER event_immutable BEFORE UPDATE OR DELETE ON rh_asset.asset_event FOR EACH ROW EXECUTE FUNCTION rh_asset.reject_change()
-- statement
CREATE FUNCTION rh_asset.check_event_sequence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,rh_asset,public AS $$
DECLARE current_revision integer; prior integer;
BEGIN
 SELECT revision INTO current_revision FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id FOR UPDATE;
 SELECT coalesce(max(asset_revision),0) INTO prior FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id;
 IF current_revision IS NULL OR NEW.asset_revision<>current_revision OR NEW.asset_revision<>prior+1 OR NEW.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) THEN RAISE EXCEPTION 'ASSET_EVENT_SEQUENCE_INVALID' USING ERRCODE='23514'; END IF;
 IF NEW.event_type IN ('reviewed','released','withdrawn') AND NOT EXISTS(SELECT 1 FROM public.account WHERE id=NEW.actor_account_id AND "tenantId"=NEW.tenant_id AND role='tenant_admin' AND status='active') THEN RAISE EXCEPTION 'ASSET_ADMIN_ACTION_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$
-- statement
CREATE TRIGGER event_sequence BEFORE INSERT ON rh_asset.asset_event FOR EACH ROW EXECUTE FUNCTION rh_asset.check_event_sequence()
-- statement
CREATE FUNCTION rh_asset.check_registry_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,rh_asset AS $$
DECLARE r integer; last_revision integer;
BEGIN
 SELECT revision INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 SELECT max(asset_revision) INTO last_revision FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id;
 IF last_revision IS DISTINCT FROM r THEN RAISE EXCEPTION 'ASSET_COMMIT_EVENT_REQUIRED' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$
-- statement
CREATE CONSTRAINT TRIGGER registry_event_commit AFTER INSERT OR UPDATE ON rh_asset.asset_registry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_asset.check_registry_event()
-- statement
ALTER TABLE rh_asset.asset_registry ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.asset_registry FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY scope_rows ON rh_asset.asset_registry USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id)) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id))
-- statement
ALTER TABLE rh_asset.version_policy ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.version_policy FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY scope_rows ON rh_asset.version_policy USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id)) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id))
-- statement
ALTER TABLE rh_asset.access_request ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.access_request FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY scope_rows ON rh_asset.access_request USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id)) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id))
-- statement
ALTER TABLE rh_asset.asset_event ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_asset.asset_event FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY scope_rows ON rh_asset.asset_event USING(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id)) WITH CHECK(rh_asset.scope_matches(tenant_id,study_group_id,research_project_id))
-- statement
CREATE INDEX catalog_scope_updated ON rh_asset.asset_registry(tenant_id,study_group_id,research_project_id,updated_at DESC,asset_id DESC)
-- statement
CREATE INDEX catalog_access_recipient ON rh_asset.access_request(tenant_id,recipient_account_id,asset_id,version_no,expires_at)
-- statement
CREATE INDEX catalog_events_kind ON rh_asset.asset_event(tenant_id,event_type,created_at,asset_id,version_no)
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA rh_asset FROM PUBLIC
-- statement
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rh_asset FROM PUBLIC
-- statement
GRANT USAGE ON SCHEMA rh_asset TO aisci_app
-- statement
GRANT SELECT,INSERT,UPDATE ON rh_asset.asset_registry,rh_asset.access_request TO aisci_app
-- statement
GRANT SELECT,INSERT ON rh_asset.version_policy,rh_asset.asset_event TO aisci_app
-- statement
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rh_asset TO aisci_app
