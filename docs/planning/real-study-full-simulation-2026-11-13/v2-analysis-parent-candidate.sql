-- Candidate ONLY. Parent applies via the existing guarded migration harness.
-- No startup DDL. Required transaction setting is captured by read-only preflight.
-- @statement
DO $$ BEGIN
 IF md5((SELECT prosrc FROM pg_proc WHERE oid='rh_analysis.parents()'::regprocedure)) <> 'df0eb9cddf4df5d592e07b9ef78f191e' OR current_setting('rh_migration.expected_parents_md5',true) IS NULL OR md5(pg_get_functiondef('rh_analysis.parents()'::regprocedure)) IS DISTINCT FROM current_setting('rh_migration.expected_parents_md5',true) OR position('full-study-simulation-v2' in pg_get_functiondef('rh_analysis.parents()'::regprocedure))>0 THEN RAISE EXCEPTION 'FULL_STUDY_PARENT_FINGERPRINT_REJECTED'; END IF;
END $$;
-- @statement
CREATE OR REPLACE FUNCTION rh_analysis.parents() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; latest integer; review_decision text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id AND p."studyGroupId"=b.study_group_id WHERE b.id=NEW.study_id AND b.tenant_id=NEW.tenant_id AND b.study_group_id=NEW.study_group_id AND b.execution_project_id=NEW.research_project_id) THEN RAISE EXCEPTION 'ANALYSIS_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='plan' THEN
  actor:=NEW.submitted_by;
  IF NEW.definition->>'schemaVersion' = 'full-study-simulation-v2' THEN
   IF NEW.definition->>'protocolVersionId' IS DISTINCT FROM NEW.protocol_version_id OR NEW.definition->>'purposeKey' IS DISTINCT FROM 'synthetic-research-only' OR NEW.definition->>'dataClassification' IS DISTINCT FROM 'synthetic' OR NEW.definition->>'method' IS DISTINCT FROM 'descriptive' OR NEW.definition->>'statisticalUnit' IS DISTINCT FROM 'subject'
    OR NEW.definition->'caseMetadata'->>'schemaVersion' IS DISTINCT FROM 'full-study-simulation-case-v1'
    OR NEW.definition->'caseMetadata'->>'studyId' IS DISTINCT FROM NEW.study_id
    OR NEW.definition->'caseMetadata'->>'protocolVersionId' IS DISTINCT FROM NEW.protocol_version_id
    OR NEW.definition->'caseMetadata'->'scope'->>'tenantId' IS DISTINCT FROM NEW.tenant_id
    OR NEW.definition->'caseMetadata'->'scope'->>'studyGroupId' IS DISTINCT FROM NEW.study_group_id
    OR NEW.definition->'caseMetadata'->'scope'->>'researchProjectId' IS DISTINCT FROM NEW.research_project_id
    OR jsonb_array_length(NEW.definition->'caseMetadata'->'subjects') IS DISTINCT FROM 6
    OR jsonb_array_length(NEW.definition->'caseMetadata'->'visitPlans') IS DISTINCT FROM 5
    OR jsonb_array_length(NEW.definition->'caseMetadata'->'variables') IS DISTINCT FROM 3
    OR jsonb_array_length(NEW.definition->'caseMetadata'->'forms') IS DISTINCT FROM 3
    OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(NEW.definition->'caseMetadata'->'subjects')x)<>6
    OR EXISTS(SELECT 1 FROM (VALUES('MDD_TARGET'),('MDD_NON_TARGET'),('HEALTHY_REFERENCE'))arms(code) WHERE (SELECT count(*) FROM jsonb_array_elements(NEW.definition->'caseMetadata'->'subjects')x WHERE x->>'armCode'=arms.code)<>2)
   THEN RAISE EXCEPTION 'FULL_STUDY_PLAN_INVALID' USING ERRCODE='23514'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.study_protocol_version p JOIN public.study_execution_policy_version ep ON ep.id=p."approvedPolicyVersionId" AND ep."protocolVersionId"=p.id AND ep."tenantId"=p."tenantId" AND ep."studyGroupId"=p."studyGroupId" AND ep."researchProjectId"=p."researchProjectId" WHERE p.id=NEW.protocol_version_id AND p."tenantId"=NEW.tenant_id AND p."studyGroupId"=NEW.study_group_id AND p."researchProjectId"=NEW.research_project_id AND p.status IN('approved','executing','superseded') AND ep.status='approved' AND ep.id=NEW.definition->'caseMetadata'->>'policyId' AND ep."contentHash"=NEW.definition->'caseMetadata'->>'policyHash' AND ep."contentHash"=p."approvedPolicyHash") THEN RAISE EXCEPTION 'FULL_STUDY_POLICY_INVALID' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.definition->'caseMetadata'->'visitPlans')v WHERE NOT EXISTS(SELECT 1 FROM public.visit_plan p WHERE p.id=v->>'id' AND p."tenantId"=NEW.tenant_id AND p."studyGroupId"=NEW.study_group_id AND p."researchProjectId"=NEW.research_project_id AND p."protocolVersionId"=NEW.protocol_version_id AND p.code=v->>'code')) THEN RAISE EXCEPTION 'FULL_STUDY_VISIT_PARENT_INVALID' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.definition->'caseMetadata'->'forms')f WHERE NOT EXISTS(SELECT 1 FROM public.form_version v WHERE v.id=f->>'id' AND v."tenantId"=NEW.tenant_id AND v."studyGroupId"=NEW.study_group_id AND v."researchProjectId"=NEW.research_project_id AND v.status IN('published','locked'))) THEN RAISE EXCEPTION 'FULL_STUDY_FORM_PARENT_INVALID' USING ERRCODE='23514'; END IF;
  ELSE
  IF NEW.definition->>'protocolVersionId' IS DISTINCT FROM NEW.protocol_version_id OR NEW.definition->>'schemaVersion' IS DISTINCT FROM 't15-synthetic-plan-v1' OR NEW.definition->>'purposeKey' IS DISTINCT FROM 'synthetic-research-only' OR NEW.definition->>'dataClassification' IS DISTINCT FROM 'synthetic' OR NEW.definition->>'method' IS DISTINCT FROM 'descriptive' OR NEW.definition->>'statisticalUnit' IS DISTINCT FROM 'subject' THEN RAISE EXCEPTION 'ANALYSIS_PLAN_INVALID' USING ERRCODE='23514'; END IF;
  END IF;
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
  IF (SELECT definition->>'schemaVersion' FROM rh_analysis.plan WHERE id=NEW.plan_id AND tenant_id=NEW.tenant_id)='full-study-simulation-v2' THEN
   IF NEW.manifest->>'schemaVersion'='full-study-simulation-root-v2' THEN
    IF NEW.manifest->>'statisticalUnit' IS DISTINCT FROM 'subject' OR NEW.manifest->>'subjectCount' IS DISTINCT FROM '6' OR jsonb_array_length(NEW.manifest->'observations') IS DISTINCT FROM 18 OR NOT jsonb_typeof(NEW.manifest->'slices')='array' OR NEW.manifest->'caseMetadata' IS DISTINCT FROM (SELECT definition->'caseMetadata' FROM rh_analysis.plan WHERE id=NEW.plan_id AND tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'FULL_STUDY_ROOT_INVALID' USING ERRCODE='23514'; END IF;
   ELSIF NEW.manifest->>'schemaVersion'='full-study-simulation-slice-v2' THEN
    IF NOT EXISTS(SELECT 1 FROM rh_analysis.snapshot root WHERE root.id=NEW.manifest->>'rootSnapshotId' AND root.tenant_id=NEW.tenant_id AND root.study_group_id=NEW.study_group_id AND root.research_project_id=NEW.research_project_id AND root.study_id=NEW.study_id AND root.plan_id=NEW.plan_id AND root.review_id=NEW.review_id AND root.manifest->>'schemaVersion'='full-study-simulation-root-v2' AND root.manifest_hash=NEW.manifest->>'rootManifestHash' AND root.quality_gate->>'status'='released' AND EXISTS(SELECT 1 FROM jsonb_array_elements(root.manifest->'slices')s WHERE s->>'sliceId'=NEW.manifest->>'sliceId' AND s->>'status'='ready' AND s->>'armCode'=NEW.manifest->>'armCode' AND s->>'logicalVisit'=NEW.manifest->>'logicalVisit' AND s->'rows'=NEW.manifest->'rows' AND s->'denominators'=NEW.manifest->'denominators' AND s->'sources'=NEW.manifest->'sources' AND s->'variable'->>'key'=NEW.manifest->'variables'->0->>'key')) OR NEW.manifest->>'statisticalUnit' IS DISTINCT FROM 'subject' OR (NEW.manifest->>'rowCount')::integer NOT BETWEEN 1 AND 2 OR NEW.manifest->>'rowCount' IS DISTINCT FROM NEW.manifest->>'subjectCount' OR jsonb_array_length(NEW.manifest->'rows')<>(NEW.manifest->>'rowCount')::integer OR jsonb_array_length(NEW.manifest->'variables') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'FULL_STUDY_SLICE_PARENT_INVALID' USING ERRCODE='23514'; END IF;
   ELSE RAISE EXCEPTION 'FULL_STUDY_SNAPSHOT_SCHEMA_INVALID' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.manifest->>'studyId' IS DISTINCT FROM NEW.study_id OR NEW.manifest->'scope'->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR NEW.manifest->'scope'->>'studyGroupId' IS DISTINCT FROM NEW.study_group_id OR NEW.manifest->'scope'->>'researchProjectId' IS DISTINCT FROM NEW.research_project_id OR NEW.manifest->'analysisPlan'->>'id' IS DISTINCT FROM NEW.plan_id OR NEW.manifest->'analysisPlan'->>'reviewId' IS DISTINCT FROM NEW.review_id OR NEW.quality_gate->>'reviewedBy' IS DISTINCT FROM NEW.released_by THEN RAISE EXCEPTION 'ANALYSIS_MANIFEST_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account a WHERE a.id=actor AND a."tenantId"=NEW.tenant_id) THEN RAISE EXCEPTION 'ANALYSIS_ACTOR_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
