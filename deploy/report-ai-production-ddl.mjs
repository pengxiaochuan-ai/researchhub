import{readFileSync}from'node:fs';
const exact=(sql,a,b)=>{if(sql.split(a).length!==2)throw Error('REPORT_AI_PRODUCTION_SCHEMA_DRIFT');return sql.replace(a,b);};
export function reportAiProductionStatements(snapshot){
 const expression=snapshot.constraint?.match(/^CHECK \(([\s\S]*)\)$/)?.[1];if(!expression)throw Error('REPORT_AI_PRODUCTION_SCHEMA_DRIFT');
 let fn=snapshot.function;
 fn=exact(fn,' PERFORM pg_advisory_xact_lock',` IF NEW.material_basis_ref LIKE 'rhmabe-%' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:official',0));
  PERFORM pg_advisory_xact_lock(hashtextextended('wp01:tenant:'||NEW.tenant_id,0));
  IF NOT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,'artifact.read') THEN RAISE EXCEPTION 'REPORT_AI_CONSENT_SCOPE_INVALID' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rh-material-ai:'||e.basis_key,0)) FROM rh_asset.material_ai_basis_event e WHERE e.id=NEW.material_basis_ref;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_AI_MATERIAL_BASIS_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NEW.event_kind='grant' AND (NEW.starts_at>clock_timestamp() OR NEW.expires_at<=clock_timestamp() OR NOT rh_asset.material_basis_matches(NEW.tenant_id,NEW.study_group_id,NEW.research_project_id,NEW.study_id,NEW.source_report_id,NEW.source_report_version,NEW.content_hash,NEW.material_basis_ref,NEW.material_basis_hash))
  THEN RAISE EXCEPTION 'REPORT_AI_MATERIAL_BASIS_REQUIRED' USING ERRCODE='23514'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock`);
 fn=exact(fn,"p.artifact_version_id='cmwk3xmxg0009lubifhlxajii'",`(p.artifact_version_id='cmwk3xmxg0009lubifhlxajii' OR (NEW.material_basis_ref LIKE 'rhmabe-%' AND EXISTS(
 SELECT 1 FROM public.research_artifact_version av WHERE av.id=p.artifact_version_id AND av."artifactId"=NEW.asset_id AND av."versionNo"=NEW.version_no AND av."tenantId"=NEW.tenant_id AND av."studyGroupId"=NEW.study_group_id AND av."researchProjectId"=NEW.research_project_id AND av."contentHash"=NEW.content_hash)))`);
 const basis=readFileSync(new URL('./material-ai-basis.sql',import.meta.url),'utf8');
 return[basis,'ALTER TABLE rh_asset.ai_use_consent_event DROP CONSTRAINT report_ai_local_admission',
  `ALTER TABLE rh_asset.ai_use_consent_event ADD CONSTRAINT report_ai_local_admission CHECK (CASE WHEN material_basis_ref LIKE 'rhmabe-%' THEN (rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,account_id) AND actor_account_id=account_id AND expires_at<=starts_at+interval '7 days') ELSE (${expression}) END)`,fn];
}
