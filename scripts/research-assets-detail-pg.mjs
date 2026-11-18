// Actual aisci_app constraints and services, in a deliberately rolled-back named-slot transaction.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetRegistration} from './local-research-assets-registration.mjs';
import {createAssetDetailReader} from './research-assets-detail-read.mjs';
import {buildA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {detailFixtureInput} from './research-assets-detail-fixtures.mjs';
import {readAssetDetailProtectedSnapshot,executeDetailSchema} from './research-assets-detail-schema.mjs';
assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_A02_PG_VERIFY_REQUIRED');
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/',import.meta.url).pathname;
const root=fileURLToPath(new URL('../../',import.meta.url)),{env,ids}=loadCatalogTarget();await assertFixtureTarget(env);assert.equal((await executeDetailSchema()).action,'verified');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
const snapshot=()=>withFixtureTransaction(env,'direct',tx=>readAssetDetailProtectedSnapshot(tx,ids),{readOnly:true}),before=await snapshot(),abort=new Error('EXPECTED_Q02_ROLLBACK');let verified=false;
try{
 await withFixtureTransaction(env,'app',async tx=>{
  await bindCatalogContext(tx,ids,ids.owner);await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});
  const account=await tx.account.findUnique({where:{id:ids.owner},select:{authVersion:true,role:true}}),user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,...account};
  const withAccess=createCatalogAccess({ids,transaction:(_u,run)=>run(tx)}),m=buildA02Manifest(ids),slot=m.assets.find(x=>x.actor==='owner'&&x.kind==='protocol'&&x.mode==='base');
  const existing=await tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:ids.tenant,idempotencyKey:slot.key}},select:{id:true}});assert.equal(existing,null,'RUN_ROLLBACK_PROBE_BEFORE_REAL_SEED');
  const registration=createAssetRegistration({ids,withAccess,registrationKey:()=>slot.key}),detail=createAssetDetailReader({withAccess});
  let r=await registration.register(user,detailFixtureInput(slot,ids));r=await registration.revise(user,r.assetId,detailFixtureInput(slot,ids,2));
  const input={baseVersion:2,expectedRevision:2,tags:['PG核对'],requestKey:'a02-pg-rollback-tags'};const saved=await detail.tags(user,r.assetId,input);assert.equal(saved.version,3);assert.deepEqual(await detail.tags(user,r.assetId,input),saved);
  await assert.rejects(detail.tags(user,r.assetId,{...input,tags:['同键异输入']}),e=>e.status===409);
  await assert.rejects(detail.tags(user,r.assetId,{...input,requestKey:'a02-pg-stale-version'}),e=>e.status===409);
  const compared=await detail.compare(user,r.assetId,3,{withVersion:'2'});assert.equal(compared.text.changed,false);assert.deepEqual(compared.changedFields.map(x=>x.field),['tags']);
  const activity=await detail.activity(user,r.assetId,3);assert.equal(activity.items[0].type,'revised');assert.equal(activity.total,1);
  const fourth=await detail.tags(user,r.assetId,{baseVersion:3,expectedRevision:3,tags:['第四版核对'],requestKey:'a02-pg-rollback-fourth'});assert.equal(fourth.version,4);
  await assert.rejects(detail.tags(user,r.assetId,{baseVersion:4,expectedRevision:4,tags:[],requestKey:'a02-pg-fifth-rejected'}),e=>e.status===409);
  await tx.$executeRawUnsafe('SAVEPOINT direct_cap');await tx.researchArtifact.update({where:{id:r.assetId},data:{currentVersionNo:5}});
  let refused=false;try{await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET working_version_no=5,revision=5 WHERE asset_id=$1',r.assetId);}catch(e){refused=e.code==='P2010'&&String(e.meta?.message).includes('ASSET_PARENT_INVALID');}assert(refused,'DATABASE_MUST_ENFORCE_NEW_VERSION_CAP');await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT direct_cap');
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');verified=true;throw abort;
 });
}catch(e){if(e!==abort){writeFileSync(out+'pg-failure.json',JSON.stringify({passed:false,code:e.code??e.name,message:String(e.message).trim().slice(0,1400)},null,2));throw e;}}
assert(verified);assert.deepEqual(await snapshot(),before);
const rows=await withFixtureTransaction(env,'direct',tx=>tx.researchArtifact.count({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:'}}}),{readOnly:true});assert.equal(rows,0);
writeFileSync(out+'pg.json',JSON.stringify({passed:true,at:new Date().toISOString(),actualAppRole:true,source:'real services and constraints, deliberate rollback',newPersistentAssets:0,oldProtectedUnchanged:true,tagVersioning:true,idempotency:true,sameKeyDifferentInputRejected:true,staleVersionRejected:true,comparisonActual:true,activityActual:true,applicationAndDatabaseCapBothEnforced:true,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,actualAppRole:true,newPersistentAssets:0,oldProtectedUnchanged:true}));
