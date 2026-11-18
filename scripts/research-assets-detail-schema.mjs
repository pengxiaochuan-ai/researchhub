// D02 only, never called by service startup. Default is prediction + rollback.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildA02Manifest,assertA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {accessGuardStatements,verifyAccessGuardReceipt} from './research-assets-access-schema.mjs';
import {loadCatalogTarget,catalogDefinitionFingerprint,readCatalogProtectedSnapshot,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {verifyAssetPublicBaseline} from './research-assets-public-baseline.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export const DETAIL_SCHEMA_ACTION='research_assets_detail_schema_v1_20261113';
export const DETAIL_TABLES=['asset_comment_event','asset_reuse_record'];
export function assertDetailMigrationActor(account){if(account?.role!=='tenant_admin'||!Number.isSafeInteger(account.authVersion)||account.authVersion<0)throw Error('ASSET_DETAIL_ADMIN_REQUIRED');}
export function detailSchemaStatements(ids){
 const m=buildA02Manifest(ids),quote=s=>"'"+s.replaceAll("'","''")+"'";
 const limit=`CREATE FUNCTION rh_asset.detail_version_limit(k text,o text,t text) RETURNS integer LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT CASE WHEN o NOT IN (${quote(ids.owner)},${quote(ids.admin)}) OR t NOT IN ('protocol','dataset','instrument','analysis','publication') THEN 0 WHEN k='rh-research-asset:catalog-20261112:' || CASE o WHEN ${quote(ids.owner)} THEN 'owner' ELSE 'admin' END || ':' || t THEN 8 ${m.assets.map(x=>`WHEN k=${quote(x.key)} AND o=${quote(x.ownerAccountId)} AND t=${quote(x.kind)} THEN ${x.maxVersions}`).join(' ')} ELSE 0 END $$`;
 const original=accessGuardStatements(ids)[0],needle=`  OR a."idempotencyKey"<>('rh-research-asset:catalog-20261112:' || CASE NEW.owner_account_id WHEN '${ids.owner}' THEN 'owner' ELSE 'admin' END || ':' || NEW.asset_kind)`;
 if(!original.includes(needle))throw Error('ASSET_DETAIL_BASE_SOURCE_DRIFT');
 const guard=original.replace(needle,'  OR rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)=0 OR NEW.working_version_no>rh_asset.detail_version_limit(a."idempotencyKey",NEW.owner_account_id,NEW.asset_kind)');
 const tokens={PROJECT_ID:ids.project,COMMENT_KEYS:m.comments.map(x=>quote(x.key)).join(','),COPY_KEYS:m.assets.filter(x=>x.mode==='copy').map(x=>quote(x.key)).join(','),APPLICATION_KEYS:m.applications.map(x=>quote(x.key)).join(',')};
 const sql=readFileSync(new URL('../server/research-assets/detail-v1.sql',import.meta.url),'utf8').replace(/\{\{([A-Z_]+)\}\}/g,(_m,k)=>tokens[k]??(()=>{throw Error('ASSET_DETAIL_TOKEN_REJECTED');})());
 const statements=[limit,guard,'ALTER TABLE rh_asset.asset_registry DROP CONSTRAINT asset_registry_tenant_id_study_group_id_research_project_i_key1',...sql.split(/^-- statement\s*$/m).map(s=>s.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').trim()).filter(Boolean),'REVOKE ALL ON FUNCTION rh_asset.detail_version_limit(text,text,text) FROM PUBLIC','GRANT EXECUTE ON FUNCTION rh_asset.detail_version_limit(text,text,text) TO aisci_app'];
 if(statements.some(s=>/\{\{|SECURITY\s+DEFINER|ALTER\s+ROLE|TRUNCATE|GRANT\s+ALL|\b(?:ALTER TABLE|CREATE TABLE|DROP TABLE)\s+public\./i.test(s)))throw Error('ASSET_DETAIL_SCHEMA_REJECTED');
 return statements;
}
export const detailSchemaSourceHash=ids=>assetDigest(detailSchemaStatements(ids));
async function executeStatements(tx,statements){for(const[index,sql]of statements.entries())try{await tx.$executeRawUnsafe(sql);}catch(e){e.message='D02 statement '+index+': '+String(e.message).trim();throw e;}}
export async function verifyDetailSchemaReceipt(tx,ids,currentFingerprint){
 const r=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,action:DETAIL_SCHEMA_ACTION,target:'rh_asset'},orderBy:{createdAt:'desc'},select:{meta:true}});
 if(!r?.meta||r.meta.syntheticOnly!==true||r.meta.sourceHash!==detailSchemaSourceHash(ids))return false;
 const original=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}});
 if(!original?.meta||!await verifyAccessGuardReceipt(tx,ids,original.meta.fingerprint,r.meta.beforeFingerprint))return false;
 if(r.meta.fingerprint===currentFingerprint)return true;
 const {verifyDetailPurposeReceipt}=await import('./research-assets-detail-purpose-schema.mjs');
 if(await verifyDetailPurposeReceipt(tx,ids,r.meta.fingerprint,currentFingerprint))return true;
 const {verifyReportContextSchemaReceipt}=await import('./research-assets-report-context-schema.mjs');
 if(await verifyReportContextSchemaReceipt(tx,ids,r.meta.fingerprint,currentFingerprint))return true;
 const {verifyReportContextScopeReceipt}=await import('./research-assets-report-context-scope-schema.mjs');
 return verifyReportContextScopeReceipt(tx,ids);
}
export async function readAssetDetailProtectedSnapshot(tx,ids){
 const old=await readCatalogProtectedSnapshot(tx,ids),assets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:catalog-20261112:'}},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
 const rows=await tx.$queryRawUnsafe('SELECT to_jsonb(r) AS registry,(SELECT jsonb_agg(p ORDER BY version_no) FROM rh_asset.version_policy p WHERE p.asset_id=r.asset_id) AS policies,(SELECT jsonb_agg(e ORDER BY asset_revision) FROM rh_asset.asset_event e WHERE e.asset_id=r.asset_id) AS events,(SELECT jsonb_agg(x ORDER BY request_id) FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id) AS access FROM rh_asset.asset_registry r JOIN public.research_artifact a ON a.id=r.asset_id WHERE a."tenantId"=$1 AND a."idempotencyKey" LIKE $2 ORDER BY r.asset_id',ids.tenant,'rh-research-asset:catalog-20261112:%');
 return{oldAssetsHash:old.oldAssetsHash,rolesHash:old.roleHash,a01Hash:assetDigest(JSON.stringify(assets,(_k,v)=>typeof v==='bigint'?v.toString():v)),a01FactsHash:assetDigest(rows)};
}
export async function executeDetailSchema({apply=false}={}){
 const {env,ids}=loadCatalogTarget();if((await assertFixtureTarget(env)).databaseName!=='wp01_test_full_baseline')throw Error('ASSET_DETAIL_TARGET_REJECTED');
 const sourceHash=detailSchemaSourceHash(ids);
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('wp01:official',0))");await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','wp01:tenant:'+ids.tenant);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:a01:catalog-schema',0))");assertDetailMigrationActor(await bindCatalogContext(tx,ids,ids.admin));
  const beforeFingerprint=await catalogDefinitionFingerprint(tx);
  const existing=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:DETAIL_SCHEMA_ACTION,target:'rh_asset'},select:{meta:true}});
  if(existing){if(!await verifyDetailSchemaReceipt(tx,ids,beforeFingerprint))throw Error('ASSET_DETAIL_SCHEMA_DRIFT');return{action:'verified',fingerprint:beforeFingerprint,sourceHash,syntheticOnly:true};}
  const base=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}});
  if(!base?.meta||!await verifyAccessGuardReceipt(tx,ids,base.meta.fingerprint,beforeFingerprint))throw Error('ASSET_DETAIL_BASE_RECEIPT_REQUIRED');
  const before=await readAssetDetailProtectedSnapshot(tx,ids),publicBefore=await verifyAssetPublicBaseline(tx,{tenantId:ids.tenant,expectedHash:base.meta.protectedSnapshot.publicDefinitionHash});
  const statements=detailSchemaStatements(ids);
  await tx.$executeRawUnsafe('SAVEPOINT detail_schema_prediction');await executeStatements(tx,statements);const predicted=await catalogDefinitionFingerprint(tx);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT detail_schema_prediction');
  if(await catalogDefinitionFingerprint(tx)!==beforeFingerprint)throw Error('ASSET_DETAIL_PREDICTION_ROLLBACK_DRIFT');
  if(!apply)return{action:'ready_not_applied',sourceHash,predictedFingerprint:predicted,beforeFingerprint,protectedUnchanged:true,syntheticOnly:true};
  await executeStatements(tx,statements);const fingerprint=await catalogDefinitionFingerprint(tx);if(fingerprint!==predicted)throw Error('ASSET_DETAIL_SCHEMA_DRIFT');
  const after=await readAssetDetailProtectedSnapshot(tx,ids),publicAfter=await verifyAssetPublicBaseline(tx,{tenantId:ids.tenant,expectedHash:base.meta.protectedSnapshot.publicDefinitionHash});if(assetDigest(before)!==assetDigest(after)||publicBefore.fullDefinitionHash!==publicAfter.fullDefinitionHash)throw Error('ASSET_DETAIL_PROTECTED_DRIFT');
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:DETAIL_SCHEMA_ACTION,target:'rh_asset',meta:{beforeFingerprint,fingerprint,sourceHash,syntheticOnly:true,protectedSnapshot:after,publicHash:publicAfter.fullDefinitionHash,approval:'D02/AU/AF/AI confirmed 2026-11-13; Q02 tables and exact new keys; old purposes unchanged'}}});
  return{action:'applied',fingerprint,sourceHash,beforeFingerprint,syntheticOnly:true,protectedUnchanged:true,publicUnchanged:true,rolesUnchanged:true};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||!['--check','--apply'].includes(process.argv[2]))throw Error('EXPLICIT_DETAIL_SCHEMA_REQUIRED');
 executeDetailSchema({apply:process.argv[2]==='--apply'}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{process.stderr.write((e.code??e.message)+'\n');process.exitCode=1;});
}
