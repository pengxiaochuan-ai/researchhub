import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext,catalogDefinitionFingerprint,readCatalogDefinitionRows} from './research-assets-catalog-schema.mjs';
import {verifyDetailSchemaReceipt,readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
import {verifyDetailPurposeReceipt} from './research-assets-detail-purpose-schema.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export const REPORT_CONTEXT_SCHEMA_ACTION='hub_asset_report_context_schema_20261116';
const sourceHash=()=>assetDigest(readFileSync(fileURLToPath(import.meta.url)));
const stableFingerprint=async tx=>assetDigest(await readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true}));
export async function verifyReportContextSchemaReceipt(tx,ids,detailFingerprint,current){
 const r=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:REPORT_CONTEXT_SCHEMA_ACTION,target:'rh_asset'},select:{meta:true}});
 return !!r?.meta&&r.meta.sourceHash===sourceHash()&&r.meta.syntheticOnly===true&&r.meta.stableFingerprint===await stableFingerprint(tx)&&
  (r.meta.beforeFingerprint===detailFingerprint||await verifyDetailPurposeReceipt(tx,ids,detailFingerprint,r.meta.beforeFingerprint));
}
function prepend(definition,sql){
 assert.equal(typeof definition,'string');const matches=definition.match(/\bBEGIN\b/g);assert.equal(matches?.length,1,'CONTEXT_EXPECTED_SINGLE_FUNCTION_BODY');
 return definition.replace(/\bBEGIN\b/,'BEGIN\n'+sql);
}
async function statements(tx,ids){
 const [constraint]=await tx.$queryRawUnsafe("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='rh_asset.asset_registry'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%research_project_id%'");
 assert(constraint&&/^[a-z_]+$/.test(constraint.conname)&&constraint.definition.includes(ids.project)&&!constraint.definition.includes(c.projectId),'CONTEXT_UNKNOWN_PROJECT_CHECK');
 const definitions={};for(const name of ['check_registry_parent','check_policy_parent','check_event_sequence']){const [r]=await tx.$queryRawUnsafe('SELECT pg_get_functiondef($1::regprocedure) AS definition','rh_asset.'+name+'()');definitions[name]=r.definition;}
 const project=`ALTER TABLE rh_asset.asset_registry DROP CONSTRAINT "${constraint.conname}"`,
 check=`ALTER TABLE rh_asset.asset_registry ADD CONSTRAINT "${constraint.conname}" CHECK(research_project_id='${ids.project}' OR (research_project_id='${c.projectId}' AND asset_id='${c.assetId}' AND owner_account_id='${ids.admin}' AND asset_kind='publication' AND working_version_no<=2 AND revision<=12 AND release_state='unreleased' AND released_version_no IS NULL AND deleted_at IS NULL))`;
 const parent=`IF NEW.asset_id='${c.assetId}' THEN
  SELECT * INTO a FROM public.research_artifact WHERE id=NEW.asset_id FOR SHARE;
  IF NOT FOUND OR NEW.tenant_id<>'${ids.tenant}' OR NEW.study_group_id<>'${ids.group}' OR NEW.research_project_id<>'${c.projectId}' OR NEW.owner_account_id<>'${ids.admin}' OR NEW.asset_kind<>'publication'
   OR a."tenantId"<>NEW.tenant_id OR a."studyGroupId"<>NEW.study_group_id OR a."researchProjectId"<>NEW.research_project_id OR a."ownerAccountId"<>NEW.owner_account_id OR a."createdBy"<>NEW.owner_account_id OR a."typeKey"<>'research_report' OR a.status<>'draft' OR a."deletedAt" IS NOT NULL OR a."idempotencyKey"<>'${c.key}' OR a."currentVersionNo"<>NEW.working_version_no THEN RAISE EXCEPTION 'ASSET_CONTEXT_PARENT_INVALID' USING ERRCODE='23514'; END IF;
  IF current_setting('app.account_id',true)<>'${ids.admin}' OR NOT EXISTS(SELECT 1 FROM public.account WHERE id='${ids.admin}' AND "tenantId"=NEW.tenant_id AND role='tenant_admin' AND status='active') THEN RAISE EXCEPTION 'ASSET_CONTEXT_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.asset_id<>OLD.asset_id OR NEW.tenant_id<>OLD.tenant_id OR NEW.study_group_id<>OLD.study_group_id OR NEW.research_project_id<>OLD.research_project_id OR NEW.owner_account_id<>OLD.owner_account_id OR NEW.asset_kind<>OLD.asset_kind OR NEW.revision<>OLD.revision+1 OR (OLD.ever_submitted AND NOT NEW.ever_submitted)) THEN RAISE EXCEPTION 'ASSET_CONTEXT_CAS_INVALID' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;`;
 const policy=`IF NEW.asset_id='${c.assetId}' AND (NEW.source_kind<>'artifact' OR NEW.source_bindings<>'[{"kind":"artifact","id":"${c.reportId}","version":1,"contentHash":"${c.hash}"}]'::jsonb OR cardinality(NEW.discovery_recipient_ceiling)<>0 OR NEW.content_hash<>'${c.hash}' OR NEW.created_by<>'${ids.admin}' OR NEW.version_no>2) THEN RAISE EXCEPTION 'ASSET_CONTEXT_POLICY_INVALID' USING ERRCODE='23514'; END IF;`;
 const event=`IF NEW.asset_id='${c.assetId}' AND (NEW.event_type NOT IN ('created','revised','submitted','reviewed') OR NEW.actor_account_id<>'${ids.admin}' OR NEW.asset_revision>12) THEN RAISE EXCEPTION 'ASSET_CONTEXT_EVENT_INVALID' USING ERRCODE='23514'; END IF;`;
 return[project,check,prepend(definitions.check_registry_parent,parent),prepend(definitions.check_policy_parent,policy),prepend(definitions.check_event_sequence,event)];
}
export async function executeReportContextSchema({apply=false}={}){
 const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 return withFixtureTransaction(env,'direct',async tx=>{
  await bindCatalogContext(tx,ids,ids.admin);await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:report-context-schema',0))::text");
  const fingerprint=await catalogDefinitionFingerprint(tx);
  assert(await verifyDetailSchemaReceipt(tx,ids,fingerprint),'CONTEXT_UNRECOGNIZED_SCHEMA');
  const existing=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:REPORT_CONTEXT_SCHEMA_ACTION,target:'rh_asset'},select:{meta:true}});
  if(existing)return {action:'verified',fingerprint};
  const protectedBefore=await readAssetDetailProtectedSnapshot(tx,ids),sql=await statements(tx,ids);
  await tx.$executeRawUnsafe('SAVEPOINT report_context_prediction');for(const s of sql)await tx.$executeRawUnsafe(s);
  const predicted=await catalogDefinitionFingerprint(tx),predictedStable=await stableFingerprint(tx),predictedRows=await readCatalogDefinitionRows(tx);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT report_context_prediction');
  assert.equal(await catalogDefinitionFingerprint(tx),fingerprint);assert.deepEqual(await readAssetDetailProtectedSnapshot(tx,ids),protectedBefore);
  if(!apply)return{action:'predicted_rolled_back',before:fingerprint,predicted};
  for(const s of sql)await tx.$executeRawUnsafe(s);
  const actual=await catalogDefinitionFingerprint(tx);
  if(await stableFingerprint(tx)!==predictedStable){writeFileSync(new URL('../.superpowers/sdd/report-context-20261116/schema-fingerprint-difference.json',import.meta.url),JSON.stringify({predictedRows,actualRows:await readCatalogDefinitionRows(tx)},null,2));throw Error('CONTEXT_PREDICTION_APPLY_DRIFT');}
  assert.deepEqual(await readAssetDetailProtectedSnapshot(tx,ids),protectedBefore);
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:REPORT_CONTEXT_SCHEMA_ACTION,target:'rh_asset',meta:{sourceHash:sourceHash(),beforeFingerprint:fingerprint,fingerprint:actual,stableFingerprint:predictedStable,syntheticOnly:true,projectId:c.projectId,assetId:c.assetId}}});
  return{action:'applied',before:fingerprint,fingerprint:actual,stableFingerprint:predictedStable,protectedBefore};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(['--predict','--apply'].includes(process.argv[2])&&process.argv.length===3);
 executeReportContextSchema({apply:process.argv[2]==='--apply'}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});
}
