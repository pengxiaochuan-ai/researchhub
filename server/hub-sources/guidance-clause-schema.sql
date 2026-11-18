-- Only local ResearchHub guidance excerpts; no original-source or clinical-table changes.
-- statement
CREATE TABLE rh_source.guidance_clause_extraction (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, hub_key TEXT NOT NULL, version_id TEXT NOT NULL,
 extraction_version INTEGER NOT NULL CHECK (extraction_version > 0),
 source_sha256 CHAR(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
 extractor_version TEXT NOT NULL CHECK (extractor_version = 'pdf-ocr-visual-v1'),
 payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
 payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 imported_by TEXT NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (tenant_id, hub_key, id),
 UNIQUE (tenant_id, hub_key, version_id, extraction_version),
 UNIQUE (tenant_id, hub_key, version_id, payload_sha256),
 FOREIGN KEY (tenant_id, hub_key, version_id)
   REFERENCES rh_source.external_document_version (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.guidance_clause_extraction ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.guidance_clause_extraction FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.guidance_clause_extraction FOR ALL
 USING (tenant_id = current_setting('app.tenant_id', true))
 WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT ON rh_source.guidance_clause_extraction TO aisci_app
-- statement
CREATE TABLE rh_source.guidance_clause_review (
 decision_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id TEXT NOT NULL, hub_key TEXT NOT NULL, extraction_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK (decision IN ('approve', 'revoke')),
 evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) > 0),
 reviewer_id TEXT NOT NULL CHECK (length(trim(reviewer_id)) > 0),
 expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id, hub_key, extraction_id)
   REFERENCES rh_source.guidance_clause_extraction (tenant_id, hub_key, id)
)
-- statement
ALTER TABLE rh_source.guidance_clause_review ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_source.guidance_clause_review FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY tenant_rows ON rh_source.guidance_clause_review FOR ALL
 USING (tenant_id = current_setting('app.tenant_id', true))
 WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- statement
GRANT SELECT, INSERT ON rh_source.guidance_clause_review TO aisci_app
-- statement
GRANT USAGE ON SEQUENCE rh_source.guidance_clause_review_decision_version_seq TO aisci_app
-- statement
CREATE INDEX guidance_clause_review_scope_idx ON rh_source.guidance_clause_review
 (tenant_id, hub_key, extraction_id, decision_version DESC)
