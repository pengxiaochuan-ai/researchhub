-- Additive, same existing source tables/roles/RLS. No role or grant changes.
ALTER TABLE rh_source.canonical_publication
  ADD COLUMN IF NOT EXISTS classification JSONB;
ALTER TABLE rh_source.pmc_candidate_version
  ADD COLUMN IF NOT EXISTS classification JSONB;
