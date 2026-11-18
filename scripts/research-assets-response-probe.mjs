// Local synthetic fault injection only. No HTTP control endpoint or production/old-system code.
import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {loadCatalogTarget,executeCatalogSchema} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const keys=['tenant','group','project','owner','admin'];
export function createAssetResponseProbe({ids,path,now=()=>Date.now()}){
 return async({user,input,receipt})=>{
  if(!existsSync(path))return;const stat=lstatSync(path);assert(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_LOCAL_PROBE_REQUIRED');
  const state=JSON.parse(readFileSync(path,'utf8'));assert(state.schemaVersion==='rh-asset-response-probe.v1'&&keys.every(k=>state.ids?.[k]===ids[k]),'NAMED_SYNTHETIC_PROBE_REQUIRED');
  if(state.used||Date.parse(state.expiresAt)<=now())return;
  assert(state.actorId===ids.admin&&state.baseVersion===2&&state.expectedRevision===2&&Number.isFinite(Date.parse(state.expiresAt))&&Date.parse(state.expiresAt)<=now()+300000,'BOUNDED_PROBE_REQUIRED');
  if(user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||user.accountId!==state.actorId||input.baseVersion!==state.baseVersion||input.expectedRevision!==state.expectedRevision||receipt.status!=='committed'||receipt.assetId!==state.assetId||receipt.version!==3||receipt.revision!==3)return;
  const temporary=join(dirname(path),'probe-'+randomUUID()+'.tmp');writeFileSync(temporary,JSON.stringify({...state,used:true,usedAt:new Date(now()).toISOString(),operationKey:input.requestKey,receipt},null,2),{flag:'wx',mode:0o600});renameSync(temporary,path);
  throw catalogError('RESULT_UNCONFIRMED',503,'保存结果尚未确认，请先核对原保存结果，不要重复新建。');
 };
}
async function arm(){
 assert.equal(process.argv[2],'--arm-admin-dataset-once','EXPLICIT_ONE_SHOT_PROBE_REQUIRED');const{env,ids}=loadCatalogTarget();await assertFixtureTarget(env);assert.equal((await executeCatalogSchema()).action,'verified');
 const row=await withFixtureTransaction(env,'direct',async tx=>{const r=await tx.$queryRawUnsafe("SELECT r.asset_id,r.working_version_no,r.revision FROM rh_asset.asset_registry r JOIN public.research_artifact a ON a.id=r.asset_id WHERE r.tenant_id=$1 AND r.study_group_id=$2 AND r.research_project_id=$3 AND r.owner_account_id=$4 AND r.asset_kind='dataset' AND r.deleted_at IS NULL AND a.\"idempotencyKey\"='rh-research-asset:catalog-20261112:admin:dataset'",ids.tenant,ids.group,ids.project,ids.admin);assert.equal(r.length,1);assert.equal(r[0].working_version_no,2);assert.equal(r[0].revision,2);return r[0];},{readOnly:true});
 const path=fileURLToPath(new URL('../../.tmp/researchhub-assets-local/a01-response-probe-20261113.json',import.meta.url));assert(!existsSync(path),'PROBE_EXISTS_NO_AUTO_REARM');
 const state={schemaVersion:'rh-asset-response-probe.v1',ids:Object.fromEntries(keys.map(k=>[k,ids[k]])),actorId:ids.admin,assetId:row.asset_id,baseVersion:2,expectedRevision:2,expiresAt:new Date(Date.now()+300000).toISOString(),used:false};writeFileSync(path,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({syntheticOnly:true,oneShot:true,assetId:row.asset_id,nextVersion:3,expiresAt:state.expiresAt,businessWrites:0,modelCalls:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await arm();
