CREATE TABLE rh_ai.session_media_content_runs (
 id text PRIMARY KEY,root_id text NOT NULL,attempt_no integer NOT NULL CHECK(attempt_no>=0),
 tenant_id text NOT NULL,study_group_id text NOT NULL,research_project_id text NOT NULL,account_id text NOT NULL,session_id text NOT NULL,media_id text NOT NULL,study_id text NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),source_sha256 text NOT NULL CHECK(source_sha256~'^[a-f0-9]{64}$'),source_bytes bigint NOT NULL CHECK(source_bytes BETWEEN 1 AND 524288000),
 request_key text,input_hash text CHECK(input_hash~'^[a-f0-9]{64}$'),origin_id text,
 config_hash text NOT NULL CHECK(config_hash~'^[a-f0-9]{64}$'),manifest jsonb,
 grant_by text,grant_audit_id text,grant_expires_at timestamptz,grant_revoked_at timestamptz,grant_version integer NOT NULL DEFAULT 1 CHECK(grant_version>0),
 channels jsonb NOT NULL DEFAULT '{"audio":{"state":"idle","version":1},"visual":{"state":"idle","version":1}}'::jsonb,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_id,attempt_no),UNIQUE(tenant_id,account_id,session_id,media_id,request_key),
 CHECK((request_key IS NULL)=(input_hash IS NULL)),CHECK(request_key IS NULL OR request_key~'^[A-Za-z0-9_-]{1,160}$'),
 CHECK((attempt_no=0 AND root_id=id AND grant_by IS NOT NULL AND grant_audit_id IS NOT NULL AND grant_expires_at IS NOT NULL AND grant_expires_at>created_at AND grant_expires_at<=created_at+interval '7 days') OR (attempt_no>0 AND root_id<>id AND origin_id IS NOT NULL AND grant_by IS NULL AND grant_expires_at IS NULL AND request_key IS NOT NULL)),
 CHECK(jsonb_typeof(channels)='object' AND channels?'audio' AND channels?'visual' AND octet_length(channels::text)<131072)
);
-- statement-break
CREATE UNIQUE INDEX session_media_content_root ON rh_ai.session_media_content_runs(tenant_id,account_id,media_id,source_version) WHERE attempt_no=0;
-- statement-break
CREATE INDEX session_media_content_owner ON rh_ai.session_media_content_runs(tenant_id,account_id,session_id,media_id,created_at DESC);
-- statement-break
CREATE TABLE rh_ai.session_media_content_evidence (
 id text PRIMARY KEY,row_id text NOT NULL REFERENCES rh_ai.session_media_content_runs(id),root_id text NOT NULL,
 tenant_id text NOT NULL,study_group_id text NOT NULL,research_project_id text NOT NULL,account_id text NOT NULL,session_id text NOT NULL,media_id text NOT NULL,
 channel text NOT NULL CHECK(channel IN('audio','visual')),evidence_key text NOT NULL CHECK(evidence_key~'^[A-Za-z0-9_-]{1,160}$'),
 claim_token uuid NOT NULL,channel_version integer NOT NULL CHECK(channel_version>0),body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=65536),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(row_id,channel,evidence_key)
);
-- statement-break
CREATE FUNCTION rh_ai.check_session_media_content() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE actor text;is_admin boolean;previous_account text;g record;r record;m record;c text;oldc jsonb;newc jsonb;changes integer:=0;
BEGIN
 actor:=nullif(current_setting('app.account_id',true),'');previous_account:=actor;
 IF actor IS NULL OR NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') OR NEW.study_group_id IS DISTINCT FROM nullif(current_setting('app.study_group_id',true),'') OR NEW.research_project_id IS DISTINCT FROM nullif(current_setting('app.research_project_id',true),'') THEN RAISE EXCEPTION 'CONTENT_CONTEXT'; END IF;
 SELECT a.role='tenant_admin' AND a."isTenantAdmin" INTO is_admin FROM public.account a JOIN public.tenant t ON t.id=a."tenantId" WHERE a.id=actor AND a."tenantId"=NEW.tenant_id AND a.status='active' AND t.status='active' FOR SHARE OF a,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_ACTOR'; END IF;
 IF TG_TABLE_NAME='session_media_content_runs' THEN
  IF TG_OP='INSERT' AND NEW.attempt_no=0 THEN
   IF NOT is_admin OR NEW.grant_by<>actor THEN RAISE EXCEPTION 'CONTENT_GRANT_ADMIN'; END IF;
   IF NEW.version<>1 OR NEW.grant_version<>1 OR NEW.grant_revoked_at IS NOT NULL OR NEW.request_key IS NOT NULL OR NEW.manifest IS NOT NULL OR NEW.channels<>'{"audio":{"state":"idle","version":1},"visual":{"state":"idle","version":1}}'::jsonb THEN RAISE EXCEPTION 'CONTENT_INITIAL'; END IF;
  ELSE
   IF TG_OP='UPDATE' THEN
    IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CONTENT_VERSION'; END IF;
    IF ROW(NEW.grant_by,NEW.grant_audit_id,NEW.grant_expires_at,NEW.grant_revoked_at,NEW.grant_version) IS DISTINCT FROM ROW(OLD.grant_by,OLD.grant_audit_id,OLD.grant_expires_at,OLD.grant_revoked_at,OLD.grant_version) THEN
     IF NOT is_admin OR NEW.attempt_no<>0 THEN RAISE EXCEPTION 'CONTENT_GRANT_ADMIN'; END IF;
     IF OLD.grant_revoked_at IS NOT NULL OR NEW.grant_revoked_at IS NULL OR NEW.grant_version<>OLD.grant_version+1 OR NEW.grant_audit_id=OLD.grant_audit_id OR (to_jsonb(NEW)-ARRAY['grant_revoked_at','grant_version','grant_audit_id','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['grant_revoked_at','grant_version','grant_audit_id','version','updated_at']) THEN RAISE EXCEPTION 'CONTENT_GRANT_IMMUTABLE'; END IF;
     NEW.updated_at:=statement_timestamp();RETURN NEW;
    END IF;
    IF ROW(NEW.id,NEW.root_id,NEW.attempt_no,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id,NEW.session_id,NEW.media_id,NEW.study_id,NEW.source_version,NEW.source_sha256,NEW.source_bytes,NEW.origin_id,NEW.config_hash,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.root_id,OLD.attempt_no,OLD.tenant_id,OLD.study_group_id,OLD.research_project_id,OLD.account_id,OLD.session_id,OLD.media_id,OLD.study_id,OLD.source_version,OLD.source_sha256,OLD.source_bytes,OLD.origin_id,OLD.config_hash,OLD.created_at) OR (OLD.request_key IS NOT NULL AND ROW(NEW.request_key,NEW.input_hash) IS DISTINCT FROM ROW(OLD.request_key,OLD.input_hash)) OR (OLD.manifest IS NOT NULL AND NEW.manifest IS DISTINCT FROM OLD.manifest) THEN RAISE EXCEPTION 'CONTENT_IMMUTABLE'; END IF;
   ELSE
    IF NEW.version<>1 OR NEW.grant_revoked_at IS NOT NULL OR NEW.grant_audit_id IS NOT NULL THEN RAISE EXCEPTION 'CONTENT_INITIAL'; END IF;
   END IF;
   IF NEW.account_id<>actor THEN RAISE EXCEPTION 'CONTENT_OWNER'; END IF;
   SELECT * INTO g FROM rh_ai.session_media_content_runs WHERE id=NEW.root_id AND attempt_no=0 AND tenant_id=NEW.tenant_id AND account_id=NEW.account_id AND media_id=NEW.media_id AND session_id=NEW.session_id AND study_id=NEW.study_id FOR SHARE;
   IF NOT FOUND OR g.grant_revoked_at IS NOT NULL OR g.grant_expires_at<=statement_timestamp() OR g.source_version<>NEW.source_version OR g.config_hash<>NEW.config_hash THEN RAISE EXCEPTION 'CONTENT_PERMISSION'; END IF;
   IF EXISTS(SELECT 1 FROM rh_ai.session_media_content_runs x WHERE x.root_id=NEW.root_id AND x.attempt_no>NEW.attempt_no) THEN RAISE EXCEPTION 'CONTENT_ATTEMPT'; END IF;
   IF TG_OP='INSERT' THEN
    PERFORM 1 FROM rh_ai.session_media_content_runs p WHERE p.id=NEW.origin_id AND p.root_id=NEW.root_id AND p.attempt_no=NEW.attempt_no-1;
    IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_ATTEMPT'; END IF;
    SELECT * INTO r FROM rh_ai.session_media_content_runs WHERE id=NEW.origin_id;
    IF EXISTS(SELECT 1 FROM rh_ai.session_media_content_runs x WHERE x.root_id=NEW.root_id AND x.attempt_no>=NEW.attempt_no) OR NEW.manifest IS DISTINCT FROM r.manifest THEN RAISE EXCEPTION 'CONTENT_ATTEMPT'; END IF;
    FOREACH c IN ARRAY ARRAY['audio','visual'] LOOP
     IF NEW.channels->c->>'state'='queued' THEN
      IF r.channels->c->>'state'<>'failed' OR r.channels->c->>'outcomeKnown'<>'true' THEN RAISE EXCEPTION 'CONTENT_RETRY_UNCERTAIN'; END IF;
     ELSIF (NEW.channels->c)-'resultRowId' IS DISTINCT FROM (r.channels->c)-'resultRowId' OR NEW.channels->c->>'resultRowId' IS DISTINCT FROM COALESCE(r.channels->c->>'resultRowId',r.id) THEN RAISE EXCEPTION 'CONTENT_RETRY_CHANGED'; END IF;
    END LOOP;
   END IF;
  END IF;
  FOREACH c IN ARRAY ARRAY['audio','visual'] LOOP
   newc:=NEW.channels->c;
   IF jsonb_typeof(newc) IS DISTINCT FROM 'object' OR newc->>'state' IS NULL OR newc->>'version' IS NULL OR newc->>'state' NOT IN('idle','queued','running','complete','not_applicable','failed') OR (newc->>'version')::integer<1 THEN RAISE EXCEPTION 'CONTENT_CHANNEL'; END IF;
   IF newc->>'state'='running' AND (newc->>'leaseToken' IS NULL OR (newc->>'leaseExpiresAt')::timestamptz IS NULL) THEN RAISE EXCEPTION 'CONTENT_LEASE'; END IF;
   IF TG_OP='UPDATE' AND NEW.channels->c IS DISTINCT FROM OLD.channels->c THEN
    oldc:=OLD.channels->c;changes:=changes+1;
    IF (newc->>'version')::integer<>(oldc->>'version')::integer+1 OR NOT ((oldc->>'state'='idle' AND newc->>'state'='queued') OR (oldc->>'state'='queued' AND (newc->>'state'='running' OR (newc->>'state'='failed' AND newc->>'code'='MEDIA_CONTENT_AUTHORIZATION_CHANGED' AND newc->>'outcomeKnown'='true' AND oldc->>'authVersion' IS DISTINCT FROM (SELECT a."authVersion"::text FROM public.account a WHERE a.id=actor AND a."tenantId"=NEW.tenant_id)))) OR (oldc->>'state'='running' AND newc->>'state' IN('running','complete','not_applicable','failed'))) THEN RAISE EXCEPTION 'CONTENT_CHANNEL_STATE'; END IF;
    IF oldc->>'state'='running' AND (oldc->>'leaseToken' IS DISTINCT FROM newc->>'leaseToken' OR ((oldc->>'leaseExpiresAt')::timestamptz<=statement_timestamp() AND NOT(newc->>'state'='failed' AND newc->>'code'='MEDIA_CONTENT_INTERRUPTED_UNKNOWN' AND newc->>'outcomeKnown'='false'))) THEN RAISE EXCEPTION 'CONTENT_LEASE'; END IF;
   END IF;
  END LOOP;
  IF changes>1 AND NOT(OLD.request_key IS NULL AND NEW.request_key IS NOT NULL) THEN RAISE EXCEPTION 'CONTENT_CHANNEL_OVERWRITE'; END IF;
 ELSE
  IF TG_OP<>'INSERT' OR NEW.account_id<>actor THEN RAISE EXCEPTION 'CONTENT_EVIDENCE_IMMUTABLE'; END IF;
  SELECT * INTO r FROM rh_ai.session_media_content_runs WHERE id=NEW.row_id AND root_id=NEW.root_id AND tenant_id=NEW.tenant_id AND account_id=NEW.account_id AND session_id=NEW.session_id AND media_id=NEW.media_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_PARENT'; END IF;
  SELECT * INTO g FROM rh_ai.session_media_content_runs WHERE id=NEW.root_id FOR SHARE;
  IF NOT FOUND OR g.grant_revoked_at IS NOT NULL OR g.grant_expires_at<=statement_timestamp() OR EXISTS(SELECT 1 FROM rh_ai.session_media_content_runs x WHERE x.root_id=r.root_id AND x.attempt_no>r.attempt_no) THEN RAISE EXCEPTION 'CONTENT_PERMISSION'; END IF;
  newc:=r.channels->NEW.channel;
  IF newc->>'state'<>'running' OR (newc->>'version')::integer<>NEW.channel_version OR newc->>'leaseToken'<>NEW.claim_token::text OR (newc->>'leaseExpiresAt')::timestamptz<=statement_timestamp() THEN RAISE EXCEPTION 'CONTENT_LEASE'; END IF;
  IF NEW.body->>'text' IS NULL OR length(NEW.body->>'text') NOT BETWEEN 1 AND 16000 OR NEW.body->>'startUs' IS NULL OR NEW.body->>'endUs' IS NULL OR r.manifest->>'durationUs' IS NULL OR NEW.body->>'kind' IS DISTINCT FROM (CASE WHEN NEW.channel='audio' THEN 'transcript' ELSE 'frame' END) OR NEW.body->>'id' IS DISTINCT FROM NEW.evidence_key OR NEW.body->>'kind' NOT IN('transcript','frame') OR (NEW.body->>'startUs')!~'^[0-9]{1,13}$' OR (NEW.body->>'endUs')!~'^[0-9]{1,13}$' OR (NEW.body->>'startUs')::bigint>(NEW.body->>'endUs')::bigint OR (NEW.body->>'endUs')::bigint>(r.manifest->>'durationUs')::bigint THEN RAISE EXCEPTION 'CONTENT_EVIDENCE'; END IF;
 END IF;
 PERFORM set_config('app.account_id',NEW.account_id,true);
 SELECT * INTO m FROM rh_ai.session_media_uploads WHERE id=NEW.media_id AND tenant_id=NEW.tenant_id AND study_group_id=NEW.study_group_id AND research_project_id=NEW.research_project_id AND account_id=NEW.account_id AND session_id=NEW.session_id FOR SHARE;
 IF NOT FOUND OR m.archive_state<>'archived' OR m.inspection_state<>'complete' OR m.inspection_classification<>'valid' THEN RAISE EXCEPTION 'CONTENT_SOURCE'; END IF;
 IF TG_TABLE_NAME='session_media_content_runs' THEN
  IF m.version<>NEW.source_version OR m.source_sha256<>NEW.source_sha256 OR m.byte_size<>NEW.source_bytes THEN RAISE EXCEPTION 'CONTENT_SOURCE_VERSION'; END IF;
 END IF;
 IF TG_TABLE_NAME='session_media_content_evidence' THEN
  IF m.version<>r.source_version OR m.source_sha256<>r.source_sha256 THEN RAISE EXCEPTION 'CONTENT_SOURCE_VERSION'; END IF;
 END IF;
 PERFORM 1 FROM public.session s JOIN public.account a ON a.id=s."accountId" AND a."tenantId"=s."tenantId" JOIN public.research_project p ON p.id=s."researchProjectId" AND p."tenantId"=s."tenantId" JOIN public.study_group sg ON sg.id=p."studyGroupId" AND sg."tenantId"=p."tenantId" WHERE s.id=NEW.session_id AND s."accountId"=NEW.account_id AND s."tenantId"=NEW.tenant_id AND s."researchProjectId"=NEW.research_project_id AND s."studyGroupId"=NEW.study_group_id AND s.status='active' AND s."deletedAt" IS NULL AND a.status='active' AND p.status='active' AND sg.status='active' FOR SHARE OF s,a,p,sg;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_PARENT'; END IF;
 IF TG_TABLE_NAME='session_media_content_runs' THEN
  PERFORM 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND p.status='active' FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_STUDY_PARENT'; END IF;
 END IF;
 PERFORM set_config('app.account_id',previous_account,true);
 IF TG_OP='INSERT' THEN NEW.created_at:=statement_timestamp(); END IF;
 IF TG_TABLE_NAME='session_media_content_runs' THEN NEW.updated_at:=statement_timestamp(); END IF;RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.account_id',COALESCE(previous_account,''),true);RAISE;
END $body$;
-- statement-break
CREATE TRIGGER session_media_content_runs_guard BEFORE INSERT OR UPDATE ON rh_ai.session_media_content_runs FOR EACH ROW EXECUTE FUNCTION rh_ai.check_session_media_content();
-- statement-break
CREATE TRIGGER session_media_content_evidence_guard BEFORE INSERT OR UPDATE ON rh_ai.session_media_content_evidence FOR EACH ROW EXECUTE FUNCTION rh_ai.check_session_media_content();
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_session_media_content() FROM PUBLIC;
-- statement-break
ALTER TABLE rh_ai.session_media_content_runs ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.session_media_content_runs FORCE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.session_media_content_evidence ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.session_media_content_evidence FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY session_media_content_runs_scope ON rh_ai.session_media_content_runs FOR ALL TO aisci_app USING(tenant_id=nullif(current_setting('app.tenant_id',true),'') AND study_group_id=nullif(current_setting('app.study_group_id',true),'') AND research_project_id=nullif(current_setting('app.research_project_id',true),'') AND (account_id=nullif(current_setting('app.account_id',true),'') OR EXISTS(SELECT 1 FROM public.account a WHERE a.id=nullif(current_setting('app.account_id',true),'') AND a."tenantId"=tenant_id AND a.role='tenant_admin' AND a."isTenantAdmin" AND a.status='active'))) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),''));
-- statement-break
CREATE POLICY session_media_content_evidence_scope ON rh_ai.session_media_content_evidence FOR ALL TO aisci_app USING(tenant_id=nullif(current_setting('app.tenant_id',true),'') AND study_group_id=nullif(current_setting('app.study_group_id',true),'') AND research_project_id=nullif(current_setting('app.research_project_id',true),'') AND account_id=nullif(current_setting('app.account_id',true),'')) WITH CHECK(account_id=nullif(current_setting('app.account_id',true),''));
-- statement-break
GRANT SELECT,INSERT,UPDATE ON rh_ai.session_media_content_runs TO aisci_app;
-- statement-break
GRANT SELECT,INSERT ON rh_ai.session_media_content_evidence TO aisci_app;
