// RC04 follow-up: extend only the owned scope function, never old/public policies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext,readCatalogDefinitionRows} from './research-assets-catalog-schema.mjs';
import {verifyDetailSchemaReceipt,readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const action='hub_asset_report_context_scope_20261116',fingerprint=async tx=>assetDigest(await readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true})),sourceHash=()=>assetDigest(readFileSync(fileURLToPath(import.meta.url)));
export async function verifyReportContextScopeReceipt(tx,ids){
 const prior=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'hub_asset_report_context_schema_20261116',target:'rh_asset'},select:{meta:true}}),r=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action,target:'rh_asset'},select:{meta:true}});
 return !!r?.meta&&r.meta.sourceHash===sourceHash()&&r.meta.syntheticOnly===true&&r.meta.beforeFingerprint===prior?.meta?.stableFingerprint&&prior.meta.sourceHash===assetDigest(readFileSync(new URL('./research-assets-report-context-schema.mjs',import.meta.url)))&&r.meta.fingerprint===await fingerprint(tx);
}
async function execute(apply){
 const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 return withFixtureTransaction(env,'direct',async tx=>{
  await bindCatalogContext(tx,ids,ids.admin);await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:report-context-schema',0))::text");
  if(await verifyReportContextScopeReceipt(tx,ids))return{action:'verified'};
  const {catalogDefinitionFingerprint}=await import('./research-assets-catalog-schema.mjs');assert(await verifyDetailSchemaReceipt(tx,ids,await catalogDefinitionFingerprint(tx)),'SCOPE_UNKNOWN_BASE');
  const before=await fingerprint(tx),protectedBefore=await readAssetDetailProtectedSnapshot(tx,ids),[r]=await tx.$queryRawUnsafe("SELECT pg_get_functiondef('rh_asset.scope_matches(text,text,text)'::regprocedure) AS definition");
  const old="p='"+ids.project+"'";assert.equal(r.definition.split(old).length,2,'SCOPE_EXACT_OLD_BRANCH_REQUIRED');
  const sql=r.definition.replace(old,"(p='"+ids.project+"' OR (p='"+c.projectId+"' AND current_setting('app.account_id',true)='"+ids.admin+"' AND EXISTS(SELECT 1 FROM public.account ca WHERE ca.id='"+ids.admin+"' AND ca.role='tenant_admin' AND ca.status='active')))" );
  await tx.$executeRawUnsafe('SAVEPOINT context_scope_prediction');await tx.$executeRawUnsafe(sql);const predicted=await fingerprint(tx);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT context_scope_prediction');assert.equal(await fingerprint(tx),before);
  if(!apply)return{action:'predicted_rolled_back',before,predicted};
  await tx.$executeRawUnsafe(sql);assert.equal(await fingerprint(tx),predicted);assert.deepEqual(await readAssetDetailProtectedSnapshot(tx,ids),protectedBefore);
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action,target:'rh_asset',meta:{beforeFingerprint:before,fingerprint:predicted,sourceHash:sourceHash(),syntheticOnly:true}}});
  return{action:'applied',before,fingerprint:predicted};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert(['--predict','--apply'].includes(process.argv[2])&&process.argv.length===3);execute(process.argv[2]==='--apply').then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
