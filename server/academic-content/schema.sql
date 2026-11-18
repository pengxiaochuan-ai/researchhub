CREATE SCHEMA rh_academic
-- statement
CREATE TABLE rh_academic.content (
 id text PRIMARY KEY,
 tenant_id text NOT NULL,
 hub_key text NOT NULL CHECK(hub_key='lingshu-xinyu'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')),
 published_version_id text,
 published_audience text CHECK(published_audience IN ('public','members')),
 published_hash text CHECK(published_hash ~ '^[a-f0-9]{64}$'),
 first_published_at timestamptz,
 updated_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL,
 UNIQUE(id,tenant_id,hub_key),
 FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key),
 CHECK((status='published' AND published_version_id IS NOT NULL AND published_audience IS NOT NULL AND published_hash IS NOT NULL AND first_published_at IS NOT NULL) OR (status<>'published' AND published_version_id IS NULL AND published_audience IS NULL)),
 CHECK(status<>'draft' OR first_published_at IS NULL)
)
-- statement
CREATE TABLE rh_academic.version (
 id text PRIMARY KEY,
 content_id text NOT NULL,
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 revision integer NOT NULL CHECK(revision>1),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND payload->>'audience' IN ('public','members') AND jsonb_typeof(payload->'resources')='array'),
 published_at timestamptz NOT NULL,
 UNIQUE(id,content_id,tenant_id,hub_key),
 UNIQUE(content_id,revision),
 FOREIGN KEY(content_id,tenant_id,hub_key) REFERENCES rh_academic.content(id,tenant_id,hub_key)
)
-- statement
ALTER TABLE rh_academic.content ADD CONSTRAINT academic_current_version FOREIGN KEY(published_version_id,id,tenant_id,hub_key) REFERENCES rh_academic.version(id,content_id,tenant_id,hub_key) DEFERRABLE INITIALLY DEFERRED
-- statement
CREATE TABLE rh_academic.event (
 id text PRIMARY KEY,
 content_id text NOT NULL,
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 actor_id text NOT NULL REFERENCES public.account(id),
 actor_auth_version integer NOT NULL CHECK(actor_auth_version>=0),
 action text NOT NULL CHECK(action IN ('create','save','publish','withdraw')),
 base_revision integer NOT NULL CHECK(base_revision>=0),
 revision integer NOT NULL CHECK(revision=base_revision+1),
 request_key text NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(content_id,revision),
 UNIQUE(tenant_id,actor_id,request_key),
 FOREIGN KEY(content_id,tenant_id,hub_key) REFERENCES rh_academic.content(id,tenant_id,hub_key),
 CHECK((action='create' AND base_revision=0) OR (action<>'create' AND base_revision>0)),
 CHECK(action<>'withdraw' OR btrim(reason)<>'')
)
-- statement
CREATE INDEX academic_published_listing ON rh_academic.content(tenant_id,hub_key,status,first_published_at DESC,id DESC)
-- statement
CREATE INDEX academic_management_listing ON rh_academic.content(tenant_id,hub_key,updated_at DESC,id DESC)
-- statement
CREATE FUNCTION rh_academic.current_admin(t text,h text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT t=current_setting('app.tenant_id',true) AND h=current_setting('app.hub_key',true) AND h='lingshu-xinyu' AND EXISTS(
 SELECT 1 FROM public.account a JOIN public.tenant n ON n.id=a."tenantId" JOIN rh_hub.hub b ON b.tenant_id=n.id AND b.hub_key=h
 WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=t AND a."authVersion"::text=current_setting('app.auth_version',true)
 AND a.status='active' AND n.status='active' AND b.status='active' AND a.role='tenant_admin' AND a."isTenantAdmin"=true
 AND EXISTS(SELECT 1 FROM rh_admission.application d WHERE d.tenant_id=t AND d.hub_key=h AND d.account_id=a.id AND d.status='approved'))
$$
-- statement
ALTER TABLE rh_academic.content ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_academic.content FORCE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_academic.version ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_academic.version FORCE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_academic.event ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_academic.event FORCE ROW LEVEL SECURITY
-- statement
-- Raw rows contain unpublished drafts, rights evidence and members-only resource URLs.
-- They are never public/member SQL projections. Those APIs use the explicitly scoped service projection.
CREATE POLICY academic_content_admin ON rh_academic.content FOR ALL USING(rh_academic.current_admin(tenant_id,hub_key)) WITH CHECK(rh_academic.current_admin(tenant_id,hub_key))
-- statement
CREATE POLICY academic_version_admin ON rh_academic.version FOR ALL USING(rh_academic.current_admin(tenant_id,hub_key)) WITH CHECK(rh_academic.current_admin(tenant_id,hub_key))
-- statement
CREATE POLICY academic_event_admin ON rh_academic.event FOR ALL USING(rh_academic.current_admin(tenant_id,hub_key)) WITH CHECK(rh_academic.current_admin(tenant_id,hub_key))
-- statement
CREATE FUNCTION rh_academic.protect_content() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v rh_academic.version%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'academic history retained'; END IF;
 IF rh_academic.current_admin(NEW.tenant_id,NEW.hub_key) IS DISTINCT FROM true THEN RAISE EXCEPTION 'academic admin invalid'; END IF;
 PERFORM id FROM public.account WHERE id=current_setting('app.account_id',true) AND "tenantId"=NEW.tenant_id FOR SHARE;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW.status<>'draft' OR NEW.published_version_id IS NOT NULL OR NEW.first_published_at IS NOT NULL OR NEW.published_hash IS NOT NULL THEN RAISE EXCEPTION 'academic initial state invalid'; END IF;
 ELSE
  IF (NEW.id,NEW.tenant_id,NEW.hub_key,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.hub_key,OLD.created_at) OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at THEN RAISE EXCEPTION 'academic immutable identity or revision'; END IF;
  IF OLD.first_published_at IS NOT NULL AND NEW.first_published_at IS DISTINCT FROM OLD.first_published_at THEN RAISE EXCEPTION 'academic first publication immutable'; END IF;
  IF NEW.status='draft' AND OLD.status<>'draft' THEN RAISE EXCEPTION 'academic state invalid'; END IF;
 END IF;
 IF NEW.published_version_id IS NOT NULL THEN
  SELECT * INTO v FROM rh_academic.version WHERE id=NEW.published_version_id AND content_id=NEW.id AND tenant_id=NEW.tenant_id AND hub_key=NEW.hub_key;
  IF v.id IS NULL OR NEW.published_audience IS DISTINCT FROM v.payload->>'audience' THEN RAISE EXCEPTION 'academic published parent invalid'; END IF;
  IF TG_OP='INSERT' OR NEW.published_version_id IS DISTINCT FROM OLD.published_version_id THEN
   IF v.payload IS DISTINCT FROM NEW.draft OR v.revision<>NEW.revision THEN RAISE EXCEPTION 'academic published version mismatch'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER academic_content_protected BEFORE INSERT OR UPDATE OR DELETE ON rh_academic.content FOR EACH ROW EXECUTE FUNCTION rh_academic.protect_content()
-- statement
CREATE FUNCTION rh_academic.protect_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE parent rh_academic.content%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'academic version immutable'; END IF;
 IF rh_academic.current_admin(NEW.tenant_id,NEW.hub_key) IS DISTINCT FROM true THEN RAISE EXCEPTION 'academic admin invalid'; END IF;
 SELECT * INTO parent FROM rh_academic.content WHERE id=NEW.content_id AND tenant_id=NEW.tenant_id AND hub_key=NEW.hub_key FOR UPDATE;
 IF parent.id IS NULL OR NEW.revision<>parent.revision+1 OR NEW.payload IS DISTINCT FROM parent.draft THEN RAISE EXCEPTION 'academic version parent invalid'; END IF;
 IF coalesce(btrim(NEW.payload->>'body'),'')='' OR coalesce(btrim(NEW.payload->>'source'),'')='' OR coalesce(btrim(NEW.payload->>'rights'),'')='' OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'resources') r WHERE coalesce(btrim(r->>'rights'),'')='' OR r->>'audience' NOT IN ('public','members')) THEN RAISE EXCEPTION 'academic publication rights incomplete'; END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER academic_version_protected BEFORE INSERT OR UPDATE OR DELETE ON rh_academic.version FOR EACH ROW EXECUTE FUNCTION rh_academic.protect_version()
-- statement
CREATE FUNCTION rh_academic.protect_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c rh_academic.content%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'academic event immutable'; END IF;
 IF rh_academic.current_admin(NEW.tenant_id,NEW.hub_key) IS DISTINCT FROM true OR NEW.actor_id IS DISTINCT FROM current_setting('app.account_id',true) OR NEW.actor_auth_version::text IS DISTINCT FROM current_setting('app.auth_version',true) THEN RAISE EXCEPTION 'academic actor invalid'; END IF;
 SELECT * INTO c FROM rh_academic.content WHERE id=NEW.content_id AND tenant_id=NEW.tenant_id AND hub_key=NEW.hub_key;
 IF c.id IS NULL OR c.revision<>NEW.revision OR NEW.result->'content'->>'id' IS DISTINCT FROM c.id OR NEW.result->'content'->>'revision' IS DISTINCT FROM c.revision::text OR NEW.result->'content'->>'status' IS DISTINCT FROM c.status OR NEW.result->'content'->'draft' IS DISTINCT FROM c.draft OR NEW.result->'content'->>'publishedVersionId' IS DISTINCT FROM c.published_version_id THEN RAISE EXCEPTION 'academic event content mismatch'; END IF;
 IF NEW.result->'receipt' IS DISTINCT FROM jsonb_build_object('contentId',c.id,'action',NEW.action,'baseRevision',NEW.base_revision,'requestKey',NEW.request_key,'requestHash',NEW.request_hash) THEN RAISE EXCEPTION 'academic receipt mismatch'; END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER academic_event_protected BEFORE INSERT OR UPDATE OR DELETE ON rh_academic.event FOR EACH ROW EXECUTE FUNCTION rh_academic.protect_event()
-- statement
CREATE FUNCTION rh_academic.require_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE e rh_academic.event%ROWTYPE;
BEGIN
 SELECT * INTO e FROM rh_academic.event WHERE content_id=NEW.id AND tenant_id=NEW.tenant_id AND hub_key=NEW.hub_key AND revision=NEW.revision;
 IF e.id IS NULL OR e.result->'content'->'draft' IS DISTINCT FROM NEW.draft OR e.result->'content'->>'status' IS DISTINCT FROM NEW.status OR e.result->'content'->>'publishedVersionId' IS DISTINCT FROM NEW.published_version_id THEN RAISE EXCEPTION 'academic event required'; END IF;
 IF TG_OP='INSERT' THEN
  IF e.action<>'create' THEN RAISE EXCEPTION 'academic creation event invalid'; END IF;
 ELSIF e.action='save' THEN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.published_version_id IS DISTINCT FROM OLD.published_version_id OR NEW.published_hash IS DISTINCT FROM OLD.published_hash THEN RAISE EXCEPTION 'academic draft changed publication'; END IF;
 ELSIF e.action='publish' THEN
  IF NEW.status<>'published' OR NEW.published_version_id IS NULL OR NEW.published_version_id IS NOT DISTINCT FROM OLD.published_version_id OR NEW.draft IS DISTINCT FROM OLD.draft THEN RAISE EXCEPTION 'academic publish event invalid'; END IF;
 ELSIF e.action='withdraw' THEN
  IF OLD.status<>'published' OR NEW.status<>'withdrawn' OR NEW.published_version_id IS NOT NULL OR NEW.draft IS DISTINCT FROM OLD.draft THEN RAISE EXCEPTION 'academic withdrawal event invalid'; END IF;
 ELSE RAISE EXCEPTION 'academic mutation event invalid'; END IF;
 RETURN NULL;
END
$$
-- statement
CREATE CONSTRAINT TRIGGER academic_content_event AFTER INSERT OR UPDATE ON rh_academic.content DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_academic.require_event()
-- statement
CREATE FUNCTION rh_academic.require_publication() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM rh_academic.event e WHERE e.content_id=NEW.content_id AND e.tenant_id=NEW.tenant_id AND e.hub_key=NEW.hub_key AND e.revision=NEW.revision AND e.action='publish' AND e.result->'content'->>'publishedVersionId'=NEW.id) THEN RAISE EXCEPTION 'academic version publication event required'; END IF;
 RETURN NULL;
END
$$
-- statement
CREATE CONSTRAINT TRIGGER academic_version_event AFTER INSERT ON rh_academic.version DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_academic.require_publication()
-- statement
REVOKE ALL ON SCHEMA rh_academic FROM PUBLIC
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA rh_academic FROM PUBLIC
-- statement
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rh_academic FROM PUBLIC
-- statement
GRANT USAGE ON SCHEMA rh_academic TO aisci_app
-- statement
GRANT SELECT,INSERT,UPDATE ON rh_academic.content TO aisci_app
-- statement
GRANT SELECT,INSERT ON rh_academic.version,rh_academic.event TO aisci_app
-- statement
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rh_academic TO aisci_app
