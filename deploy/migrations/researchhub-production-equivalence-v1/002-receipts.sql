CREATE OR REPLACE FUNCTION public.researchhub_read_account_receipt(
  p_tenant text, p_actor text, p_auth_version integer, p_request_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  saved record;
  result jsonb := NULL;
  matches integer := 0;
BEGIN
  IF p_tenant IS NULL
     OR p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)
     OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,160}$'
     OR p_actor IS DISTINCT FROM current_setting('app.account_id',true)
     OR p_auth_version IS NULL OR p_auth_version < 0
     OR p_auth_version::text IS DISTINCT FROM current_setting('app.auth_version',true)
     OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9_-]{8,128}$'
  THEN RAISE EXCEPTION 'HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED'; END IF;

  -- Same global-before-tenant order as legacy Accounts.update. Keep the current
  -- identity valid through this short transaction, including after lock waits.
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:official',0));
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:tenant:' || p_tenant,0));
  PERFORM a.id FROM public.account a JOIN public.tenant t ON t.id=a."tenantId" JOIN rh_hub.hub h ON h.tenant_id=t.id AND h.hub_key='lingshu-xinyu' AND h.status='active'
    WHERE a.id=p_actor AND a."tenantId"=p_tenant AND a.status='active'
      AND a.role='tenant_admin' AND a."isTenantAdmin"=true
      AND a."authVersion"=p_auth_version AND t.status='active'
    FOR SHARE OF a,t,h;
  IF NOT FOUND THEN RAISE EXCEPTION 'HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED'; END IF;

  FOR saved IN
    SELECT l.meta,l."createdAt" FROM public.audit_log l
    WHERE l."tenantId"=p_tenant AND l."accountId"=p_actor
      AND l."researchProjectId" IS NULL AND l."studyGroupId" IS NULL
      AND l.action='update_account'
      AND l.meta->>'schemaVersion'='researchhub.account-status.receipt.v1'
      AND l.meta->>'requestKey'=p_request_key
    LIMIT 2
  LOOP
    matches := matches + 1;
    IF matches > 1 THEN RAISE EXCEPTION 'HUB_ACCOUNT_RECEIPT_AMBIGUOUS'; END IF;
    IF jsonb_typeof(saved.meta->'result') IS DISTINCT FROM 'object'
       OR saved.meta->>'requestHash' IS NULL OR saved.meta->>'requestHash' !~ '^[a-f0-9]{64}$'
       OR saved.meta->>'targetAccountId' IS NULL
       OR saved.meta->'result'->>'id' IS DISTINCT FROM saved.meta->>'targetAccountId'
       OR saved.meta->'result'->>'status' IS NULL
       OR saved.meta->'result'->>'status' NOT IN ('active','disabled')
       OR jsonb_typeof(saved.meta->'result'->'version') IS DISTINCT FROM 'string'
       OR saved.meta->'result'->>'version' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
       OR jsonb_typeof(saved.meta->'result'->'authVersion') IS DISTINCT FROM 'number'
       OR saved.meta->'result'->>'authVersion' !~ '^(0|[1-9][0-9]{0,9})$'
       OR jsonb_typeof(saved.meta->'result'->'refundedTokens') IS DISTINCT FROM 'string'
       OR saved.meta->'result'->>'refundedTokens' !~ '^(0|[1-9][0-9]{0,29})$'
    THEN RAISE EXCEPTION 'HUB_ACCOUNT_RECEIPT_INVALID'; END IF;
    PERFORM 1 FROM public.account target
      WHERE target.id=saved.meta->>'targetAccountId' AND target."tenantId"=p_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'HUB_ACCOUNT_RECEIPT_INVALID'; END IF;
    result := jsonb_build_object(
      'requestKey',p_request_key,'requestHash',saved.meta->>'requestHash',
      'completedAt',to_char(saved."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'result',jsonb_build_object(
        'id',saved.meta->'result'->>'id','status',saved.meta->'result'->>'status',
        'version',saved.meta->'result'->>'version',
        'authVersion',saved.meta->'result'->'authVersion',
        'refundedTokens',saved.meta->'result'->>'refundedTokens'));
  END LOOP;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION rh_source.read_review_receipt(
  p_tenant text, p_hub text, p_account text, p_auth_version integer,
  p_receipt text, p_operation text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)
     OR p_hub IS NULL OR p_hub <> 'lingshu-xinyu'
     OR p_account IS NULL OR p_account IS DISTINCT FROM current_setting('app.account_id',true)
     OR p_auth_version IS NULL OR p_auth_version<0 OR p_auth_version::text IS DISTINCT FROM current_setting('app.auth_version',true)
     OR p_receipt IS NULL OR p_receipt !~ '^rh-source-review-[a-f0-9]{64}$'
     OR p_operation IS NULL OR p_operation !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  THEN RAISE EXCEPTION 'HUB_SOURCE_REVIEW_AUTH_REQUIRED'; END IF;
  LOCK TABLE rh_source.review_grant_event IN SHARE MODE;
  PERFORM a.id FROM public.account a JOIN public.tenant t ON t.id=a."tenantId" JOIN rh_hub.hub h ON h.tenant_id=t.id AND h.hub_key=p_hub AND h.status='active'
    WHERE a.id=p_account AND a."tenantId"=p_tenant AND a.status='active'
      AND t.status='active' AND a."authVersion"=p_auth_version FOR SHARE OF a,t,h;
  IF NOT FOUND OR (SELECT decision FROM rh_source.review_grant_event
      WHERE tenant_id=p_tenant AND hub_key=p_hub AND account_id=p_account
        AND capability='source.review' ORDER BY event_version DESC LIMIT 1) IS DISTINCT FROM 'grant'
  THEN RAISE EXCEPTION 'HUB_SOURCE_REVIEW_AUTH_REQUIRED'; END IF;
  SELECT jsonb_build_object('kind',a.meta->'kind','input',a.meta->'input','review',a.meta->'review') INTO result FROM public.audit_log a
    WHERE a.id=p_receipt AND a."tenantId"=p_tenant AND a."accountId"=p_account
      AND a."researchProjectId" IS NULL AND a.action='researchhub.source_review.receipt'
      AND a.meta->>'schemaVersion'='hub-source-review-receipt.v1'
      AND a.meta->>'hubKey'=p_hub AND a.meta->'input'->>'operationId'=p_operation
      AND a.meta->>'kind' IN ('pmc','external','workbook')
      AND jsonb_typeof(a.meta->'input')='object' AND jsonb_typeof(a.meta->'review')='object';
  RETURN result;
END;
$$;
ALTER FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) OWNER TO aisci_owner;
ALTER FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) OWNER TO aisci_owner;
REVOKE ALL ON FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) TO aisci_app;
GRANT EXECUTE ON FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) TO aisci_app;
