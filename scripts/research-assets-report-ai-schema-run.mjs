// Explicit approved synthetic AQ02 migration/prediction. Never imported on boot.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,readCatalogDefinitionRows} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig,fixtureClient,readFixtureIdentity,checkFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readBusinessAssetAdmission} from './research-assets-business-preflight.mjs';
import {prepareReportAiConsentMigration} from '../server/research-assets/report-ai-consent-migration.mjs';
import {nativeReportServices} from './research-assets-native-report-services.mjs';
import {createLocalBusinessAssetCatalog} from '../server/research-assets/business-local-catalog.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {REPORT_AI_LOCAL as L} from '../server/research-assets/report-ai-local.mjs';
const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--rollback-only','--apply'].includes(mode));
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const dir=new URL('../docs/planning/research-assets-agent-qa-2026-11-16/evidence/',import.meta.url),old=JSON.parse(readFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-recipients-applied.json',import.meta.url)));
const oldTables=['asset_registry','version_policy','asset_event','access_request','asset_comment_event','asset_reuse_record'];
const isNew=r=>r.name==='check_ai_consent_event()'||r.name.startsWith('ai_use_consent_event')||r.name.startsWith('ai_consent_latest');
async function protectedState(tx){
 const facts={};for(const t of oldTables)facts[t]=await tx.$queryRawUnsafe(`SELECT md5(to_jsonb(r)::text) AS hash FROM rh_asset.${t} r ORDER BY to_jsonb(r)::text`);
 const artifacts=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,OR:[{id:{startsWith:'rhab-'}},{id:L.sourceReportId}]},include:{versions:{orderBy:{id:'asc'}},reviews:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
 assert.equal(facts.asset_registry.length,42);
 return{factsHash:assetDigest(facts),artifactsHash:assetDigest(artifacts),publicHash:assetDigest(await readCatalogDefinitionRows(tx,'public',{fullNames:true})),oldDefinitions:assetDigest((await readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true})).filter(r=>!isNew(r)))};
}
const before=await withFixtureTransaction(env,'direct',async tx=>{
 const [s]=await tx.$queryRawUnsafe("SELECT to_regclass('rh_asset.ai_use_consent_event')::text AS name");assert.equal(s.name,null,'Already applied or unknown migration: inspect receipt, never rerun');
 assert.equal((await readBusinessAssetAdmission(tx,ids)).ddlFingerprint,old.afterFingerprint);
 return protectedState(tx);
},{readOnly:true});
const migration=prepareReportAiConsentMigration({schemaExists:true,tableExists:false});
if(mode==='--apply'){const prediction=JSON.parse(readFileSync(new URL('aq02-pg-prediction.json',dir)));assert(prediction.passed);assert.equal(prediction.schemaHash,migration.schemaHash);assert.deepEqual(prediction.protectedState,before);}
let activeTx;await nativeReportServices({root:fileURLToPath(new URL('../../',import.meta.url)),env,ids,transaction:run=>{assert(activeTx);return run(activeTx);}});
const rollback=Error('EXPECTED_AQ02_FULL_ROLLBACK'),config=validateFixtureConfig(env),client=fixtureClient(config.directUrl);let result;
try{await client.$transaction(async tx=>{
 checkFixtureIdentity(config,'direct',await readFixtureIdentity(tx));await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 10000');
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:aq02:migration',0))");
 assert.deepEqual(await protectedState(tx),before);
 for(const s of migration.statements)await tx.$executeRawUnsafe(s);
 const definitions=await readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true});assert.deepEqual(await protectedState(tx),before);
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');assert.equal((await tx.$queryRawUnsafe('SELECT current_user AS name'))[0].name,'aisci_app');
 for(const[k,v]of[['app.tenant_id',L.tenantId],['app.study_group_id',L.studyGroupId],['app.research_project_id',L.researchProjectId],['app.account_id',L.accountId]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',k,v);
 const a=await tx.account.findFirst({where:{id:L.accountId,tenantId:L.tenantId}}),user={tenantId:L.tenantId,studyGroupId:L.studyGroupId,researchProjectId:L.researchProjectId,accountId:a.id,role:a.role,authVersion:a.authVersion};
 activeTx=tx;const legacy={assertSources:async()=>false,reader:{},registration:{},details:{},governance:{},lifecycle:{},usage:{},views:{}};
 const qa=createLocalBusinessAssetCatalog({ids,legacy,transaction:(_u,run)=>run(tx)}).reportQa,checks=[];
 assert.equal((await qa.status(user,L.assetId,2)).state,'not_granted');
 if(mode==='--rollback-only'){
  const input={action:'grant',expectedConsentRevision:0,requestKey:'aq02-predict-first-grant'},first=await qa.consent(user,L.assetId,2,input);assert.equal(first.revision,1);assert.deepEqual(await qa.consent(user,L.assetId,2,input),first);
  await assert.rejects(qa.consent(user,L.assetId,2,{...input,action:'revoke'}),e=>e.status===409);
  await assert.rejects(qa.consent(user,L.assetId,2,{...input,requestKey:'aq02-predict-stale'}),e=>e.status===409);
  const pack=await qa.search(user,L.assetId,2,{question:'报告的数据完整性和使用限制是什么？'});assert.equal(pack.generated,false);assert.equal(pack.status,'ready');assert(pack.evidence.length>0);
  assert.equal((await qa.search(user,L.assetId,2,{question:'一年随访疗效'})).status,'no_evidence');
  const internal=await qa.reader.search(user,{assetId:L.assetId,version:2,question:'使用限制'});
  const revoke=await qa.consent(user,L.assetId,2,{action:'revoke',expectedConsentRevision:1,requestKey:'aq02-predict-revoke'});assert.equal(revoke.revision,2);
  await assert.rejects(qa.reader.revalidate(user,internal),e=>e.status===403);
  await assert.rejects(qa.search(user,L.assetId,2,{question:'使用限制'}),e=>e.status===403);
  const last=await qa.consent(user,L.assetId,2,{action:'grant',expectedConsentRevision:2,requestKey:'aq02-predict-final-grant'});assert.equal(last.revision,3);assert.equal(last.expiresAt,first.expiresAt);
  await assert.rejects(qa.status({...user,accountId:ids.owner,role:'researcher'},L.assetId,2));
  await assert.rejects(qa.status({...user,authVersion:a.authVersion+1},L.assetId,2),e=>e.status===401);
  await assert.rejects(qa.status(user,L.assetId,1),e=>e.status===403);
  await assert.rejects(qa.consent(user,L.assetId,2,{action:'revoke',expectedConsentRevision:3,requestKey:'aq02-predict-fourth'}));
  checks.push('real aisci_app grant/revoke/regrant + original receipt replay + payload/CAS guard','native T17 current source, free exact fragments, zero model/no-evidence','revocation blocks captured evidence, old version/auth/other actor rejected','immutable initial seven-day window and three-event cap');
  for(const sql of ['UPDATE rh_asset.ai_use_consent_event SET material_ai_allowed=false','DELETE FROM rh_asset.ai_use_consent_event']){
   await tx.$executeRawUnsafe('SAVEPOINT aq02_denied');let rejected=false;try{await tx.$executeRawUnsafe(sql);}catch{rejected=true;}await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT aq02_denied');assert(rejected);
  }
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');checks.push('app UPDATE/DELETE rejected; deferred constraints checked');
 }
 await tx.$executeRawUnsafe('RESET ROLE');assert.deepEqual(await protectedState(tx),before);
 result={passed:true,at:new Date().toISOString(),mode,database:'wp01_test_full_baseline',schemaHash:migration.schemaHash,protectedState:before,afterDefinitionHash:assetDigest(definitions),definitions,checks,persistentConsents:0,modelCalls:0};
 if(mode==='--rollback-only')throw rollback;
},{maxWait:8000,timeout:120000});}catch(e){if(e!==rollback)throw e;}finally{activeTx=null;await client.$disconnect();}
assert(result);
await withFixtureTransaction(env,'direct',async tx=>{assert.deepEqual(await protectedState(tx),before);const [s]=await tx.$queryRawUnsafe("SELECT to_regclass('rh_asset.ai_use_consent_event')::text AS name");assert.equal(s.name,mode==='--apply'?'rh_asset.ai_use_consent_event':null);},{readOnly:true});
writeFileSync(new URL(mode==='--apply'?'aq02-schema-applied.json':'aq02-pg-prediction.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,definitions:undefined}));
