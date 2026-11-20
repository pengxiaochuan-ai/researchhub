-- One-time data operation. NOT a startup migration. Requires separate approval.
-- Operator must verify the archived admission SHA, provide its historicalChatIds
-- as historical_ids JSON, and reserve the private backup file exclusively (0600)
-- before invoking psql. Never print the backup or any task text into cloud logs.
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
SELECT set_config('hub.retire.historical_ids', :'historical_ids', true);
SELECT set_config('hub.retire.expected_role', :'expected_role', true);
SELECT set_config('hub.retire.expected_marker', :'expected_marker', true);
SELECT set_config('hub.retire.approval_ref', :'approval_ref', true);
DO $guard$
DECLARE observed text; row_count integer;
BEGIN
 IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'RETIRE_TARGET_REJECTED'; END IF;
 IF current_setting('hub.retire.approval_ref') !~ '^HUB_HISTORY_175_APPROVED_[A-Za-z0-9_-]{12,120}$' THEN RAISE EXCEPTION 'RETIRE_APPROVAL_REQUIRED'; END IF;
 IF current_user<>current_setting('hub.retire.expected_role') OR
 (SELECT encode(sha256(convert_to(shobj_description(oid,'pg_database'),'UTF8')),'hex') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM current_setting('hub.retire.expected_marker')
 THEN RAISE EXCEPTION 'RETIRE_TARGET_IDENTITY_CHANGED'; END IF;
 IF jsonb_typeof(current_setting('hub.retire.historical_ids')::jsonb)<>'array'
 OR jsonb_array_length(current_setting('hub.retire.historical_ids')::jsonb)<>623
 THEN RAISE EXCEPTION 'RETIRE_ORIGINAL_MANIFEST_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wp01:tenant:rh-kb-local-b0e2af9d-tenant',0));
 PERFORM id FROM public.knowledge_chat_job
 WHERE "tenantId"='rh-kb-local-b0e2af9d-tenant'
 AND id IN (SELECT jsonb_array_elements_text(current_setting('hub.retire.historical_ids')::jsonb))
 ORDER BY id FOR UPDATE;
 SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(j)::text),'' ORDER BY id),'')) INTO row_count,observed
 FROM public.knowledge_chat_job j WHERE "tenantId"='rh-kb-local-b0e2af9d-tenant'
 AND id IN (SELECT jsonb_array_elements_text(current_setting('hub.retire.historical_ids')::jsonb));
 IF row_count<>623 OR observed<>'735bdccbbc401c67285f0dd9714a2bed' THEN RAISE EXCEPTION 'RETIRE_HISTORY_CHANGED'; END IF;
END $guard$;
CREATE TEMP TABLE hub_retire_selected ON COMMIT DROP AS
 SELECT j.*,md5(to_jsonb(j)::text) AS original_hash FROM public.knowledge_chat_job j
 WHERE "tenantId"='rh-kb-local-b0e2af9d-tenant' AND status='queued'
 AND id IN (SELECT jsonb_array_elements_text(current_setting('hub.retire.historical_ids')::jsonb));
DO $guard$
BEGIN
 IF (SELECT count(*) FROM hub_retire_selected)<>175 THEN RAISE EXCEPTION 'RETIRE_COUNT_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM hub_retire_selected WHERE attempts<>0 OR "assistantMessageId" IS NOT NULL OR result IS NOT NULL OR "executionToken" IS NOT NULL OR "workerOwner" IS NOT NULL OR "leaseExpiresAt" IS NOT NULL OR "startedAt" IS NOT NULL)
 THEN RAISE EXCEPTION 'RETIRE_EXECUTION_STATE_REQUIRES_REVIEW'; END IF;
 IF EXISTS(SELECT 1 FROM public.token_quota_reservation r JOIN hub_retire_selected j
 ON r."tenantId"=j."tenantId" AND r."requestKey"='chat:'||j."sessionId"||':'||j."requestKey")
 THEN RAISE EXCEPTION 'RETIRE_RESERVATION_REQUIRES_REVIEW'; END IF;
END $guard$;
-- Operator has already persisted and verified the exact private original rows.
UPDATE public.knowledge_chat_job j SET status='failed',"errorCode"='HUB_DEPLOYMENT_HISTORY_ARCHIVED',
 "errorMessage"='部署迁移前历史任务，本次未继续执行；如仍需要请重新发起。',"completedAt"=now(),"updatedAt"=now()
 FROM hub_retire_selected old WHERE j.id=old.id AND j.status='queued' AND md5(to_jsonb(j)::text)=old.original_hash;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.knowledge_chat_job j JOIN hub_retire_selected old ON j.id=old.id WHERE j.status='failed' AND j."errorCode"='HUB_DEPLOYMENT_HISTORY_ARCHIVED')<>175
 THEN RAISE EXCEPTION 'RETIRE_COMMIT_COUNT_CHANGED'; END IF;
END $guard$;
INSERT INTO public.audit_log(id,"tenantId","studyGroupId","researchProjectId",action,target,meta,"createdAt")
 SELECT 'rh-history-retire-'||md5(id),'rh-kb-local-b0e2af9d-tenant',"studyGroupId","researchProjectId",'hub_historical_chat_retired',id,
 jsonb_build_object('reason','development-history-not-for-production-execution','originalRowHash',original_hash,'approvalRef',:'approval_ref'),now()
 FROM hub_retire_selected;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.audit_log a JOIN hub_retire_selected j ON a.target=j.id
 WHERE a.id='rh-history-retire-'||md5(j.id) AND a.action='hub_historical_chat_retired' AND a.meta->>'originalRowHash'=j.original_hash AND a.meta->>'approvalRef'=current_setting('hub.retire.approval_ref'))<>175
 THEN RAISE EXCEPTION 'RETIRE_AUDIT_COUNT_CHANGED'; END IF;
END $guard$;
COMMIT;
SELECT 'historical-queue-retired:175;modelCalls:0;billingWrites:0';
