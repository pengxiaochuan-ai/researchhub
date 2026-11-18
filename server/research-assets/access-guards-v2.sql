CREATE OR REPLACE FUNCTION rh_asset.check_registry_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
DECLARE r rh_asset.asset_registry%ROWTYPE; e rh_asset.asset_event%ROWTYPE; manager boolean; b jsonb; live jsonb;
BEGIN
 IF TG_TABLE_NAME='access_request' THEN
  SELECT * INTO e FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND asset_revision=NEW.event_revision;
  SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
  IF e.asset_id IS NULL OR r.asset_id IS NULL OR e.tenant_id<>NEW.tenant_id OR e.study_group_id<>NEW.study_group_id OR e.research_project_id<>NEW.research_project_id OR e.version_no<>NEW.version_no OR e.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR NEW.recipient_account_id=r.owner_account_id THEN RAISE EXCEPTION 'ASSET_ACCESS_EVENT_INVALID'; END IF;
  SELECT e.actor_account_id=r.owner_account_id OR EXISTS(SELECT 1 FROM public.account WHERE id=e.actor_account_id AND "tenantId"=NEW.tenant_id AND role='tenant_admin' AND status='active') INTO manager;
  IF TG_OP='UPDATE' AND (NEW.request_id<>OLD.request_id OR NEW.asset_id<>OLD.asset_id OR NEW.tenant_id<>OLD.tenant_id OR NEW.study_group_id<>OLD.study_group_id OR NEW.research_project_id<>OLD.research_project_id OR NEW.version_no<>OLD.version_no OR NEW.initiator_account_id<>OLD.initiator_account_id OR NEW.recipient_account_id<>OLD.recipient_account_id OR NEW.requested_actions<>OLD.requested_actions OR NEW.purpose<>OLD.purpose OR NEW.decision_mode<>OLD.decision_mode OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at OR NEW.revision<>OLD.revision+1 OR OLD.state NOT IN ('pending','approved')) THEN RAISE EXCEPTION 'ASSET_ACCESS_IDENTITY_INVALID'; END IF;
  IF e.event_type='withdrawn' THEN
   IF NOT manager OR TG_OP<>'UPDATE' OR NEW.state<>'revoked' OR cardinality(NEW.approved_actions)<>0 OR NEW.decided_by<>e.actor_account_id THEN RAISE EXCEPTION 'ASSET_ACCESS_WITHDRAW_INVALID'; END IF;
   RETURN NULL;
  END IF;
  b:=e.payload->'access';
  IF b IS NULL OR b->>'requestId' IS DISTINCT FROM NEW.request_id OR b->>'recipientAccountId' IS DISTINCT FROM NEW.recipient_account_id OR b->>'initiatorAccountId' IS DISTINCT FROM NEW.initiator_account_id OR b->>'state' IS DISTINCT FROM NEW.state OR b->'requestedActions' IS DISTINCT FROM to_jsonb(NEW.requested_actions) OR b->'actions' IS DISTINCT FROM to_jsonb(NEW.approved_actions) OR b->>'purpose' IS DISTINCT FROM NEW.purpose OR (b->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at OR (b->>'revision')::integer IS DISTINCT FROM NEW.revision THEN RAISE EXCEPTION 'ASSET_ACCESS_EVENT_INVALID'; END IF;
  IF NEW.state='pending' THEN
   IF e.event_type<>'requested' OR TG_OP<>'INSERT' OR NEW.decision_mode<>'request' OR NEW.initiator_account_id<>e.actor_account_id OR NEW.recipient_account_id<>e.actor_account_id OR NEW.decided_by IS NOT NULL OR cardinality(NEW.approved_actions)<>0 THEN RAISE EXCEPTION 'ASSET_ACCESS_REQUEST_INVALID'; END IF;
  ELSE
   IF NOT manager OR NEW.decided_by IS DISTINCT FROM e.actor_account_id OR e.event_type NOT IN ('decided','grant_revoked') OR (TG_OP='INSERT' AND (NEW.state<>'approved' OR NEW.decision_mode<>'direct_share' OR NEW.initiator_account_id<>e.actor_account_id)) OR (NEW.state='revoked' AND e.event_type<>'grant_revoked') OR (TG_OP='UPDATE' AND OLD.state='approved' AND NEW.state<>'revoked') THEN RAISE EXCEPTION 'ASSET_ACCESS_MANAGER_REQUIRED'; END IF;
  END IF;
  IF NEW.state IN ('pending','approved') THEN
   SELECT payload INTO live FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no AND event_type IN ('released','withdrawn','scope_narrowed') ORDER BY asset_revision DESC LIMIT 1;
   IF live IS NULL OR NOT coalesce(live->'discoveryRecipients' ? NEW.recipient_account_id,false) OR NEW.expires_at>coalesce((SELECT (payload->>'expiresAt')::timestamptz FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no AND event_type='released' ORDER BY asset_revision DESC LIMIT 1),'-infinity'::timestamptz) OR NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ASSET_ACCESS_RELEASE_INVALID'; END IF;
  END IF;
  RETURN NULL;
 END IF;
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 SELECT * INTO e FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id ORDER BY asset_revision DESC LIMIT 1;
 IF e.asset_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'ASSET_COMMIT_EVENT_REQUIRED'; END IF;
 SELECT e.actor_account_id=r.owner_account_id OR EXISTS(SELECT 1 FROM public.account WHERE id=e.actor_account_id AND "tenantId"=r.tenant_id AND role='tenant_admin' AND status='active') INTO manager;
 IF NOT manager THEN
  IF e.event_type NOT IN ('requested','cited') OR e.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) THEN RAISE EXCEPTION 'ASSET_RECIPIENT_MUTATION_INVALID'; END IF;
  SELECT payload INTO live FROM rh_asset.asset_event WHERE asset_id=r.asset_id AND version_no=e.version_no AND event_type IN ('released','withdrawn','scope_narrowed') ORDER BY asset_revision DESC LIMIT 1;
  IF live IS NULL OR NOT coalesce(live->'discoveryRecipients' ? e.actor_account_id,false) OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_event x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.event_type='released' AND (x.payload->>'expiresAt')::timestamptz>clock_timestamp()) THEN RAISE EXCEPTION 'ASSET_RECIPIENT_RELEASE_INVALID'; END IF;
  IF e.event_type='requested' AND NOT EXISTS(SELECT 1 FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.event_revision=e.asset_revision AND x.recipient_account_id=e.actor_account_id AND x.state='pending') THEN RAISE EXCEPTION 'ASSET_ACCESS_EVENT_INVALID'; END IF;
  IF e.event_type='cited' AND NOT EXISTS(SELECT 1 FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.recipient_account_id=e.actor_account_id AND x.state='approved' AND 'cite'=ANY(x.approved_actions) AND x.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'ASSET_CITATION_GRANT_REQUIRED'; END IF;
 END IF;
 RETURN NULL;
END $$
-- statement
CREATE CONSTRAINT TRIGGER access_event_commit AFTER INSERT OR UPDATE ON rh_asset.access_request DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rh_asset.check_registry_event()
