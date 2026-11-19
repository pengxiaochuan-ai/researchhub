import{assetProductionStatements}from'./asset-production-ddl.mjs';
export function commentParentProductionStatements(assetBaseline,constraints){
 const statements=[assetProductionStatements(assetBaseline).at(-1)];
 for(const name of ['asset_comment_event_check','asset_comment_event_parent_revision_check']){
  const matches=constraints.filter(c=>c.name===name),old=matches[0]?.definition?.match(/^CHECK \(([\s\S]*)\)$/)?.[1];if(matches.length!==1||!old)throw Error('COMMENT_PARENT_SCHEMA_DRIFT');
  const parent="((parent_comment_id IS NULL AND parent_revision IS NULL) OR (parent_comment_id IS NOT NULL AND parent_revision IS NOT NULL AND parent_revision>0 AND parent_comment_id<>comment_id))";
  statements.push('ALTER TABLE rh_asset.asset_comment_event DROP CONSTRAINT '+name,`ALTER TABLE rh_asset.asset_comment_event ADD CONSTRAINT ${name} CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id) AND ${parent}) ELSE (${old}) END)`);
 }
 return statements;
}
