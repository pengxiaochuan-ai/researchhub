CREATE FUNCTION public.researchhub_read_account_receipt(
  p_tenant text, p_actor text, p_auth_version integer, p_request_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  saved record;
  result jsonb := NULL;
  matches integer := 0;
BEGIN
  IF p_tenant IS NULL OR p_tenant <> '__TENANT__'
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
  PERFORM a.id FROM public.account a JOIN public.tenant t ON t.id=a."tenantId"
    WHERE a.id=p_actor AND a."tenantId"=p_tenant AND a.status='active'
      AND a.role='tenant_admin' AND a."isTenantAdmin"=true
      AND a."authVersion"=p_auth_version AND t.status='active'
    FOR SHARE OF a,t;
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
