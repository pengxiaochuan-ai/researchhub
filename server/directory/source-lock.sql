CREATE FUNCTION rh_directory.hold_source_for_commit(p_kind text,p_source_id text,p_version_id text,p_row_id text,p_sha text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,rh_source,pg_temp
SET lock_timeout='1500ms'
AS $$
DECLARE t text:=current_setting('app.tenant_id',true);h text:=current_setting('app.hub_key',true);
 actor text:=current_setting('app.account_id',true);av text:=current_setting('app.auth_version',true);
 actual_id text;actual_sha text;
BEGIN
 IF t IS NULL OR t='' OR h IS DISTINCT FROM 'lingshu-xinyu' OR actor IS NULL OR actor='' OR av IS NULL OR av !~ '^[0-9]+$'
   OR p_source_id IS NULL OR p_source_id !~ '^[A-Za-z0-9_-]{1,160}$' OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$'
   OR p_kind IS NULL OR p_kind NOT IN ('external_document_version','pmc_candidate_version','source_record') THEN
  RAISE EXCEPTION 'DIRECTORY_SOURCE_SCOPE_REJECTED' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('wp01:tenant:'||t,0));
 PERFORM a.id FROM public.account a JOIN public.tenant tn ON tn.id=a."tenantId"
  WHERE a.id=actor AND a."tenantId"=t AND a.status='active' AND tn.status='active'
   AND a."authVersion"::text=av AND a."isTenantAdmin"=true FOR SHARE OF a,tn;
 IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTORY_SOURCE_ACTOR_REJECTED' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM rh_hub.hub WHERE tenant_id=t AND hub_key=h AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTORY_SOURCE_SCOPE_REJECTED' USING ERRCODE='42501'; END IF;
 IF p_kind='source_record' THEN
  IF p_version_id IS NOT NULL OR p_row_id IS NULL OR p_row_id !~ '^[A-Za-z0-9_-]{1,160}$' THEN
   RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  PERFORM id FROM rh_source.source_registry WHERE tenant_id=t AND hub_key=h AND id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  SELECT r.id,r.row_sha256 INTO actual_id,actual_sha FROM rh_source.source_record r
   JOIN rh_source.import_batch b ON b.tenant_id=r.tenant_id AND b.hub_key=r.hub_key AND b.id=r.batch_id
   WHERE r.tenant_id=t AND r.hub_key=h AND r.source_registry_id=p_source_id AND r.id=p_row_id
    AND b.status='staged' FOR SHARE OF r,b;
 ELSIF p_kind='external_document_version' THEN
  IF p_row_id IS NOT NULL OR p_version_id IS NULL OR p_version_id !~ '^[A-Za-z0-9_-]{1,160}$' THEN
   RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t||':'||h||':'||p_source_id,0));
  PERFORM id FROM rh_source.external_document WHERE tenant_id=t AND hub_key=h AND id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  SELECT id,content_sha256 INTO actual_id,actual_sha FROM rh_source.external_document_version
   WHERE tenant_id=t AND hub_key=h AND document_id=p_source_id ORDER BY version_number DESC LIMIT 1 FOR SHARE;
 ELSE
  IF p_row_id IS NOT NULL OR p_version_id IS NULL OR p_version_id !~ '^[A-Za-z0-9_-]{1,160}$' THEN
   RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t||':'||h||':'||p_version_id,0));
  PERFORM id FROM rh_source.pmc_candidate WHERE tenant_id=t AND hub_key=h AND id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514'; END IF;
  SELECT id,raw_sha256 INTO actual_id,actual_sha FROM rh_source.pmc_candidate_version
   WHERE tenant_id=t AND hub_key=h AND candidate_id=p_source_id ORDER BY staged_at DESC,id DESC LIMIT 1 FOR SHARE;
 END IF;
 IF actual_id IS NULL OR actual_id IS DISTINCT FROM (CASE WHEN p_kind='source_record' THEN p_row_id ELSE p_version_id END) OR actual_sha IS DISTINCT FROM p_sha THEN
  RAISE EXCEPTION 'DIRECTORY_SOURCE_CHANGED' USING ERRCODE='23514';
 END IF;
 RETURN true;
END $$
-- statement
REVOKE ALL ON FUNCTION rh_directory.hold_source_for_commit(text,text,text,text,text) FROM PUBLIC
-- statement
GRANT EXECUTE ON FUNCTION rh_directory.hold_source_for_commit(text,text,text,text,text) TO aisci_app
