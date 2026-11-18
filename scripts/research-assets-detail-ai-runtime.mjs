import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetDetailAiCurrent} from './research-assets-detail-ai-current.mjs';
import {createAssetDetailAiQueue} from './research-assets-detail-ai-queue.mjs';
import {assetDetailAiCases} from './research-assets-detail-ai-cases.mjs';
import {assetDetailAiMessages,parseAssetDetailAi} from './research-assets-detail-ai.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
import {AssetDetailAiFeeGuard} from './research-assets-detail-ai-fee.mjs';

export function assertAssetDetailOpinionBasis({basis,job,message,expectedRevision,revision}){assert(job?.status==='completed'&&message?.id===job.assistantMessageId&&job.payload?.researchAssetDetail?.basisHash===basis.basisHash&&message.meta?.provenance?.assetDetailResult?.basisHash===basis.basisHash,'A02_AI_RESULT_CHANGED');assert(Number.isSafeInteger(expectedRevision)&&expectedRevision===revision,'A02_AI_OPINION_VERSION_CHANGED');}

export function createAssetDetailAiRuntime({root,ids,prisma,scope,require,storage,quota,queue,catalog}){
 const {withAuthorizationMutation,lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts'),{assertLiveClaim}=require(root+'app/server/src/common/worker-claim.ts'),{SessionsService}=require(root+'app/server/src/sessions/sessions.service.ts');
 const transaction=(u,fn)=>withAuthorizationMutation(prisma,u.tenantId,fn,{studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,includeOfficial:true}),withAccess=createCatalogAccess({ids,transaction});
 const current=createAssetDetailAiCurrent({ids,transaction,assertSources:catalog.assertSources,assertLiveClaim:(tx,_j,c)=>assertLiveClaim(tx,scope,c)});
 const path=root+'.tmp/researchhub-a02-asset-detail-ai/fee-approval.json';readFileSync(path); // Never initialize approval/budget implicitly.
 const budgetPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledger=JSON.parse(readFileSync(budgetPath));assert(Number.isFinite(Date.parse(ledger.priceValidUntil)),'A02_AI_EXISTING_LEDGER_REQUIRED');
 const fee=new AssetDetailAiFeeGuard({approvalPath:path,budget:new LocalAiBudget(budgetPath)});
 const cases=assetDetailAiCases(ids),intake=createAssetDetailAiQueue({ids,withAccess,current,fee,quota,sessionsInTx:tx=>new SessionsService({forTenant:()=>tx},storage,null,null,null,{}),authorizeInTx:(tx)=>lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true})});intake.setQueue(queue);
 const pick=(u,id,v)=>cases.filter(c=>c.accountId===u.accountId&&c.sourceId===id&&String(c.sourceVersion)===String(v));
 async function validate(tx,turn){
  await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});await assertLiveClaim(tx,scope,turn.execution.claim);
  const j=await tx.knowledgeChatJob.findFirst({where:{id:turn.jobId,tenantId:ids.tenant,accountId:turn.user.accountId,sessionId:turn.sessionId,status:'processing'}}),b=j?.payload?.researchAssetDetail,c=cases.find(c=>c.key===b?.caseKey&&c.accountId===turn.user.accountId);
  assert(c&&j.requestKey===c.requestKey&&b.basisHash===turn.assetDetail.basis.basisHash,'A02_AI_JOB_CHANGED');
  const s=await tx.session.findFirst({where:{id:j.sessionId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:turn.user.accountId,agentId:ids.tenant+'-kb-research',channel:'knowledge',contextKey:'rh-asset-detail:'+c.key}});assert(s,'A02_AI_SESSION_CHANGED');
  const fresh=await current.inTx(tx,turn.user,c);assert(fresh.basisHash===b.basisHash,'A02_AI_SOURCE_CHANGED');return fresh;
 }
 async function status(u,id,v){return withAccess(u,'artifact.read',async tx=>{
  const result=[];for(const c of pick(u,id,v)){
   const basis=await current.inTx(tx,u,c),j=await tx.knowledgeChatJob.findFirst({where:{tenantId:ids.tenant,accountId:u.accountId,requestKey:c.requestKey}});let ai=null;
   if(j?.status==='completed'){const m=await tx.message.findFirst({where:{id:j.assistantMessageId,sessionId:j.sessionId,tenantId:ids.tenant,role:'assistant'}}),r=m?.meta?.provenance?.assetDetailResult;assert(r?.basisHash===basis.basisHash,'A02_AI_RESULT_CHANGED');ai={messageId:m.id,items:r.items};}
   const opinions=await tx.auditLog.findMany({where:{tenantId:ids.tenant,accountId:u.accountId,action:'hub_asset_detail_ai_opinion',target:c.requestKey},orderBy:{createdAt:'asc'}});
   let canStart=false;try{canStart=!j&&fee.status().canStart&&(await quota.status(u)).canStart;}catch{}
   result.push({caseKey:c.key,requestKey:c.requestKey,basisHash:basis.basisHash,intent:c.intent,status:j?.status??'not_requested',jobId:j?.id??null,canStart,ai,opinions:opinions.map(x=>x.meta)});
  }return{items:result};
 });}
 return{fee,status,onJobCreate:intake.onJobCreate,
  run:async(u,id,v,b)=>{assert(pick(u,id,v).some(c=>c.key===b.caseKey),'A02_AI_NAMED_CASE_REQUIRED');await intake.run(u,b);return status(u,id,v);},
  async prepare(u,jobId){return withAccess(u,'chat.use',async tx=>{const j=await tx.knowledgeChatJob.findFirst({where:{id:jobId,tenantId:ids.tenant,accountId:u.accountId,status:'processing'}}),b=j?.payload?.researchAssetDetail;if(!b)return null;const c=cases.find(c=>c.key===b.caseKey&&c.accountId===u.accountId);assert(c);const basis=await current.inTx(tx,u,c);assert(basis.basisHash===b.basisHash);return{basis,intent:c.intent,messages:assetDetailAiMessages(basis,c.intent)};});},
  validate,beforeProvider:turn=>transaction(turn.user,tx=>validate(tx,turn)),
  accept:async(result,turn)=>{await transaction(turn.user,tx=>validate(tx,turn));const parsed=parseAssetDetailAi(result.text,turn.assetDetail.basis);return{basisHash:turn.assetDetail.basis.basisHash,items:parsed.items};},
  async opinions(u,id,v,body){return withAccess(u,'artifact.edit',async tx=>{
   assert(Object.keys(body).sort().join(',')==='caseKey,decision,expectedRevision,messageId,reason,requestKey','A02_AI_INPUT_INVALID');assert(['reference','revise','decline'].includes(body.decision)&&typeof body.reason==='string'&&body.reason.trim()&&body.reason.length<=1000&&/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey),'A02_AI_INPUT_INVALID');
   const c=pick(u,id,v).find(c=>c.key===body.caseKey);assert(c);const basis=await current.inTx(tx,u,c);
   const j=await tx.knowledgeChatJob.findFirst({where:{tenantId:ids.tenant,accountId:u.accountId,requestKey:c.requestKey,status:'completed',assistantMessageId:body.messageId}});assert(j,'A02_AI_RESULT_CHANGED');
   const old=await tx.auditLog.findMany({where:{tenantId:ids.tenant,accountId:u.accountId,action:'hub_asset_detail_ai_opinion',target:c.requestKey},orderBy:{createdAt:'asc'}}),hash=assetDigest(body),prior=old.find(x=>x.meta.requestKey===body.requestKey);if(prior){assert(prior.meta.hash===hash,'A02_AI_KEY_CONFLICT');return prior.meta;}const message=await tx.message.findFirst({where:{id:body.messageId,sessionId:j.sessionId,tenantId:ids.tenant,role:'assistant'}});assertAssetDetailOpinionBasis({basis,job:j,message,expectedRevision:body.expectedRevision,revision:old.length});assert(old.length<3,'A02_AI_OPINION_CAPACITY');
   const meta={requestKey:body.requestKey,hash,messageId:body.messageId,decision:body.decision,reason:body.reason.trim(),revision:old.length+1};await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'hub_asset_detail_ai_opinion',target:c.requestKey,meta}});return meta;
  });},
 };
}
