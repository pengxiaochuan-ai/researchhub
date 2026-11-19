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
