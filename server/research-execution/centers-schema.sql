-- Apply separately before activating center configuration. No automatic migration.
-- @statement
CREATE SCHEMA rh_center;
-- @statement
CREATE TABLE rh_center.center (
 tenant_id text NOT NULL, study_id text NOT NULL, id text NOT NULL,
 code text NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120), active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,study_id,id), UNIQUE(tenant_id,study_id,code),
 FOREIGN KEY(tenant_id,study_id) REFERENCES rh_research.study_binding(tenant_id,id)
);
-- @statement
CREATE TABLE rh_center.plan (
 tenant_id text NOT NULL, study_id text NOT NULL, center_id text NOT NULL, version integer NOT NULL CHECK(version>0),
 target integer NOT NULL CHECK(target>0), start_date date NOT NULL, end_date date,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500), created_by text NOT NULL REFERENCES public.account(id),
 created_at timestamptz NOT NULL DEFAULT now(), approved_by text REFERENCES public.account(id), approved_at timestamptz,
 PRIMARY KEY(tenant_id,study_id,center_id,version),
 FOREIGN KEY(tenant_id,study_id,center_id) REFERENCES rh_center.center(tenant_id,study_id,id),
 CHECK(end_date IS NULL OR end_date >= start_date), CHECK((approved_by IS NULL)=(approved_at IS NULL))
);
-- @statement
CREATE UNIQUE INDEX one_pending_center_plan ON rh_center.plan(tenant_id,study_id,center_id) WHERE approved_at IS NULL;
-- @statement
CREATE TABLE rh_center.access (
 tenant_id text NOT NULL, study_id text NOT NULL, center_id text NOT NULL, actor_id text NOT NULL REFERENCES public.account(id),
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,study_id,center_id,actor_id),
 FOREIGN KEY(tenant_id,study_id,center_id) REFERENCES rh_center.center(tenant_id,study_id,id)
);
-- @statement
CREATE TABLE rh_center.attribution (
 tenant_id text NOT NULL, study_id text NOT NULL, enrollment_id text NOT NULL REFERENCES public.study_enrollment(id),
 version integer NOT NULL CHECK(version>0), center_id text NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 created_by text NOT NULL REFERENCES public.account(id), created_at timestamptz NOT NULL DEFAULT now(),
 approved_by text REFERENCES public.account(id), approved_at timestamptz,
 PRIMARY KEY(tenant_id,study_id,enrollment_id,version),
 FOREIGN KEY(tenant_id,study_id,center_id) REFERENCES rh_center.center(tenant_id,study_id,id),
 CHECK((approved_by IS NULL)=(approved_at IS NULL))
);
-- @statement
CREATE UNIQUE INDEX one_pending_attribution ON rh_center.attribution(tenant_id,study_id,enrollment_id) WHERE approved_at IS NULL;
-- @statement
CREATE FUNCTION rh_center.validate_parent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='attribution' AND NOT EXISTS(
   SELECT FROM rh_research.study_binding b JOIN public.study_enrollment e
    ON e."tenantId"=b.tenant_id AND e."studyGroupId"=b.study_group_id AND e."researchProjectId"=b.execution_project_id
   WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.study_id AND e.id=NEW.enrollment_id AND NOT e."acceptanceFixture"
 ) THEN RAISE EXCEPTION 'CENTER_ENROLLMENT_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
-- @statement
CREATE TRIGGER validate_parent BEFORE INSERT ON rh_center.attribution FOR EACH ROW EXECUTE FUNCTION rh_center.validate_parent();
-- @statement
DO $$ DECLARE tab text; app_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['center','plan','access','attribution'] LOOP
  EXECUTE format('ALTER TABLE rh_center.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE rh_center.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_boundary ON rh_center.%I USING (tenant_id=current_setting(''app.tenant_id'',true)) WITH CHECK (tenant_id=current_setting(''app.tenant_id'',true))',tab);
 END LOOP;
 FOREACH app_role IN ARRAY ARRAY['aisci_app','researchhub_demo_app'] LOOP
  IF EXISTS (SELECT FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT USAGE ON SCHEMA rh_center TO %I',app_role);
   EXECUTE format('GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA rh_center TO %I',app_role);
   EXECUTE format('GRANT UPDATE (name,active) ON rh_center.center TO %I',app_role);
   EXECUTE format('GRANT UPDATE (active) ON rh_center.access TO %I',app_role);
   EXECUTE format('GRANT UPDATE (approved_by,approved_at) ON rh_center.plan,rh_center.attribution TO %I',app_role);
  END IF;
 END LOOP;
END $$;
