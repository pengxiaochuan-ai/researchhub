import {randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {canManageRelease,normalizePolicySections} from './policy-input.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const missing=()=>fail(404,'RESEARCH_NOT_FOUND','研究方案不存在或当前账号无权查看。');
export async function authorizeReleaseContext(tx,user,ctx){
 if(!await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ctx.tenantId,featureKey:'study_operations',enabled:true}}))fail(403,'FEATURE_NOT_ENABLED','该功能尚未向当前租户开放，请联系平台管理员。');
 const [account,projectMember,groupMember]=await Promise.all([
  tx.account.findFirst({where:{id:user.accountId,tenantId:ctx.tenantId},select:{tenantId:true,role:true,isTenantAdmin:true}}),
  tx.researchProjectMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId,accountId:user.accountId,status:'active'}}),
  tx.studyGroupMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}}),
 ]);
 return canManageRelease({account,projectMember,groupMember});
}
const scope=(ctx)=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
async function protocol(tx,ctx,id,lock=false){
 const rows=lock?await tx.$queryRaw`SELECT id,status FROM public.study_protocol_version WHERE id=${id} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND "acceptanceFixture"=false FOR UPDATE`:await tx.$queryRaw`SELECT id,status FROM public.study_protocol_version WHERE id=${id} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND "acceptanceFixture"=false`;
 if(!rows[0])missing();return rows[0];
}
export async function latestPolicy(tx,ctx,id){
 const row=(await tx.$queryRaw`SELECT id,"versionNumber",status,sections,"contentHash","createdBy","createdAt","reviewedBy","reviewedAt" FROM public.study_execution_policy_version WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND "protocolVersionId"=${id} ORDER BY "versionNumber" DESC LIMIT 1`)[0];
 return row?{...row,createdAt:row.createdAt instanceof Date?row.createdAt.toISOString():row.createdAt,reviewedAt:row.reviewedAt instanceof Date?row.reviewedAt.toISOString():row.reviewedAt}:null;
}
export function createPolicyDraftService({studies}){
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>fn(tx,ctx,await authorizeReleaseContext(tx,user,ctx)));
 return {
  get:(user,studyId,protocolId)=>run(user,studyId,async(tx,ctx,canManage)=>{const p=await protocol(tx,ctx,protocolId);return {protocol:p,policy:await latestPolicy(tx,ctx,protocolId),capabilities:{canManageRelease:canManage}};}),
  save:(user,studyId,protocolId,body)=>{
   only(body,['requestKey','expectedPolicyId','sections']);validateMutation(body);if(body.expectedPolicyId!==null&&typeof body.expectedPolicyId!=='string')invalid();only(body.sections,['ethics','screening','researchConsent','dataUse','withdrawal','safety','site','blinding','captureReview','populationSchedule','simulation']);
   return run(user,studyId,async(tx,ctx,canManage)=>{
    if(!canManage)fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理方案审批。');
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
    const p=await protocol(tx,ctx,protocolId,true);const saved=await repository.getReceipt(tx,user,body.requestKey);
    if(saved){if(saved.request_hash!==requestHash(body)||saved.action!=='protocol.policy.save'||saved.target_id!==protocolId)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该保存请求已用于其他内容，请重新操作。');return saved.result;}
    if(p.status!=='draft')fail(409,'PROTOCOL_VERSION_LOCKED','方案已提交，不能修改政策草稿。');
    const previous=await latestPolicy(tx,ctx,protocolId);if((previous?.id??null)!==body.expectedPolicyId)fail(409,'RESEARCH_VERSION_CONFLICT','政策已改变，请刷新核对；输入已保留。');
    const sections=normalizePolicySections(body.sections,user.accountId,new Date()),hash=requestHash(sections),id='policy-'+randomUUID(),version=(previous?.versionNumber??0)+1;
    await tx.$executeRaw`INSERT INTO public.study_execution_policy_version (id,"tenantId","studyGroupId","researchProjectId","protocolVersionId","versionNumber",status,sections,"contentHash","createdBy") VALUES (${id},${ctx.tenantId},${ctx.studyGroupId},${ctx.executionProjectId},${protocolId},${version},'draft',${JSON.stringify(sections)}::jsonb,${hash},${user.accountId})`;
    const auditId='rh-audit-'+randomUUID(),receiptId='rh-op-'+randomUUID();
    await tx.auditLog.createMany({data:{id:auditId,...scope(ctx),accountId:user.accountId,action:'researchhub.protocol.policy.save',target:id,meta:{protocolVersionId:protocolId,policyVersion:version,contentHash:hash,requestKey:body.requestKey}}});
    const result={policy:await latestPolicy(tx,ctx,protocolId),receipt:{id:receiptId,requestKey:body.requestKey,action:'protocol.policy.save',targetId:protocolId}};
    await repository.saveReceipt(tx,user,{id:receiptId,key:body.requestKey,hash:requestHash(body),action:'protocol.policy.save',target:protocolId,result,auditId});return result;
   });
  },
 };
}
