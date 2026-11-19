SET ROLE aisci_owner;
-- Additive Hub-owned purpose evidence. Apply as aisci_owner, never at startup.
CREATE TABLE rh_asset.material_ai_basis_event (
 id text PRIMARY KEY CHECK(id ~ '^rhmabe-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 basis_key text NOT NULL CHECK(basis_key ~ '^rhmab-[a-f0-9]{64}$'),
 revision integer NOT NULL CHECK(revision>0),
 decision text NOT NULL CHECK(decision IN ('approve','revoke')),
 previous_event_id text REFERENCES rh_asset.material_ai_basis_event(id),
 tenant_id text NOT NULL REFERENCES public.tenant(id),
 study_group_id text NOT NULL REFERENCES public.study_group(id),
 research_project_id text NOT NULL REFERENCES public.research_project(id),
 study_id text NOT NULL REFERENCES rh_research.study_binding(id),
 source_report_id text NOT NULL REFERENCES public.research_artifact(id),
 source_report_version integer NOT NULL CHECK(source_report_version>0),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 material_manifest_hash text NOT NULL CHECK(material_manifest_hash ~ '^[a-f0-9]{64}$'),
 rights_evidence jsonb NOT NULL CHECK(jsonb_typeof(rights_evidence)='object' AND octet_length(rights_evidence::text) BETWEEN 3 AND 16384),
 evidence_ref text NOT NULL CHECK(length(evidence_ref) BETWEEN 1 AND 160),
 basis_hash text NOT NULL CHECK(basis_hash ~ '^[a-f0-9]{64}$'),
 actor_account_id text NOT NULL REFERENCES public.account(id),
 actor_auth_version integer NOT NULL CHECK(actor_auth_version>=0),
 review_reason text NOT NULL CHECK(length(btrim(review_reason)) BETWEEN 1 AND 2000),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 audit_id text NOT NULL REFERENCES public.audit_log(id),
 starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>starts_at AND expires_at<=starts_at+interval '7 days'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,actor_account_id,request_key),UNIQUE(tenant_id,basis_key,revision)
);
ALTER TABLE rh_asset.material_ai_basis_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_asset.material_ai_basis_event FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rh_asset.material_ai_basis_event FROM PUBLIC,aisci_app;
GRANT SELECT,INSERT ON rh_asset.material_ai_basis_event TO aisci_app;
CREATE POLICY material_basis_select ON rh_asset.material_ai_basis_event FOR SELECT USING (
 rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read') AND
 (rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.review') OR EXISTS(
 SELECT 1 FROM public.research_artifact a WHERE a.id=source_report_id AND a."tenantId"=tenant_id AND a."studyGroupId"=study_group_id AND a."researchProjectId"=research_project_id AND a."ownerAccountId"=current_setting('app.account_id',true)))
);
CREATE POLICY material_basis_insert ON rh_asset.material_ai_basis_event FOR INSERT WITH CHECK (
 rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.review') AND actor_account_id=current_setting('app.account_id',true) AND actor_auth_version::text=current_setting('app.auth_version',true)
);
CREATE FUNCTION rh_asset.check_material_ai_basis() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset,rh_research AS $$
DECLARE prior rh_asset.material_ai_basis_event%ROWTYPE; computed_key text; computed_hash text;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_AI_APPEND_ONLY' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wp01:official',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('wp01:tenant:'||NEW.tenant_id,0));
 IF NEW.actor_account_id IS DISTINCT FROM current_setting('app.account_id',true) OR NEW.actor_auth_version::text IS DISTINCT FROM current_setting('app.auth_version',true)
 OR NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.review')
 OR NOT EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id)
 THEN RAISE EXCEPTION 'MATERIAL_AI_REVIEW_REQUIRED' USING ERRCODE='42501'; END IF;
 computed_key:='rhmab-'||encode(sha256(convert_to(concat_ws(chr(31),NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.study_id,NEW.source_report_id,NEW.source_report_version::text,NEW.content_hash,NEW.material_manifest_hash),'UTF8')),'hex');
 IF NEW.basis_key IS DISTINCT FROM computed_key THEN RAISE EXCEPTION 'MATERIAL_AI_KEY_INVALID' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rh-material-ai:'||NEW.basis_key,0));
 IF NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.review')
 OR NOT EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id)
 THEN RAISE EXCEPTION 'MATERIAL_AI_REVIEW_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM rh_asset.material_ai_basis_event e WHERE e.tenant_id=NEW.tenant_id AND e.basis_key=NEW.basis_key ORDER BY e.revision DESC LIMIT 1;
 IF NEW.revision<>coalesce(prior.revision,0)+1 OR NEW.previous_event_id IS DISTINCT FROM prior.id OR (NEW.decision='revoke' AND (prior.id IS NULL OR prior.decision<>'approve'))
 THEN RAISE EXCEPTION 'MATERIAL_AI_REVISION_CONFLICT' USING ERRCODE='23514'; END IF;
 computed_hash:=encode(sha256(convert_to(jsonb_build_array(NEW.basis_key,NEW.rights_evidence,NEW.evidence_ref)::text,'UTF8')),'hex');
 IF NEW.basis_hash IS DISTINCT FROM computed_hash THEN RAISE EXCEPTION 'MATERIAL_AI_HASH_INVALID' USING ERRCODE='23514'; END IF;
 IF prior.id IS NOT NULL AND ROW(NEW.content_hash,NEW.material_manifest_hash,NEW.rights_evidence,NEW.evidence_ref,NEW.basis_hash,NEW.starts_at,NEW.expires_at)
 IS DISTINCT FROM ROW(prior.content_hash,prior.material_manifest_hash,prior.rights_evidence,prior.evidence_ref,prior.basis_hash,prior.starts_at,prior.expires_at)
 THEN RAISE EXCEPTION 'MATERIAL_AI_BINDING_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.decision='approve' AND (NEW.starts_at>clock_timestamp() OR NEW.expires_at<=clock_timestamp() OR NOT EXISTS(
 SELECT 1 FROM public.research_artifact a JOIN public.research_artifact_version v ON v."artifactId"=a.id
 WHERE a.id=NEW.source_report_id AND a."tenantId"=NEW.tenant_id AND a."studyGroupId"=NEW.study_group_id AND a."researchProjectId"=NEW.research_project_id
 AND a."typeKey"='analysis_report' AND a.status='released' AND a."deletedAt" IS NULL AND v."tenantId"=NEW.tenant_id AND v."studyGroupId"=NEW.study_group_id AND v."researchProjectId"=NEW.research_project_id
 AND v."versionNo"=NEW.source_report_version AND v."contentHash"=NEW.content_hash))
 THEN RAISE EXCEPTION 'MATERIAL_AI_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_log a WHERE a.id=NEW.audit_id AND a."tenantId"=NEW.tenant_id AND a."studyGroupId"=NEW.study_group_id AND a."researchProjectId"=NEW.research_project_id AND a."accountId"=NEW.actor_account_id
 AND a.action='researchhub.material_ai_'||NEW.decision AND a.target=NEW.source_report_id AND a.meta->>'basisEventId'=NEW.id AND a.meta->>'requestKey'=NEW.request_key AND a.meta->>'requestHash'=NEW.request_hash)
 THEN RAISE EXCEPTION 'MATERIAL_AI_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
 NEW.created_at=now();RETURN NEW;
END $$;
CREATE TRIGGER material_ai_basis_guard BEFORE INSERT OR UPDATE OR DELETE ON rh_asset.material_ai_basis_event FOR EACH ROW EXECUTE FUNCTION rh_asset.check_material_ai_basis();
CREATE FUNCTION rh_asset.material_basis_matches(t text,g text,p text,s text,r text,v integer,h text,ref text,bh text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
 SELECT EXISTS(SELECT 1 FROM rh_asset.material_ai_basis_event e WHERE e.id=ref AND e.basis_hash=bh AND e.tenant_id=t AND e.study_group_id=g AND e.research_project_id=p AND e.study_id=s AND e.source_report_id=r AND e.source_report_version=v AND e.content_hash=h AND e.decision='approve' AND e.starts_at<=clock_timestamp() AND e.expires_at>clock_timestamp() AND e.revision=(SELECT max(n.revision) FROM rh_asset.material_ai_basis_event n WHERE n.tenant_id=e.tenant_id AND n.basis_key=e.basis_key))
$$;
REVOKE ALL ON FUNCTION rh_asset.check_material_ai_basis() FROM PUBLIC;
REVOKE ALL ON FUNCTION rh_asset.material_basis_matches(text,text,text,text,text,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rh_asset.material_basis_matches(text,text,text,text,text,integer,text,text,text) TO aisci_app;
ALTER TABLE rh_asset.ai_use_consent_event DROP CONSTRAINT report_ai_local_admission;
ALTER TABLE rh_asset.ai_use_consent_event ADD CONSTRAINT report_ai_local_admission CHECK (CASE WHEN material_basis_ref LIKE 'rhmabe-%' THEN (rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,account_id) AND actor_account_id=account_id AND expires_at<=starts_at+interval '7 days') ELSE (((tenant_id = 'rh-kb-local-b0e2af9d-tenant'::text) AND (study_group_id = 'rh-kb-local-b0e2af9d-group'::text) AND (research_project_id = 'cmwczp5hk0003lud9lsla5b75'::text) AND (study_id = 'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d'::text) AND (account_id = 'rh-kb-local-b0e2af9d-admin'::text) AND (actor_account_id = account_id) AND (asset_id = 'rhab-cc8fc61a-38f6-4cf0-96f7-17d11252d7f2'::text) AND (version_no = 2) AND (source_report_id = 'rh-formal-report-2d0c1ee7-a6b9-48b9-8433-f47be111ae58'::text) AND (source_report_version = 1) AND (content_hash = '668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b'::text) AND (policy_hash = '92778b8cc4e23e4c636c823a78cf20a8d81f2d6a1cedb700318c210958baf060'::text) AND (material_basis_ref = 'aq-c2-user-20261117'::text) AND (material_basis_hash = 'a33f7e54c887fd89782d8ab50434108c5659b3c6996b63f6027766de7b9159d4'::text) AND (expires_at <= (starts_at + '7 days'::interval)) AND (((consent_revision = ANY (ARRAY[1, 3])) AND (event_kind = 'grant'::text)) OR ((consent_revision = 2) AND (event_kind = 'revoke'::text))))) END);
CREATE OR REPLACE FUNCTION rh_asset.check_ai_consent_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'rh_asset', 'rh_research'
AS $function$
DECLARE prior rh_asset.ai_use_consent_event%ROWTYPE;
BEGIN
 IF NEW.account_id IS DISTINCT FROM current_setting('app.account_id',true)
 OR NEW.actor_account_id IS DISTINCT FROM NEW.account_id
 OR NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.read')
 OR NOT rh_asset.business_parent_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id)
 OR NOT EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id)
 THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_SCOPE_INVALID' USING ERRCODE='42501'; END IF;
 IF NEW.material_basis_ref LIKE 'rhmabe-%' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:official',0));
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:tenant:'||NEW.tenant_id,0));
  IF NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.read') THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_SCOPE_INVALID' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rh-material-ai:'||e.basis_key,0)) FROM rh_asset.material_ai_basis_event e WHERE e.id=NEW.material_basis_ref;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_AI_MATERIAL_BASIS_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NEW.event_kind='grant' AND (NEW.starts_at>clock_timestamp() OR NEW.expires_at<=clock_timestamp() OR NOT rh_asset.material_basis_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.study_id,NEW.source_report_id,NEW.source_report_version,NEW.content_hash,NEW.material_basis_ref,NEW.material_basis_hash))
  THEN RAISE EXCEPTION 'REPORT_AI_MATERIAL_BASIS_REQUIRED' USING ERRCODE='23514'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('rh-report-ai',NEW.tenant_id,NEW.asset_id,NEW.version_no,NEW.account_id,NEW.provider_scope,NEW.purpose)::text,0));
 SELECT * INTO prior FROM rh_asset.ai_use_consent_event e
 WHERE e.tenant_id=NEW.tenant_id AND e.asset_id=NEW.asset_id AND e.version_no=NEW.version_no AND e.account_id=NEW.account_id AND e.provider_scope=NEW.provider_scope AND e.purpose=NEW.purpose
 ORDER BY e.consent_revision DESC LIMIT 1;
 IF NEW.consent_revision<>coalesce(prior.consent_revision,0)+1 OR (NEW.event_kind='revoke' AND (prior.id IS NULL OR prior.event_kind<>'grant')) THEN
  RAISE EXCEPTION 'REPORT_AI_CONSENT_REVISION_CONFLICT' USING ERRCODE='23514'; END IF;
 IF prior.id IS NOT NULL AND ROW(NEW.starts_at,NEW.expires_at) IS DISTINCT FROM ROW(prior.starts_at,prior.expires_at) THEN
  RAISE EXCEPTION 'REPORT_AI_CONSENT_WINDOW_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.event_kind='grant' AND (
  NEW.starts_at>statement_timestamp() OR NEW.expires_at<=statement_timestamp() OR NOT NEW.material_ai_allowed
  OR NOT EXISTS(SELECT 1 FROM rh_asset.asset_registry r JOIN rh_asset.version_policy p ON p.asset_id=r.asset_id AND p.version_no=NEW.version_no
    JOIN public.research_artifact_version v ON v."artifactId"=NEW.source_report_id AND v."versionNo"=NEW.source_report_version AND v."tenantId"=NEW.tenant_id AND v."studyGroupId"=NEW.study_group_id AND v."researchProjectId"=NEW.research_project_id
    JOIN public.research_artifact a ON a.id=v."artifactId"
    WHERE r.asset_id=NEW.asset_id AND r.tenant_id=NEW.tenant_id AND r.study_group_id=NEW.study_group_id AND r.research_project_id=NEW.research_project_id AND r.owner_account_id=NEW.account_id
    AND r.asset_kind='publication' AND r.deleted_at IS NULL AND r.approved_version_no=NEW.version_no
    AND (p.artifact_version_id='cmwk3xmxg0009lubifhlxajii' OR (NEW.material_basis_ref LIKE 'rhmabe-%' AND EXISTS(
 SELECT 1 FROM public.research_artifact_version av WHERE av.id=p.artifact_version_id AND av."artifactId"=NEW.asset_id AND av."versionNo"=NEW.version_no AND av."tenantId"=NEW.tenant_id AND av."studyGroupId"=NEW.study_group_id AND av."researchProjectId"=NEW.research_project_id AND av."contentHash"=NEW.content_hash))) AND p.content_hash=NEW.content_hash AND p.policy_hash=NEW.policy_hash AND p.source_kind='artifact'
    AND p.source_bindings=jsonb_build_array(jsonb_build_object('kind','artifact','id',NEW.source_report_id,'version',NEW.source_report_version,'contentHash',NEW.content_hash))
    AND v."contentHash"=NEW.content_hash AND a."ownerAccountId"=NEW.account_id AND a."typeKey"='analysis_report' AND a.status='released' AND a."deletedAt" IS NULL)
 ) THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 IF NEW.event_kind='revoke' AND ROW(NEW.content_hash,NEW.policy_hash,NEW.source_report_id,NEW.source_report_version,NEW.material_basis_ref,NEW.material_basis_hash,NEW.material_ai_allowed,NEW.starts_at,NEW.expires_at)
 IS DISTINCT FROM ROW(prior.content_hash,prior.policy_hash,prior.source_report_id,prior.source_report_version,prior.material_basis_ref,prior.material_basis_hash,prior.material_ai_allowed,prior.starts_at,prior.expires_at)
 THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_REVOKE_BINDING_CHANGED' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_log a WHERE a.id=NEW.audit_id AND a."tenantId"=NEW.tenant_id AND a."studyGroupId"=NEW.study_group_id AND a."researchProjectId"=NEW.research_project_id AND a."accountId"=NEW.actor_account_id
 AND a.action='researchhub.asset_ai_consent_'||NEW.event_kind AND a.target=NEW.asset_id
 AND a.meta->>'consentEventId'=NEW.id AND a.meta->>'requestKey'=NEW.request_key AND a.meta->>'requestHash'=NEW.request_hash)
 THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
 NEW.created_at=now();RETURN NEW;
END $function$
;
RESET ROLE;
