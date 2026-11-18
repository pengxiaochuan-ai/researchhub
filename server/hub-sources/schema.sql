-- ResearchHub-only source catalog; the grant event prefix is installed at Task 1.
-- statement
CREATE TABLE rh_source.source_registry (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  terms_version TEXT,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown','verified','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, source_key)
)
-- statement
ALTER TABLE rh_source.source_registry ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.source_registry FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.source_registry FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.source_registry TO aisci_app

-- statement
CREATE TABLE rh_source.import_batch (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  snapshot_path TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  mapper_version TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged','failed')),
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  error_count INTEGER NOT NULL CHECK (error_count >= 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, file_sha256, sheet_name, mapper_version, scope_key)
)
-- statement
ALTER TABLE rh_source.import_batch ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.import_batch FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.import_batch FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.import_batch TO aisci_app

-- statement
CREATE TABLE rh_source.source_record (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  source_registry_id TEXT NOT NULL,
  row_number INTEGER NOT NULL CHECK (row_number >= 2),
  row_sha256 CHAR(64) NOT NULL,
  raw_fields JSONB NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  authors TEXT,
  journal TEXT,
  publication_year TEXT,
  doi TEXT,
  source_url TEXT,
  abstract_text TEXT,
  display_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (batch_id, row_number),
  FOREIGN KEY (tenant_id, hub_key, batch_id)
    REFERENCES rh_source.import_batch (tenant_id, hub_key, id),
  FOREIGN KEY (tenant_id, hub_key, source_registry_id)
    REFERENCES rh_source.source_registry (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.source_record ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.source_record FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.source_record FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.source_record TO aisci_app
-- statement
CREATE INDEX source_record_scope_idx ON rh_source.source_record (tenant_id, hub_key, source_registry_id, batch_id)
-- statement
CREATE INDEX source_record_doi_idx ON rh_source.source_record (tenant_id, hub_key, doi) WHERE doi IS NOT NULL

-- statement
CREATE TABLE rh_source.canonical_publication (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_year TEXT,
  doi TEXT,
  source_url TEXT,
  abstract_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, source_record_id),
  FOREIGN KEY (tenant_id, hub_key, source_record_id)
    REFERENCES rh_source.source_record (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.canonical_publication ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.canonical_publication FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.canonical_publication FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.canonical_publication TO aisci_app

-- statement
CREATE TABLE rh_source.canonical_source (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  canonical_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  link_kind TEXT NOT NULL DEFAULT 'original' CHECK (link_kind IN ('original','reviewed_match')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, canonical_id, source_record_id),
  FOREIGN KEY (tenant_id, hub_key, canonical_id)
    REFERENCES rh_source.canonical_publication (tenant_id, hub_key, id),
  FOREIGN KEY (tenant_id, hub_key, source_record_id)
    REFERENCES rh_source.source_record (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.canonical_source ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.canonical_source FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.canonical_source FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.canonical_source TO aisci_app

-- statement
CREATE TABLE rh_source.review_decision (
  decision_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  source_registry_id TEXT NOT NULL,
  batch_id TEXT,
  source_record_id TEXT,
  field_kind TEXT NOT NULL CHECK (field_kind IN ('bibliographic','abstract','fulltext')),
  purpose TEXT NOT NULL CHECK (purpose IN ('display','ai_retrieval')),
  decision TEXT NOT NULL CHECK (decision IN ('approve','revoke')),
  audience TEXT NOT NULL DEFAULT 'tenant' CHECK (audience IN ('tenant','public')),
  expires_at TIMESTAMPTZ,
  evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) > 0),
  reviewer_id TEXT NOT NULL,
  confirmed_count INTEGER NOT NULL CHECK (confirmed_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((batch_id IS NOT NULL) <> (source_record_id IS NOT NULL)),
  FOREIGN KEY (tenant_id, hub_key, source_registry_id)
    REFERENCES rh_source.source_registry (tenant_id, hub_key, id),
  FOREIGN KEY (tenant_id, hub_key, batch_id)
    REFERENCES rh_source.import_batch (tenant_id, hub_key, id),
  FOREIGN KEY (tenant_id, hub_key, source_record_id)
    REFERENCES rh_source.source_record (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.review_decision ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.review_decision FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.review_decision FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.review_decision TO aisci_app
-- statement
CREATE INDEX review_decision_scope_idx ON rh_source.review_decision
  (tenant_id, hub_key, source_registry_id, field_kind, purpose, decision_version DESC)
-- statement
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rh_source TO aisci_app
-- statement
CREATE OR REPLACE FUNCTION rh_source.hold_review_grants_for_commit() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
BEGIN
  LOCK TABLE rh_source.review_grant_event IN SHARE MODE;
  RETURN 1;
END;
$$
-- statement
REVOKE ALL ON FUNCTION rh_source.hold_review_grants_for_commit() FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_source.hold_review_grants_for_commit() TO aisci_app
