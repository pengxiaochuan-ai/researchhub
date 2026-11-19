SET ROLE aisci_owner;
ALTER TABLE rh_asset.asset_registry DROP CONSTRAINT asset_registry_tenant_id_check;
ALTER TABLE rh_asset.asset_registry ADD CONSTRAINT asset_registry_tenant_id_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id)) ELSE ((tenant_id = 'rh-kb-local-b0e2af9d-tenant'::text)) END);
ALTER TABLE rh_asset.access_request DROP CONSTRAINT access_request_initiator_account_id_check;
ALTER TABLE rh_asset.access_request ADD CONSTRAINT access_request_initiator_account_id_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,ARRAY[initiator_account_id])) ELSE ((initiator_account_id = ANY (ARRAY['rh-kb-local-b0e2af9d-owner'::text, 'rh-kb-local-b0e2af9d-admin'::text]))) END);
ALTER TABLE rh_asset.access_request DROP CONSTRAINT access_request_recipient_account_id_check;
ALTER TABLE rh_asset.access_request ADD CONSTRAINT access_request_recipient_account_id_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,ARRAY[recipient_account_id])) ELSE ((recipient_account_id = ANY (ARRAY['rh-kb-local-b0e2af9d-owner'::text, 'rh-kb-local-b0e2af9d-admin'::text]))) END);
ALTER TABLE rh_asset.access_request DROP CONSTRAINT access_request_decided_by_check;
ALTER TABLE rh_asset.access_request ADD CONSTRAINT access_request_decided_by_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (decided_by IS NULL OR rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,ARRAY[decided_by])) ELSE (((decided_by IS NULL) OR (decided_by = ANY (ARRAY['rh-kb-local-b0e2af9d-owner'::text, 'rh-kb-local-b0e2af9d-admin'::text])))) END);
ALTER TABLE rh_asset.access_request DROP CONSTRAINT access_request_check2;
ALTER TABLE rh_asset.access_request ADD CONSTRAINT access_request_check2 CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,CASE WHEN initiator_account_id=recipient_account_id THEN ARRAY[initiator_account_id] ELSE ARRAY[initiator_account_id,recipient_account_id] END)) ELSE ((rh_asset.recipients_valid(ARRAY[initiator_account_id, recipient_account_id]) OR (initiator_account_id = recipient_account_id))) END);
ALTER TABLE rh_asset.asset_comment_event DROP CONSTRAINT asset_comment_event_comment_id_check;
ALTER TABLE rh_asset.asset_comment_event ADD CONSTRAINT asset_comment_event_comment_id_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND comment_id ~ '^rhc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') ELSE ((comment_id = ANY (ARRAY['rh-research-asset:detail-20261113:comment:owner:1'::text, 'rh-research-asset:detail-20261113:comment:owner:2'::text, 'rh-research-asset:detail-20261113:comment:owner:3'::text, 'rh-research-asset:detail-20261113:comment:owner:4'::text, 'rh-research-asset:detail-20261113:comment:admin:1'::text, 'rh-research-asset:detail-20261113:comment:admin:2'::text, 'rh-research-asset:detail-20261113:comment:admin:3'::text, 'rh-research-asset:detail-20261113:comment:admin:4'::text]))) END);
ALTER TABLE rh_asset.asset_comment_event DROP CONSTRAINT asset_comment_event_revision_check;
ALTER TABLE rh_asset.asset_comment_event ADD CONSTRAINT asset_comment_event_revision_check CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND revision>0) ELSE (((revision >= 1) AND (revision <= 3))) END);
CREATE POLICY runtime_business_insert ON rh_asset.access_request FOR INSERT WITH CHECK (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND initiator_account_id=current_setting('app.account_id',true));
CREATE POLICY runtime_business_update ON rh_asset.access_request FOR UPDATE USING (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND EXISTS(SELECT 1 FROM rh_asset.asset_registry r JOIN public.account a ON a.id=current_setting('app.account_id',true) AND a."tenantId"=r.tenant_id WHERE r.asset_id=access_request.asset_id AND a.status='active' AND (a.id=r.owner_account_id OR a.role='tenant_admin'))) WITH CHECK (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND EXISTS(SELECT 1 FROM rh_asset.asset_registry r JOIN public.account a ON a.id=current_setting('app.account_id',true) AND a."tenantId"=r.tenant_id WHERE r.asset_id=access_request.asset_id AND a.status='active' AND (a.id=r.owner_account_id OR a.role='tenant_admin')));
CREATE POLICY runtime_business_select ON rh_asset.asset_comment_event FOR SELECT USING (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body'));
CREATE POLICY runtime_business_insert ON rh_asset.asset_comment_event FOR INSERT WITH CHECK (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body') AND rh_asset.detail_actor_can_use(asset_id,version_no,'comment') AND actor_account_id=current_setting('app.account_id',true));
CREATE POLICY runtime_business_select ON rh_asset.asset_reuse_record FOR SELECT USING (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body') AND (actor_account_id=current_setting('app.account_id',true) OR EXISTS(SELECT 1 FROM public.account a WHERE a.id=current_setting('app.account_id',true) AND a."tenantId"=tenant_id AND a.status='active' AND a.role='tenant_admin')));
CREATE POLICY runtime_business_insert ON rh_asset.asset_reuse_record FOR INSERT WITH CHECK (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND rh_asset.detail_actor_can_use(asset_id,version_no,'read_body') AND rh_asset.detail_actor_can_use(asset_id,version_no,CASE WHEN kind='copy' THEN 'derive' ELSE 'apply' END) AND actor_account_id=current_setting('app.account_id',true));
CREATE OR REPLACE FUNCTION rh_asset.check_detail_access_purposes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'rh_asset'
AS $function$
 DECLARE k text; r rh_asset.asset_registry%ROWTYPE; v rh_asset.version_policy%ROWTYPE; detail boolean;
 BEGIN
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id AND tenant_id=NEW.tenant_id AND study_group_id=NEW.study_group_id AND research_project_id=NEW.research_project_id;
 SELECT "idempotencyKey" INTO k FROM public.research_artifact WHERE id=NEW.asset_id AND "tenantId"=NEW.tenant_id AND "studyGroupId"=NEW.study_group_id AND "researchProjectId"=NEW.research_project_id;
 SELECT * INTO v FROM rh_asset.version_policy WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no;
 IF r.asset_id IS NULL OR v.asset_id IS NULL OR k IS NULL THEN RAISE EXCEPTION 'ASSET_PURPOSE_PARENT_INVALID'; END IF;
 detail:=rh_asset.detail_version_limit(k,r.owner_account_id,r.asset_kind) IN (2,4) OR rh_asset.business_object_matches(r.asset_id,r.tenant_id,r.study_group_id,r.research_project_id);
 IF cardinality(NEW.requested_actions)<>(SELECT count(DISTINCT x) FROM unnest(NEW.requested_actions) AS x) OR cardinality(NEW.approved_actions)<>(SELECT count(DISTINCT x) FROM unnest(NEW.approved_actions) AS x) THEN RAISE EXCEPTION 'ASSET_PURPOSE_INVALID'; END IF;
 IF NOT detail AND (cardinality(NEW.requested_actions)>2 OR NOT NEW.requested_actions <@ ARRAY['read_body','cite']::text[]) THEN RAISE EXCEPTION 'ASSET_LEGACY_PURPOSE_INVALID'; END IF;
 IF detail AND (length(trim(v.rights_evidence))=0 OR ('apply'=ANY(NEW.requested_actions) AND r.asset_kind<>'protocol')) THEN RAISE EXCEPTION 'ASSET_DETAIL_PURPOSE_INVALID'; END IF;
 RETURN NEW;
 END $function$
;
CREATE OR REPLACE FUNCTION rh_asset.check_registry_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'rh_asset'
AS $function$
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
 IF e.event_type IN ('asset_copy','asset_apply') THEN
  IF e.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,CASE WHEN e.event_type='asset_copy' THEN 'derive' ELSE 'apply' END) OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_reuse_record f WHERE f.asset_id=e.asset_id AND f.version_no=e.version_no AND f.event_revision=e.asset_revision AND f.actor_account_id=e.actor_account_id AND f.request_key=e.request_key AND f.request_hash=e.request_hash AND f.target_artifact_id=e.payload->>'targetArtifactId' AND f.kind=CASE WHEN e.event_type='asset_copy' THEN 'copy' ELSE 'apply' END) THEN RAISE EXCEPTION 'ASSET_REUSE_COMMIT_REQUIRED'; END IF;
  RETURN NULL;
 END IF;
 IF e.event_type IN ('attachment_bound','file_accessed','markdown_exported') THEN
  IF e.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR NOT (EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=r.asset_id AND rh_asset.detail_version_limit(a."idempotencyKey",r.owner_account_id,r.asset_kind) IN (2,4)) OR rh_asset.business_object_matches(r.asset_id,r.tenant_id,r.study_group_id,r.research_project_id)) OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,'read_body') THEN RAISE EXCEPTION 'ASSET_FILE_PARENT_INVALID'; END IF;
  IF e.event_type='attachment_bound' THEN
   IF NOT manager OR NOT rh_asset.detail_attachment_matches(r.asset_id,e.version_no,e.payload->>'fileId') THEN RAISE EXCEPTION 'ASSET_ATTACHMENT_INVALID'; END IF;
  ELSE
   IF e.payload->>'phase'<>'authorized' OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,CASE WHEN e.event_type='file_accessed' THEN 'download' ELSE 'export' END) OR NOT EXISTS(SELECT 1 FROM rh_asset.version_policy p WHERE p.asset_id=r.asset_id AND p.version_no=e.version_no AND p.content_hash=e.payload->>'contentHash' AND p.policy_hash=e.payload->>'policyHash') OR (e.event_type='file_accessed' AND NOT rh_asset.detail_attachment_matches(r.asset_id,e.version_no,e.payload->>'fileId')) THEN RAISE EXCEPTION 'ASSET_FILE_CURRENT_PURPOSE_REQUIRED'; END IF;
  END IF;
  RETURN NULL;
 END IF;
 IF e.event_type='comment_changed' THEN
  IF NOT (EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=r.asset_id AND rh_asset.detail_version_limit(a."idempotencyKey",r.owner_account_id,r.asset_kind) IN (2,4)) OR rh_asset.business_object_matches(r.asset_id,r.tenant_id,r.study_group_id,r.research_project_id)) OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(r.asset_id,e.version_no,'comment') OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_comment_event c WHERE c.asset_id=e.asset_id AND c.version_no=e.version_no AND c.event_revision=e.asset_revision AND c.actor_account_id=e.actor_account_id AND c.request_key=e.request_key AND c.request_hash=e.request_hash) THEN RAISE EXCEPTION 'ASSET_COMMENT_COMMIT_REQUIRED'; END IF;
  RETURN NULL;
 END IF;
 IF NOT manager THEN
  IF e.event_type NOT IN ('requested','cited') OR e.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) THEN RAISE EXCEPTION 'ASSET_RECIPIENT_MUTATION_INVALID'; END IF;
  SELECT payload INTO live FROM rh_asset.asset_event WHERE asset_id=r.asset_id AND version_no=e.version_no AND event_type IN ('released','withdrawn','scope_narrowed') ORDER BY asset_revision DESC LIMIT 1;
  IF live IS NULL OR NOT coalesce(live->'discoveryRecipients' ? e.actor_account_id,false) OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_event x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.event_type='released' AND (x.payload->>'expiresAt')::timestamptz>clock_timestamp()) THEN RAISE EXCEPTION 'ASSET_RECIPIENT_RELEASE_INVALID'; END IF;
  IF e.event_type='requested' AND NOT EXISTS(SELECT 1 FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.event_revision=e.asset_revision AND x.recipient_account_id=e.actor_account_id AND x.state='pending') THEN RAISE EXCEPTION 'ASSET_ACCESS_EVENT_INVALID'; END IF;
  IF e.event_type='cited' AND NOT EXISTS(SELECT 1 FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id AND x.version_no=e.version_no AND x.recipient_account_id=e.actor_account_id AND x.state='approved' AND 'cite'=ANY(x.approved_actions) AND x.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'ASSET_CITATION_GRANT_REQUIRED'; END IF;
 END IF;
 RETURN NULL;
END $function$
;
CREATE OR REPLACE FUNCTION rh_asset.detail_attachment_matches(aid text, v integer, fid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'rh_asset'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.research_artifact_file f JOIN public.research_artifact a ON a.id=f."artifactId" JOIN rh_asset.version_policy p ON p.asset_id=a.id AND p.artifact_version_id=f."artifactVersionId" WHERE f.id=fid AND a.id=aid AND p.version_no=v AND v=1 AND f."tenantId"=p.tenant_id AND f."studyGroupId"=p.study_group_id AND f."researchProjectId"=p.research_project_id AND f.role='source_attachment' AND CASE WHEN a."idempotencyKey"='rh-research-asset:detail-20261113:owner:protocol' AND a."ownerAccountId"='rh-kb-local-b0e2af9d-owner' AND f.id='rh-a02-file-02cc9a65f1d32db0723a11ff0c735d42' AND f.filename='a02-owner-protocol.md' AND f.sha256='bcf0e5a1bbbdecc2abe9866517eb73cf492e155f1b25d8fedbff0a4f56c41a7c' AND f."sizeBytes"=173 AND f."storageKey"='rh-kb-local-b0e2af9d-tenant/hub-a02-files/rh-a02-file-02cc9a65f1d32db0723a11ff0c735d42.md' AND f."mimeType"='text/markdown; charset=utf-8' THEN true WHEN a."idempotencyKey"='rh-research-asset:detail-20261113:owner:dataset' AND a."ownerAccountId"='rh-kb-local-b0e2af9d-owner' AND f.id='rh-a02-file-edd38b0d4978570107845c87ba07b05e' AND f.filename='a02-owner-dataset.txt' AND f.sha256='86698ee2de4f86ce2850d467e3d0a5894d5b88476985aac2c98543a77c2ad896' AND f."sizeBytes"=173 AND f."storageKey"='rh-kb-local-b0e2af9d-tenant/hub-a02-files/rh-a02-file-edd38b0d4978570107845c87ba07b05e.txt' AND f."mimeType"='text/plain; charset=utf-8' THEN true WHEN a."idempotencyKey"='rh-research-asset:detail-20261113:admin:protocol' AND a."ownerAccountId"='rh-kb-local-b0e2af9d-admin' AND f.id='rh-a02-file-8912d37ef7c5b648e0b91f0ecd064861' AND f.filename='a02-admin-protocol.md' AND f.sha256='bcf0e5a1bbbdecc2abe9866517eb73cf492e155f1b25d8fedbff0a4f56c41a7c' AND f."sizeBytes"=173 AND f."storageKey"='rh-kb-local-b0e2af9d-tenant/hub-a02-files/rh-a02-file-8912d37ef7c5b648e0b91f0ecd064861.md' AND f."mimeType"='text/markdown; charset=utf-8' THEN true WHEN a."idempotencyKey"='rh-research-asset:detail-20261113:admin:dataset' AND a."ownerAccountId"='rh-kb-local-b0e2af9d-admin' AND f.id='rh-a02-file-8ce3e1894820b91d7f2d873c431c7457' AND f.filename='a02-admin-dataset.txt' AND f.sha256='86698ee2de4f86ce2850d467e3d0a5894d5b88476985aac2c98543a77c2ad896' AND f."sizeBytes"=173 AND f."storageKey"='rh-kb-local-b0e2af9d-tenant/hub-a02-files/rh-a02-file-8ce3e1894820b91d7f2d873c431c7457.txt' AND f."mimeType"='text/plain; charset=utf-8' THEN true ELSE false END) OR EXISTS(SELECT 1 FROM public.research_artifact_file f JOIN public.research_artifact a ON a.id=f."artifactId" JOIN rh_asset.version_policy p ON p.asset_id=a.id AND p.artifact_version_id=f."artifactVersionId" WHERE a.id=aid AND f.id=fid AND p.version_no=v AND rh_asset.business_object_matches(a.id,p.tenant_id,p.study_group_id,p.research_project_id) AND f."tenantId"=p.tenant_id AND f."studyGroupId"=p.study_group_id AND f."researchProjectId"=p.research_project_id AND f.role='source_attachment' AND f.sha256 ~ '^[a-f0-9]{64}$' AND f."sizeBytes">0 AND left(f."storageKey",length(p.tenant_id||'/hub-assets/'))=p.tenant_id||'/hub-assets/' AND position(chr(92) in f."storageKey")=0 AND f."storageKey" !~ '[[:cntrl:]]' AND NOT (string_to_array(f."storageKey",'/') && ARRAY['','.','..'])) $function$;
CREATE OR REPLACE FUNCTION rh_asset.check_detail_fact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'rh_asset'
AS $function$
DECLARE e rh_asset.asset_event%ROWTYPE; prior rh_asset.asset_comment_event%ROWTYPE; r rh_asset.asset_registry%ROWTYPE; p rh_asset.version_policy%ROWTYPE; t public.research_artifact%ROWTYPE; manager boolean; saved_project text; business boolean; target_allowed boolean;
BEGIN
 business:=rh_asset.business_object_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id);
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id;
 SELECT * INTO p FROM rh_asset.version_policy WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no;
 SELECT * INTO e FROM rh_asset.asset_event WHERE asset_id=NEW.asset_id AND asset_revision=NEW.event_revision;
 IF r.asset_id IS NULL OR p.asset_id IS NULL OR e.asset_id IS NULL OR e.version_no<>NEW.version_no OR e.actor_account_id<>NEW.actor_account_id OR NEW.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR e.request_key<>NEW.request_key OR e.request_hash<>NEW.request_hash THEN RAISE EXCEPTION 'ASSET_DETAIL_EVENT_REQUIRED'; END IF;
 IF NOT business AND NOT EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND a."idempotencyKey" LIKE 'rh-research-asset:detail-20261113:%') THEN RAISE EXCEPTION 'ASSET_DETAIL_FAMILY_REQUIRED'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.account a WHERE a.id=NEW.actor_account_id AND a."tenantId"=NEW.tenant_id AND a.role='tenant_admin' AND a.status='active') INTO manager;
 IF TG_TABLE_NAME='asset_comment_event' THEN
  IF NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'comment') OR NOT (EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND rh_asset.detail_comment_slot(NEW.comment_id,NEW.author_account_id,a."idempotencyKey",NEW.version_no,NEW.parent_comment_id)) OR (business AND (NEW.parent_comment_id IS NULL OR EXISTS(SELECT 1 FROM rh_asset.asset_comment_event c WHERE c.comment_id=NEW.parent_comment_id AND c.asset_id=NEW.asset_id AND c.version_no=NEW.version_no AND c.tenant_id=NEW.tenant_id AND c.study_group_id=NEW.study_group_id AND c.research_project_id=NEW.research_project_id AND c.revision=(SELECT max(z.revision) FROM rh_asset.asset_comment_event z WHERE z.comment_id=c.comment_id) AND c.action IN ('create','edit'))))) THEN RAISE EXCEPTION 'ASSET_COMMENT_SLOT_INVALID'; END IF;
  IF NEW.action='withdraw' AND NEW.actor_account_id<>NEW.author_account_id THEN RAISE EXCEPTION 'ASSET_COMMENT_AUTHOR_REQUIRED'; END IF;
  IF e.event_type<>'comment_changed' OR e.payload->>'commentId' IS DISTINCT FROM NEW.comment_id OR (e.payload->>'commentRevision')::integer IS DISTINCT FROM NEW.revision OR e.payload->>'action' IS DISTINCT FROM NEW.action THEN RAISE EXCEPTION 'ASSET_COMMENT_EVENT_REQUIRED'; END IF;
  SELECT * INTO prior FROM rh_asset.asset_comment_event WHERE comment_id=NEW.comment_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1;
  IF NEW.action='create' THEN
   IF NEW.revision<>1 OR prior.event_id IS NOT NULL OR NEW.author_account_id<>NEW.actor_account_id OR length(trim(NEW.body))=0 THEN RAISE EXCEPTION 'ASSET_COMMENT_CREATE_INVALID'; END IF;
  ELSE
   IF prior.event_id IS NULL OR NEW.revision<>prior.revision+1 OR prior.action IN ('withdraw','moderate') OR NEW.author_account_id<>prior.author_account_id OR NEW.parent_comment_id IS DISTINCT FROM prior.parent_comment_id OR NEW.asset_id<>prior.asset_id OR NEW.version_no<>prior.version_no OR (NEW.actor_account_id<>prior.author_account_id AND NOT manager) OR (NEW.action='moderate' AND (NOT manager OR length(trim(coalesce(NEW.reason,'')))=0)) OR (NEW.action IN ('withdraw','moderate') AND NEW.body<>'') OR (NEW.action='edit' AND (NEW.actor_account_id<>prior.author_account_id OR length(trim(NEW.body))=0)) THEN RAISE EXCEPTION 'ASSET_COMMENT_REVISION_INVALID'; END IF;
  END IF;
 ELSE
  IF e.event_type IS DISTINCT FROM (CASE WHEN NEW.kind='copy' THEN 'asset_copy' ELSE 'asset_apply' END) OR e.payload->>'targetArtifactId' IS DISTINCT FROM NEW.target_artifact_id OR NEW.source_hash<>p.content_hash OR NEW.source_policy_hash<>p.policy_hash THEN RAISE EXCEPTION 'ASSET_REUSE_EVENT_REQUIRED'; END IF;
  saved_project:=current_setting('app.research_project_id',true);PERFORM set_config('app.research_project_id',NEW.target_project_id,true);
  SELECT * INTO t FROM public.research_artifact WHERE id=NEW.target_artifact_id;
  SELECT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.target_project_id,'artifact.create') INTO target_allowed;
  PERFORM set_config('app.research_project_id',saved_project,true);
  IF t.id IS NULL OR t."tenantId"<>NEW.tenant_id OR t."studyGroupId"<>NEW.study_group_id OR t."researchProjectId"<>NEW.target_project_id OR t."ownerAccountId"<>NEW.actor_account_id OR t."createdBy"<>NEW.actor_account_id OR t.status<>'draft' OR t."deletedAt" IS NOT NULL OR t."currentVersionNo"<>1 THEN RAISE EXCEPTION 'ASSET_REUSE_TARGET_INVALID'; END IF;
  IF (NOT business AND NOT rh_asset.detail_reuse_slot((SELECT "idempotencyKey" FROM public.research_artifact WHERE id=NEW.asset_id),t."idempotencyKey",NEW.actor_account_id,NEW.kind,NEW.version_no,NEW.target_project_id)) OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,'read_body') OR NOT rh_asset.detail_actor_can_use(NEW.asset_id,NEW.version_no,CASE WHEN NEW.kind='copy' THEN 'derive' ELSE 'apply' END) THEN RAISE EXCEPTION 'ASSET_REUSE_SLOT_INVALID'; END IF;
  IF NEW.kind='copy' THEN
   IF (t."typeKey"<>'research_report') OR (NOT business AND (NEW.target_project_id<>'rh-kb-local-b0e2af9d-project' OR t."typeKey"<>'research_report' OR t."idempotencyKey" NOT IN ('rh-research-asset:detail-20261113:owner:protocol:copy','rh-research-asset:detail-20261113:owner:dataset:copy','rh-research-asset:detail-20261113:owner:instrument:copy','rh-research-asset:detail-20261113:admin:protocol:copy','rh-research-asset:detail-20261113:admin:analysis:copy','rh-research-asset:detail-20261113:admin:publication:copy'))) OR (business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM 'rhab-reuse:'||encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex'))) THEN RAISE EXCEPTION 'ASSET_COPY_TARGET_INVALID'; END IF;
  ELSE
   IF (t."typeKey"<>'protocol_draft' OR r.asset_kind<>'protocol') OR (NOT business AND (NEW.target_project_id<>'rh-asset-detail-20261113-study-b' OR t."typeKey"<>'protocol_draft' OR r.asset_kind<>'protocol' OR t."idempotencyKey" NOT IN ('rh-research-asset:detail-20261113:application:owner:1','rh-research-asset:detail-20261113:application:owner:2','rh-research-asset:detail-20261113:application:admin:1','rh-research-asset:detail-20261113:application:admin:2'))) OR (business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM 'rhab-reuse:'||encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex'))) THEN RAISE EXCEPTION 'ASSET_APPLICATION_TARGET_INVALID'; END IF;
  END IF;
 END IF;
 RETURN NULL;
END $function$
;
RESET ROLE;
