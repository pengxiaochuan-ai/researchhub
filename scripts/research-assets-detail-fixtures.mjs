// Explicit Q02 base slots only. Copies, B, files, comments and jobs are not created here.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetRegistration} from './local-research-assets-registration.mjs';
import {createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';
import {executeDetailSchema,readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
export function detailFixtureInput(slot,ids,version=1){
 assert.equal(slot.mode,'base');assert([1,2].includes(version));
 return{kind:slot.kind,metadata:{title:slot.title,summary:'原创合成材料，用于核对研究内容、固定版本和可追溯来源。',purpose:'核对材料适用条件与研究设计定义。',limitations:'合成材料，不含患者资料；未声明内容需人工核对，不作为已执行研究结果。',author:slot.actor==='owner'?'合成科研人员':'合成租户管理员',domains:['针灸','情志病'],tags:[]},contentMd:slot.contentMd+(version===2?'\n## 方法核对补充\n\n结局操作定义与访视时点须人工确认；尚未声明的参数保持待核对。\n':''),sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:slot.rightsEvidence,discoveryRecipients:[ids.owner,ids.admin]},requestKey:'a02-base-'+slot.actor+'-'+slot.kind+'-v'+version,...(version===2?{baseVersion:1,expectedRevision:1}:{})};
}
async function main(){
 assert.deepEqual(process.argv.slice(2),['--apply-base'],'EXPLICIT_A02_BASE_APPLY_REQUIRED');
 const root=fileURLToPath(new URL('../../',import.meta.url)),{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeDetailSchema()).action,'verified');
 const m=JSON.parse(readFileSync(root+'.tmp/researchhub-assets-local/a02-20261113/fixture-plan.json','utf8')),manifestHash=assertA02Manifest(m,ids);
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const{lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 const withAccess=createCatalogAccess({ids,transaction:(u,run)=>withFixtureTransaction(env,'app',async tx=>{await bindCatalogContext(tx,ids,u.accountId);await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});return run(tx);})});
 const service=createAssetRegistration({ids,withAccess,registrationKey:(p,v)=>m.assets.find(x=>x.mode==='base'&&x.ownerAccountId===p.accountId&&x.kind===v.kind)?.key}),reader=createAssetCatalogReader({withAccess});
 const snapshot=()=>withFixtureTransaction(env,'direct',tx=>readAssetDetailProtectedSnapshot(tx,ids),{readOnly:true}),before=await snapshot(),results=[];
 const existing=await withFixtureTransaction(env,'direct',tx=>tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:'}},select:{id:true,idempotencyKey:true,currentVersionNo:true,ownerAccountId:true,status:true,deletedAt:true}}),{readOnly:true});
 assert(existing.every(x=>m.assets.some(s=>s.mode==='base'&&s.key===x.idempotencyKey&&s.ownerAccountId===x.ownerAccountId)&&x.currentVersionNo<=2&&x.status==='draft'&&!x.deletedAt),'A02_BASE_ALREADY_IN_USE_OR_UNKNOWN');
 for(const actor of ['owner','admin']){
  const account=await withFixtureTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:ids[actor]},select:{id:true,role:true,authVersion:true}}),{readOnly:true});
  const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:account.id,role:account.role,authVersion:account.authVersion};
  for(const slot of m.assets.filter(x=>x.actor===actor&&x.mode==='base')){
   const found=existing.find(x=>x.idempotencyKey===slot.key);let receipt;
   if(found){const v1=await reader.detail(user,found.id,1);assert.equal(v1.contentMd,detailFixtureInput(slot,ids).contentMd);assert.equal(v1.metadata.title,slot.title);receipt={assetId:found.id,version:found.currentVersionNo};}
   else receipt=await service.register(user,detailFixtureInput(slot,ids));
   if(receipt.version===1)receipt=await service.revise(user,receipt.assetId,detailFixtureInput(slot,ids,2));
   const head=await reader.detail(user,receipt.assetId,2);assert.equal(head.contentMd,detailFixtureInput(slot,ids,2).contentMd);assert.equal(head.family,'detail');assert.equal(head.canEditTags,true);results.push({actor,kind:slot.kind,id:receipt.assetId,version:2,key:slot.key});
  }
 }
 const after=await snapshot();assert.deepEqual(after,before);
 const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/',import.meta.url).pathname;mkdirSync(out,{recursive:true});writeFileSync(out+'fixtures.json',JSON.stringify({passed:true,at:new Date().toISOString(),manifestHash,baseAssets:10,versions:20,events:20,newCopies:0,newB:0,filesCreated:0,commentsCreated:0,modelCalls:0,oldProtectedUnchanged:true,protectedSnapshot:after,results},null,2));console.log(JSON.stringify({passed:true,baseAssets:10,versions:20,events:20,oldProtectedUnchanged:true,modelCalls:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{process.stderr.write(String(e.message).trim().replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,1000)+'\n');process.exitCode=1;});
