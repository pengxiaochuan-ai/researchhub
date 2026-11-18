CREATE TABLE rh_ai.research_data_uploads (
 id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 account_id text NOT NULL, session_id text NOT NULL,
 request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 26214400),
 format text NOT NULL CHECK (format IN ('csv','xlsx')),
 filename text NOT NULL DEFAULT '研究数据' CHECK (length(filename) BETWEEN 1 AND 240),
 storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^researchhub-private-data/[A-Za-z0-9_/-]+$'),
 state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','ready','rejected','invalid')),
 summary jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(summary)='object' AND octet_length(summary::text)<=262144),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,account_id,session_id,request_key)
);
-- statement-break
CREATE TABLE rh_ai.research_data_preflights (
 id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 account_id text NOT NULL, session_id text NOT NULL,
 request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 source_refs jsonb NOT NULL CHECK (jsonb_typeof(source_refs)='array' AND jsonb_array_length(source_refs) BETWEEN 1 AND 20),
 preview_hash text NOT NULL CHECK (preview_hash ~ '^[a-f0-9]{64}$'),
 parser_version text NOT NULL DEFAULT 'hub-data-parser.v1' CHECK (parser_version='hub-data-parser.v1'),
 target jsonb CHECK (target IS NULL),
 result jsonb NOT NULL CHECK (COALESCE(jsonb_typeof(result)='object' AND result->>'schema'='hub-research-data-summary.v1' AND result->'confirmationReady'='false'::jsonb AND octet_length(result::text)<=262144,false)),
 state text NOT NULL DEFAULT 'previewed' CHECK (state IN ('previewed','cancelled','invalid')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,account_id,session_id,request_key)
);
-- statement-break
CREATE INDEX research_data_uploads_list ON rh_ai.research_data_uploads(tenant_id,study_group_id,research_project_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE INDEX research_data_preflights_list ON rh_ai.research_data_preflights(tenant_id,study_group_id,research_project_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE FUNCTION rh_ai.check_research_data_staging() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE ref jsonb; found_count integer;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') OR
 NEW.study_group_id IS DISTINCT FROM nullif(current_setting('app.study_group_id',true),'') OR
 NEW.research_project_id IS DISTINCT FROM nullif(current_setting('app.research_project_id',true),'') OR
 NEW.account_id IS DISTINCT FROM nullif(current_setting('app.account_id',true),'') THEN RAISE EXCEPTION 'DATA_CONTEXT_MISMATCH'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR (TG_TABLE_NAME='research_data_uploads' AND NEW.state<>'staged') OR
  (TG_TABLE_NAME='research_data_preflights' AND NEW.state<>'previewed') THEN RAISE EXCEPTION 'DATA_INITIAL_STATE'; END IF;
  NEW.created_at:=statement_timestamp();
 ELSE
  IF ROW(NEW.id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id,NEW.session_id,NEW.request_key,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.study_group_id,OLD.research_project_id,OLD.account_id,OLD.session_id,OLD.request_key,OLD.created_at) THEN RAISE EXCEPTION 'DATA_IDENTITY_IMMUTABLE'; END IF;
  IF NEW.version::bigint<>OLD.version::bigint+1 THEN RAISE EXCEPTION 'DATA_VERSION_CONFLICT'; END IF;
  IF TG_TABLE_NAME='research_data_uploads' THEN
   IF ROW(NEW.fingerprint,NEW.source_sha256,NEW.byte_size,NEW.format,NEW.filename,NEW.storage_key) IS DISTINCT FROM ROW(OLD.fingerprint,OLD.source_sha256,OLD.byte_size,OLD.format,OLD.filename,OLD.storage_key) OR
   OLD.state IN ('rejected','invalid') OR (OLD.state='ready' AND NEW.state<>'invalid') THEN RAISE EXCEPTION 'DATA_UPLOAD_IMMUTABLE'; END IF;
  ELSE
   IF ROW(NEW.source_refs,NEW.preview_hash,NEW.parser_version,NEW.target,NEW.result) IS DISTINCT FROM ROW(OLD.source_refs,OLD.preview_hash,OLD.parser_version,OLD.target,OLD.result) OR
   OLD.state<>'previewed' OR NEW.state NOT IN ('cancelled','invalid') THEN RAISE EXCEPTION 'DATA_PLAN_IMMUTABLE'; END IF;
  END IF;
 END IF;
 NEW.updated_at:=statement_timestamp();
 PERFORM 1 FROM public.session s JOIN public.account a ON a.id=s."accountId" AND a."tenantId"=s."tenantId"
 JOIN public.tenant t ON t.id=a."tenantId"
 JOIN public.study_group g ON g.id=s."studyGroupId" AND g."tenantId"=s."tenantId"
 JOIN public.research_project p ON p.id=s."researchProjectId" AND p."studyGroupId"=g.id AND p."tenantId"=t.id
 WHERE s.id=NEW.session_id AND s."tenantId"=NEW.tenant_id AND s."studyGroupId"=NEW.study_group_id AND s."researchProjectId"=NEW.research_project_id
 AND s."accountId"=NEW.account_id AND s."deletedAt" IS NULL AND s.status='active' AND s.channel='knowledge'
 AND s."contextKey" LIKE 'hub:%:conversation:%' AND a.status='active' AND t.status='active' AND g.status='active' AND p.status='active' FOR SHARE OF s,a,t,g,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA_PARENT_INVALID'; END IF;
 IF TG_TABLE_NAME='research_data_preflights' AND TG_OP='INSERT' THEN
  SELECT count(DISTINCT value->>'id') INTO found_count FROM jsonb_array_elements(NEW.source_refs);
  IF found_count<>jsonb_array_length(NEW.source_refs) THEN RAISE EXCEPTION 'DATA_SOURCE_INVALID'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(NEW.source_refs) LOOP
   PERFORM 1 FROM rh_ai.research_data_uploads u WHERE u.id=ref->>'id' AND u.version::text=ref->>'version' AND u.source_sha256=ref->>'sha256'
   AND u.tenant_id=NEW.tenant_id AND u.study_group_id=NEW.study_group_id AND u.research_project_id=NEW.research_project_id
   AND u.account_id=NEW.account_id AND u.session_id=NEW.session_id AND u.state='ready' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'DATA_SOURCE_INVALID'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END
$body$;
-- statement-break
CREATE TRIGGER research_data_uploads_guard BEFORE INSERT OR UPDATE ON rh_ai.research_data_uploads FOR EACH ROW EXECUTE FUNCTION rh_ai.check_research_data_staging();
-- statement-break
CREATE TRIGGER research_data_preflights_guard BEFORE INSERT OR UPDATE ON rh_ai.research_data_preflights FOR EACH ROW EXECUTE FUNCTION rh_ai.check_research_data_staging();
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_research_data_staging() FROM PUBLIC;
-- statement-break
ALTER TABLE rh_ai.research_data_uploads ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_uploads FORCE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_preflights ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.research_data_preflights FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY research_data_uploads_owner ON rh_ai.research_data_uploads FOR ALL TO aisci_app USING
 (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true))
 WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true));
-- statement-break
CREATE POLICY research_data_preflights_owner ON rh_ai.research_data_preflights FOR ALL TO aisci_app USING
 (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true))
 WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true));
-- statement-break
REVOKE ALL ON TABLE rh_ai.research_data_uploads,rh_ai.research_data_preflights FROM PUBLIC;
-- statement-break
GRANT SELECT,INSERT,UPDATE ON TABLE rh_ai.research_data_uploads,rh_ai.research_data_preflights TO aisci_app;
