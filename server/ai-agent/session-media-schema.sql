-- MV01/MV02: explicit synthetic-only migration, never run at application startup.
CREATE TABLE rh_ai.session_media_uploads (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 account_id text NOT NULL, session_id text NOT NULL,
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 upload_id uuid UNIQUE,
 extension text NOT NULL CHECK(extension IN ('mp4','mov','webm')),
 content_type text NOT NULL,
 safe_filename text NOT NULL,
 byte_size bigint NOT NULL CHECK(byte_size BETWEEN 1 AND 524288000),
 storage_key text NOT NULL UNIQUE,
 source_sha256 text CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 archive_state text NOT NULL DEFAULT 'pending' CHECK(archive_state IN ('pending','archived','failed')),
 inspection_state text NOT NULL DEFAULT 'pending' CHECK(inspection_state IN ('pending','running','complete','unavailable')),
 inspection_classification text CHECK(inspection_classification IN ('valid','tool_unavailable','timeout','corrupt','parse_failed','unknown_stream')),
 inspection jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(inspection)='object'),
 inspection_attempt_id uuid, lease_expires_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT session_media_request UNIQUE(tenant_id,account_id,session_id,request_key),
 CONSTRAINT session_media_path CHECK(storage_key=tenant_id||'/hub-media/'||session_id||'/'||id||'.'||extension AND safe_filename=id||'.'||extension),
 CONSTRAINT session_media_mime CHECK(content_type=CASE extension WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime' ELSE 'video/webm' END),
 CONSTRAINT session_media_archived CHECK(archive_state<>'archived' OR (source_sha256 IS NOT NULL AND upload_id IS NOT NULL)),
 CONSTRAINT session_media_lease CHECK(inspection_state<>'running' OR (archive_state='archived' AND inspection_attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
 CONSTRAINT session_media_classification CHECK(
  (inspection_state IN ('pending','running') AND inspection_classification IS NULL) OR
  (inspection_state='complete' AND inspection_classification IS NOT NULL AND inspection_classification='valid' AND archive_state='archived') OR
  (inspection_state='unavailable' AND inspection_classification IS NOT NULL AND inspection_classification<>'valid' AND archive_state='archived'))
);
-- statement-break
CREATE INDEX session_media_list ON rh_ai.session_media_uploads(tenant_id,study_group_id,research_project_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE FUNCTION rh_ai.check_session_media() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') OR
    NEW.study_group_id IS DISTINCT FROM nullif(current_setting('app.study_group_id',true),'') OR
    NEW.research_project_id IS DISTINCT FROM nullif(current_setting('app.research_project_id',true),'') OR
    NEW.account_id IS DISTINCT FROM nullif(current_setting('app.account_id',true),'') THEN RAISE EXCEPTION 'MEDIA_CONTEXT'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.archive_state<>'pending' OR NEW.upload_id IS NOT NULL OR NEW.source_sha256 IS NOT NULL OR NEW.inspection_state<>'pending' THEN RAISE EXCEPTION 'MEDIA_INITIAL_STATE'; END IF;
  NEW.created_at:=statement_timestamp();
 ELSE
  IF NEW.version::bigint<>OLD.version::bigint+1 THEN RAISE EXCEPTION 'MEDIA_VERSION'; END IF;
  IF ROW(NEW.id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id,NEW.session_id,NEW.request_key,NEW.request_fingerprint,NEW.extension,NEW.content_type,NEW.safe_filename,NEW.byte_size,NEW.storage_key,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.study_group_id,OLD.research_project_id,OLD.account_id,OLD.session_id,OLD.request_key,OLD.request_fingerprint,OLD.extension,OLD.content_type,OLD.safe_filename,OLD.byte_size,OLD.storage_key,OLD.created_at) OR
    (OLD.upload_id IS NOT NULL AND NEW.upload_id IS DISTINCT FROM OLD.upload_id) OR
    (OLD.source_sha256 IS NOT NULL AND NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256) THEN RAISE EXCEPTION 'MEDIA_IMMUTABLE'; END IF;
  IF (OLD.archive_state='archived' AND NEW.archive_state<>'archived') OR (OLD.archive_state='failed' AND NEW.archive_state<>'failed') THEN RAISE EXCEPTION 'MEDIA_ARCHIVE_STATE'; END IF;
 END IF;
 NEW.updated_at:=statement_timestamp();
 PERFORM 1 FROM public.session s JOIN public.account a ON a.id=s."accountId" AND a."tenantId"=s."tenantId"
 JOIN public.tenant t ON t.id=s."tenantId"
 JOIN public.study_group g ON g.id=s."studyGroupId" AND g."tenantId"=s."tenantId"
 JOIN public.research_project p ON p.id=s."researchProjectId" AND p."tenantId"=s."tenantId" AND p."studyGroupId"=g.id
 WHERE s.id=NEW.session_id AND s."tenantId"=NEW.tenant_id AND s."studyGroupId"=NEW.study_group_id AND s."researchProjectId"=NEW.research_project_id AND s."accountId"=NEW.account_id
 AND s."deletedAt" IS NULL AND s.status='active' AND a.status='active' AND t.status='active' AND g.status='active' AND p.status='active'
 FOR SHARE OF s,a,t,g,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_PARENT'; END IF;
 RETURN NEW;
END $body$;
-- statement-break
CREATE TRIGGER session_media_guard BEFORE INSERT OR UPDATE ON rh_ai.session_media_uploads FOR EACH ROW EXECUTE FUNCTION rh_ai.check_session_media();
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_session_media() FROM PUBLIC;
-- statement-break
ALTER TABLE rh_ai.session_media_uploads ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.session_media_uploads FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY session_media_owner ON rh_ai.session_media_uploads FOR ALL TO aisci_app USING(
 tenant_id=nullif(current_setting('app.tenant_id',true),'') AND study_group_id=nullif(current_setting('app.study_group_id',true),'') AND research_project_id=nullif(current_setting('app.research_project_id',true),'') AND account_id=nullif(current_setting('app.account_id',true),'')) WITH CHECK(
 tenant_id=nullif(current_setting('app.tenant_id',true),'') AND study_group_id=nullif(current_setting('app.study_group_id',true),'') AND research_project_id=nullif(current_setting('app.research_project_id',true),'') AND account_id=nullif(current_setting('app.account_id',true),''));
-- statement-break
GRANT SELECT,INSERT,UPDATE ON rh_ai.session_media_uploads TO aisci_app;
