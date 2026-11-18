-- Additive ResearchHub external-source extension. No existing/public table changes.
-- statement
CREATE TABLE rh_source.external_document (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  source_registry_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('clinical_registry','research_standard','clinical_guideline')),
  external_key TEXT NOT NULL CHECK (length(trim(external_key)) > 0),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  source_target_condition TEXT,
  hub_topic TEXT NOT NULL,
  selection_status TEXT NOT NULL CHECK (selection_status IN ('accepted_for_initial_dataset')),
  selection_basis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, document_type, external_key),
  FOREIGN KEY (tenant_id, hub_key, source_registry_id)
    REFERENCES rh_source.source_registry (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.external_document ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.external_document FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.external_document FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT ON rh_source.external_document TO aisci_app

-- statement
CREATE TABLE rh_source.external_document_version (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('multipart/related','application/pdf')),
  content_sha256 CHAR(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  source_url TEXT,
  source_updated_on DATE,
  metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  imported_by TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, id),
  UNIQUE (tenant_id, hub_key, document_id, version_number),
  UNIQUE (tenant_id, hub_key, document_id, content_sha256),
  FOREIGN KEY (tenant_id, hub_key, document_id)
    REFERENCES rh_source.external_document (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.external_document_version ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.external_document_version FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.external_document_version FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT ON rh_source.external_document_version TO aisci_app
-- statement
CREATE INDEX external_document_type_idx ON rh_source.external_document (tenant_id, hub_key, document_type)

-- statement
CREATE TABLE rh_source.external_document_payload (
  version_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  byte_count INTEGER NOT NULL CHECK (byte_count > 0 AND byte_count <= 8388608),
  content_bytes BYTEA NOT NULL,
  CHECK (byte_count = octet_length(content_bytes)),
  FOREIGN KEY (tenant_id, hub_key, version_id)
    REFERENCES rh_source.external_document_version (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.external_document_payload ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.external_document_payload FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.external_document_payload FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- No aisci_app grant on raw payload: no endpoint may accidentally serve it.

-- statement
CREATE TABLE rh_source.external_review_decision (
  decision_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  version_id TEXT NOT NULL,
  field_kind TEXT NOT NULL CHECK (field_kind IN ('bibliographic','abstract','fulltext')),
  purpose TEXT NOT NULL CHECK (purpose IN ('display','ai_retrieval')),
  audience TEXT NOT NULL CHECK (audience IN ('tenant','public')),
  decision TEXT NOT NULL CHECK (decision IN ('approve','revoke')),
  evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) > 0),
  reviewer_id TEXT NOT NULL CHECK (length(trim(reviewer_id)) > 0),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, hub_key, version_id)
    REFERENCES rh_source.external_document_version (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.external_review_decision ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.external_review_decision FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.external_review_decision FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT ON rh_source.external_review_decision TO aisci_app
-- statement
GRANT INSERT ON rh_source.external_review_decision TO aisci_app
-- statement
GRANT USAGE ON SEQUENCE rh_source.external_review_decision_decision_version_seq TO aisci_app
-- statement
CREATE INDEX external_review_scope_idx ON rh_source.external_review_decision
  (tenant_id, hub_key, version_id, field_kind, purpose, decision_version DESC)
-- Only the named-reviewer API may invoke INSERT; raw payload remains unreadable.
