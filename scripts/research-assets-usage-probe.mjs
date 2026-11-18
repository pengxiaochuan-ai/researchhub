// Bounded local synthetic response-loss test. No network control endpoint.
import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {loadCatalogTarget,executeCatalogSchema} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const keys=['tenant','group','project','owner','admin'];
export function createAssetUsageProbe({ids,path,now=()=>Date.now()}){
 return async({user,input,receipt})=>{
  if(!existsSync(path))return;const stat=lstatSync(path);assert(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_USAGE_PROBE_REQUIRED');
  const s=JSON.parse(readFileSync(path,'utf8'));assert(s.schemaVersion==='rh-asset-usage-probe.v1'&&keys.every(k=>s.ids?.[k]===ids[k]),'NAMED_USAGE_PROBE_REQUIRED');
  if(s.used||Date.parse(s.expiresAt)<=now())return;
  assert(s.actorId===ids.owner&&s.version===1&&s.expectedRevision===4&&Number.isFinite(Date.parse(s.expiresAt))&&Date.parse(s.expiresAt)<=now()+300000,'BOUNDED_USAGE_PROBE_REQUIRED');
  if(user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||user.accountId!==s.actorId||input.action!=='request'||input.version!==1||input.expectedRevision!==4||receipt.status!=='committed'||receipt.operation!=='requested'||receipt.assetId!==s.assetId||receipt.version!==1||receipt.revision!==5||!receipt.requestId)return;
  const temporary=join(dirname(path),'usage-probe-'+randomUUID()+'.tmp');writeFileSync(temporary,JSON.stringify({...s,used:true,usedAt:new Date(now()).toISOString(),operationKey:input.requestKey,receipt},null,2),{flag:'wx',mode:0o600});renameSync(temporary,path);
  throw catalogError('RESULT_UNCONFIRMED',503,'申请结果尚未确认，请先核对原申请结果。');
 };
}
async function arm(){
 assert.equal(process.argv[2],'--arm-owner-protocol-request-once','EXPLICIT_USAGE_PROBE_REQUIRED');const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
 const row=await withFixtureTransaction(env,'direct',async t=>{
  const rows=await t.$queryRawUnsafe("SELECT r.asset_id FROM rh_asset.asset_registry r JOIN public.research_artifact a ON a.id=r.asset_id WHERE r.tenant_id=$1 AND r.study_group_id=$2 AND r.research_project_id=$3 AND r.owner_account_id=$4 AND r.asset_kind='protocol' AND r.working_version_no=1 AND r.working_state='approved' AND r.revision=4 AND r.released_version_no=1 AND r.release_state='released' AND r.deleted_at IS NULL AND a.\"idempotencyKey\"='rh-research-asset:catalog-20261112:admin:protocol'",ids.tenant,ids.group,ids.project,ids.admin);assert.equal(rows.length,1,'NAMED_USAGE_PRE_REQUEST_STATE_REQUIRED');return rows[0];
 },{readOnly:true});
 const path=fileURLToPath(new URL('../../.tmp/researchhub-assets-local/a01-usage-probe-20261113.json',import.meta.url));assert(!existsSync(path),'USAGE_PROBE_EXISTS_NO_REARM');
 const s={schemaVersion:'rh-asset-usage-probe.v1',ids:Object.fromEntries(keys.map(k=>[k,ids[k]])),assetId:row.asset_id,actorId:ids.owner,version:1,expectedRevision:4,expiresAt:new Date(Date.now()+300000).toISOString(),used:false};writeFileSync(path,JSON.stringify(s,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({syntheticOnly:true,oneShot:true,assetId:s.assetId,version:1,nextRevision:5,expiresAt:s.expiresAt,businessWrites:0,modelsCalled:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await arm();
