/** Scope is fixed by the original Study transaction/RLS. No answers or result values leave SQL. */
export const correctionImpactRepository={async list(tx,s,{studyId,assignmentId,kind,limit,after}){
 const variables=JSON.stringify({assignment:assignmentId});
 if(kind==='analysis')return tx.$queryRaw`
  WITH roots AS (
   SELECT id,plan_id,manifest,created_at FROM rh_analysis.snapshot
   WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId}
    AND manifest->>'schemaVersion' IN ('t15-formal-projection-v1','full-study-simulation-root-v2')
    AND (jsonb_path_exists(manifest,'$.rows[*].cells[*].source.ref ? (@.assignmentId == $assignment)',${variables}::jsonb)
      OR jsonb_path_exists(manifest,'$.observations[*].cells.*.source.ref ? (@.assignmentId == $assignment)',${variables}::jsonb))
    AND id>${after} ORDER BY id LIMIT ${limit}
  )
  SELECT r.id,r.plan_id AS "planId",r.created_at AS "createdAt",r.manifest->>'schemaVersion' AS "schemaVersion",
   jsonb_path_query_array(r.manifest,'$.rows[*].cells[*].source') || jsonb_path_query_array(r.manifest,'$.observations[*].cells.*.source') AS sources,
   (SELECT count(*)::int FROM public.research_method_run m WHERE m."tenantId"=${s.tenantId} AND m."studyGroupId"=${s.studyGroupId} AND m."researchProjectId"=${s.researchProjectId} AND m."inputSummary"->>'studyId'=${studyId}
     AND (m."inputSummary"->>'snapshotId'=r.id OR m."inputSummary"->>'snapshotId' IN (SELECT child.id FROM rh_analysis.snapshot child WHERE child.tenant_id=${s.tenantId} AND child.study_group_id=${s.studyGroupId} AND child.research_project_id=${s.researchProjectId} AND child.study_id=${studyId} AND child.manifest->>'rootSnapshotId'=r.id))) AS "runCount"
  FROM roots r ORDER BY r.id`;
 return tx.$queryRaw`
  WITH roots AS (
   SELECT id,plan_id,manifest FROM rh_analysis.snapshot
   WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId}
    AND manifest->>'schemaVersion' IN ('t15-formal-projection-v1','full-study-simulation-root-v2')
    AND (jsonb_path_exists(manifest,'$.rows[*].cells[*].source.ref ? (@.assignmentId == $assignment)',${variables}::jsonb)
      OR jsonb_path_exists(manifest,'$.observations[*].cells.*.source.ref ? (@.assignmentId == $assignment)',${variables}::jsonb))
  )
  SELECT a.id,a.title,a.status,a."createdAt",v."versionNo",r.id AS "snapshotId",r.plan_id AS "planId",r.manifest->>'schemaVersion' AS "schemaVersion",
   jsonb_path_query_array(r.manifest,'$.rows[*].cells[*].source') || jsonb_path_query_array(r.manifest,'$.observations[*].cells.*.source') AS sources
  FROM roots r JOIN public.research_artifact_source src ON src."tenantId"=${s.tenantId} AND src."studyGroupId"=${s.studyGroupId} AND src."researchProjectId"=${s.researchProjectId} AND src."sourceType"='data_snapshot' AND src."sourceId"=r.id
   JOIN public.research_artifact_version v ON v.id=src."artifactVersionId" AND v."tenantId"=${s.tenantId} AND v."studyGroupId"=${s.studyGroupId} AND v."researchProjectId"=${s.researchProjectId}
   JOIN public.research_artifact a ON a.id=v."artifactId" AND a."tenantId"=${s.tenantId} AND a."studyGroupId"=${s.studyGroupId} AND a."researchProjectId"=${s.researchProjectId} AND a."currentVersionNo"=v."versionNo" AND a."typeKey"='analysis_report' AND a."deletedAt" IS NULL
  WHERE a.id LIKE 'rh-formal-report-%' AND a.id>${after} ORDER BY a.id LIMIT ${limit}`;
}};
