// Explicit F01 completion only. No startup side effects, old-row conversion, reviews, files or model calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createAssetCatalogClient} from '../src/research-assets-catalog-client.js';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertCatalogFixtureInventory,CATALOG_ASSET_PREFIX} from './research-assets-catalog-contract.mjs';
export const CATALOG_HTTP_FIXTURES=[['owner','instrument'],['owner','analysis'],['owner','publication'],['admin','protocol'],['admin','instrument'],['admin','analysis'],['admin','publication']];
const labels={protocol:'研究方案说明',instrument:'量表结构说明',analysis:'研究方法说明',publication:'研究说明草稿'};
export function catalogFixtureDefinition(actor,kind,ids){
 assert(CATALOG_HTTP_FIXTURES.some(([a,k])=>a===actor&&k===kind),'EXACT_NAMED_F01_ONLY');
 return{kind,metadata:{title:'原创合成'+labels[kind]+' · A01 '+actor+' 20261113',summary:'用于本轮合成研究的资产登记、版本与限定用途核对。',purpose:'为研究者提供可核对的方法或材料说明。',limitations:'仅原创合成材料；不是已执行研究、实际统计、正式量表或已发表成果。',author:actor==='owner'?'合成科研人员':'合成租户管理员',domains:['针灸','情志病']},sourceKind:'author',sourceBindings:[],contentMd:'# 原创合成'+labels[kind]+'\n\n本材料仅用于具名合成Study的资产功能验证，不含患者资料、实际数值或外部版权正文。\n\n研究者应核对来源、设计定义、访视与结局时点；缺失信息显式标记，不填补为零。本材料不代表已经执行、审批、锁库或发表。\n\n本轮允许在原两个合成账号间按已确认范围阅读与引用，当前只保存私有草稿。',policy:{rightsEvidence:'本轮原创合成材料；允许当前Study固定资产及原两个合成账号在获准期限内阅读和引用。',discoveryRecipients:[ids.owner,ids.admin]},requestKey:'asset-a01-20261113-'+actor+'-'+kind};
}
async function run(){
 assert.equal(process.argv[2],'--complete-missing','EXPLICIT_NAMED_F01_REQUIRED');
 const {env,ids}=loadCatalogTarget();await assertFixtureTarget(env);assert.equal((await executeCatalogSchema()).action,'verified');
 const snapshot=()=>withFixtureTransaction(env,'direct',tx=>readCatalogProtectedSnapshot(tx,ids),{readOnly:true});const before=await snapshot();
 const inventory=()=>withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe('SELECT a.id,a."tenantId",a."studyGroupId",a."researchProjectId",a."ownerAccountId",a."createdBy",a.status,a."deletedAt",a."currentVersionNo",a."idempotencyKey",(SELECT count(*)::int FROM rh_asset.asset_event e WHERE e.asset_id=a.id) AS "eventCount" FROM public.research_artifact a WHERE a."tenantId"=$1 AND a."idempotencyKey" LIKE $2 ORDER BY a.id LIMIT 11',ids.tenant,CATALOG_ASSET_PREFIX+'%'),{readOnly:true});
 let rows=await inventory();assertCatalogFixtureInventory(rows,ids);
 const runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8')),origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project};
 const results=[];
 for(const actor of ['owner','admin']){
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
  const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';'),me=await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}});assert.equal(me.status,200);const user=await me.json();assert.equal(user.accountId,ids[actor]);
  const api=createAssetCatalogClient({user,scope,fetchImpl:(path,init)=>fetch(origin+path,{...init,headers:{...init.headers,Cookie:cookie,Origin:origin}})});
  for(const [who,kind]of CATALOG_HTTP_FIXTURES.filter(([who])=>who===actor)){
   const input=catalogFixtureDefinition(who,kind,ids),existing=rows.find(r=>r.idempotencyKey===CATALOG_ASSET_PREFIX+actor+':'+kind);
   if(existing){const detail=await api.get('/research-assets/catalog/'+existing.id+'/versions/'+existing.currentVersionNo);assert.equal(detail.metadata.title,input.metadata.title);results.push({actor,kind,id:existing.id,status:'verified_existing'});continue;}
   // Unknown outcomes stop this explicit script: no automatic retries or fresh keys.
   const receipt=await api.post('/research-assets',input);assert.equal(receipt.status,'committed');assert.equal(receipt.version,1);assert.equal(receipt.revision,1);
   const detail=await api.get('/research-assets/catalog/'+receipt.assetId+'/versions/1');assert.equal(detail.contentMd,input.contentMd);assert.equal(detail.metadata.title,input.metadata.title);
   results.push({actor,kind,id:receipt.assetId,status:'created_and_read_back'});rows=await inventory();assertCatalogFixtureInventory(rows,ids);
  }
 }
 assert.deepEqual(await snapshot(),before);
 console.log(JSON.stringify({syntheticOnly:true,realHttp:true,results,logicalAssets:rows.length,eventCount:rows.reduce((n,r)=>n+r.eventCount,0),oldDataAndRolesUnchanged:true,filesCreated:0,modelCalls:0,adminDatasetLeftForBrowser:!rows.some(r=>r.idempotencyKey===CATALOG_ASSET_PREFIX+'admin:dataset')},null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await run();
