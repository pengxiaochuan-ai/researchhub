CREATE FUNCTION rh_source.read_review_receipt(
  p_tenant text, p_hub text, p_account text, p_auth_version integer,
  p_receipt text, p_operation text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)
     OR p_tenant <> '__TENANT__' OR p_hub <> 'lingshu-xinyu'
     OR p_account <> '__REVIEWER__' OR p_account IS NULL OR p_auth_version IS NULL
     OR p_receipt IS NULL OR p_receipt !~ '^rh-source-review-[a-f0-9]{64}$'
     OR p_operation IS NULL OR p_operation !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  THEN RAISE EXCEPTION 'HUB_SOURCE_REVIEW_AUTH_REQUIRED'; END IF;
  LOCK TABLE rh_source.review_grant_event IN SHARE MODE;
  PERFORM a.id FROM public.account a JOIN public.tenant t ON t.id=a."tenantId"
    WHERE a.id=p_account AND a."tenantId"=p_tenant AND a.status='active'
      AND t.status='active' AND a."authVersion"=p_auth_version FOR SHARE OF a,t;
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
