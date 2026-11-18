-- Additive PMC first-batch extension. Apply only to the guarded synthetic database.
-- The provisioning script creates rh_pmc_collector_local before these statements.
-- statement
CREATE TABLE rh_source.pmc_collector_binding (
  role_name TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  campaign_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role_name = 'rh_pmc_collector_local'),
  CHECK (campaign_key ~ '^pmc-first-[0-9]{4}-[0-9]{2}-[0-9]{2}$')
)
-- statement
ALTER TABLE rh_source.pmc_collector_binding ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_collector_binding FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY collector_binding_read ON rh_source.pmc_collector_binding FOR SELECT TO rh_pmc_collector_local
  USING (role_name = session_user)
-- statement
GRANT SELECT ON rh_source.pmc_collector_binding TO rh_pmc_collector_local

-- statement
CREATE FUNCTION rh_source.pmc_collector_scope(p_tenant TEXT, p_hub TEXT, p_campaign TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
  SELECT EXISTS (
    SELECT 1 FROM rh_source.pmc_collector_binding
    WHERE role_name = session_user AND tenant_id = p_tenant
      AND hub_key = p_hub AND campaign_key = p_campaign
  )
$$
-- statement
REVOKE ALL ON FUNCTION rh_source.pmc_collector_scope(TEXT,TEXT,TEXT) FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_source.pmc_collector_scope(TEXT,TEXT,TEXT) TO rh_pmc_collector_local

-- statement
CREATE TABLE rh_source.pmc_run (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  campaign_key TEXT NOT NULL UNIQUE,
  query_sha256 CHAR(64) NOT NULL CHECK (query_sha256 ~ '^[0-9a-f]{64}$'),
  query_text TEXT NOT NULL,
  query_translation TEXT,
  keyword_version TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  request_ledger JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(request_ledger) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  CHECK (campaign_key ~ '^pmc-first-[0-9]{4}-[0-9]{2}-[0-9]{2}$')
)
-- statement
ALTER TABLE rh_source.pmc_run ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_run FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY pmc_run_app ON rh_source.pmc_run FOR SELECT TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
-- statement
CREATE POLICY pmc_run_collector ON rh_source.pmc_run FOR ALL TO rh_pmc_collector_local
  USING (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
  WITH CHECK (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
-- statement
GRANT SELECT ON rh_source.pmc_run TO aisci_app
-- statement
GRANT SELECT, INSERT ON rh_source.pmc_run TO rh_pmc_collector_local

-- statement
CREATE OR REPLACE FUNCTION rh_source.set_pmc_query_translation(p_campaign TEXT, p_response_sha TEXT,
  p_translation TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
DECLARE v_run rh_source.pmc_run%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM rh_source.pmc_run WHERE campaign_key=p_campaign FOR UPDATE;
  IF NOT FOUND OR NOT rh_source.pmc_collector_scope(v_run.tenant_id, v_run.hub_key, p_campaign)
     OR p_response_sha !~ '^[a-f0-9]{64}$'
     OR p_translation IS NULL OR length(p_translation) NOT BETWEEN 1 AND 10000
     OR v_run.request_ledger->0->>'kind' IS DISTINCT FROM 'esearch'
     OR v_run.request_ledger->0->>'status' IS DISTINCT FROM '200'
     OR v_run.request_ledger->0->>'sha256' IS DISTINCT FROM p_response_sha
     OR (v_run.query_translation IS NOT NULL AND v_run.query_translation <> p_translation) THEN
    RAISE EXCEPTION 'PMC_DISCOVERY_FINALIZE_REJECTED';
  END IF;
  UPDATE rh_source.pmc_run SET query_translation=p_translation WHERE id=v_run.id;
END
$$
-- statement
REVOKE ALL ON FUNCTION rh_source.set_pmc_query_translation(TEXT,TEXT,TEXT) FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_source.set_pmc_query_translation(TEXT,TEXT,TEXT) TO rh_pmc_collector_local

-- statement
CREATE TABLE rh_source.pmc_candidate (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  run_id TEXT NOT NULL,
  campaign_key TEXT NOT NULL,
  pmcid TEXT NOT NULL CHECK (pmcid ~ '^PMC[1-9][0-9]{0,10}$'),
  selected_rank INTEGER NOT NULL CHECK (selected_rank BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, run_id, selected_rank),
  UNIQUE (tenant_id, hub_key, run_id, pmcid),
  FOREIGN KEY (tenant_id, hub_key, run_id)
    REFERENCES rh_source.pmc_run (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.pmc_candidate ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_candidate FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY pmc_candidate_app ON rh_source.pmc_candidate FOR SELECT TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
-- statement
CREATE POLICY pmc_candidate_collector ON rh_source.pmc_candidate FOR ALL TO rh_pmc_collector_local
  USING (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
  WITH CHECK (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
-- statement
GRANT SELECT ON rh_source.pmc_candidate TO aisci_app
-- statement
GRANT SELECT, INSERT ON rh_source.pmc_candidate TO rh_pmc_collector_local

-- statement
CREATE TABLE rh_source.pmc_candidate_version (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  campaign_key TEXT NOT NULL,
  pmcid TEXT NOT NULL,
  article_version TEXT NOT NULL CHECK (article_version ~ '^PMC[1-9][0-9]{0,10}[.][1-9][0-9]{0,2}$'),
  raw_sha256 CHAR(64) NOT NULL CHECK (raw_sha256 ~ '^[0-9a-f]{64}$'),
  oai_datestamp TEXT,
  license_uri TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  journal TEXT,
  doi TEXT,
  publication_year INTEGER CHECK (publication_year BETWEEN 1800 AND 2200),
  authors JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authors) = 'array'),
  abstract_text TEXT,
  body_text TEXT,
  tables_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tables_json) = 'array'),
  media_refs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(media_refs) = 'array'),
  cloud_manifest JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(cloud_manifest) = 'array'),
  expected_asset_count INTEGER NOT NULL CHECK (expected_asset_count BETWEEN 1 AND 260),
  staged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, candidate_id, article_version, raw_sha256),
  FOREIGN KEY (tenant_id, hub_key, candidate_id)
    REFERENCES rh_source.pmc_candidate (tenant_id, hub_key, id),
  CHECK (article_version LIKE pmcid || '.%'),
  CHECK (license_uri ~ '^https://creativecommons[.]org/licenses/by/[1-9][0-9]*([.][0-9]+)?/?$'
    OR license_uri ~ '^https://creativecommons[.]org/publicdomain/zero/[1-9][0-9]*([.][0-9]+)?/?$')
)
-- statement
ALTER TABLE rh_source.pmc_candidate_version ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_candidate_version FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY pmc_version_app ON rh_source.pmc_candidate_version FOR SELECT TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
-- statement
CREATE POLICY pmc_version_collector ON rh_source.pmc_candidate_version FOR ALL TO rh_pmc_collector_local
  USING (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
  WITH CHECK (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
-- statement
GRANT SELECT ON rh_source.pmc_candidate_version TO aisci_app
-- statement
GRANT SELECT, INSERT ON rh_source.pmc_candidate_version TO rh_pmc_collector_local

-- statement
CREATE TABLE rh_source.pmc_asset (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  version_id TEXT NOT NULL,
  campaign_key TEXT NOT NULL,
  component_ref TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('jats','image','supplement')),
  official_url TEXT NOT NULL,
  object_sha256 CHAR(64) NOT NULL CHECK (object_sha256 ~ '^[0-9a-f]{64}$'),
  object_md5 CHAR(32),
  byte_count BIGINT NOT NULL CHECK (byte_count BETWEEN 1 AND 67108864),
  local_object_key TEXT NOT NULL CHECK (local_object_key !~ '(^/|[.][.])'),
  mime_type TEXT,
  rights_uri TEXT,
  attribution TEXT,
  third_party_rights BOOLEAN NOT NULL DEFAULT false,
  parsed_text TEXT,
  staged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, version_id, component_ref),
  UNIQUE (tenant_id, hub_key, version_id, component_ref, object_sha256),
  FOREIGN KEY (tenant_id, hub_key, version_id)
    REFERENCES rh_source.pmc_candidate_version (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.pmc_asset ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_asset FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY pmc_asset_app ON rh_source.pmc_asset FOR SELECT TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
-- statement
CREATE POLICY pmc_asset_collector ON rh_source.pmc_asset FOR ALL TO rh_pmc_collector_local
  USING (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
  WITH CHECK (rh_source.pmc_collector_scope(tenant_id, hub_key, campaign_key))
-- statement
GRANT SELECT ON rh_source.pmc_asset TO aisci_app
-- statement
GRANT SELECT, INSERT ON rh_source.pmc_asset TO rh_pmc_collector_local

-- statement
CREATE TABLE rh_source.pmc_review_decision (
  decision_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  version_id TEXT NOT NULL,
  asset_id TEXT,
  field_kind TEXT NOT NULL CHECK (field_kind IN ('bibliographic','abstract','body','table','image','supplement')),
  purpose TEXT NOT NULL CHECK (purpose IN ('display','download','ai_retrieval')),
  audience TEXT NOT NULL CHECK (audience IN ('tenant','public')),
  decision TEXT NOT NULL CHECK (decision IN ('approve','revoke')),
  evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) > 0),
  reviewer_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, hub_key, version_id)
    REFERENCES rh_source.pmc_candidate_version (tenant_id, hub_key, id),
  FOREIGN KEY (tenant_id, hub_key, asset_id)
    REFERENCES rh_source.pmc_asset (tenant_id, hub_key, id),
  CHECK ((field_kind IN ('image','supplement')) = (asset_id IS NOT NULL))
)
-- statement
ALTER TABLE rh_source.pmc_review_decision ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.pmc_review_decision FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY pmc_review_app ON rh_source.pmc_review_decision FOR ALL TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.pmc_review_decision TO aisci_app
-- statement
GRANT USAGE ON SEQUENCE rh_source.pmc_review_decision_decision_version_seq TO aisci_app
-- statement
CREATE INDEX pmc_review_current_idx ON rh_source.pmc_review_decision
  (tenant_id, hub_key, version_id, field_kind, asset_id, purpose, audience, decision_version DESC)

-- statement
CREATE FUNCTION rh_source.reserve_pmc_request(p_campaign TEXT, p_method TEXT, p_target TEXT,
  p_kind TEXT, p_pmcid TEXT DEFAULT NULL, p_version TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
DECLARE
  v_run rh_source.pmc_run%ROWTYPE;
  v_seq BIGINT;
  v_expected TEXT;
BEGIN
  SELECT * INTO v_run FROM rh_source.pmc_run WHERE campaign_key = p_campaign FOR UPDATE;
  IF NOT FOUND OR NOT rh_source.pmc_collector_scope(v_run.tenant_id, v_run.hub_key, p_campaign) THEN
    RAISE EXCEPTION 'PMC_SCOPE_REJECTED';
  END IF;
  IF p_kind = 'esearch' THEN
    IF p_method <> 'POST' OR p_target <> 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
       OR p_pmcid IS NOT NULL OR p_version IS NOT NULL OR v_run.request_count <> 0 THEN
      RAISE EXCEPTION 'PMC_TARGET_REJECTED';
    END IF;
  ELSE
    IF p_method <> 'GET' OR NOT EXISTS (
      SELECT 1 FROM rh_source.pmc_candidate c WHERE c.run_id = v_run.id
        AND c.tenant_id = v_run.tenant_id AND c.hub_key = v_run.hub_key AND c.pmcid = p_pmcid
    ) THEN RAISE EXCEPTION 'PMC_CANDIDATE_REJECTED'; END IF;
    IF p_kind = 'oai' THEN
      IF p_target <> 'https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/?verb=GetRecord&identifier=oai%3Apubmedcentral.nih.gov%3A'
         || substring(p_pmcid FROM 4) || '&metadataPrefix=pmc' OR p_version IS NOT NULL THEN
        RAISE EXCEPTION 'PMC_TARGET_REJECTED';
      END IF;
    ELSIF p_kind = 'cloud_version_list' THEN
      IF p_target <> 'https://pmc-oa-opendata.s3.amazonaws.com/?list-type=2&prefix=' || p_pmcid || '.&delimiter=/'
         OR p_version IS NOT NULL THEN RAISE EXCEPTION 'PMC_TARGET_REJECTED'; END IF;
    ELSIF p_kind IN ('cloud_object_list','cloud_metadata','cloud_object') THEN
      IF p_version IS NULL OR p_version !~ '^PMC[1-9][0-9]{0,10}[.][1-9][0-9]{0,2}$'
         OR p_version NOT LIKE p_pmcid || '.%' THEN RAISE EXCEPTION 'PMC_VERSION_REJECTED'; END IF;
      IF p_kind = 'cloud_object_list' THEN
        v_expected := 'https://pmc-oa-opendata.s3.amazonaws.com/?list-type=2&prefix=' || p_version || '/';
      ELSIF p_kind = 'cloud_metadata' THEN
        v_expected := 'https://pmc-oa-opendata.s3.amazonaws.com/metadata/' || p_version || '.json';
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM rh_source.pmc_candidate_version cv
          JOIN rh_source.pmc_candidate c ON c.id = cv.candidate_id
            AND c.tenant_id = cv.tenant_id AND c.hub_key = cv.hub_key
          WHERE c.run_id = v_run.id AND c.pmcid = p_pmcid AND cv.article_version = p_version
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(cv.cloud_manifest) object
              WHERE object->>'url' = p_target)
        ) THEN RAISE EXCEPTION 'PMC_MANIFEST_REJECTED'; END IF;
        v_expected := p_target;
        IF p_target !~ ('^https://pmc-oa-opendata[.]s3[.]amazonaws[.]com/' || p_version || '/[A-Za-z0-9_./%-]+[?]md5=[0-9a-f]{32}$')
        THEN RAISE EXCEPTION 'PMC_TARGET_REJECTED'; END IF;
      END IF;
      IF p_target <> v_expected THEN RAISE EXCEPTION 'PMC_TARGET_REJECTED'; END IF;
    ELSE
      RAISE EXCEPTION 'PMC_KIND_REJECTED';
    END IF;
  END IF;
  v_seq := v_run.request_count + 1;
  UPDATE rh_source.pmc_run SET request_count = v_seq,
    request_ledger = request_ledger || jsonb_build_array(jsonb_build_object(
      'sequence', v_seq, 'method', p_method, 'target', p_target, 'kind', p_kind,
      'pmcid', p_pmcid, 'version', p_version, 'status', 'reserved', 'at', clock_timestamp()
    )) WHERE id = v_run.id;
  RETURN v_seq;
END
$$
-- statement
REVOKE ALL ON FUNCTION rh_source.reserve_pmc_request(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_source.reserve_pmc_request(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO rh_pmc_collector_local

-- statement
CREATE FUNCTION rh_source.complete_pmc_request(p_campaign TEXT, p_sequence BIGINT,
  p_status TEXT, p_sha256 TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
DECLARE
  v_run rh_source.pmc_run%ROWTYPE;
  v_index INTEGER;
BEGIN
  SELECT * INTO v_run FROM rh_source.pmc_run WHERE campaign_key = p_campaign FOR UPDATE;
  IF NOT FOUND OR NOT rh_source.pmc_collector_scope(v_run.tenant_id, v_run.hub_key, p_campaign)
     OR p_status !~ '^(unknown|invalid_response|[1-5][0-9]{2})$'
     OR (p_sha256 IS NOT NULL AND p_sha256 !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'PMC_COMPLETION_REJECTED';
  END IF;
  SELECT (ordinality - 1)::INTEGER INTO v_index
    FROM jsonb_array_elements(v_run.request_ledger) WITH ORDINALITY AS item(value, ordinality)
    WHERE (value->>'sequence')::BIGINT = p_sequence AND value->>'status' = 'reserved';
  IF v_index IS NULL THEN RAISE EXCEPTION 'PMC_COMPLETION_CONFLICT'; END IF;
  UPDATE rh_source.pmc_run SET request_ledger = jsonb_set(request_ledger, ARRAY[v_index::TEXT],
    (request_ledger->v_index) || jsonb_build_object('status', p_status,
      'sha256', p_sha256, 'completed_at', clock_timestamp())) WHERE id = v_run.id;
END
$$
-- statement
REVOKE ALL ON FUNCTION rh_source.complete_pmc_request(TEXT,BIGINT,TEXT,TEXT) FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_source.complete_pmc_request(TEXT,BIGINT,TEXT,TEXT) TO rh_pmc_collector_local
