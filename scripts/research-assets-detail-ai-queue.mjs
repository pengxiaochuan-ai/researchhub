import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {assetDetailAiCases,assertAssetDetailAiCase} from './research-assets-detail-ai-cases.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
const question='核对本固定资产与目标声明，生成待人工确认的定性解释。';

// Reuses the native Queue.enqueue + Sessions.ensureKnowledgeSession. The job
// create hook is part of the native queue transaction, never a later patch.
export function createAssetDetailAiQueue({ids,withAccess,current,fee,quota,sessionsInTx,authorizeInTx}){
 assert(typeof authorizeInTx==='function','A02_AI_AUTHORIZATION_LOCK_REQUIRED');
 const active=new AsyncLocalStorage(),cases=assetDetailAiCases(ids);let queue;
 const where=user=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId});
 async function gate(tx,user,c,expected){
  const basis=await current.inTx(tx,user,c);assert(basis.basisHash===expected,'A02_AI_SOURCE_CHANGED');
  const jobs=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,requestKey:{startsWith:'rh-asset-detail-ai-'}},select:{id:true}});fee.admitJobs(jobs);assert(fee.status().canStart,'A02_AI_FEE_BLOCKED');assert(jobs.length<4,'A02_AI_JOB_LIMIT');
  await quota.assert(user);return basis;
 }
 return{
  setQueue(value){assert(!queue&&typeof value?.enqueue==='function');queue=value;},
  async run(user,input){
   const c=assertAssetDetailAiCase(cases,user,input),requestHash=assetDigest({user:user.accountId,...input});
   const prepared=await withAccess(user,'chat.use',async(tx)=>{
    const old=await tx.knowledgeChatJob.findFirst({where:{...where(user),requestKey:c.requestKey}});
    if(old){assert(old.payload?.researchAssetDetail?.requestHash===requestHash,'A02_AI_KEY_CONFLICT');await current.inTx(tx,user,c);return{existing:{jobId:old.id,status:old.status}};}
    const basis=await gate(tx,user,c,input.basisHash);
    const session=await sessionsInTx(tx).ensureKnowledgeSession(user,ids.tenant+'-kb-research','rh-asset-detail:'+c.key,'科研资产定性核对');
    return{sessionId:session.id,basis};
   });
   if(prepared.existing)return prepared.existing;
   assert(queue,'A02_AI_QUEUE_NOT_READY');
   return active.run({user,c,requestHash,sessionId:prepared.sessionId,basisHash:input.basisHash},()=>queue.enqueue(user,prepared.sessionId,{text:question,requestKey:c.requestKey,kbIds:[]}));
  },
  async onJobCreate(tx,args,next){
   const context=active.getStore(),d=args.data,session=await tx.session.findUnique({where:{id:d.sessionId}});
   if(!context){assert(!d.payload?.researchAssetDetail&&!session?.contextKey?.startsWith('rh-asset-detail:'),'A02_AI_SERVER_CONTEXT_REQUIRED');return next(args);}
   const {user,c}=context;
   await authorizeInTx(tx,user);
   const binding=await current.inTx(tx,user,c);assert(binding.basisHash===context.basisHash,'A02_AI_SOURCE_CHANGED');
   assert(d.tenantId===ids.tenant&&d.studyGroupId===ids.group&&d.researchProjectId===ids.project&&d.accountId===user.accountId&&d.sessionId===context.sessionId&&d.requestKey===c.requestKey&&d.text===question&&session?.accountId===user.accountId&&session.contextKey==='rh-asset-detail:'+c.key,'A02_AI_JOB_CHANGED');
   const message=await tx.message.findUnique({where:{id:d.userMessageId}});assert(message?.role==='user'&&message.sessionId===d.sessionId&&message.content===question,'A02_AI_MESSAGE_CHANGED');
   assert(!d.payload?.kbIds?.length&&!d.payload?.attachments?.length,'A02_AI_UNEXPECTED_MATERIAL');
   assert(!Object.keys(d.payload??{}).some(k=>k.startsWith('research')||k.startsWith('hub')),'A02_AI_MIXED_INTENT');
   await gate(tx,user,c,context.basisHash);
   const job=await next({...args,data:{...d,payload:{...d.payload,researchAssetDetail:{caseKey:c.key,intent:c.intent,requestKey:c.requestKey,requestHash:context.requestHash,basisHash:binding.basisHash}}}});
   await tx.auditLog.create({data:{...where(user),action:'hub_asset_detail_ai_queued',target:job.id,meta:{caseKey:c.key,basisHash:binding.basisHash,sourceId:c.sourceId,sourceVersion:c.sourceVersion,targetId:c.targetId,targetVersion:c.targetVersion}}});
   return job;
  },
 };
}
