import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {assetSchemaStatements,assertCatalogIds,loadCatalogTarget,catalogDefinitionFingerprint,bindCatalogContext,readCatalogProtectedSnapshot} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {verifyAssetPublicBaseline} from './research-assets-public-baseline.mjs';
export const ACCESS_GUARD_ACTION='research_assets_access_guards_v2_20261113';
export const accessGuardHash=ids=>createHash('sha256').update(accessGuardStatements(ids).join('\n')).digest('hex');
export function accessGuardStatements(ids){
 assertCatalogIds(ids);
 const original=assetSchemaStatements(ids).find(s=>s.startsWith('CREATE FUNCTION rh_asset.check_registry_parent('));
 const before="IF actor IS NULL OR (actor<>NEW.owner_account_id AND NOT admin) THEN RAISE EXCEPTION 'ASSET_ACTOR_INVALID' USING ERRCODE='42501'; END IF;";
 if(!original?.includes(before))throw Error('ASSET_ACCESS_BASE_GUARD_DRIFT');
 const replacement="IF actor IS NULL THEN RAISE EXCEPTION 'ASSET_ACTOR_INVALID'; END IF; IF actor<>NEW.owner_account_id AND NOT admin THEN IF TG_OP<>'UPDATE' OR (to_jsonb(NEW)-'revision'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'revision'-'updated_at') THEN RAISE EXCEPTION 'ASSET_RECIPIENT_MUTATION_INVALID'; END IF; END IF;";
 return[original.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace(before,replacement),...readFileSync(new URL('../server/research-assets/access-guards-v2.sql',import.meta.url),'utf8').split(/^-- statement\s*$/m).map(s=>s.trim()).filter(Boolean)];
}
export async function verifyAccessGuardReceipt(tx,ids,baseFingerprint,currentFingerprint){
 const receipt=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,action:ACCESS_GUARD_ACTION,target:'rh_asset'},orderBy:{createdAt:'desc'},select:{meta:true}});
 return receipt?.meta?.baseFingerprint===baseFingerprint&&receipt.meta.fingerprint===currentFingerprint&&receipt.meta.sourceHash===accessGuardHash(ids)&&receipt.meta.syntheticOnly===true;
}
export async function upgradeAccessGuards({apply=false}={}){
 const{env,ids}=loadCatalogTarget();if((await assertFixtureTarget(env)).databaseName!=='wp01_test_full_baseline')throw Error('ASSET_ACCESS_TARGET_REJECTED');
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:a01:catalog-schema',0))");await bindCatalogContext(tx,ids,ids.admin);
  const original=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}});if(!original?.meta?.fingerprint)throw Error('ASSET_ACCESS_BASE_REQUIRED');
  const before=await catalogDefinitionFingerprint(tx),base=original.meta.fingerprint;
  if(before!==base){if(!await verifyAccessGuardReceipt(tx,ids,base,before))throw Error('ASSET_ACCESS_SCHEMA_DRIFT');return{action:'verified',fingerprint:before,sourceHash:accessGuardHash(ids),syntheticOnly:true};}
  const publicBefore=await verifyAssetPublicBaseline(tx,{tenantId:ids.tenant,expectedHash:original.meta.protectedSnapshot.publicDefinitionHash}),protectedBefore=await readCatalogProtectedSnapshot(tx,ids);
  await tx.$executeRawUnsafe('SAVEPOINT access_upgrade_probe');for(const sql of accessGuardStatements(ids))await tx.$executeRawUnsafe(sql);const predicted=await catalogDefinitionFingerprint(tx);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT access_upgrade_probe');
  if(await catalogDefinitionFingerprint(tx)!==base)throw Error('ASSET_ACCESS_ROLLBACK_DRIFT');
  if(!apply)return{action:'ready_not_applied',predictedFingerprint:predicted,sourceHash:accessGuardHash(ids),syntheticOnly:true,businessWrites:0};
  for(const sql of accessGuardStatements(ids))await tx.$executeRawUnsafe(sql);const fingerprint=await catalogDefinitionFingerprint(tx);if(fingerprint!==predicted)throw Error('ASSET_ACCESS_UPGRADE_DRIFT');
  const publicAfter=await verifyAssetPublicBaseline(tx,{tenantId:ids.tenant,expectedHash:original.meta.protectedSnapshot.publicDefinitionHash}),protectedAfter=await readCatalogProtectedSnapshot(tx,ids);
  if(publicBefore.fullDefinitionHash!==publicAfter.fullDefinitionHash||protectedBefore.oldAssetsHash!==protectedAfter.oldAssetsHash||protectedBefore.roleHash!==protectedAfter.roleHash)throw Error('ASSET_ACCESS_PROTECTED_DRIFT');
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:ACCESS_GUARD_ACTION,target:'rh_asset',meta:{baseFingerprint:base,fingerprint,sourceHash:accessGuardHash(ids),syntheticOnly:true,approval:'A-W03/C05 approved; owned guards only; no new role grants'}}});
  return{action:'applied',fingerprint,sourceHash:accessGuardHash(ids),syntheticOnly:true,publicUnchanged:true,rolesUnchanged:true,businessWrites:0};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!['--check','--apply'].includes(process.argv[2]))throw Error('EXPLICIT_ACCESS_UPGRADE_REQUIRED');
 console.log(JSON.stringify(await upgradeAccessGuards({apply:process.argv[2]==='--apply'}),null,2));
}
