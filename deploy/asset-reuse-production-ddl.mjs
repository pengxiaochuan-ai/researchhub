import{createHash}from'node:crypto';
const expected='75fe714af06d08b0950d3be1054d1f78101c5749f4b9c19ddf8dabd6c98b2d0b';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function assetReuseProductionStatements(snapshot){
 if(sha(JSON.stringify(snapshot))!==expected)throw Error('ASSET_REUSE_BASELINE_DRIFT');
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('ASSET_REUSE_SCHEMA_DRIFT');return s.replace(a,b);};
 let scope=snapshot.find(x=>x.name==='business_scope_matches').definition;
 scope=once(scope,"AND a.status='active' AND n.status='active'",`AND a.role IN ('researcher','tenant_admin') AND a."isTenantAdmin"=(a.role='tenant_admin') AND a.status='active' AND n.status='active'`);
 let fact=snapshot.find(x=>x.name==='check_detail_fact').definition;
 const tuple="encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex')";
 const old="(business AND (NOT coalesce(target_allowed,false) OR t.\"idempotencyKey\" IS DISTINCT FROM 'rhab-reuse:'||"+tuple+")) THEN RAISE EXCEPTION 'ASSET_COPY_TARGET_INVALID'";
 const target=`EXISTS(SELECT 1 FROM rh_asset.asset_registry rr JOIN rh_asset.version_policy vp ON vp.asset_id=rr.asset_id AND vp.version_no=1 JOIN public.research_artifact_version av ON av.id=vp.artifact_version_id AND av."artifactId"=rr.asset_id AND av."versionNo"=1 WHERE rr.asset_id=t.id AND rr.tenant_id=NEW.tenant_id AND rr.study_group_id=NEW.study_group_id AND rr.research_project_id=NEW.target_project_id AND rr.owner_account_id=NEW.actor_account_id AND rr.asset_kind=r.asset_kind AND rr.working_version_no=1 AND rr.working_state='draft' AND rr.deleted_at IS NULL AND av."tenantId"=rr.tenant_id AND av."studyGroupId"=rr.study_group_id AND av."researchProjectId"=rr.research_project_id AND vp.source_kind='artifact' AND vp.source_bindings=jsonb_build_array(jsonb_build_object('kind','artifact','id',NEW.asset_id,'version',NEW.version_no,'contentHash',NEW.source_hash)) AND vp.content_hash=NEW.source_hash AND av."contentHash"=vp.content_hash AND encode(sha256(convert_to(av."contentMd",'UTF8')),'hex')=vp.content_hash)`;
 fact=once(fact,old,`(business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM 'rh-research-asset:business:v1:'||t.id OR t."creationRequestHash" IS DISTINCT FROM ${tuple} OR t."currentVersionNo"<>1 OR NOT ${target})) THEN RAISE EXCEPTION 'ASSET_COPY_TARGET_INVALID'`);
 return[scope,fact];
}
