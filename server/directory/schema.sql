-- Trusted statements, applied atomically only by scripts/directory-schema.mjs.
CREATE SCHEMA rh_directory
-- statement
CREATE TABLE rh_directory.entity (
 tenant_id text NOT NULL REFERENCES public.tenant(id),
 id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('organization','team','researcher')),
 stable_key text NOT NULL CHECK(length(stable_key) BETWEEN 1 AND 160),
 account_id text REFERENCES public.account(id),
 created_by text NOT NULL REFERENCES public.account(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 creation_hub_key text NOT NULL,
 request_key uuid NOT NULL,
 request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 archived_at timestamptz,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,kind,stable_key),
 UNIQUE(tenant_id,created_by,request_key),
 FOREIGN KEY(tenant_id,creation_hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key),
 CHECK(account_id IS NULL OR kind='researcher')
)
-- statement
CREATE UNIQUE INDEX directory_account_binding ON rh_directory.entity(tenant_id,account_id) WHERE account_id IS NOT NULL AND archived_at IS NULL
-- statement
CREATE TABLE rh_directory.assertion (
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 id text NOT NULL,
 entity_id text NOT NULL,
 assertion_key text NOT NULL CHECK(length(assertion_key) BETWEEN 1 AND 240),
 revision integer NOT NULL CHECK(revision>0),
 kind text NOT NULL CHECK(kind IN ('profile','affiliation','team_member','work','collaboration','coverage')),
 related_entity_id text,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16384),
 provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='array' AND jsonb_array_length(provenance) BETWEEN 1 AND 10),
 content_sha256 char(64) NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 request_key uuid NOT NULL,
 request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_by text NOT NULL REFERENCES public.account(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,hub_key,id),
 UNIQUE(tenant_id,hub_key,entity_id,assertion_key,revision),
 UNIQUE(tenant_id,created_by,request_key),
 FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key),
 FOREIGN KEY(tenant_id,entity_id) REFERENCES rh_directory.entity(tenant_id,id),
 FOREIGN KEY(tenant_id,related_entity_id) REFERENCES rh_directory.entity(tenant_id,id)
)
-- statement
CREATE INDEX directory_assertion_head ON rh_directory.assertion(tenant_id,hub_key,entity_id,assertion_key,revision DESC)
-- statement
CREATE INDEX directory_assertion_relation ON rh_directory.assertion(tenant_id,hub_key,kind,related_entity_id)
-- statement
CREATE TABLE rh_directory.decision (
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 id text NOT NULL,
 assertion_id text NOT NULL,
 decision_version integer NOT NULL CHECK(decision_version>0),
 decision text NOT NULL CHECK(decision IN ('approve','reject','revoke')),
 audience text NOT NULL CHECK(audience IN ('public','tenant','none')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 evidence_refs jsonb NOT NULL CHECK(jsonb_typeof(evidence_refs)='array' AND jsonb_array_length(evidence_refs) BETWEEN 1 AND 10),
 assertion_sha256 char(64) NOT NULL CHECK(assertion_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_account_id text NOT NULL REFERENCES public.account(id),
 request_key uuid NOT NULL,
 request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,
 PRIMARY KEY(tenant_id,hub_key,id),
 UNIQUE(tenant_id,hub_key,assertion_id,decision_version),
 UNIQUE(tenant_id,reviewer_account_id,request_key),
 FOREIGN KEY(tenant_id,hub_key,assertion_id) REFERENCES rh_directory.assertion(tenant_id,hub_key,id),
 CHECK((decision='approve' AND audience IN ('public','tenant')) OR (decision IN ('reject','revoke') AND audience='none')),
 CHECK(expires_at IS NULL OR expires_at>created_at)
)
-- statement
CREATE INDEX directory_decision_head ON rh_directory.decision(tenant_id,hub_key,assertion_id,decision_version DESC)
-- statement
CREATE FUNCTION rh_directory.check_parent_scope() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,rh_directory AS $$
DECLARE subject_kind text; related_kind text; actor text;
BEGIN
 IF TG_TABLE_NAME='decision' THEN actor:=NEW.reviewer_account_id;
 ELSE actor:=NEW.created_by; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account WHERE id=actor AND "tenantId"=NEW.tenant_id) THEN
  RAISE EXCEPTION 'DIRECTORY_ACTOR_TENANT_REJECTED' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='entity' THEN
  IF NEW.account_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.account WHERE id=NEW.account_id AND "tenantId"=NEW.tenant_id) THEN
   RAISE EXCEPTION 'DIRECTORY_ACCOUNT_TENANT_REJECTED' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME='assertion' THEN
  SELECT kind INTO subject_kind FROM rh_directory.entity WHERE tenant_id=NEW.tenant_id AND id=NEW.entity_id AND archived_at IS NULL;
  IF subject_kind IS NULL THEN RAISE EXCEPTION 'DIRECTORY_PARENT_REJECTED' USING ERRCODE='23514'; END IF;
  IF NEW.related_entity_id IS NOT NULL THEN
   SELECT kind INTO related_kind FROM rh_directory.entity WHERE tenant_id=NEW.tenant_id AND id=NEW.related_entity_id AND archived_at IS NULL;
   IF related_kind IS NULL OR NEW.related_entity_id=NEW.entity_id THEN RAISE EXCEPTION 'DIRECTORY_RELATION_REJECTED' USING ERRCODE='23514'; END IF;
  END IF;
  IF (NEW.kind='affiliation' AND NOT(subject_kind IN ('researcher','team') AND related_kind='organization'))
    OR (NEW.kind='team_member' AND NOT(subject_kind='researcher' AND related_kind='team'))
    OR (NEW.kind='collaboration' AND related_kind IS NULL)
    OR (NEW.kind IN ('profile','work','coverage') AND related_kind IS NOT NULL)
    OR (NEW.kind IN ('affiliation','team_member') AND related_kind IS NULL) THEN
   RAISE EXCEPTION 'DIRECTORY_KIND_MATRIX_REJECTED' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$
-- statement
CREATE TRIGGER directory_entity_parent BEFORE INSERT OR UPDATE ON rh_directory.entity FOR EACH ROW EXECUTE FUNCTION rh_directory.check_parent_scope()
-- statement
CREATE TRIGGER directory_assertion_parent BEFORE INSERT ON rh_directory.assertion FOR EACH ROW EXECUTE FUNCTION rh_directory.check_parent_scope()
-- statement
CREATE TRIGGER directory_decision_parent BEFORE INSERT ON rh_directory.decision FOR EACH ROW EXECUTE FUNCTION rh_directory.check_parent_scope()
-- statement
ALTER TABLE rh_directory.entity ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_directory.entity FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY directory_entity_scope ON rh_directory.entity USING(tenant_id=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id=current_setting('app.tenant_id',true))
-- statement
ALTER TABLE rh_directory.assertion ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_directory.assertion FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY directory_assertion_scope ON rh_directory.assertion USING(tenant_id=current_setting('app.tenant_id',true) AND hub_key=current_setting('app.hub_key',true)) WITH CHECK(tenant_id=current_setting('app.tenant_id',true) AND hub_key=current_setting('app.hub_key',true))
-- statement
ALTER TABLE rh_directory.decision ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_directory.decision FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY directory_decision_scope ON rh_directory.decision USING(tenant_id=current_setting('app.tenant_id',true) AND hub_key=current_setting('app.hub_key',true)) WITH CHECK(tenant_id=current_setting('app.tenant_id',true) AND hub_key=current_setting('app.hub_key',true))
-- statement
GRANT USAGE ON SCHEMA rh_directory TO aisci_app
-- statement
GRANT SELECT,INSERT ON rh_directory.entity,rh_directory.assertion,rh_directory.decision TO aisci_app
-- statement
GRANT UPDATE(archived_at,version) ON rh_directory.entity TO aisci_app
