import assert from 'node:assert/strict';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {loadCatalogRecords,createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';
import {createAssetReuse} from './research-assets-reuse.mjs';
import {createAssetDetailAiBasis} from './research-assets-detail-ai.mjs';
import {assetDetailAiCases} from './research-assets-detail-ai-cases.mjs';

export function createAssetDetailAiCurrent({ids,transaction,assertSources,assertLiveClaim}){
 const cases=assetDetailAiCases(ids),targetProjectId='rh-asset-detail-20261113-study-b';
 async function inTx(tx,user,c){
  assert(cases.some(x=>JSON.stringify(x)===JSON.stringify(c))&&c.accountId===user.accountId,'A02_AI_NAMED_CASE_REQUIRED');
  const transaction=(_u,run)=>run(tx),withAccess=createCatalogAccess({ids,transaction}),withTargetAccess=createCatalogAccess({ids:{...ids,project:targetProjectId},transaction});
  const reader=createAssetCatalogReader({withAccess,assertSources}),reuse=createAssetReuse({ids,withAccess,withTargetAccess,assertSources,artifacts:()=>{throw Error('A02_AI_NO_TARGET_WRITE');}});
  const source=await reader.detail(user,c.sourceId,c.sourceVersion);
  assert(source.bodyAccess==='allowed','A02_AI_SOURCE_FORBIDDEN');
  const target=c.targetId?await reuse.readTarget({...user,researchProjectId:targetProjectId},c.targetId):null;
  assert(!target||target.version===c.targetVersion&&target.sourceStatus==='current','A02_AI_TARGET_CHANGED');
  return withAccess(user,'chat.use',async(tx,p)=>{
   const record=(await loadCatalogRecords(tx,p,assertSources)).find(x=>x.registry.assetId===c.sourceId),policy=record?.policies.find(x=>x.version===c.sourceVersion);
   assert(record?.family.family==='detail'&&policy?.sourceValid,'A02_AI_SOURCE_CHANGED');
   const [r]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,'ai') AS allowed",c.sourceId,c.sourceVersion);assert(r.allowed,'A02_AI_SOURCE_FORBIDDEN');
   return createAssetDetailAiBasis({source:{...source,policyHash:policy.policyHash},target,principal:p});
  });
 }
 return{inTx,
  async readBasis(user,caseKey){const c=cases.find(x=>x.key===caseKey&&x.accountId===user.accountId);assert(c,'A02_AI_NAMED_CASE_REQUIRED');return transaction(user,tx=>inTx(tx,user,c));},
  withCurrent(user,id,claim,run){return transaction(user,async tx=>{
   const job=await tx.knowledgeChatJob.findFirst({where:{id,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,status:'processing'}}),binding=job?.payload?.researchAssetDetail,c=cases.find(x=>x.key===binding?.caseKey&&x.accountId===user.accountId);
   assert(c&&job.requestKey===c.requestKey&&binding.requestKey===c.requestKey&&binding.intent===c.intent,'A02_AI_JOB_CHANGED');
   const session=await tx.session.findFirst({where:{id:job.sessionId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,agentId:ids.tenant+'-kb-research',channel:'knowledge',contextKey:'rh-asset-detail:'+c.key}});assert(session,'A02_AI_SESSION_CHANGED');
   await assertLiveClaim(tx,job,claim);const basis=await inTx(tx,user,c);assert(basis.basisHash===binding.basisHash,'A02_AI_SOURCE_CHANGED');
   return run(tx,job,basis);
  });},
 };
}
