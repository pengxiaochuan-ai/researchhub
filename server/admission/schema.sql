CREATE SCHEMA rh_admission
-- statement
CREATE TABLE rh_admission.application (
 id text PRIMARY KEY,
 tenant_id text NOT NULL,
 hub_key text NOT NULL,
 account_id text NOT NULL REFERENCES public.account(id),
 source text NOT NULL CHECK(source IN ('registration_review','legacy_confirmed')),
 status text NOT NULL CHECK(status IN ('pending','needs_information','approved','rejected')),
 allow_resubmit boolean NOT NULL DEFAULT false CHECK(NOT allow_resubmit OR status='rejected'),
 material jsonb NOT NULL CHECK(jsonb_typeof(material)='object' AND NOT material ? 'password' AND NOT material ? 'token'),
 material_version integer NOT NULL DEFAULT 1 CHECK(material_version>0),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,hub_key,account_id),
 FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key)
)
-- statement
CREATE TABLE rh_admission.event (
 id text PRIMARY KEY,
 application_id text NOT NULL REFERENCES rh_admission.application(id),
 tenant_id text NOT NULL,
 actor_id text NOT NULL REFERENCES public.account(id),
 actor_auth_version integer NOT NULL,
 action text NOT NULL CHECK(action IN ('register','legacy_confirmed','approve','needs_information','reject','supplement','resubmit')),
 revision integer NOT NULL CHECK(revision>0),
 material_version integer NOT NULL CHECK(material_version>0),
 material jsonb NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=500),
 policy_version text NOT NULL,
 request_key text NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(application_id,revision),
 UNIQUE(tenant_id,actor_id,request_key)
)
-- statement
CREATE FUNCTION rh_admission.can_read(t text, a text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT t=current_setting('app.tenant_id',true) AND EXISTS (
 SELECT 1 FROM public.account u JOIN public.tenant n ON n.id=u."tenantId"
 WHERE u.id=current_setting('app.account_id',true) AND u."tenantId"=t
 AND u."authVersion"::text=current_setting('app.auth_version',true)
 AND u.status='active' AND n.status='active'
 AND (u.id=a OR (u.role='tenant_admin' AND u."isTenantAdmin"=true)))
$$
-- statement
ALTER TABLE rh_admission.application ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_admission.application FORCE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_admission.event ENABLE ROW LEVEL SECURITY
-- statement
ALTER TABLE rh_admission.event FORCE ROW LEVEL SECURITY
-- statement
CREATE POLICY admission_application_scope ON rh_admission.application FOR ALL USING (rh_admission.can_read(tenant_id,account_id)) WITH CHECK (rh_admission.can_read(tenant_id,account_id))
-- statement
CREATE POLICY admission_event_scope ON rh_admission.event FOR ALL USING (EXISTS(SELECT 1 FROM rh_admission.application a WHERE a.id=application_id AND a.tenant_id=event.tenant_id)) WITH CHECK (EXISTS(SELECT 1 FROM rh_admission.application a WHERE a.id=application_id AND a.tenant_id=event.tenant_id) AND actor_id=current_setting('app.account_id',true) AND actor_auth_version::text=current_setting('app.auth_version',true))
-- statement
CREATE FUNCTION rh_admission.protect_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE actor public.account%ROWTYPE; is_admin boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'admission history retained'; END IF;
 SELECT * INTO actor FROM public.account WHERE id=current_setting('app.account_id',true) AND "tenantId"=NEW.tenant_id AND "authVersion"::text=current_setting('app.auth_version',true) AND status='active' FOR SHARE;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'admission actor invalid'; END IF;
 is_admin := actor.role='tenant_admin' AND actor."isTenantAdmin"=true;
 IF NOT EXISTS(SELECT 1 FROM public.account WHERE id=NEW.account_id AND "tenantId"=NEW.tenant_id AND status='active') THEN RAISE EXCEPTION 'admission parent invalid'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW.material_version<>1 OR NOT ((NEW.source='registration_review' AND NEW.status='pending' AND actor.id=NEW.account_id) OR (NEW.source='legacy_confirmed' AND NEW.status='approved' AND is_admin)) THEN RAISE EXCEPTION 'admission initial state invalid'; END IF;
 ELSE
  IF (NEW.id,NEW.tenant_id,NEW.hub_key,NEW.account_id,NEW.source,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.hub_key,OLD.account_id,OLD.source,OLD.created_at) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'admission immutable identity'; END IF;
  IF OLD.status='pending' THEN
   IF NOT is_admin OR actor.id=NEW.account_id OR NEW.status NOT IN ('approved','needs_information','rejected') OR NEW.material IS DISTINCT FROM OLD.material OR NEW.material_version<>OLD.material_version THEN RAISE EXCEPTION 'admission decision invalid'; END IF;
  ELSIF OLD.status IN ('needs_information','rejected') THEN
   IF actor.id<>NEW.account_id OR NEW.status<>'pending' OR (OLD.status='rejected' AND NOT OLD.allow_resubmit) OR NEW.material_version<>OLD.material_version+1 OR NEW.material->'registration' IS DISTINCT FROM OLD.material->'registration' THEN RAISE EXCEPTION 'admission supplement invalid'; END IF;
  ELSE RAISE EXCEPTION 'admission terminal state'; END IF;
 END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER admission_application_mutation BEFORE INSERT OR UPDATE OR DELETE ON rh_admission.application FOR EACH ROW EXECUTE FUNCTION rh_admission.protect_mutation()
-- statement
CREATE FUNCTION rh_admission.check_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a rh_admission.application%ROWTYPE; expected text;
BEGIN
 SELECT * INTO a FROM rh_admission.application WHERE id=NEW.application_id;
 expected := CASE NEW.action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'needs_information' THEN 'needs_information' WHEN 'legacy_confirmed' THEN 'approved' ELSE 'pending' END;
 IF a.id IS NULL OR a.tenant_id<>NEW.tenant_id OR a.revision<>NEW.revision OR a.material_version<>NEW.material_version OR a.material IS DISTINCT FROM NEW.material OR a.status<>expected OR (NEW.action IN ('reject','needs_information','supplement','resubmit') AND btrim(NEW.reason)='') THEN RAISE EXCEPTION 'admission event mismatch'; END IF;
 IF NEW.actor_id<>current_setting('app.account_id',true) OR NEW.actor_auth_version::text<>current_setting('app.auth_version',true) THEN RAISE EXCEPTION 'admission event actor invalid'; END IF;
 IF NEW.result IS DISTINCT FROM jsonb_build_object('id',a.id,'status',a.status,'revision',a.revision,'materialVersion',a.material_version,'allowResubmit',a.allow_resubmit) THEN RAISE EXCEPTION 'admission result mismatch'; END IF;
 RETURN NEW;
END
$$
-- statement
CREATE TRIGGER admission_event_insert BEFORE INSERT ON rh_admission.event FOR EACH ROW EXECUTE FUNCTION rh_admission.check_event()
-- statement
CREATE FUNCTION rh_admission.retain_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN RAISE EXCEPTION 'admission event is immutable'; END
$$
-- statement
CREATE TRIGGER admission_event_retained BEFORE UPDATE OR DELETE ON rh_admission.event FOR EACH ROW EXECUTE FUNCTION rh_admission.retain_event()
-- statement
CREATE FUNCTION rh_admission.require_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM rh_admission.event WHERE application_id=NEW.id AND revision=NEW.revision AND material_version=NEW.material_version AND material=NEW.material) THEN RAISE EXCEPTION 'admission event required'; END IF;
 RETURN NULL;
END
$$
-- statement
CREATE CONSTRAINT TRIGGER admission_application_event AFTER INSERT OR UPDATE ON rh_admission.application DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_admission.require_event()
-- statement
REVOKE ALL ON SCHEMA rh_admission FROM PUBLIC
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA rh_admission FROM PUBLIC
-- statement
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rh_admission FROM PUBLIC
-- statement
GRANT USAGE ON SCHEMA rh_admission TO aisci_app
-- statement
GRANT SELECT,INSERT,UPDATE ON rh_admission.application TO aisci_app
-- statement
GRANT SELECT,INSERT ON rh_admission.event TO aisci_app
-- statement
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rh_admission TO aisci_app
