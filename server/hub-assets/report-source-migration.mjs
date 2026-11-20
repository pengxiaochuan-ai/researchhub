import {hubAssetMigration} from './migration.mjs';
import {REPORT_SCHEMA} from '../research-analysis/t17-report-content.mjs';

const role=value=>{if(typeof value!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value))throw Error('HUB_REPORT_ROLE_INVALID');return '"'+value+'"';};
// Only the exact current T17 chain is supported. The SQL predicate establishes
// existence and fixed identity, not scientific currency. Every server delivery
// must additionally verify report_bundle with the native pure verifier in the
// same transaction, retaining these locks through delivery/target submission.
export function hubReportSourceMigration({ownerRole,appRole}){
 const owner=role(ownerRole),app=role(appRole),statements=[];
 const scope=alias=>`${alias}."tenantId"=e.tenant_id AND ${alias}."studyGroupId"=e.source_group_id AND ${alias}."researchProjectId"=e.source_project_id`;
 const analysisScope=alias=>`${alias}.tenant_id=e.tenant_id AND ${alias}.study_group_id=e.source_group_id AND ${alias}.research_project_id=e.source_project_id`;
 const chain=`FROM rh_asset.version_policy p
 JOIN public.research_artifact a ON a.id=p.source_bindings->0->>'id' AND ${scope('a')}
 JOIN public.research_artifact_version v ON v."artifactId"=a.id AND v."versionNo"=1 AND ${scope('v')}
 JOIN public.research_method_run r ON r.id=v."contentBlocks"->0->>'runId' AND ${scope('r')}
 JOIN rh_analysis.snapshot s ON s.id=r."inputSummary"->>'snapshotId' AND ${analysisScope('s')}
 JOIN rh_analysis.plan n ON n.id=s.plan_id AND ${analysisScope('n')}
 JOIN public.study_protocol_version pv ON pv.id=n.protocol_version_id AND pv.id=n.definition->>'protocolVersionId' AND ${scope('pv')}
 JOIN public.study_execution_policy_version ep ON ep.id=pv."approvedPolicyVersionId" AND ep."protocolVersionId"=pv.id AND ${scope('ep')}
 JOIN LATERAL(SELECT z.* FROM public.research_artifact_review z WHERE z."artifactId"=a.id AND z."versionId"=v.id AND ${scope('z')} ORDER BY z."createdAt" DESC,z.id DESC LIMIT 1) ar ON true
 JOIN LATERAL(SELECT z.* FROM public.research_method_review z WHERE z."runId"=r.id AND ${scope('z')} ORDER BY z.version DESC LIMIT 1) mr ON true
 JOIN LATERAL(SELECT z.* FROM rh_analysis.plan_review z WHERE z.plan_id=n.id AND ${analysisScope('z')} ORDER BY z.sequence DESC LIMIT 1) pr ON true
 JOIN rh_research.study_binding b ON b.id=s.study_id AND b.tenant_id=e.tenant_id AND b.study_group_id=e.source_group_id AND b.execution_project_id=e.source_project_id
 JOIN rh_research.project_intent source_intent ON source_intent.id=b.project_intent_id AND source_intent.tenant_id=e.tenant_id
 JOIN public.account source_owner ON source_owner.id=e.owner_id AND source_owner."tenantId"=e.tenant_id
 WHERE p.asset_id=e.asset_id AND p.version_no=e.version_no AND p.source_kind='artifact'
 AND jsonb_typeof(p.source_bindings)='array' AND jsonb_array_length(p.source_bindings)=1
 AND p.source_bindings=jsonb_build_array(jsonb_build_object('kind','artifact','id',a.id,'version',1,'contentHash',v."contentHash"))
 AND a.id LIKE 'rh-formal-report-%' AND a."typeKey"='analysis_report' AND a.status='released' AND a."deletedAt" IS NULL
 AND a."ownerAccountId"=e.owner_id AND a."createdBy"=e.owner_id AND a."currentVersionNo"=1 AND a."approvedVersionNo"=1 AND a."releasedVersionNo"=1
 AND source_owner.status='active' AND source_owner.role IN ('researcher','tenant_admin') AND source_owner."isTenantAdmin"=(source_owner.role='tenant_admin')
 AND EXISTS(SELECT 1 FROM public.tenant_feature_entitlement feature WHERE feature."tenantId"=e.tenant_id AND feature."featureKey"='study_operations' AND feature.enabled=true)
 AND (source_owner.role='tenant_admin' AND source_owner."isTenantAdmin"=true OR EXISTS(
 SELECT 1 FROM public.study_group_membership source_member
 JOIN public.permission_role source_role ON source_role.id=source_member."roleId" AND source_role."tenantId"=e.tenant_id
 JOIN public.research_project_membership source_project_member ON source_project_member."tenantId"=e.tenant_id AND source_project_member."studyGroupId"=e.source_group_id AND source_project_member."researchProjectId"=e.source_project_id AND source_project_member."accountId"=e.owner_id
 WHERE source_member."tenantId"=e.tenant_id AND source_member."studyGroupId"=e.source_group_id AND source_member."accountId"=e.owner_id
 AND source_member.status='active' AND source_project_member.status='active' AND source_role.status='active'
 AND jsonb_typeof(source_role."menuPermissions")='array' AND jsonb_typeof(source_role."buttonPermissions")='array'
 AND source_role."menuPermissions"?'workbench' AND source_role."menuPermissions"?'artifacts'
 AND source_role."buttonPermissions"?'data.analyze' AND source_role."buttonPermissions"?'artifact.read'))
 AND v."contentHash"=e.content_hash AND encode(sha256(convert_to(v."contentMd",'UTF8')),'hex')=v."contentHash"
 AND jsonb_array_length(v."contentBlocks")=1 AND v."contentBlocks"->0->>'schemaVersion'='${REPORT_SCHEMA}'
 AND ar.conclusion='approved' AND length(trim(ar.comment))>0 AND r."skillKey"='descriptive-statistics' AND r.status='completed' AND r."reviewStatus"='confirmed'
 AND mr.conclusion='confirmed' AND length(trim(mr.comment))>0 AND pr.decision='approved' AND pr.id=s.review_id
 AND encode(sha256(convert_to(rh_hub_asset.canonical_json(n.definition),'UTF8')),'hex')=n.content_hash
 AND encode(sha256(convert_to(rh_hub_asset.canonical_json(s.manifest),'UTF8')),'hex')=s.manifest_hash
 AND pv."acceptanceFixture"=false AND pv.status IN ('executing','superseded') AND ep.status='approved' AND ep."contentHash"=pv."approvedPolicyHash"
 AND n.study_id=s.study_id AND pr.study_id=s.study_id AND r."inputSummary"->>'studyId'=s.study_id
 AND v."contentBlocks"->0->'analysisBasis'->>'studyId'=s.study_id
 AND v."contentBlocks"->0->'analysisBasis'->>'snapshotId'=s.id
 AND s.quality_gate->>'id'=s.quality_gate_id AND s.quality_gate->>'version'='1'`;
 statements.push(`CREATE OR REPLACE FUNCTION rh_hub_asset.report_basic_current(e rh_hub_asset.entry) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 ${chain}) $$`);
 const originals=hubAssetMigration({ownerRole,appRole});
 const original=prefix=>{const value=originals.find(x=>x.startsWith(prefix));if(!value)throw Error('HUB_REPORT_BASE_MIGRATION_CHANGED');return value.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');};
 const oldFamily="p.source_kind='author' AND p.source_bindings='[]'::jsonb";
 const current=original('CREATE FUNCTION rh_hub_asset.source_current(');
 if(!current.includes(oldFamily))throw Error('HUB_REPORT_BASE_SOURCE_CHANGED');
 statements.push(current.replace(oldFamily,`((${oldFamily}) OR (p.source_kind='artifact' AND rh_hub_asset.report_basic_current(e)))`));
 const descriptor=`jsonb_build_object('entryId',e.id,'version',e.version_no,'contentHash',e.content_hash)`;
 let read=original('CREATE FUNCTION rh_hub_asset.read_source(');
 if(!read.includes('content text; actor text:='))throw Error('HUB_REPORT_BASE_READ_CHANGED');
 read=read.replace('content text; actor text:=','content text; report_binding jsonb; report_study text; actor text:=');
 read=read.replace("IF purpose='probe' THEN",`SELECT p.source_bindings->0,v."contentBlocks"->0->'analysisBasis'->>'studyId' INTO report_binding,report_study FROM rh_asset.version_policy p JOIN public.research_artifact_version v ON v."artifactId"=p.source_bindings->0->>'id' AND v."versionNo"=1 AND ${scope('v')} WHERE p.asset_id=e.asset_id AND p.version_no=e.version_no AND p.source_kind='artifact'; IF purpose='probe' THEN`);
 read=read.replaceAll(descriptor,descriptor+`||CASE WHEN report_binding IS NOT NULL THEN jsonb_build_object('sourceType','fixed-report','studyId',report_study,'reportId',report_binding->>'id','reportVersion',1,'reportHash',report_binding->>'contentHash') ELSE '{}'::jsonb END`);
 read=read.replace("IF purpose='cite' THEN RETURN","IF purpose='cite' OR report_binding IS NOT NULL THEN RETURN");
 statements.push(read);
 const rows=(table,alias,condition,order=`${alias}.id`)=>`(SELECT coalesce(jsonb_agg(to_jsonb(${alias}) ORDER BY ${order}),'[]'::jsonb) FROM public.${table} ${alias} WHERE ${scope(alias)} AND ${condition})`;
 const bySubjects=alias=>`${alias}."subjectId"=ANY(subject_ids)`;
 const byVisits=alias=>`${alias}."subjectVisitId"=ANY(visit_ids)`;
 const concerns=alias=>`${alias}."acceptanceFixture"=false AND (${byVisits(alias)} OR ${alias}."subjectVisitId" IS NULL AND (${alias}."subjectId"=ANY(subject_ids) OR ${alias}."subjectId" IS NULL))`;
 statements.push(`CREATE OR REPLACE FUNCTION rh_hub_asset.report_bundle(entry_key text,purpose text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE e rh_hub_asset.entry; base jsonb; selected record; subject_ids text[]; visit_ids text[]; assignment_ids text[]; response_ids text[]; form_ids text[]; protocol_id text; result jsonb;
 BEGIN
 base:=rh_hub_asset.read_source(entry_key,purpose);
 IF base IS NULL OR base->>'sourceType' IS DISTINCT FROM 'fixed-report' THEN RETURN NULL; END IF;
 SELECT * INTO e FROM rh_hub_asset.entry WHERE id=entry_key AND tenant_id=current_setting('app.tenant_id',true) AND hub_key='lingshu-xinyu';
 SELECT a.id AS report_id,v.id AS report_version_id,r.id AS run_id,s.id AS snapshot_id,n.id AS plan_id,n.definition INTO selected ${chain};
 IF selected.report_id IS NULL THEN RETURN NULL; END IF;
 -- plan serialization precedes native projection locks, exactly as T15 assertCurrent.
 PERFORM pg_advisory_xact_lock(hashtextextended(e.tenant_id||':t15-plan:'||selected.plan_id,0));
 protocol_id:=selected.definition->>'protocolVersionId';
 SELECT array_agg(value ORDER BY value) INTO subject_ids FROM jsonb_array_elements_text(selected.definition->'subjectIds');
 SELECT array_agg(DISTINCT value->>'formVersionId' ORDER BY value->>'formVersionId') INTO form_ids FROM jsonb_array_elements(selected.definition->'variables');
 IF coalesce(cardinality(subject_ids),0)<>3 OR protocol_id IS NULL OR coalesce(cardinality(form_ids),0)<1 THEN RETURN NULL; END IF;
 -- capture scope: project and protocol SHARE locks precede every parent lock.
 PERFORM z.id FROM public.research_project z WHERE z.id=e.source_project_id AND z."tenantId"=e.tenant_id AND z."studyGroupId"=e.source_group_id FOR SHARE;
 PERFORM z.id FROM public.study_protocol_version z WHERE z.id=protocol_id AND ${scope('z')} FOR SHARE;
 -- sorted subjects (the native capture and migration writer serialization key).
 PERFORM z.id FROM public.subject z WHERE z.id=ANY(subject_ids) AND ${scope('z')} ORDER BY z.id FOR UPDATE;
 -- enrollments: no caller supplied subject or enrollment identifiers.
 PERFORM z.id FROM public.study_enrollment z WHERE ${bySubjects('z')} AND z."protocolVersionId"=protocol_id AND ${scope('z')} ORDER BY z."subjectId",z.id FOR UPDATE;
 -- visits: resolve only the selected protocol visit code under locked parents.
 PERFORM z.id FROM public.subject_visit z JOIN public.visit_plan vp ON vp.id=z."visitPlanId" AND ${scope('vp')} WHERE ${bySubjects('z')} AND z."protocolVersionId"=protocol_id AND vp.code=selected.definition->>'visitCode' AND ${scope('z')} ORDER BY z."subjectId",z.id FOR UPDATE OF z;
 SELECT array_agg(z.id ORDER BY z.id) INTO visit_ids FROM public.subject_visit z JOIN public.visit_plan vp ON vp.id=z."visitPlanId" AND ${scope('vp')} WHERE ${bySubjects('z')} AND z."protocolVersionId"=protocol_id AND vp.code=selected.definition->>'visitCode' AND ${scope('z')};
 -- assignments: current response/review writers use these same capture parents.
 PERFORM z.id FROM public.form_assignment z WHERE ${byVisits('z')} AND z."formVersionId"=ANY(form_ids) AND ${scope('z')} ORDER BY z.id FOR UPDATE;
 SELECT array_agg(z.id ORDER BY z.id) INTO assignment_ids FROM public.form_assignment z WHERE ${byVisits('z')} AND z."formVersionId"=ANY(form_ids) AND ${scope('z')};
 SELECT array_agg(z.id ORDER BY z.id) INTO response_ids FROM public.form_response z WHERE z."assignmentId"=ANY(assignment_ids) AND ${scope('z')};
 -- selected fixed forms: native readT17Presentation locks sorted forms before Run/Artifact.
 PERFORM z.id FROM public.form_version z WHERE z.id=ANY(form_ids) AND ${scope('z')} ORDER BY z.id FOR SHARE;
 -- run and fixed report: match current native T17 read lock order.
 PERFORM z.id FROM public.research_method_run z WHERE z.id=selected.run_id AND ${scope('z')} FOR SHARE;
 PERFORM z.id FROM public.research_artifact z WHERE z.id=selected.report_id AND ${scope('z')} FOR UPDATE;
 -- Re-read all mutable rows after waiting. A stale chain never produces a bundle.
 IF rh_hub_asset.read_source(entry_key,purpose) IS DISTINCT FROM base THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('actorId',current_setting('app.account_id',true),'scope',jsonb_build_object('tenantId',e.tenant_id,'studyGroupId',e.source_group_id,'researchProjectId',e.source_project_id),'studyId',s.study_id,'report',to_jsonb(a),'reportVersion',to_jsonb(v),'reportReview',to_jsonb(ar),'run',to_jsonb(r),'methodReview',to_jsonb(mr),'plan',to_jsonb(n),'planReview',to_jsonb(pr),'snapshot',to_jsonb(s),
 'protocol',(SELECT to_jsonb(z) FROM public.study_protocol_version z WHERE z.id=protocol_id AND ${scope('z')}),
 'policy',(SELECT to_jsonb(z) FROM public.study_execution_policy_version z JOIN public.study_protocol_version pv ON pv."approvedPolicyVersionId"=z.id AND ${scope('pv')} WHERE pv.id=protocol_id AND ${scope('z')}),
 'sources',${rows('research_artifact_source','z','z."artifactVersionId"=v.id')},
 'subjects',${rows('subject','z','z.id=ANY(subject_ids)')},
 'enrollments',${rows('study_enrollment','z',bySubjects('z')+' AND z."protocolVersionId"=protocol_id')},
 'visits',${rows('subject_visit','z','z.id=ANY(visit_ids)')},
 'visitPlans',${rows('visit_plan','z','z."protocolVersionId"=protocol_id')},
 'visitRequirements',${rows('visit_requirement','z','z."visitPlanId" IN (SELECT vp.id FROM public.visit_plan vp WHERE vp."protocolVersionId"=protocol_id AND '+scope('vp')+')')},
 'assignments',${rows('form_assignment','z','z.id=ANY(assignment_ids)')},
 'responses',${rows('form_response','z','z.id=ANY(response_ids)')},
 'revisions',${rows('form_response_revision','z','z."responseId"=ANY(response_ids) AND z.id IN (SELECT fr."currentRevisionId" FROM public.form_response fr WHERE fr.id=ANY(response_ids) AND '+scope('fr')+')')},
 'responseReviews',${rows('form_response_review_event','z','z."responseId"=ANY(response_ids)')},
 'formVersions',${rows('form_version','z','z.id=ANY(form_ids)')},
 'participationEvents',${rows('study_participation_event','z',bySubjects('z')+' AND z."protocolVersionId"=protocol_id','z."subjectId",z.sequence')},
 'queries',${rows('data_query','q',concerns('q'))},
 'deviations',${rows('protocol_deviation','q',concerns('q'))}) INTO result ${chain}
 AND a.id=selected.report_id AND v.id=selected.report_version_id AND r.id=selected.run_id AND s.id=selected.snapshot_id AND n.id=selected.plan_id AND n.definition=selected.definition;
 IF result IS NULL THEN RETURN NULL; END IF;
 RETURN result;
 END $$`);
 for(const signature of ['report_basic_current(rh_hub_asset.entry)','source_current(rh_hub_asset.entry)','read_source(text,text)','report_bundle(text,text)']){
  statements.push(`ALTER FUNCTION rh_hub_asset.${signature} OWNER TO ${owner}`);
  statements.push(`REVOKE ALL ON FUNCTION rh_hub_asset.${signature} FROM PUBLIC`);
 }
 statements.push(`GRANT EXECUTE ON FUNCTION rh_hub_asset.read_source(text,text) TO ${app}`);
 statements.push(`GRANT EXECUTE ON FUNCTION rh_hub_asset.report_bundle(text,text) TO ${app}`);
 return statements;
}
