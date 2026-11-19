// Metadata only. Every returned scope is independently authorized on the app
// connection before any catalog body is read. Existing creation scopes stay bound.
export async function readAssetOverviewScopes(tx,tenantId){
 const rows=await tx.$queryRawUnsafe(`SELECT "studyGroupId","researchProjectId",bool_or(bound) AS bound FROM (
 SELECT study_group_id AS "studyGroupId",execution_project_id AS "researchProjectId",true AS bound
 FROM rh_research.study_binding WHERE tenant_id=$1
 UNION ALL
 SELECT study_group_id AS "studyGroupId",research_project_id AS "researchProjectId",false AS bound
 FROM rh_asset.asset_registry WHERE tenant_id=$1
 ) scopes GROUP BY "studyGroupId","researchProjectId" ORDER BY "researchProjectId","studyGroupId"`,tenantId);
 return rows.map(r=>({scope:{studyGroupId:r.studyGroupId,researchProjectId:r.researchProjectId},canCreate:r.bound===true}));
}
