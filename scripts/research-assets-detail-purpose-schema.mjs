import {fileURLToPath} from 'node:url';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {assertCatalogIds,loadCatalogTarget,catalogDefinitionFingerprint,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertDetailMigrationActor,verifyDetailSchemaReceipt,readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export const DETAIL_PURPOSE_ACTION='research_assets_detail_purposes_v1_20261113';
export function detailPurposeStatements(ids){
 assertCatalogIds(ids);
 return [
 "ALTER TABLE rh_asset.access_request DROP CONSTRAINT access_request_requested_actions_check",
 "ALTER TABLE rh_asset.access_request ADD CONSTRAINT access_request_requested_actions_check CHECK(cardinality(requested_actions) BETWEEN 1 AND 8 AND requested_actions <@ ARRAY['read_body','cite','comment','download','ai','derive','apply','export']::text[])",
 `CREATE FUNCTION rh_asset.check_detail_access_purposes() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,rh_asset AS $$
 DECLARE k text; r rh_asset.asset_registry%ROWTYPE; v rh_asset.version_policy%ROWTYPE; detail boolean;
 BEGIN
 SELECT * INTO r FROM rh_asset.asset_registry WHERE asset_id=NEW.asset_id AND tenant_id=NEW.tenant_id AND study_group_id=NEW.study_group_id AND research_project_id=NEW.research_project_id;
 SELECT "idempotencyKey" INTO k FROM public.research_artifact WHERE id=NEW.asset_id AND "tenantId"=NEW.tenant_id AND "studyGroupId"=NEW.study_group_id AND "researchProjectId"=NEW.research_project_id;
 SELECT * INTO v FROM rh_asset.version_policy WHERE asset_id=NEW.asset_id AND version_no=NEW.version_no;
 IF r.asset_id IS NULL OR v.asset_id IS NULL OR k IS NULL THEN RAISE EXCEPTION 'ASSET_PURPOSE_PARENT_INVALID'; END IF;
 detail:=rh_asset.detail_version_limit(k,r.owner_account_id,r.asset_kind) IN (2,4);
 IF cardinality(NEW.requested_actions)<>(SELECT count(DISTINCT x) FROM unnest(NEW.requested_actions) AS x) OR cardinality(NEW.approved_actions)<>(SELECT count(DISTINCT x) FROM unnest(NEW.approved_actions) AS x) THEN RAISE EXCEPTION 'ASSET_PURPOSE_INVALID'; END IF;
 IF NOT detail AND (cardinality(NEW.requested_actions)>2 OR NOT NEW.requested_actions <@ ARRAY['read_body','cite']::text[]) THEN RAISE EXCEPTION 'ASSET_LEGACY_PURPOSE_INVALID'; END IF;
 IF detail AND (length(trim(v.rights_evidence))=0 OR ('apply'=ANY(NEW.requested_actions) AND r.asset_kind<>'protocol')) THEN RAISE EXCEPTION 'ASSET_DETAIL_PURPOSE_INVALID'; END IF;
 RETURN NEW;
 END $$`,
 'CREATE TRIGGER detail_access_purposes BEFORE INSERT OR UPDATE ON rh_asset.access_request FOR EACH ROW EXECUTE FUNCTION rh_asset.check_detail_access_purposes()',
 'REVOKE ALL ON FUNCTION rh_asset.check_detail_access_purposes() FROM PUBLIC',
 'GRANT EXECUTE ON FUNCTION rh_asset.check_detail_access_purposes() TO aisci_app'
 ];
}
export const detailPurposeSourceHash=ids=>assetDigest(detailPurposeStatements(ids));
export async function verifyDetailPurposeReceipt(tx,ids,before,current){
 const r=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,action:DETAIL_PURPOSE_ACTION,target:'rh_asset'},orderBy:{createdAt:'desc'},select:{meta:true}});
 if(!(r?.meta?.syntheticOnly===true&&r.meta.beforeFingerprint===before&&r.meta.sourceHash===detailPurposeSourceHash(ids)))return false;
 if(r.meta.fingerprint===current)return true;const{verifyCommentSchemaReceipt}=await import('./research-assets-comments-schema.mjs');return verifyCommentSchemaReceipt(tx,ids,r.meta.fingerprint,current);
}
export async function executeDetailPurposes({apply=false}={}){
 const {env,ids}=loadCatalogTarget();if((await assertFixtureTarget(env)).databaseName!=='wp01_test_full_baseline')throw Error('ASSET_DETAIL_TARGET_REJECTED');
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('wp01:official',0))");await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','wp01:tenant:'+ids.tenant);await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:a01:catalog-schema',0))");assertDetailMigrationActor(await bindCatalogContext(tx,ids,ids.admin));
  const beforeFingerprint=await catalogDefinitionFingerprint(tx);if(!await verifyDetailSchemaReceipt(tx,ids,beforeFingerprint))throw Error('ASSET_DETAIL_BASE_RECEIPT_REQUIRED');
  const exists=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:DETAIL_PURPOSE_ACTION,target:'rh_asset'},select:{meta:true}}),sourceHash=detailPurposeSourceHash(ids);
  if(exists){if(!await verifyDetailPurposeReceipt(tx,ids,exists.meta.beforeFingerprint,beforeFingerprint))throw Error('ASSET_DETAIL_PURPOSE_DRIFT');return{action:'verified',fingerprint:beforeFingerprint,sourceHash};}
  const protectedBefore=await readAssetDetailProtectedSnapshot(tx,ids),sql=detailPurposeStatements(ids);
  await tx.$executeRawUnsafe('SAVEPOINT purpose_prediction');for(const s of sql)await tx.$executeRawUnsafe(s);const predicted=await catalogDefinitionFingerprint(tx);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT purpose_prediction');if(await catalogDefinitionFingerprint(tx)!==beforeFingerprint)throw Error('ASSET_DETAIL_ROLLBACK_DRIFT');
  if(!apply)return{action:'ready_not_applied',sourceHash,beforeFingerprint,predictedFingerprint:predicted};
  for(const s of sql)await tx.$executeRawUnsafe(s);const fingerprint=await catalogDefinitionFingerprint(tx);if(fingerprint!==predicted||assetDigest(protectedBefore)!==assetDigest(await readAssetDetailProtectedSnapshot(tx,ids)))throw Error('ASSET_DETAIL_PROTECTED_DRIFT');
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:DETAIL_PURPOSE_ACTION,target:'rh_asset',meta:{syntheticOnly:true,sourceHash,beforeFingerprint,fingerprint,approval:'D02/AU02 confirmed; Q03 exact new family only',protectedSnapshot:protectedBefore}}});return{action:'applied',sourceHash,beforeFingerprint,fingerprint,oldProtectedUnchanged:true};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==3||!['--check','--apply'].includes(process.argv[2]))throw Error('EXPLICIT_DETAIL_PURPOSE_REQUIRED');executeDetailPurposes({apply:process.argv[2]==='--apply'}).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
