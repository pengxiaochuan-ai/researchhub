-- LOCAL SYNTHETIC CANDIDATE ONLY. Explicit approval required; never on boot.
-- One append-only purpose ledger, no copy of reports or account permissions.
-- @statement
CREATE TABLE rh_asset.ai_use_consent_event (
 id text PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES public.tenant(id),
 study_group_id text NOT NULL REFERENCES public.study_group(id),
 research_project_id text NOT NULL REFERENCES public.research_project(id),
 study_id text NOT NULL,
 asset_id text NOT NULL, version_no integer NOT NULL CHECK(version_no>0),
 account_id text NOT NULL REFERENCES public.account(id),
 actor_account_id text NOT NULL REFERENCES public.account(id),
 provider_scope text NOT NULL CHECK(provider_scope='deepseek'),
 purpose text NOT NULL CHECK(purpose='research_report_qa'),
 consent_revision integer NOT NULL CHECK(consent_revision>0),
 event_kind text NOT NULL CHECK(event_kind IN ('grant','revoke')),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 policy_hash text NOT NULL CHECK(policy_hash ~ '^[a-f0-9]{64}$'),
 source_report_id text NOT NULL REFERENCES public.research_artifact(id),
 source_report_version integer NOT NULL CHECK(source_report_version>0),
 material_basis_ref text NOT NULL CHECK(length(material_basis_ref) BETWEEN 1 AND 160),
 material_basis_hash text NOT NULL CHECK(material_basis_hash ~ '^[a-f0-9]{64}$'),
 material_ai_allowed boolean NOT NULL,
 starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at>starts_at),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 audit_id text NOT NULL REFERENCES public.audit_log(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,asset_id,version_no) REFERENCES rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no),
 UNIQUE(tenant_id,account_id,request_key),
 UNIQUE(tenant_id,asset_id,version_no,account_id,provider_scope,purpose,consent_revision),
 CHECK(actor_account_id=account_id),
 CHECK(event_kind<>'grant' OR material_ai_allowed)
);
-- @statement
ALTER TABLE rh_asset.ai_use_consent_event ADD CONSTRAINT report_ai_local_admission CHECK (
 tenant_id='rh-kb-local-b0e2af9d-tenant' AND study_group_id='rh-kb-local-b0e2af9d-group'
 AND research_project_id='cmwczp5hk0003lud9lsla5b75' AND study_id='rh-study-72203d59-4db8-4e74-9444-edff3b088b6d'
 AND account_id='rh-kb-local-b0e2af9d-admin' AND actor_account_id=account_id
 AND asset_id='rhab-cc8fc61a-38f6-4cf0-96f7-17d11252d7f2' AND version_no=2
 AND source_report_id='rh-formal-report-2d0c1ee7-a6b9-48b9-8433-f47be111ae58' AND source_report_version=1
 AND content_hash='668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b'
 AND policy_hash='92778b8cc4e23e4c636c823a78cf20a8d81f2d6a1cedb700318c210958baf060'
 AND material_basis_ref='aq-c2-user-20261117' AND material_basis_hash='a33f7e54c887fd89782d8ab50434108c5659b3c6996b63f6027766de7b9159d4'
 AND expires_at<=starts_at+interval '7 days'
 AND ((consent_revision IN (1,3) AND event_kind='grant') OR (consent_revision=2 AND event_kind='revoke'))
);
-- @statement
CREATE FUNCTION rh_asset.check_ai_consent_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset,rh_research AS $$
DECLARE prior rh_asset.ai_use_consent_event%ROWTYPE;
BEGIN
 IF NEW.account_id IS DISTINCT FROM current_setting('app.account_id',true)
 OR NEW.actor_account_id IS DISTINCT FROM NEW.account_id
 OR NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.read')
 OR NOT rh_asset.business_parent_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.account_id)
 OR NOT EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id)
 THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_SCOPE_INVALID' USING ERRCODE='42501'; END IF;
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
    AND p.artifact_version_id='cmwk3xmxg0009lubifhlxajii' AND p.content_hash=NEW.content_hash AND p.policy_hash=NEW.policy_hash AND p.source_kind='artifact'
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
END $$;
-- @statement
REVOKE ALL ON FUNCTION rh_asset.check_ai_consent_event() FROM PUBLIC;
-- @statement
CREATE TRIGGER check_ai_consent_event BEFORE INSERT ON rh_asset.ai_use_consent_event FOR EACH ROW EXECUTE FUNCTION rh_asset.check_ai_consent_event();
-- @statement
CREATE TRIGGER immutable_ai_consent_event BEFORE UPDATE OR DELETE ON rh_asset.ai_use_consent_event FOR EACH ROW EXECUTE FUNCTION rh_asset.reject_change();
-- @statement
ALTER TABLE rh_asset.ai_use_consent_event ENABLE ROW LEVEL SECURITY;
-- @statement
ALTER TABLE rh_asset.ai_use_consent_event FORCE ROW LEVEL SECURITY;
-- @statement
CREATE POLICY ai_consent_select ON rh_asset.ai_use_consent_event FOR SELECT USING (
 account_id=current_setting('app.account_id',true)
 AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read')
 AND rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,account_id)
);
-- @statement
CREATE POLICY ai_consent_insert ON rh_asset.ai_use_consent_event FOR INSERT WITH CHECK (
 account_id=current_setting('app.account_id',true) AND actor_account_id=account_id
 AND rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'artifact.read')
 AND rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,account_id)
);
-- @statement
CREATE INDEX ai_consent_latest ON rh_asset.ai_use_consent_event(tenant_id,asset_id,version_no,account_id,provider_scope,purpose,consent_revision DESC);
-- @statement
REVOKE ALL ON rh_asset.ai_use_consent_event FROM PUBLIC;
-- @statement
GRANT SELECT,INSERT ON rh_asset.ai_use_consent_event TO aisci_app;
