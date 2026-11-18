CREATE TABLE rh_ai.research_data_import_access (
 id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, study_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 account_id text NOT NULL, source_study_group_id text NOT NULL, source_research_project_id text NOT NULL, source_session_id text NOT NULL,
 scope_key text NOT NULL CHECK (scope_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 capabilities text[] NOT NULL CHECK (cardinality(capabilities) BETWEEN 1 AND 3 AND capabilities <@ ARRAY['profile.create','visit.import','result.read']::text[]),
 objects jsonb NOT NULL DEFAULT '{"subjectIds":[],"visitIds":[]}' CHECK (COALESCE(jsonb_typeof(objects)='object' AND jsonb_typeof(objects->'subjectIds')='array' AND jsonb_typeof(objects->'visitIds')='array' AND octet_length(objects::text)<=65536,false)),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 granted_by text NOT NULL, audit_id text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expires_at>created_at AND expires_at<=created_at+interval '7 days'),
 UNIQUE(tenant_id,account_id,study_id,scope_key)
);
-- statement-break
CREATE TABLE rh_ai.research_data_imports (
 id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, account_id text NOT NULL, session_id text NOT NULL,
 source_study_group_id text NOT NULL, source_research_project_id text NOT NULL,
 study_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 scope_key text NOT NULL CHECK (scope_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 source_preflight_id text NOT NULL, source_preflight_version integer NOT NULL CHECK (source_preflight_version>0),
 request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 confirmation_hash text NOT NULL CHECK (confirmation_hash ~ '^[a-f0-9]{64}$'),
 snapshot jsonb NOT NULL CHECK (COALESCE(snapshot->>'schema'='hub-data-import-confirmation.v1' AND snapshot->>'mode' IN ('subjects','visit_form') AND snapshot->>'hash'=confirmation_hash AND snapshot->'requiresCurrentAuthorization'='true'::jsonb AND snapshot->'confirmationReady'='false'::jsonb AND octet_length(snapshot::text)<=262144,false)),
 target_manifest jsonb NOT NULL CHECK (jsonb_typeof(target_manifest)='array' AND jsonb_array_length(target_manifest) BETWEEN 1 AND 1000 AND octet_length(target_manifest::text)<=262144),
 state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','committed','cancelled','invalid')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 receipt jsonb CHECK (receipt IS NULL OR COALESCE(jsonb_typeof(receipt)='object' AND receipt->>'schema'='hub-data-import-receipt.v1' AND receipt->>'confirmationHash'=confirmation_hash AND jsonb_typeof(receipt->'subjects')='array' AND jsonb_typeof(receipt->'visits')='array' AND octet_length(receipt::text)<=262144,false)),
 audit_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((state='committed')=(receipt IS NOT NULL)),
 UNIQUE(tenant_id,account_id,session_id,request_key)
);
-- statement-break
CREATE INDEX research_data_import_access_current ON rh_ai.research_data_import_access(tenant_id,account_id,study_id,status,expires_at);
-- statement-break
CREATE INDEX research_data_imports_current ON rh_ai.research_data_imports(tenant_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE FUNCTION rh_ai.check_research_data_import() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE actor text; is_admin boolean; sg text; rp text; sid text; previous_group text; previous_project text;
BEGIN
 actor:=nullif(current_setting('app.account_id',true),'');
 IF actor IS NULL OR NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') THEN RAISE EXCEPTION 'DATA_IMPORT_CONTEXT_MISMATCH'; END IF;
 SELECT a.role='tenant_admin' AND a."isTenantAdmin" INTO is_admin FROM public.account a JOIN public.tenant t ON t.id=a."tenantId"
 WHERE a.id=actor AND a."tenantId"=NEW.tenant_id AND a.status='active' AND t.status='active' AND a.role<>'platform_admin' AND a."isTenantAdmin"=(a.role='tenant_admin') FOR SHARE OF a,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_ACTOR_INVALID'; END IF;
 IF TG_TABLE_NAME='research_data_import_access' THEN
  IF NOT is_admin THEN RAISE EXCEPTION 'DATA_IMPORT_GRANT_FORBIDDEN'; END IF;
  sg:=NEW.source_study_group_id;rp:=NEW.source_research_project_id;sid:=NEW.source_session_id;
  IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.status<>'active' OR NEW.granted_by<>actor THEN RAISE EXCEPTION 'DATA_IMPORT_INITIAL_STATE'; END IF;
  ELSE
   IF ROW(NEW.id,NEW.tenant_id,NEW.study_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id,NEW.source_study_group_id,NEW.source_research_project_id,NEW.source_session_id,NEW.scope_key,NEW.capabilities,NEW.granted_by,NEW.expires_at,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.study_id,OLD.study_group_id,OLD.research_project_id,OLD.account_id,OLD.source_study_group_id,OLD.source_research_project_id,OLD.source_session_id,OLD.scope_key,OLD.capabilities,OLD.granted_by,OLD.expires_at,OLD.created_at)
   OR OLD.status='revoked' OR NEW.audit_id=OLD.audit_id THEN RAISE EXCEPTION 'DATA_IMPORT_GRANT_IMMUTABLE'; END IF;
  END IF;
 ELSE
  IF NEW.account_id<>actor THEN RAISE EXCEPTION 'DATA_IMPORT_OWNER_MISMATCH'; END IF;
  sg:=NEW.source_study_group_id;rp:=NEW.source_research_project_id;sid:=NEW.session_id;
  IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.state<>'planned' OR NEW.receipt IS NOT NULL THEN RAISE EXCEPTION 'DATA_IMPORT_INITIAL_STATE'; END IF;
  ELSE
   IF ROW(NEW.id,NEW.tenant_id,NEW.account_id,NEW.session_id,NEW.source_study_group_id,NEW.source_research_project_id,NEW.study_id,NEW.study_group_id,NEW.research_project_id,NEW.scope_key,NEW.source_preflight_id,NEW.source_preflight_version,NEW.request_key,NEW.confirmation_hash,NEW.snapshot,NEW.target_manifest,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.account_id,OLD.session_id,OLD.source_study_group_id,OLD.source_research_project_id,OLD.study_id,OLD.study_group_id,OLD.research_project_id,OLD.scope_key,OLD.source_preflight_id,OLD.source_preflight_version,OLD.request_key,OLD.confirmation_hash,OLD.snapshot,OLD.target_manifest,OLD.created_at)
   OR OLD.state<>'planned' OR NEW.state NOT IN ('committed','cancelled','invalid') OR NEW.audit_id=OLD.audit_id THEN RAISE EXCEPTION 'DATA_IMPORT_PLAN_IMMUTABLE'; END IF;
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.version::bigint<>OLD.version::bigint+1 THEN RAISE EXCEPTION 'DATA_IMPORT_VERSION_CONFLICT'; END IF;
 previous_group:=current_setting('app.study_group_id',true);previous_project:=current_setting('app.research_project_id',true);
 PERFORM set_config('app.study_group_id',sg,true),set_config('app.research_project_id',rp,true);
 PERFORM 1 FROM public.session s JOIN public.account a ON a.id=s."accountId" AND a."tenantId"=s."tenantId"
 JOIN public.study_group g ON g.id=s."studyGroupId" AND g."tenantId"=s."tenantId"
 JOIN public.research_project p ON p.id=s."researchProjectId" AND p."tenantId"=s."tenantId" AND p."studyGroupId"=g.id
 WHERE s.id=sid AND s."tenantId"=NEW.tenant_id AND s."accountId"=NEW.account_id AND s."studyGroupId"=sg AND s."researchProjectId"=rp
 AND s.status='active' AND s."deletedAt" IS NULL AND s.channel='knowledge' AND s."contextKey" LIKE 'hub:%:conversation:%' AND a.status='active' AND g.status='active' AND p.status='active' FOR SHARE OF s,a,g,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_SOURCE_PARENT_INVALID'; END IF;
 IF TG_TABLE_NAME='research_data_imports' THEN
  PERFORM 1 FROM rh_ai.research_data_preflights p WHERE p.id=NEW.source_preflight_id AND p.version=NEW.source_preflight_version AND p.state='previewed'
  AND p.tenant_id=NEW.tenant_id AND p.account_id=NEW.account_id AND p.session_id=sid AND p.study_group_id=sg AND p.research_project_id=rp
  AND p.preview_hash=NEW.snapshot->'source'->>'previewHash' AND p.source_refs @> (NEW.snapshot->'source'->'files') AND p.source_refs <@ (NEW.snapshot->'source'->'files') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_SOURCE_CHANGED'; END IF;
  IF NEW.snapshot->'source'->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR NEW.snapshot->'source'->>'accountId' IS DISTINCT FROM NEW.account_id OR NEW.snapshot->'source'->>'sessionId' IS DISTINCT FROM sid
  OR NEW.snapshot->'target'->>'studyId' IS DISTINCT FROM NEW.study_id OR NEW.snapshot->'target'->>'studyGroupId' IS DISTINCT FROM NEW.study_group_id OR NEW.snapshot->'target'->>'executionProjectId' IS DISTINCT FROM NEW.research_project_id THEN RAISE EXCEPTION 'DATA_IMPORT_SNAPSHOT_MISMATCH'; END IF;
  IF TG_OP='INSERT' OR NEW.state='committed' THEN
   IF is_admin THEN
    IF NEW.snapshot->'permissionRef'->>'kind' IS DISTINCT FROM 'native_admin' OR NEW.snapshot->'permissionRef'->>'id' IS DISTINCT FROM actor THEN RAISE EXCEPTION 'DATA_IMPORT_PERMISSION_CHANGED'; END IF;
   ELSE
    PERFORM 1 FROM rh_ai.research_data_import_access a WHERE a.id=NEW.snapshot->'permissionRef'->>'id' AND NEW.snapshot->'permissionRef'->>'kind'='study_grant'
    AND a.version::text=NEW.snapshot->'permissionRef'->>'version' AND a.tenant_id=NEW.tenant_id AND a.account_id=actor AND a.study_id=NEW.study_id
    AND a.study_group_id=NEW.study_group_id AND a.research_project_id=NEW.research_project_id AND a.source_study_group_id=sg AND a.source_research_project_id=rp AND a.source_session_id=sid
    AND a.scope_key=NEW.scope_key AND a.status='active' AND a.expires_at>statement_timestamp()
    AND (CASE WHEN NEW.snapshot->>'mode'='subjects' THEN 'profile.create' ELSE 'visit.import' END)=ANY(a.capabilities) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_PERMISSION_CHANGED'; END IF;
   END IF;
  END IF;
 END IF;
 PERFORM set_config('app.study_group_id',NEW.study_group_id,true),set_config('app.research_project_id',NEW.research_project_id,true);
 PERFORM 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id AND p."studyGroupId"=b.study_group_id
 JOIN public.study_group g ON g.id=b.study_group_id AND g."tenantId"=b.tenant_id
 WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id AND p.status='active' AND g.status='active' FOR SHARE OF p,g;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_TARGET_PARENT_INVALID'; END IF;
 PERFORM 1 FROM public.audit_log a WHERE a.id=NEW.audit_id AND a."tenantId"=NEW.tenant_id AND a."accountId"=actor AND a.target=NEW.id AND a.action LIKE 'researchhub.data.%';
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA_IMPORT_AUDIT_REQUIRED'; END IF;
 PERFORM set_config('app.study_group_id',coalesce(previous_group,''),true),set_config('app.research_project_id',coalesce(previous_project,''),true);
 NEW.updated_at:=statement_timestamp();RETURN NEW;
END
$body$;
-- statement-break
CREATE TRIGGER research_data_import_access_guard BEFORE INSERT OR UPDATE ON rh_ai.research_data_import_access FOR EACH ROW EXECUTE FUNCTION rh_ai.check_research_data_import();
-- statement-break
CREATE TRIGGER research_data_imports_guard BEFORE INSERT OR UPDATE ON rh_ai.research_data_imports FOR EACH ROW EXECUTE FUNCTION rh_ai.check_research_data_import();
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_research_data_import() FROM PUBLIC;
-- statement-break
ALTER TABLE rh_ai.research_data_import_access ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_import_access FORCE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_imports ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_imports FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY research_data_import_access_actor ON rh_ai.research_data_import_access FOR ALL TO aisci_app USING
 (tenant_id=current_setting('app.tenant_id',true) AND (account_id=current_setting('app.account_id',true) OR EXISTS(SELECT 1 FROM public.account a WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=tenant_id AND a.status='active' AND a.role='tenant_admin' AND a."isTenantAdmin")))
 WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND EXISTS(SELECT 1 FROM public.account a WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=tenant_id AND a.status='active' AND a.role='tenant_admin' AND a."isTenantAdmin"));
-- statement-break
CREATE POLICY research_data_imports_actor ON rh_ai.research_data_imports FOR ALL TO aisci_app USING
 (tenant_id=current_setting('app.tenant_id',true) AND account_id=current_setting('app.account_id',true)) WITH CHECK
 (tenant_id=current_setting('app.tenant_id',true) AND account_id=current_setting('app.account_id',true));
-- statement-break
REVOKE ALL ON TABLE rh_ai.research_data_import_access,rh_ai.research_data_imports FROM PUBLIC;
-- statement-break
GRANT SELECT,INSERT,UPDATE ON TABLE rh_ai.research_data_import_access,rh_ai.research_data_imports TO aisci_app;
