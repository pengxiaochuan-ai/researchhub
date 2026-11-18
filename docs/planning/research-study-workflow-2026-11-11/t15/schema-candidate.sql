-- T15 candidate only. Independent review required; never apply at startup.
CREATE SCHEMA rh_analysis;
CREATE TABLE rh_analysis.plan (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES public.tenant(id),study_group_id text NOT NULL,
 research_project_id text NOT NULL,study_id text NOT NULL,protocol_version_id text NOT NULL,
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 submitted_by text NOT NULL REFERENCES public.account(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,study_group_id,research_project_id,study_id,id),
 FOREIGN KEY(tenant_id,study_id) REFERENCES rh_research.study_binding(tenant_id,id)
);
CREATE TABLE rh_analysis.plan_review (
 id text PRIMARY KEY,tenant_id text NOT NULL,study_group_id text NOT NULL,research_project_id text NOT NULL,study_id text NOT NULL,plan_id text NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0),decision text NOT NULL CHECK(decision IN ('approved','revoked')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 5000),reviewed_by text NOT NULL REFERENCES public.account(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(plan_id,sequence),UNIQUE(tenant_id,study_group_id,research_project_id,study_id,plan_id,id),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,study_id,plan_id) REFERENCES rh_analysis.plan(tenant_id,study_group_id,research_project_id,study_id,id)
);
CREATE TABLE rh_analysis.snapshot (
 id text PRIMARY KEY,tenant_id text NOT NULL,study_group_id text NOT NULL,research_project_id text NOT NULL,study_id text NOT NULL,plan_id text NOT NULL,review_id text NOT NULL,
 manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
 quality_gate_id text NOT NULL UNIQUE,quality_gate jsonb NOT NULL CHECK(jsonb_typeof(quality_gate)='object'),
 released_by text NOT NULL REFERENCES public.account(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,study_group_id,research_project_id,study_id,plan_id,review_id) REFERENCES rh_analysis.plan_review(tenant_id,study_group_id,research_project_id,study_id,plan_id,id)
);
CREATE INDEX t15_plan_scope ON rh_analysis.plan(tenant_id,study_group_id,research_project_id,study_id,created_at);
CREATE INDEX t15_snapshot_scope ON rh_analysis.snapshot(tenant_id,study_group_id,research_project_id,study_id,plan_id,created_at);
CREATE FUNCTION rh_analysis.immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ANALYSIS_RECORD_IMMUTABLE' USING ERRCODE='23514'; END $$;
CREATE FUNCTION rh_analysis.parents() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; latest integer; review_decision text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id AND p."studyGroupId"=b.study_group_id WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id) THEN RAISE EXCEPTION 'ANALYSIS_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='plan' THEN
  actor:=NEW.submitted_by;
  IF NEW.definition->>'protocolVersionId' IS DISTINCT FROM NEW.protocol_version_id OR NEW.definition->>'schemaVersion' IS DISTINCT FROM 't15-synthetic-plan-v1' OR NEW.definition->>'purposeKey' IS DISTINCT FROM 'synthetic-research-only' OR NEW.definition->>'dataClassification' IS DISTINCT FROM 'synthetic' OR NEW.definition->>'method' IS DISTINCT FROM 'descriptive' OR NEW.definition->>'statisticalUnit' IS DISTINCT FROM 'subject' THEN RAISE EXCEPTION 'ANALYSIS_PLAN_INVALID' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.study_protocol_version p WHERE p.id=NEW.protocol_version_id AND p."tenantId"=NEW.tenant_id AND p."studyGroupId"=NEW.study_group_id AND p."researchProjectId"=NEW.research_project_id AND NOT p."acceptanceFixture") THEN RAISE EXCEPTION 'ANALYSIS_PROTOCOL_INVALID' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='plan_review' THEN
  actor:=NEW.reviewed_by;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id||':t15-plan:'||NEW.plan_id,0));
  SELECT coalesce(max(sequence),0) INTO latest FROM rh_analysis.plan_review WHERE plan_id=NEW.plan_id AND tenant_id=NEW.tenant_id;
  IF NEW.sequence<>latest+1 OR (latest=0 AND NEW.decision<>'approved') THEN RAISE EXCEPTION 'ANALYSIS_REVIEW_SEQUENCE_INVALID' USING ERRCODE='23514'; END IF;
 ELSE
  actor:=NEW.released_by;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id||':t15-plan:'||NEW.plan_id,0));
  SELECT decision INTO review_decision FROM rh_analysis.plan_review WHERE id=NEW.review_id AND plan_id=NEW.plan_id AND tenant_id=NEW.tenant_id AND sequence=(SELECT max(sequence) FROM rh_analysis.plan_review WHERE plan_id=NEW.plan_id AND tenant_id=NEW.tenant_id);
  IF review_decision IS DISTINCT FROM 'approved' OR NEW.quality_gate->>'id' IS DISTINCT FROM NEW.quality_gate_id OR NEW.quality_gate->>'manifestHash' IS DISTINCT FROM NEW.manifest_hash OR NEW.quality_gate->>'status' IS DISTINCT FROM 'released' OR NEW.quality_gate->>'version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'ANALYSIS_RELEASE_INVALID' USING ERRCODE='23514'; END IF;
  IF NEW.manifest->>'studyId' IS DISTINCT FROM NEW.study_id OR NEW.manifest->'scope'->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR NEW.manifest->'scope'->>'studyGroupId' IS DISTINCT FROM NEW.study_group_id OR NEW.manifest->'scope'->>'researchProjectId' IS DISTINCT FROM NEW.research_project_id OR NEW.manifest->'analysisPlan'->>'id' IS DISTINCT FROM NEW.plan_id OR NEW.manifest->'analysisPlan'->>'reviewId' IS DISTINCT FROM NEW.review_id OR NEW.quality_gate->>'reviewedBy' IS DISTINCT FROM NEW.released_by THEN RAISE EXCEPTION 'ANALYSIS_MANIFEST_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account a WHERE a.id=actor AND a."tenantId"=NEW.tenant_id) THEN RAISE EXCEPTION 'ANALYSIS_ACTOR_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['plan','plan_review','snapshot'] LOOP
 EXECUTE format('CREATE TRIGGER t15_parent BEFORE INSERT ON rh_analysis.%I FOR EACH ROW EXECUTE FUNCTION rh_analysis.parents()',t);
 EXECUTE format('CREATE TRIGGER t15_immutable BEFORE UPDATE OR DELETE ON rh_analysis.%I FOR EACH ROW EXECUTE FUNCTION rh_analysis.immutable()',t);
 EXECUTE format('ALTER TABLE rh_analysis.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE rh_analysis.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY exact_scope ON rh_analysis.%I USING (tenant_id=current_setting(''app.tenant_id'',true) AND study_group_id=current_setting(''app.study_group_id'',true) AND research_project_id=current_setting(''app.research_project_id'',true)) WITH CHECK (tenant_id=current_setting(''app.tenant_id'',true) AND study_group_id=current_setting(''app.study_group_id'',true) AND research_project_id=current_setting(''app.research_project_id'',true))',t);
 EXECUTE format('REVOKE ALL PRIVILEGES ON rh_analysis.%I FROM aisci_app,PUBLIC',t);
 EXECUTE format('GRANT SELECT,INSERT ON rh_analysis.%I TO aisci_app',t);
 END LOOP; END $$;
REVOKE ALL ON SCHEMA rh_analysis FROM PUBLIC;
GRANT USAGE ON SCHEMA rh_analysis TO aisci_app;
REVOKE ALL ON FUNCTION rh_analysis.parents(),rh_analysis.immutable() FROM PUBLIC,aisci_app;
