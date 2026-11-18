-- Applied only by the existing explicitly invoked migration harness, never at startup.
-- @statement
CREATE SCHEMA rh_research;
-- @statement
CREATE TABLE rh_research.project_intent (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES public.tenant(id), owner_id text NOT NULL REFERENCES public.account(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 300), question text NOT NULL DEFAULT '', pico jsonb NOT NULL DEFAULT '{"p":"","i":"","c":"","o":""}',
 research_type text NOT NULL DEFAULT '', hub_key text, version integer NOT NULL DEFAULT 1 CHECK(version>0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','study_created')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key), CHECK(jsonb_typeof(pico)='object')
);
-- @statement
CREATE TABLE rh_research.study_binding (
 id text PRIMARY KEY,tenant_id text NOT NULL,project_intent_id text NOT NULL,execution_project_id text NOT NULL UNIQUE REFERENCES public.research_project(id),
 study_group_id text NOT NULL REFERENCES public.study_group(id),hub_key text,is_default boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,project_intent_id) REFERENCES rh_research.project_intent(tenant_id,id),FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key)
);
-- @statement
CREATE UNIQUE INDEX one_default_study ON rh_research.study_binding(project_intent_id) WHERE is_default;
-- @statement
CREATE TABLE rh_research.hub_role (
 tenant_id text NOT NULL,hub_key text NOT NULL,account_id text NOT NULL REFERENCES public.account(id),study_group_id text NOT NULL REFERENCES public.study_group(id),
 role text NOT NULL CHECK(role='owner'),status text NOT NULL CHECK(status IN ('active','disabled')),version integer NOT NULL DEFAULT 1 CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,hub_key,account_id),FOREIGN KEY(tenant_id,hub_key) REFERENCES rh_hub.hub(tenant_id,hub_key)
);
-- @statement
CREATE TABLE rh_research.operation (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES public.tenant(id),actor_id text NOT NULL REFERENCES public.account(id),request_key text NOT NULL,request_hash text NOT NULL,
 action text NOT NULL,target_id text NOT NULL,result jsonb NOT NULL,audit_id text NOT NULL REFERENCES public.audit_log(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,actor_id,request_key)
);
-- @statement
CREATE FUNCTION rh_research.check_parent_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='project_intent' THEN
  IF NOT EXISTS(SELECT 1 FROM public.account a WHERE a.id=NEW.owner_id AND a."tenantId"=NEW.tenant_id) THEN RAISE EXCEPTION 'RESEARCH_OWNER_PARENT_INVALID' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.owner_id<>OLD.owner_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'RESEARCH_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW.hub_key IS DISTINCT FROM OLD.hub_key AND EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.project_intent_id=NEW.id) THEN RAISE EXCEPTION 'RESEARCH_BOUND_HUB_IMMUTABLE' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='study_binding' THEN
  IF NOT EXISTS(SELECT 1 FROM public.research_project p JOIN public.study_group g ON g.id=p."studyGroupId" AND g."tenantId"=p."tenantId" JOIN rh_research.project_intent i ON i.id=NEW.project_intent_id AND i.tenant_id=p."tenantId" WHERE p.id=NEW.execution_project_id AND p."tenantId"=NEW.tenant_id AND p."studyGroupId"=NEW.study_group_id AND i.hub_key IS NOT DISTINCT FROM NEW.hub_key) THEN RAISE EXCEPTION 'RESEARCH_STUDY_PARENT_INVALID' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'RESEARCH_BINDING_IMMUTABLE' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='hub_role' THEN
  IF NOT EXISTS(SELECT 1 FROM public.account a JOIN public.study_group g ON g."tenantId"=a."tenantId" WHERE a.id=NEW.account_id AND a."tenantId"=NEW.tenant_id AND g.id=NEW.study_group_id) THEN RAISE EXCEPTION 'RESEARCH_HUB_ROLE_PARENT_INVALID' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='operation' THEN
  IF NOT EXISTS(SELECT 1 FROM public.account a WHERE a.id=NEW.actor_id AND a."tenantId"=NEW.tenant_id) THEN RAISE EXCEPTION 'RESEARCH_OPERATION_PARENT_INVALID' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
-- @statement
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['project_intent','study_binding','hub_role','operation'] LOOP
 EXECUTE format('CREATE TRIGGER check_parent_chain BEFORE INSERT OR UPDATE ON rh_research.%I FOR EACH ROW EXECUTE FUNCTION rh_research.check_parent_chain()',t);
 EXECUTE format('ALTER TABLE rh_research.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE rh_research.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_boundary ON rh_research.%I USING (tenant_id=current_setting(''app.tenant_id'',true)) WITH CHECK (tenant_id=current_setting(''app.tenant_id'',true))',t);
 END LOOP; END $$;
-- @statement
GRANT USAGE ON SCHEMA rh_research TO aisci_app;
-- @statement
GRANT SELECT,INSERT,UPDATE ON rh_research.project_intent,rh_research.hub_role TO aisci_app;
-- @statement
GRANT SELECT,INSERT ON rh_research.study_binding,rh_research.operation TO aisci_app;

-- @statement
CREATE FUNCTION rh_research.check_operation_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.audit_log a WHERE a.id=NEW.audit_id AND a."tenantId"=NEW.tenant_id AND a."accountId"=NEW.actor_id) THEN RAISE EXCEPTION 'RESEARCH_AUDIT_PARENT_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
-- @statement
REVOKE ALL ON FUNCTION rh_research.check_operation_audit() FROM PUBLIC,aisci_app;
-- @statement
CREATE TRIGGER check_operation_audit BEFORE INSERT ON rh_research.operation FOR EACH ROW EXECUTE FUNCTION rh_research.check_operation_audit();
