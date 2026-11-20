-- Tongue image candidate: pinned local synthetic upgrade; no startup DDL.
CREATE OR REPLACE FUNCTION rh_ai.check_session_media_ingest() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE actor text; actor_role text; actor_admin boolean; actor_version integer;
 prev_group text; prev_project text; prev_account text; grant_row boolean;
 mids text[]; subs text[]; vids text[]; item text; m record; last_media record; allowed boolean:=false;
BEGIN
 actor:=nullif(current_setting('app.account_id',true),'');prev_account:=actor;
 prev_group:=nullif(current_setting('app.study_group_id',true),'');prev_project:=nullif(current_setting('app.research_project_id',true),'');
 grant_row:=TG_TABLE_NAME='session_media_ingest_access';
 IF actor IS NULL OR NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') OR
 NOT ((prev_group=NEW.source_study_group_id AND prev_project=NEW.source_research_project_id) OR (prev_group=NEW.study_group_id AND prev_project=NEW.research_project_id)) THEN RAISE EXCEPTION 'MEDIA_INGEST_CONTEXT'; END IF;
 SELECT a.role,a."isTenantAdmin",a."authVersion" INTO actor_role,actor_admin,actor_version FROM public.account a JOIN public.tenant t ON t.id=a."tenantId"
 WHERE a.id=actor AND a."tenantId"=NEW.tenant_id AND a.status='active' AND t.status='active' AND a.role IN ('researcher','tenant_admin') AND a."isTenantAdmin"=(a.role='tenant_admin') FOR SHARE OF a,t;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_ACTOR'; END IF;
 IF grant_row THEN
  IF NOT(actor_role='tenant_admin' AND actor_admin) THEN RAISE EXCEPTION 'MEDIA_INGEST_GRANT_ADMIN'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.status<>'active' OR NEW.granted_by<>actor THEN RAISE EXCEPTION 'MEDIA_INGEST_GRANT_STATE'; END IF;
  ELSE
   IF OLD.status<>'active' THEN RAISE EXCEPTION 'MEDIA_INGEST_GRANT_STATE'; END IF;
   IF NEW.version<>OLD.version+1 OR NEW.audit_id=OLD.audit_id OR
   ROW(NEW.id,NEW.tenant_id,NEW.account_id,NEW.source_study_group_id,NEW.source_research_project_id,NEW.session_id,NEW.study_id,NEW.study_group_id,NEW.research_project_id,NEW.scope_key,NEW.media_ids,NEW.subject_ids,NEW.visit_ids,NEW.capabilities,NEW.granted_by,NEW.expires_at,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.account_id,OLD.source_study_group_id,OLD.source_research_project_id,OLD.session_id,OLD.study_id,OLD.study_group_id,OLD.research_project_id,OLD.scope_key,OLD.media_ids,OLD.subject_ids,OLD.visit_ids,OLD.capabilities,OLD.granted_by,OLD.expires_at,OLD.created_at) THEN RAISE EXCEPTION 'MEDIA_INGEST_IMMUTABLE'; END IF;
   IF NEW.status<>'revoked' THEN RAISE EXCEPTION 'MEDIA_INGEST_GRANT_STATE'; END IF;
   -- Termination must remain possible after a source or target becomes unavailable.
   -- Current administrator, immutable scope, version and audit checks above still apply.
   NEW.updated_at:=statement_timestamp();RETURN NEW;
  END IF;
  mids:=NEW.media_ids;subs:=NEW.subject_ids;vids:=NEW.visit_ids;
 ELSE
  IF NEW.account_id<>actor THEN RAISE EXCEPTION 'MEDIA_INGEST_OWNER'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.state<>'planned' OR NEW.receipt IS NOT NULL OR NEW.modality_file_id IS NOT NULL THEN RAISE EXCEPTION 'MEDIA_INGEST_INITIAL_STATE'; END IF;
  ELSE
   IF OLD.state<>'planned' OR NEW.state NOT IN ('committed','cancelled','invalid') OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'MEDIA_INGEST_STATE'; END IF;
   IF ROW(NEW.id,NEW.tenant_id,NEW.account_id,NEW.session_id,NEW.source_study_group_id,NEW.source_research_project_id,NEW.media_id,NEW.source_version,NEW.source_sha256,NEW.study_id,NEW.study_group_id,NEW.research_project_id,NEW.scope_key,NEW.subject_id,NEW.enrollment_id,NEW.visit_id,NEW.protocol_id,NEW.collected_at,NEW.request_key,NEW.confirmation_hash,NEW.snapshot,NEW.permission_ref,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.account_id,OLD.session_id,OLD.source_study_group_id,OLD.source_research_project_id,OLD.media_id,OLD.source_version,OLD.source_sha256,OLD.study_id,OLD.study_group_id,OLD.research_project_id,OLD.scope_key,OLD.subject_id,OLD.enrollment_id,OLD.visit_id,OLD.protocol_id,OLD.collected_at,OLD.request_key,OLD.confirmation_hash,OLD.snapshot,OLD.permission_ref,OLD.created_at) THEN RAISE EXCEPTION 'MEDIA_INGEST_IMMUTABLE'; END IF;
  END IF;
  mids:=ARRAY[NEW.media_id];subs:=ARRAY[NEW.subject_id];vids:=CASE WHEN NEW.visit_id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[NEW.visit_id] END;
 END IF;
 PERFORM set_config('app.study_group_id',NEW.source_study_group_id,true),set_config('app.research_project_id',NEW.source_research_project_id,true),set_config('app.account_id',NEW.account_id,true);
 PERFORM 1 FROM public.session s JOIN public.account a ON a.id=s."accountId" AND a."tenantId"=s."tenantId"
 JOIN public.study_group g ON g.id=s."studyGroupId" AND g."tenantId"=s."tenantId" JOIN public.research_project p ON p.id=s."researchProjectId" AND p."tenantId"=s."tenantId" AND p."studyGroupId"=g.id
 WHERE s.id=NEW.session_id AND s."tenantId"=NEW.tenant_id AND s."accountId"=NEW.account_id AND s."studyGroupId"=NEW.source_study_group_id AND s."researchProjectId"=NEW.source_research_project_id AND s."deletedAt" IS NULL AND s.status='active' AND a.status='active' AND g.status='active' AND p.status='active' FOR SHARE OF s,a,g,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
 FOREACH item IN ARRAY mids LOOP
  SELECT * INTO m FROM rh_ai.session_media_uploads WHERE id=item AND tenant_id=NEW.tenant_id AND account_id=NEW.account_id AND session_id=NEW.session_id AND study_group_id=NEW.source_study_group_id AND research_project_id=NEW.source_research_project_id FOR SHARE;
  IF NOT FOUND OR m.archive_state<>'archived' OR m.inspection_state<>'complete' OR m.inspection_classification<>'valid' THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
  IF m.extension IN ('png','jpg','jpeg') THEN
   IF m.byte_size>26214400 OR m.inspection->'hasImage' IS DISTINCT FROM 'true'::jsonb OR m.inspection->'hasVideo' IS DISTINCT FROM 'false'::jsonb OR m.inspection->'hasAudio' IS DISTINCT FROM 'false'::jsonb OR
    jsonb_typeof(m.inspection->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(m.inspection->'height') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
   IF (m.inspection->>'width')::numeric NOT BETWEEN 1 AND 20000 OR (m.inspection->>'height')::numeric NOT BETWEEN 1 AND 20000 OR (m.inspection->>'width')::numeric%1<>0 OR (m.inspection->>'height')::numeric%1<>0 OR (m.inspection->>'width')::numeric*(m.inspection->>'height')::numeric>40000000 THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
  ELSIF m.extension NOT IN ('mp4','mov','webm') OR m.inspection->'hasVideo' IS DISTINCT FROM 'true'::jsonb OR m.inspection->'hasImage'='true'::jsonb THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
  last_media:=m;
 END LOOP;
 PERFORM set_config('app.study_group_id',NEW.study_group_id,true),set_config('app.research_project_id',NEW.research_project_id,true),set_config('app.account_id',actor,true);
 PERFORM 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id AND p."studyGroupId"=b.study_group_id
 JOIN public.study_group g ON g.id=b.study_group_id AND g."tenantId"=b.tenant_id
 WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id AND p.status='active' AND g.status='active' FOR SHARE OF p,g;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
 IF NOT grant_row THEN
  IF NEW.permission_ref->>'kind' IS DISTINCT FROM 'native' AND NEW.permission_ref->>'kind' IS DISTINCT FROM 'grant' THEN RAISE EXCEPTION 'MEDIA_INGEST_PERMISSION'; END IF;
  IF NEW.permission_ref->>'kind'='native' THEN
   allowed:=actor_role='tenant_admin' AND actor_admin;
   IF NOT allowed THEN
    SELECT EXISTS(SELECT 1 FROM public.study_group_membership gm JOIN public.permission_role r ON r.id=gm."roleId" AND r."tenantId"=gm."tenantId" JOIN public.research_project_membership pm ON pm."tenantId"=gm."tenantId" AND pm."studyGroupId"=gm."studyGroupId" AND pm."accountId"=gm."accountId"
    WHERE gm."tenantId"=NEW.tenant_id AND gm."studyGroupId"=NEW.study_group_id AND gm."accountId"=actor AND gm.status='active' AND r.status='active' AND pm.status='active' AND pm."researchProjectId"=NEW.research_project_id AND jsonb_typeof(r."menuPermissions")='array' AND jsonb_typeof(r."buttonPermissions")='array' AND r."menuPermissions" ? 'data' AND r."buttonPermissions" ? 'data.upload') INTO allowed;
   END IF;
   IF NOT allowed OR NEW.permission_ref->>'id' IS DISTINCT FROM actor OR (NEW.permission_ref->>'version')::integer IS DISTINCT FROM actor_version THEN RAISE EXCEPTION 'MEDIA_INGEST_PERMISSION'; END IF;
  END IF;
 END IF;
 FOREACH item IN ARRAY subs LOOP
  PERFORM 1 FROM public.subject s WHERE s.id=item AND s."tenantId"=NEW.tenant_id AND s."studyGroupId"=NEW.study_group_id AND s."researchProjectId"=NEW.research_project_id AND (s."createdBy"=NEW.account_id OR (NOT grant_row AND allowed)) AND s."deletedAt" IS NULL AND NOT s."acceptanceFixture" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
 END LOOP;
 FOREACH item IN ARRAY vids LOOP
  PERFORM 1 FROM public.subject_visit v JOIN public.study_enrollment e ON e.id=v."enrollmentId" AND e."subjectId"=v."subjectId" AND e."protocolVersionId"=v."protocolVersionId" AND e."tenantId"=v."tenantId" AND e."studyGroupId"=v."studyGroupId" AND e."researchProjectId"=v."researchProjectId"
  JOIN public.visit_plan p ON p.id=v."visitPlanId" AND p."protocolVersionId"=v."protocolVersionId" AND p."tenantId"=v."tenantId" AND p."studyGroupId"=v."studyGroupId" AND p."researchProjectId"=v."researchProjectId"
  WHERE v.id=item AND v."tenantId"=NEW.tenant_id AND v."studyGroupId"=NEW.study_group_id AND v."researchProjectId"=NEW.research_project_id AND v."subjectId"=ANY(subs) AND NOT v."acceptanceFixture" AND NOT e."acceptanceFixture" FOR SHARE OF v,e,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_PARENT'; END IF;
 END LOOP;
 IF NOT grant_row THEN
  IF last_media.extension IN ('png','jpg','jpeg') AND (NEW.snapshot->'source'->>'modality' IS DISTINCT FROM 'tongue' OR NEW.snapshot->'source'->'inspection'->'hasImage' IS DISTINCT FROM 'true'::jsonb OR NEW.snapshot->'source'->'inspection'->'hasVideo' IS DISTINCT FROM 'false'::jsonb OR NEW.snapshot->'source'->'inspection'->'hasAudio' IS DISTINCT FROM 'false'::jsonb OR NEW.snapshot->'source'->'inspection'->'width' IS DISTINCT FROM last_media.inspection->'width' OR NEW.snapshot->'source'->'inspection'->'height' IS DISTINCT FROM last_media.inspection->'height') THEN RAISE EXCEPTION 'MEDIA_INGEST_SOURCE_CHANGED'; END IF;
  IF last_media.version<>NEW.source_version OR last_media.source_sha256<>NEW.source_sha256 OR
   NEW.snapshot->'source'->>'mediaId' IS DISTINCT FROM NEW.media_id OR NEW.snapshot->'source'->>'sha256' IS DISTINCT FROM NEW.source_sha256 OR NEW.snapshot->'target'->'subject'->>'id' IS DISTINCT FROM NEW.subject_id OR NEW.snapshot->'permissionRef' IS DISTINCT FROM NEW.permission_ref THEN RAISE EXCEPTION 'MEDIA_INGEST_SOURCE_CHANGED'; END IF;
  IF NEW.permission_ref->>'kind' IS DISTINCT FROM 'native' THEN
   PERFORM 1 FROM rh_ai.session_media_ingest_access a WHERE a.id=NEW.permission_ref->>'id' AND a.version=(NEW.permission_ref->>'version')::integer AND a.tenant_id=NEW.tenant_id AND a.account_id=actor AND a.study_id=NEW.study_id AND a.study_group_id=NEW.study_group_id AND a.research_project_id=NEW.research_project_id AND a.source_study_group_id=NEW.source_study_group_id AND a.source_research_project_id=NEW.source_research_project_id AND a.session_id=NEW.session_id AND a.scope_key=NEW.scope_key AND a.status='active' AND a.expires_at>statement_timestamp() AND 'media.register'=ANY(a.capabilities) AND NEW.media_id=ANY(a.media_ids) AND NEW.subject_id=ANY(a.subject_ids) AND (NEW.visit_id IS NULL OR NEW.visit_id=ANY(a.visit_ids)) FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_PERMISSION'; END IF;
  END IF;
  IF NEW.state='committed' THEN
   PERFORM 1 FROM public.modality_file f WHERE f.id=NEW.modality_file_id AND f."tenantId"=NEW.tenant_id AND f."subjectId"=NEW.subject_id AND f."subjectVisitId" IS NOT DISTINCT FROM NEW.visit_id AND f.modality=CASE WHEN last_media.extension IN ('png','jpg','jpeg') THEN 'tongue' ELSE 'video' END AND f.kind='raw' AND f."storageKey"=last_media.storage_key AND f."createdBy"=actor AND f."deletedAt" IS NULL AND f.meta->>'sha256'=NEW.source_sha256 AND f.meta->'hubMediaIngest'->>'id'=NEW.id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_INGEST_RECEIPT'; END IF;
  END IF;
 END IF;
 IF TG_OP='INSERT' THEN NEW.created_at:=statement_timestamp(); END IF;NEW.updated_at:=statement_timestamp();
 PERFORM set_config('app.study_group_id',prev_group,true),set_config('app.research_project_id',prev_project,true),set_config('app.account_id',prev_account,true);
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.study_group_id',COALESCE(prev_group,''),true),set_config('app.research_project_id',COALESCE(prev_project,''),true),set_config('app.account_id',COALESCE(prev_account,''),true);RAISE;
END $body$;
