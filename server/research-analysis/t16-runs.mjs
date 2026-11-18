import {invalid,only,researchError,validateMutation} from '../research-studies/contract.mjs';
import {assertAnalysisListLive} from '../http/analysis-list-lifetime.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const missing=()=>{throw researchError(404,'METHOD_RUN_NOT_FOUND','暂未找到可访问的分析运行，请保留核对记录。');};
/** Resolve one real Study first, then call MethodsService after the wrapper commits. */
export function createT16Runs({studies,methods}){
 if(typeof studies?.withResearchStudyTransaction!=='function'||!methods)throw Error('T16_REAL_SERVICES_REQUIRED');
 const scoped=(user,ctx)=>({...user,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
 const resolve=(user,studyId,query)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>({user:scoped(user,ctx),...(query?await query(tx,ctx):{})}));
 const where=(ctx,studyId)=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId,skillKey:'descriptive-statistics',inputSummary:{path:['studyId'],equals:studyId}});
 const find=async(user,studyId,runId)=>{if(!id(runId))invalid();return resolve(user,studyId,async(tx,ctx)=>{const run=await tx.researchMethodRun.findFirst({where:{...where(ctx,studyId),id:runId},select:{id:true}});if(!run)missing();return {runId:run.id};});};
 const presented=(studyId,result,requestKey)=>({studyId,...result,receipt:{requestKey,action:'analysis.run.create',targetId:studyId,runId:result.id}});
 return {
  async create(user,studyId,body){only(body,['requestKey','snapshotId']);validateMutation(body);if(!id(body.snapshotId))invalid();const ctx=await resolve(user,studyId);return presented(studyId,await methods.createFromWorkbench(ctx.user,{skillKey:'descriptive-statistics',idempotencyKey:body.requestKey,input:{studyId,snapshotId:body.snapshotId}}),body.requestKey);},
  async list(user,studyId,{signal}={}){assertAnalysisListLive(signal);const ctx=await resolve(user,studyId,async(tx,s)=>({ids:await tx.researchMethodRun.findMany({where:where(s,studyId),select:{id:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50})}));assertAnalysisListLive(signal);const items=[];for(const row of ctx.ids){assertAnalysisListLive(signal);items.push(await methods.getDescriptiveListItem(ctx.user,row.id));}assertAnalysisListLive(signal);return {studyId,items,limit:50};},
  async read(user,studyId,runId){const ctx=await find(user,studyId,runId);return {studyId,...await methods.get(ctx.user,ctx.runId)};},
  async capabilities(user,studyId,runId){const ctx=await find(user,studyId,runId),value=await methods.getDescriptiveCapabilities(ctx.user,ctx.runId);if(value?.runId!==ctx.runId||typeof value.status!=='string'||typeof value.reviewStatus!=='string'||typeof value.capabilities?.canReview!=='boolean'||typeof value.capabilities?.canCancel!=='boolean')throw researchError(503,'METHOD_CAPABILITIES_UNAVAILABLE','当前分析操作权限暂不可核对，请重新读取。');return {studyId,runId:ctx.runId,status:value.status,reviewStatus:value.reviewStatus,capabilities:{canReview:value.capabilities.canReview,canCancel:value.capabilities.canCancel}};},
  async receipt(user,studyId,requestKey){validateMutation({requestKey});const ctx=await resolve(user,studyId,async(tx,s)=>{const row=await tx.researchMethodRun.findFirst({where:{...where(s,studyId),accountId:user.accountId,idempotencyKey:requestKey},select:{id:true}});if(!row)missing();return {runId:row.id};});const result=await methods.getDescriptiveReceipt(ctx.user,requestKey);if(result.id!==ctx.runId)missing();return presented(studyId,result,requestKey);},
  async review(user,studyId,runId,body){only(body,['requestKey','conclusion','comment']);validateMutation(body);if(!['confirmed','returned','needs_input'].includes(body.conclusion)||typeof body.comment!=='string'||!body.comment.trim()||body.comment.length>5000)invalid();const ctx=await find(user,studyId,runId),result=await methods.review(ctx.user,runId,body),receipt=await methods.getDescriptiveReviewReceipt(ctx.user,runId,body.requestKey);return {studyId,...result,receipt:receipt.receipt};},
  async reviewReceipt(user,studyId,runId,requestKey){validateMutation({requestKey});const ctx=await find(user,studyId,runId);return {studyId,...await methods.getDescriptiveReviewReceipt(ctx.user,runId,requestKey)};},
  async cancel(user,studyId,runId){const ctx=await find(user,studyId,runId);return {studyId,...await methods.cancel(ctx.user,runId)};},
 };
}
