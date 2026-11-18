-- Local synthetic migration only, applied by scripts/study-tasks-schema.mjs.
-- @statement separators keep PL/pgSQL bodies intact; never run fragments alone.
-- @statement
CREATE SCHEMA rh_study_tasks;
-- @statement
CREATE TABLE rh_study_tasks.context (
  task_id text PRIMARY KEY REFERENCES public.study_task(id),
  tenant_id text NOT NULL,
  study_group_id text NOT NULL,
  research_project_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('none','formal_visit','synthetic_crf_record')),
  source_id text,
  parent_id text,
  root_id text,
  source_version integer,
  source_hash text,
  created_by text NOT NULL REFERENCES public.account(id),
  actor_account_id text NOT NULL REFERENCES public.account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT context_source_hash_required CHECK (kind='none' OR source_hash IS NOT NULL),
  CHECK ((kind='none' AND source_id IS NULL AND parent_id IS NULL AND root_id IS NULL
    AND source_version IS NULL AND source_hash IS NULL) OR
    (kind<>'none' AND source_id IS NOT NULL AND parent_id IS NOT NULL AND root_id IS NOT NULL
    AND source_version IS NOT NULL AND source_version>=0 AND source_hash ~ '^[a-f0-9]{64}$'))
);
-- @statement
CREATE TABLE rh_study_tasks.operation (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  study_group_id text NOT NULL,
  research_project_id text NOT NULL,
  actor_account_id text NOT NULL REFERENCES public.account(id),
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK (action IN ('create','edit','assign','transition','review','remind','link')),
  task_id text NOT NULL REFERENCES public.study_task(id),
  expected_version integer CHECK (expected_version>=0),
  result_version integer NOT NULL CHECK (result_version>=0),
  receipt jsonb NOT NULL,
  reason text CHECK (length(reason)<=2000),
  recipient_account_ids text[] NOT NULL DEFAULT '{}',
  notice text CHECK (length(notice)<=2000),
  notification_id text REFERENCES public.study_notification(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,study_group_id,research_project_id,actor_account_id,request_key),
  CHECK ((action='create' AND expected_version IS NULL) OR (action<>'create' AND expected_version IS NOT NULL)),
  CHECK (receipt=jsonb_build_object('operationId',id,'taskId',task_id,'version',result_version)),
  CHECK (action='remind' OR (cardinality(recipient_account_ids)=0 AND notification_id IS NULL AND notice IS NULL))
);
-- @statement
CREATE INDEX context_scope ON rh_study_tasks.context(tenant_id,study_group_id,research_project_id);
-- @statement
CREATE INDEX operation_task_history ON rh_study_tasks.operation(tenant_id,study_group_id,research_project_id,task_id,created_at DESC,id DESC);
-- @statement
CREATE FUNCTION rh_study_tasks.check_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,rh_study_tasks AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.study_task t WHERE t.id=NEW.task_id
    AND t."tenantId"=NEW.tenant_id AND t."studyGroupId"=NEW.study_group_id
    AND t."researchProjectId"=NEW.research_project_id AND t."acceptanceFixture"=false) THEN
    RAISE EXCEPTION 'S08_TASK_PARENT_REJECTED' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.account a WHERE a.id=NEW.actor_account_id AND a."tenantId"=NEW.tenant_id) THEN
    RAISE EXCEPTION 'S08_ACTOR_PARENT_REJECTED' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='context' THEN
    IF NOT EXISTS (SELECT 1 FROM public.account a WHERE a.id=NEW.created_by AND a."tenantId"=NEW.tenant_id) THEN
      RAISE EXCEPTION 'S08_CREATOR_PARENT_REJECTED' USING ERRCODE='23514';
    END IF;
  ELSE
    IF cardinality(NEW.recipient_account_ids)<>(SELECT count(*) FROM public.account a
      WHERE a.id=ANY(NEW.recipient_account_ids) AND a."tenantId"=NEW.tenant_id) THEN
      RAISE EXCEPTION 'S08_RECIPIENT_PARENT_REJECTED' USING ERRCODE='23514';
    END IF;
    IF NEW.notification_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.study_notification n
      WHERE n.id=NEW.notification_id AND n."studyTaskId"=NEW.task_id AND n."tenantId"=NEW.tenant_id
      AND n."studyGroupId"=NEW.study_group_id AND n."researchProjectId"=NEW.research_project_id) THEN
      RAISE EXCEPTION 'S08_NOTICE_PARENT_REJECTED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
-- @statement
CREATE TRIGGER context_scope_guard BEFORE INSERT OR UPDATE ON rh_study_tasks.context FOR EACH ROW EXECUTE FUNCTION rh_study_tasks.check_scope();
-- @statement
CREATE TRIGGER operation_scope_guard BEFORE INSERT OR UPDATE ON rh_study_tasks.operation FOR EACH ROW EXECUTE FUNCTION rh_study_tasks.check_scope();
-- @statement
ALTER TABLE rh_study_tasks.context ENABLE ROW LEVEL SECURITY;
-- @statement
ALTER TABLE rh_study_tasks.context FORCE ROW LEVEL SECURITY;
-- @statement
ALTER TABLE rh_study_tasks.operation ENABLE ROW LEVEL SECURITY;
-- @statement
ALTER TABLE rh_study_tasks.operation FORCE ROW LEVEL SECURITY;
-- @statement
CREATE POLICY context_scope_policy ON rh_study_tasks.context
USING (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true))
WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true));
-- @statement
CREATE POLICY operation_scope_policy ON rh_study_tasks.operation
USING (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true))
WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true));
-- @statement
REVOKE ALL ON SCHEMA rh_study_tasks FROM PUBLIC;
-- @statement
REVOKE ALL ON ALL TABLES IN SCHEMA rh_study_tasks FROM PUBLIC,aisci_app;
-- @statement
GRANT USAGE ON SCHEMA rh_study_tasks TO aisci_app;
-- @statement
GRANT SELECT,INSERT ON rh_study_tasks.context,rh_study_tasks.operation TO aisci_app;
-- @statement
GRANT UPDATE(kind,source_id,parent_id,root_id,source_version,source_hash,actor_account_id,updated_at) ON rh_study_tasks.context TO aisci_app;
