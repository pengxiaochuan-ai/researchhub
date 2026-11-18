-- Explicit, guarded, synthetic-only migration. Never run during application startup.
CREATE SCHEMA IF NOT EXISTS rh_ai;
-- statement-break
CREATE TABLE rh_ai.session_materials (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
  -- Historical references, not lifecycle-owning FKs: old native deletion must
  -- remain independent. The trigger locks/checks true parents on new bindings;
  -- consumers must reject snapshots whose native parents no longer exist.
  tenant_id text NOT NULL,
  study_group_id text NOT NULL,
  research_project_id text NOT NULL,
  account_id text NOT NULL,
  session_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'knowledge',
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','importing','ready','blocked','failed')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  kb_id text,
  source_file_id text UNIQUE,
  import_task_id text UNIQUE,
  doc_id text,
  doc_version integer CHECK (doc_version > 0),
  content_sha256 text CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_material_request_key UNIQUE (tenant_id,account_id,session_id,request_key),
  CONSTRAINT session_material_source_pair CHECK ((source_file_id IS NULL) = (import_task_id IS NULL)),
  CONSTRAINT session_material_source_base CHECK (source_file_id IS NULL OR kb_id IS NOT NULL),
  CONSTRAINT session_material_doc_snapshot CHECK (
    (doc_id IS NULL AND doc_version IS NULL AND content_sha256 IS NULL) OR
    (doc_id IS NOT NULL AND doc_version IS NOT NULL AND content_sha256 IS NOT NULL AND source_file_id IS NOT NULL)),
  CONSTRAINT session_material_import_binding CHECK (state NOT IN ('importing','ready') OR source_file_id IS NOT NULL),
  CONSTRAINT session_material_ready_snapshot CHECK (state <> 'ready' OR doc_id IS NOT NULL)
);
-- statement-break
CREATE INDEX session_material_list ON rh_ai.session_materials
  (tenant_id,study_group_id,research_project_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE FUNCTION rh_ai.check_session_material() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
  IF NEW.purpose <> 'knowledge' THEN RAISE EXCEPTION 'MATERIAL_PURPOSE_DISABLED'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') OR
     NEW.study_group_id IS DISTINCT FROM nullif(current_setting('app.study_group_id',true),'') OR
     NEW.research_project_id IS DISTINCT FROM nullif(current_setting('app.research_project_id',true),'') OR
     NEW.account_id IS DISTINCT FROM nullif(current_setting('app.account_id',true),'') THEN
    RAISE EXCEPTION 'MATERIAL_CONTEXT_MISMATCH';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version <> 1 OR NEW.state <> 'staged' OR NEW.deleted_at IS NOT NULL OR
       NEW.source_file_id IS NOT NULL OR NEW.doc_id IS NOT NULL THEN
      RAISE EXCEPTION 'MATERIAL_INITIAL_STATE';
    END IF;
    NEW.created_at := statement_timestamp();
  ELSE
    IF ROW(NEW.id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id,NEW.session_id,
           NEW.purpose,NEW.request_key,NEW.request_fingerprint,NEW.source_sha256,NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id,OLD.tenant_id,OLD.study_group_id,OLD.research_project_id,OLD.account_id,OLD.session_id,
           OLD.purpose,OLD.request_key,OLD.request_fingerprint,OLD.source_sha256,OLD.created_at) OR
       (OLD.kb_id IS NOT NULL AND NEW.kb_id IS DISTINCT FROM OLD.kb_id) OR
       (OLD.source_file_id IS NOT NULL AND NEW.source_file_id IS DISTINCT FROM OLD.source_file_id) OR
       (OLD.import_task_id IS NOT NULL AND NEW.import_task_id IS DISTINCT FROM OLD.import_task_id) OR
       (OLD.doc_id IS NOT NULL AND ROW(NEW.doc_id,NEW.doc_version,NEW.content_sha256)
         IS DISTINCT FROM ROW(OLD.doc_id,OLD.doc_version,OLD.content_sha256)) THEN
      RAISE EXCEPTION 'MATERIAL_IDENTITY_IMMUTABLE';
    END IF;
    IF NEW.version::bigint <> OLD.version::bigint+1 THEN RAISE EXCEPTION 'MATERIAL_VERSION_CONFLICT'; END IF;
    IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'MATERIAL_REMOVED'; END IF;
    IF NOT (NEW.state=OLD.state OR
       (OLD.state='staged' AND NEW.state IN ('importing','failed')) OR
       (OLD.state='importing' AND NEW.state IN ('ready','blocked','failed')) OR
       (OLD.state='blocked' AND NEW.state IN ('importing','failed')) OR
       (OLD.state='ready' AND NEW.state='failed')) THEN
      RAISE EXCEPTION 'MATERIAL_STATE_CONFLICT';
    END IF;
  END IF;
  NEW.updated_at := statement_timestamp();
  -- Lock real parents for this transaction only. Reads/tools still revalidate
  -- current authorization and source versions; a past ready flag is not a grant.
  PERFORM 1 FROM public.tenant t WHERE t.id=NEW.tenant_id AND t.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PARENT_INVALID'; END IF;
  PERFORM 1 FROM public.account a WHERE a.id=NEW.account_id AND a."tenantId"=NEW.tenant_id AND a.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PARENT_INVALID'; END IF;
  PERFORM 1 FROM public.study_group g WHERE g.id=NEW.study_group_id AND g."tenantId"=NEW.tenant_id AND g.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PARENT_INVALID'; END IF;
  PERFORM 1 FROM public.research_project p WHERE p.id=NEW.research_project_id AND
    p."tenantId"=NEW.tenant_id AND p."studyGroupId"=NEW.study_group_id AND p.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PARENT_INVALID'; END IF;
  PERFORM 1 FROM public.session s WHERE s.id=NEW.session_id AND s."tenantId"=NEW.tenant_id AND
    s."studyGroupId"=NEW.study_group_id AND s."researchProjectId"=NEW.research_project_id AND
    s."accountId"=NEW.account_id AND s."deletedAt" IS NULL AND s.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PARENT_INVALID'; END IF;
  -- Attenuation cannot replace any frozen binding above. Missing/edited native
  -- content must not prevent marking the old snapshot unavailable or removed.
  IF TG_OP='UPDATE' AND (NEW.state='failed' OR NEW.deleted_at IS NOT NULL) THEN
    IF ROW(NEW.kb_id,NEW.source_file_id,NEW.import_task_id,NEW.doc_id,NEW.doc_version,NEW.content_sha256)
       IS DISTINCT FROM ROW(OLD.kb_id,OLD.source_file_id,OLD.import_task_id,OLD.doc_id,OLD.doc_version,OLD.content_sha256) THEN
      RAISE EXCEPTION 'MATERIAL_IDENTITY_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.kb_id IS NOT NULL THEN
    PERFORM 1 FROM public.knowledge_base k WHERE k.id=NEW.kb_id AND k."tenantId"=NEW.tenant_id AND
      k."studyGroupId"=NEW.study_group_id AND k."researchProjectId"=NEW.research_project_id AND
      k."ownerAccountId"=NEW.account_id AND k.visibility='private' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_PRIVATE_BASE_INVALID'; END IF;
  END IF;
  IF NEW.source_file_id IS NOT NULL THEN
    PERFORM 1 FROM public.knowledge_source_file f WHERE f.id=NEW.source_file_id AND f."kbId"=NEW.kb_id AND
      f."tenantId"=NEW.tenant_id AND f."studyGroupId"=NEW.study_group_id AND
      f."createdBy"=NEW.account_id AND f.sha256=NEW.source_sha256 FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_SOURCE_INVALID'; END IF;
    PERFORM 1 FROM public.knowledge_import_task i WHERE i.id=NEW.import_task_id AND i."kbId"=NEW.kb_id AND
      i."sourceFileId"=NEW.source_file_id AND i."tenantId"=NEW.tenant_id AND
      i."studyGroupId"=NEW.study_group_id AND i."createdBy"=NEW.account_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_IMPORT_INVALID'; END IF;
  END IF;
  IF NEW.doc_id IS NOT NULL THEN
    PERFORM 1 FROM public.knowledge_doc d WHERE d.id=NEW.doc_id AND d."kbId"=NEW.kb_id AND
      d."tenantId"=NEW.tenant_id AND d."studyGroupId"=NEW.study_group_id AND
      d.version=NEW.doc_version AND encode(sha256(convert_to(d."contentMd",'UTF8')),'hex')=NEW.content_sha256
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_READY_INVALID'; END IF;
  END IF;
  IF NEW.state='ready' THEN
    PERFORM 1 FROM public.knowledge_source_file f
      JOIN public.knowledge_import_task i ON i.id=NEW.import_task_id AND i."sourceFileId"=f.id
      JOIN public.knowledge_doc d ON d.id=NEW.doc_id
      WHERE f.id=NEW.source_file_id AND f."docId"=d.id AND i."docId"=d.id AND
      i.status='complete' AND i.stage='complete' AND i."safetyLevel"='allow' AND
      d."safetyLevel"='allow' AND d.status IN ('draft','published') AND d."trashedAt" IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_READY_INVALID'; END IF;
  END IF;
  RETURN NEW;
END;
$body$;
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_session_material() FROM PUBLIC;
-- statement-break
CREATE TRIGGER check_session_material BEFORE INSERT OR UPDATE ON rh_ai.session_materials
  FOR EACH ROW EXECUTE FUNCTION rh_ai.check_session_material();
-- statement-break
ALTER TABLE rh_ai.session_materials ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.session_materials FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY material_scope_read ON rh_ai.session_materials FOR SELECT USING (
  tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true));
-- statement-break
CREATE POLICY material_scope_insert ON rh_ai.session_materials FOR INSERT WITH CHECK (
  tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true));
-- statement-break
CREATE POLICY material_scope_update ON rh_ai.session_materials FOR UPDATE USING (
  tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true))
WITH CHECK (
  tenant_id=current_setting('app.tenant_id',true) AND study_group_id=current_setting('app.study_group_id',true)
  AND research_project_id=current_setting('app.research_project_id',true) AND account_id=current_setting('app.account_id',true));
