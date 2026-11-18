-- Proposal only: apply through the approved synthetic schema runner.
CREATE TABLE rh_ai.subject_profile_imports (
 id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,160}$'),
 tenant_id text NOT NULL, account_id text NOT NULL, session_id text NOT NULL,
 source_study_group_id text NOT NULL, source_research_project_id text NOT NULL,
 source_preflight_id text NOT NULL, source_preflight_version integer NOT NULL CHECK (source_preflight_version>0),
 study_id text NOT NULL, study_group_id text NOT NULL, research_project_id text NOT NULL,
 request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{1,160}$'),
 confirmation_hash text NOT NULL CHECK (confirmation_hash ~ '^[a-f0-9]{64}$'),
 snapshot jsonb NOT NULL CHECK (COALESCE(snapshot->>'schema'='hub-subject-profile-confirmation.v1' AND snapshot->>'hash'=confirmation_hash
   AND jsonb_typeof(snapshot->'rows')='array' AND jsonb_array_length(snapshot->'rows') BETWEEN 1 AND 500
   AND jsonb_typeof(snapshot->'recordBindings')='array' AND NOT (snapshot ? 'identityMap')
   AND NOT jsonb_path_exists(snapshot,'$.recordBindings[*].sourceIdentity')
   AND octet_length(snapshot::text)<=1048576,false)),
 state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','committed','cancelled')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 receipt jsonb CHECK (receipt IS NULL OR COALESCE(receipt->>'schema'='hub-subject-profile-receipt.v1'
   AND receipt->>'confirmationHash'=confirmation_hash AND jsonb_typeof(receipt->'subjects')='array'
   AND octet_length(receipt::text)<=262144,false)),
 audit_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((state='committed')=(receipt IS NOT NULL)),
 UNIQUE(tenant_id,account_id,session_id,request_key)
);
-- statement-break
CREATE INDEX subject_profile_imports_owner ON rh_ai.subject_profile_imports(tenant_id,account_id,session_id,created_at DESC,id DESC);
-- statement-break
CREATE UNIQUE INDEX subject_profile_imports_once ON rh_ai.subject_profile_imports(tenant_id,account_id,session_id,source_preflight_id,source_preflight_version,study_id) WHERE state='committed';
-- statement-break
CREATE FUNCTION rh_ai.check_subject_profile_import() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE actor text; current_actor record; source_ref jsonb; source_storage_key text; item jsonb; previous_group text; previous_project text;
BEGIN
 actor:=nullif(current_setting('app.account_id',true),'');
 IF actor IS NULL OR NEW.account_id IS DISTINCT FROM actor OR NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') THEN
  RAISE EXCEPTION 'PROFILE_IMPORT_CONTEXT_MISMATCH';
 END IF;
 SELECT a.id,a."authVersion",a.role,a."isTenantAdmin" INTO current_actor FROM public.account a JOIN public.tenant t ON t.id=a."tenantId"
 WHERE a.id=actor AND a."tenantId"=NEW.tenant_id AND a.status='active' AND t.status='active'
 AND a.role IN ('researcher','tenant_admin') AND a."isTenantAdmin"=(a.role='tenant_admin') FOR SHARE OF a,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_ACTOR_INVALID'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.state<>'planned' OR NEW.receipt IS NOT NULL THEN RAISE EXCEPTION 'PROFILE_IMPORT_INITIAL_STATE'; END IF;
  NEW.created_at:=statement_timestamp();
 ELSE
  IF ROW(NEW.id,NEW.tenant_id,NEW.account_id,NEW.session_id,NEW.source_study_group_id,NEW.source_research_project_id,
   NEW.source_preflight_id,NEW.source_preflight_version,NEW.study_id,NEW.study_group_id,NEW.research_project_id,
   NEW.request_key,NEW.confirmation_hash,NEW.snapshot,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.account_id,OLD.session_id,OLD.source_study_group_id,OLD.source_research_project_id,
   OLD.source_preflight_id,OLD.source_preflight_version,OLD.study_id,OLD.study_group_id,OLD.research_project_id,
   OLD.request_key,OLD.confirmation_hash,OLD.snapshot,OLD.created_at)
   OR NEW.version::bigint<>OLD.version::bigint+1 OR OLD.state<>'planned' OR NEW.state NOT IN ('committed','cancelled') OR NEW.audit_id=OLD.audit_id THEN
   RAISE EXCEPTION 'PROFILE_IMPORT_IMMUTABLE_OR_VERSION_CHANGED';
  END IF;
 END IF;
 IF NEW.snapshot->'source'->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR NEW.snapshot->'source'->>'accountId' IS DISTINCT FROM actor
 OR NEW.snapshot->'source'->>'sessionId' IS DISTINCT FROM NEW.session_id OR NEW.snapshot->'source'->>'studyGroupId' IS DISTINCT FROM NEW.source_study_group_id
 OR NEW.snapshot->'source'->>'researchProjectId' IS DISTINCT FROM NEW.source_research_project_id
 OR NEW.snapshot->'source'->>'preflightId' IS DISTINCT FROM NEW.source_preflight_id
 OR NEW.snapshot->'source'->>'preflightVersion' IS DISTINCT FROM NEW.source_preflight_version::text
 OR NEW.snapshot->'target'->>'studyId' IS DISTINCT FROM NEW.study_id OR NEW.snapshot->'target'->>'studyGroupId' IS DISTINCT FROM NEW.study_group_id
 OR NEW.snapshot->'target'->>'researchProjectId' IS DISTINCT FROM NEW.research_project_id THEN RAISE EXCEPTION 'PROFILE_IMPORT_SNAPSHOT_SCOPE'; END IF;
 IF NEW.state<>'cancelled' AND NEW.snapshot->'source'->>'authVersion' IS DISTINCT FROM current_actor."authVersion"::text THEN RAISE EXCEPTION 'PROFILE_IMPORT_AUTH_VERSION_CHANGED'; END IF;
 previous_group:=current_setting('app.study_group_id',true); previous_project:=current_setting('app.research_project_id',true);
 PERFORM set_config('app.study_group_id',NEW.source_study_group_id,true),set_config('app.research_project_id',NEW.source_research_project_id,true);
 PERFORM 1 FROM public.session s JOIN public.study_group g ON g.id=s."studyGroupId" AND g."tenantId"=s."tenantId"
 JOIN public.research_project p ON p.id=s."researchProjectId" AND p."studyGroupId"=g.id AND p."tenantId"=g."tenantId"
 WHERE s.id=NEW.session_id AND s."tenantId"=NEW.tenant_id AND s."studyGroupId"=NEW.source_study_group_id
 AND s."researchProjectId"=NEW.source_research_project_id AND s."accountId"=actor AND s.status='active' AND s."deletedAt" IS NULL
 AND s.channel='knowledge' AND s."contextKey" LIKE 'hub:%:conversation:%' AND g.status='active' AND p.status='active' FOR SHARE OF s,g,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_SOURCE_PARENT'; END IF;
 IF NEW.state<>'cancelled' THEN
  PERFORM 1 FROM rh_ai.research_data_preflights p WHERE p.id=NEW.source_preflight_id AND p.tenant_id=NEW.tenant_id
   AND p.account_id=actor AND p.session_id=NEW.session_id AND p.study_group_id=NEW.source_study_group_id AND p.research_project_id=NEW.source_research_project_id
   AND p.version=NEW.source_preflight_version AND p.state='previewed' AND p.preview_hash=NEW.snapshot->'source'->>'previewHash' AND p.source_refs=NEW.snapshot->'source'->'refs'
   AND jsonb_array_length(p.source_refs)=1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_PREFLIGHT_CHANGED'; END IF;
  source_ref:=NEW.snapshot->'source'->'refs'->0;
  SELECT u.storage_key INTO source_storage_key FROM rh_ai.research_data_uploads u WHERE u.id=source_ref->>'id' AND u.tenant_id=NEW.tenant_id AND u.account_id=actor
   AND u.session_id=NEW.session_id AND u.study_group_id=NEW.source_study_group_id AND u.research_project_id=NEW.source_research_project_id
   AND u.version::text=source_ref->>'version' AND u.source_sha256=source_ref->>'sha256' AND u.state='ready' AND u.format='xlsx' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_FILE_CHANGED'; END IF;
 END IF;
 PERFORM set_config('app.study_group_id',NEW.study_group_id,true),set_config('app.research_project_id',NEW.research_project_id,true);
 IF NEW.state<>'cancelled' THEN
 PERFORM 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id AND p."studyGroupId"=b.study_group_id
 JOIN public.study_group g ON g.id=b.study_group_id AND g."tenantId"=b.tenant_id WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id
 AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id AND p.status='active' AND g.status='active' FOR SHARE OF p,g;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_TARGET_PARENT'; END IF;
 END IF;
 IF NEW.state<>'cancelled' AND current_actor.role<>'tenant_admin' THEN
  PERFORM 1 FROM public.study_group_membership m JOIN public.permission_role r ON r.id=m."roleId" AND r."tenantId"=m."tenantId"
   JOIN public.research_project_membership pm ON pm."tenantId"=m."tenantId" AND pm."studyGroupId"=m."studyGroupId" AND pm."accountId"=m."accountId"
   WHERE m."tenantId"=NEW.tenant_id AND m."studyGroupId"=NEW.study_group_id AND m."accountId"=actor AND m.status='active' AND r.status='active'
   AND r."menuPermissions" ? 'data' AND r."buttonPermissions" ? 'data.upload' AND pm."researchProjectId"=NEW.research_project_id AND pm.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_NATIVE_PERMISSION'; END IF;
 END IF;
 IF NEW.state='committed' THEN
  IF NEW.receipt->>'studyId' IS DISTINCT FROM NEW.study_id OR jsonb_array_length(NEW.receipt->'subjects')<>jsonb_array_length(NEW.snapshot->'rows')
   OR (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.receipt->'subjects'))<>jsonb_array_length(NEW.receipt->'subjects') THEN RAISE EXCEPTION 'PROFILE_IMPORT_RECEIPT_INVALID'; END IF;
  PERFORM 1 FROM public.processing_task t JOIN public.modality_file f ON f.id=t."modalityFileId" AND f."tenantId"=t."tenantId"
   WHERE t.id=NEW.receipt->>'taskId' AND f.id=NEW.receipt->>'fileId' AND f."subjectId"=t."subjectId" AND t."tenantId"=NEW.tenant_id AND t."studyGroupId"=NEW.study_group_id
   AND t."researchProjectId"=NEW.research_project_id AND t."createdBy"=actor AND f."createdBy"=actor AND f."deletedAt" IS NULL
   AND f.kind='raw' AND f.status='ingested' AND f."storageKey"=source_storage_key AND f.meta->>'sha256'=source_ref->>'sha256' AND t."skillKey"='subject-profile-import'
   AND t.status='complete' AND t.result->>'kind'='subject-profile-import' AND t.result->'valuesImported'='true'::jsonb
   AND t.result->'rawBytesSentToModel'='false'::jsonb
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'rows') r WHERE r->>'subjectId'=t."subjectId") FOR SHARE OF t,f;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_NATIVE_RESULT_REQUIRED'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.receipt->'subjects') LOOP
   PERFORM 1 FROM jsonb_array_elements(NEW.snapshot->'rows') r WHERE r->>'subjectId'=item->>'id' AND r->>'subjectCode'=item->>'subjectCode';
   IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_RECEIPT_SUBJECT_MISMATCH'; END IF;
   PERFORM 1 FROM public.subject s JOIN public.subject_profile p ON p."subjectId"=s.id AND p."tenantId"=s."tenantId"
    WHERE s.id=item->>'id' AND s."subjectId"=item->>'subjectCode' AND s."tenantId"=NEW.tenant_id AND s."studyGroupId"=NEW.study_group_id
    AND s."researchProjectId"=NEW.research_project_id AND s."deletedAt" IS NULL AND NOT s."acceptanceFixture"
    AND p."updatedAt"=(item->>'profileUpdatedAt')::timestamptz FOR SHARE OF s,p;
   IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_PROFILE_RESULT_REQUIRED'; END IF;
  END LOOP;
 END IF;
 PERFORM 1 FROM public.audit_log a WHERE a.id=NEW.audit_id AND a."tenantId"=NEW.tenant_id AND a."accountId"=actor
 AND a."studyGroupId"=NEW.study_group_id AND a."researchProjectId"=NEW.research_project_id AND a.target=NEW.id
 AND a.action='researchhub.profile_import.'||NEW.state;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_IMPORT_AUDIT_REQUIRED'; END IF;
 PERFORM set_config('app.study_group_id',coalesce(previous_group,''),true),set_config('app.research_project_id',coalesce(previous_project,''),true);
 NEW.updated_at:=statement_timestamp(); RETURN NEW;
END
$body$;
-- statement-break
CREATE TRIGGER subject_profile_imports_guard BEFORE INSERT OR UPDATE ON rh_ai.subject_profile_imports FOR EACH ROW EXECUTE FUNCTION rh_ai.check_subject_profile_import();
-- statement-break
REVOKE ALL ON FUNCTION rh_ai.check_subject_profile_import() FROM PUBLIC;
-- statement-break
ALTER TABLE rh_ai.subject_profile_imports ENABLE ROW LEVEL SECURITY;
-- statement-break
ALTER TABLE rh_ai.subject_profile_imports FORCE ROW LEVEL SECURITY;
-- statement-break
CREATE POLICY subject_profile_imports_owner ON rh_ai.subject_profile_imports FOR ALL TO aisci_app USING
 (tenant_id=current_setting('app.tenant_id',true) AND account_id=current_setting('app.account_id',true)
  AND ((source_study_group_id=current_setting('app.study_group_id',true) AND source_research_project_id=current_setting('app.research_project_id',true))
    OR (study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true))))
 WITH CHECK (tenant_id=current_setting('app.tenant_id',true) AND account_id=current_setting('app.account_id',true)
  AND ((source_study_group_id=current_setting('app.study_group_id',true) AND source_research_project_id=current_setting('app.research_project_id',true))
    OR (study_group_id=current_setting('app.study_group_id',true) AND research_project_id=current_setting('app.research_project_id',true))));
-- statement-break
REVOKE ALL ON TABLE rh_ai.subject_profile_imports FROM PUBLIC;
-- statement-break
REVOKE ALL ON TABLE rh_ai.subject_profile_imports FROM aisci_app;
-- statement-break
GRANT SELECT,INSERT,UPDATE ON TABLE rh_ai.subject_profile_imports TO aisci_app;
