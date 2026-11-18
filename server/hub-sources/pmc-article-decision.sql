-- Additive, local synthetic PMC article-level review. Run after pmc-schema.sql.
CREATE TABLE rh_source.pmc_article_decision (
  decision_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hub_key TEXT NOT NULL,
  version_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public','tenant','withheld')),
  asset_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,hub_key,version_id)
    REFERENCES rh_source.pmc_candidate_version (tenant_id,hub_key,id)
);
ALTER TABLE rh_source.pmc_article_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_source.pmc_article_decision FORCE ROW LEVEL SECURITY;
CREATE POLICY pmc_article_decision_app ON rh_source.pmc_article_decision FOR ALL TO aisci_app
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT ON rh_source.pmc_article_decision TO aisci_app;
GRANT USAGE ON SEQUENCE rh_source.pmc_article_decision_decision_version_seq TO aisci_app;
CREATE INDEX pmc_article_decision_current_idx ON rh_source.pmc_article_decision
  (tenant_id,hub_key,version_id,decision_version DESC);
