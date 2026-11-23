-- Proposed additive migration only. Startup and HTTP handlers never execute it.
CREATE SCHEMA rh_hub_activity
-- statement
REVOKE ALL ON SCHEMA rh_hub_activity FROM PUBLIC
-- statement
CREATE TABLE rh_hub_activity.evidence (
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 category text NOT NULL CHECK(category IN ('registration','publication','guidance','organization','researcher','platform_content')),
 entity_key text NOT NULL CHECK(length(entity_key) BETWEEN 1 AND 512 AND entity_key !~ '[[:cntrl:]]'),
 evidence_hash char(64) NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
 time_status text NOT NULL CHECK(time_status IN ('verified','historical_undated')),
 first_public_at timestamptz,
 proof_refs jsonb NOT NULL CHECK(jsonb_typeof(proof_refs)='array' AND jsonb_array_length(proof_refs) BETWEEN 1 AND 64),
 rule_version text NOT NULL CHECK(length(btrim(rule_version)) BETWEEN 1 AND 512),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,hub_key,category,entity_key,evidence_hash),
 FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key),
 CHECK((time_status='verified' AND first_public_at IS NOT NULL AND first_public_at<=observed_at) OR (time_status='historical_undated' AND first_public_at IS NULL))
)
-- statement
CREATE TABLE rh_hub_activity.first_public (
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 category text NOT NULL,
 entity_key text NOT NULL,
 evidence_hash char(64) NOT NULL,
 time_status text NOT NULL CHECK(time_status IN ('verified','historical_undated')),
 first_public_at timestamptz,
 proof_refs jsonb NOT NULL,
 rule_version text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,hub_key,category,entity_key),
 FOREIGN KEY(tenant_id,hub_key,category,entity_key,evidence_hash) REFERENCES rh_hub_activity.evidence(tenant_id,hub_key,category,entity_key,evidence_hash),
 CHECK((time_status='verified' AND first_public_at IS NOT NULL AND first_public_at<=observed_at) OR (time_status='historical_undated' AND first_public_at IS NULL))
)
-- statement
CREATE INDEX hub_activity_first_date ON rh_hub_activity.first_public(tenant_id,hub_key,first_public_at DESC,category,entity_key) WHERE first_public_at IS NOT NULL
-- statement
CREATE FUNCTION rh_hub_activity.scope_matches(t text,h text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT t=current_setting('app.tenant_id',true) AND h=current_setting('app.hub_key',true)
 AND EXISTS(SELECT 1 FROM rh_hub.hub b JOIN public.tenant n ON n.id=b.tenant_id WHERE b.tenant_id=t AND b.hub_key=h AND b.status='active' AND n.status='active')
$$
-- statement
CREATE FUNCTION rh_hub_activity.owner_writer() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT current_user=pg_get_userbyid(relowner) FROM pg_class WHERE oid='rh_hub_activity.first_public'::regclass
$$
-- statement
ALTER TABLE rh_hub_activity.evidence ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_hub_activity.evidence FORCE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_hub_activity.first_public ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_hub_activity.first_public FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY hub_activity_evidence_owner ON rh_hub_activity.evidence FOR ALL USING(rh_hub_activity.owner_writer() AND rh_hub_activity.scope_matches(tenant_id,hub_key)) WITH CHECK(rh_hub_activity.owner_writer() AND rh_hub_activity.scope_matches(tenant_id,hub_key))
-- statement
CREATE POLICY hub_activity_first_owner ON rh_hub_activity.first_public FOR ALL USING(rh_hub_activity.owner_writer() AND rh_hub_activity.scope_matches(tenant_id,hub_key)) WITH CHECK(rh_hub_activity.owner_writer() AND rh_hub_activity.scope_matches(tenant_id,hub_key))
-- statement
CREATE POLICY hub_activity_first_reader ON rh_hub_activity.first_public FOR SELECT USING(rh_hub_activity.scope_matches(tenant_id,hub_key))
-- statement
CREATE FUNCTION rh_hub_activity.protect_history() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE e rh_hub_activity.evidence%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' OR (TG_TABLE_NAME='evidence' AND TG_OP='UPDATE') THEN RAISE EXCEPTION 'public activity evidence retained'; END IF;
 IF TG_TABLE_NAME='first_public' THEN
  SELECT * INTO e FROM rh_hub_activity.evidence WHERE tenant_id=NEW.tenant_id AND hub_key=NEW.hub_key AND category=NEW.category AND entity_key=NEW.entity_key AND evidence_hash=NEW.evidence_hash;
  IF e.evidence_hash IS NULL OR (NEW.time_status,NEW.first_public_at,NEW.proof_refs,NEW.rule_version) IS DISTINCT FROM (e.time_status,e.first_public_at,e.proof_refs,e.rule_version) THEN RAISE EXCEPTION 'public activity proof mismatch'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (NEW.tenant_id,NEW.hub_key,NEW.category,NEW.entity_key,NEW.observed_at) IS DISTINCT FROM (OLD.tenant_id,OLD.hub_key,OLD.category,OLD.entity_key,OLD.observed_at) THEN RAISE EXCEPTION 'public activity immutable identity'; END IF;
   IF OLD.first_public_at IS NOT NULL AND (NEW.first_public_at IS NULL OR NEW.first_public_at>OLD.first_public_at) THEN RAISE EXCEPTION 'public activity first date cannot move later'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER hub_activity_evidence_retained BEFORE UPDATE OR DELETE ON rh_hub_activity.evidence FOR EACH ROW EXECUTE FUNCTION rh_hub_activity.protect_history()
-- statement
CREATE TRIGGER hub_activity_first_proof BEFORE INSERT OR UPDATE OR DELETE ON rh_hub_activity.first_public FOR EACH ROW EXECUTE FUNCTION rh_hub_activity.protect_history()
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA rh_hub_activity FROM PUBLIC
-- statement
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rh_hub_activity FROM PUBLIC
-- statement
DO $grant_activity_reader$
DECLARE
 reader_role name;
BEGIN
 IF current_database() = 'researchhub' AND current_user = 'researchhub_demo_owner' THEN
  reader_role := 'researchhub_demo_app';
 ELSIF current_database() = 'wp01_test_full_baseline' AND current_user = 'aisci_owner' THEN
  reader_role := 'aisci_app';
 ELSE
  RAISE EXCEPTION 'Hub activity migration target or owner mismatch';
 END IF;
 EXECUTE format('GRANT USAGE ON SCHEMA rh_hub_activity TO %I', reader_role);
 EXECUTE format('GRANT SELECT ON rh_hub_activity.first_public TO %I', reader_role);
 EXECUTE format('GRANT EXECUTE ON FUNCTION rh_hub_activity.scope_matches(text,text),rh_hub_activity.owner_writer() TO %I', reader_role);
END
$grant_activity_reader$
