-- Candidate rollback ONLY; never deletes data. Stop if any v2 record exists.
-- @statement
DO $$ BEGIN
 IF md5(pg_get_functiondef('rh_analysis.parents()'::regprocedure)) IS DISTINCT FROM current_setting('rh_migration.expected_v2_parents_md5',true) OR position('full-study-simulation-v2' in pg_get_functiondef('rh_analysis.parents()'::regprocedure))=0 THEN RAISE EXCEPTION 'FULL_STUDY_ROLLBACK_FINGERPRINT_REJECTED'; END IF;
 IF EXISTS(SELECT 1 FROM rh_analysis.plan WHERE definition->>'schemaVersion'='full-study-simulation-v2') THEN RAISE EXCEPTION 'FULL_STUDY_ROLLBACK_HAS_V2_DATA'; END IF;
END $$;
-- @statement
CREATE OR REPLACE FUNCTION rh_analysis.parents() RETURNS trigger LANGUAGE plpgsql AS $$
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
