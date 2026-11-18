import {randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {presentProtocol} from './protocols.mjs';
import {authorizeReleaseContext,latestPolicy} from './policy-drafts.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
async function find(tx,ctx,id){const p=await tx.studyProtocolVersion.findFirst({where:{...scope(ctx),id,acceptanceFixture:false},include});if(!p)fail(404,'RESEARCH_NOT_FOUND','研究方案不存在或当前账号无权查看。');return p;}
export async function releasePolicyPeople(tx,ctx,policy){
 if(!policy)return null;
 const ids=[...new Set([policy.createdBy,policy.reviewedBy].filter(id=>typeof id==='string'&&id))];
 const rows=ids.length?await tx.account.findMany({where:{tenantId:ctx.tenantId,id:{in:ids}},select:{id:true,displayName:true}}):[];
 const names=new Map(rows.map(row=>[row.id,typeof row.displayName==='string'?row.displayName.trim()||null:null]));
 return {...policy,createdByName:names.get(policy.createdBy)??null,reviewedByName:names.get(policy.reviewedBy)??null};
}
export function releaseCapabilities(canManage,protocol,policyIssues,release,fixedReferences,submissionPolicyIssues=policyIssues){
 const ready=policyIssues.length===0&&release.gate.ready===true&&fixedReferences.ready===true;
 return{canSubmitWithCheck:canManage&&protocol.status==='draft'&&submissionPolicyIssues.length===0,canApproveAndActivate:canManage&&protocol.status==='pending_review'&&ready,canManageRelease:canManage,canCheck:canManage&&['draft','pending_review'].includes(protocol.status),canSubmit:canManage&&protocol.status==='draft'&&submissionPolicyIssues.length===0&&release.gate.ready===true&&fixedReferences.ready===true,canReturn:canManage&&protocol.status==='pending_review',canApprove:canManage&&protocol.status==='pending_review'&&ready,canActivate:canManage&&protocol.status==='approved'&&ready};
}
export function createProtocolReleaseService({studies,core}){
 const run=(principal,id,fn)=>studies.withResearchStudyTransaction(principal,id,'read',async(tx,ctx)=>{
  const account=await tx.account.findFirst({where:{id:principal.accountId,tenantId:ctx.tenantId},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}});
  if(!account||account.authVersion!==principal.authVersion)fail(401,'AUTH_SESSION_EXPIRED','登录会话已变化，请重新登录。');
  const current={accountId:account.id,tenantId:ctx.tenantId,role:account.role,isTenantAdmin:account.isTenantAdmin,authVersion:account.authVersion};
  return fn(tx,ctx,await authorizeReleaseContext(tx,current,ctx),current);
 });
 const actor=(user,ctx)=>({...user,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
 const command=(action,principal,studyId,protocolId,body)=>{
  const extras=['approve','check','submit'].includes(action)?['policyVersionId','expectedPolicyHash']:action==='return'?['reason']:action==='activate'?['migrateExisting','previewToken']:[];
  only(body,['requestKey','expectedRevision',...extras]);validateMutation(body);if(typeof body.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedRevision))invalid();
  const policyBound=Object.hasOwn(body,'policyVersionId')||Object.hasOwn(body,'expectedPolicyHash');
  if((action==='approve'||policyBound)&&(typeof body.policyVersionId!=='string'||!body.policyVersionId||typeof body.expectedPolicyHash!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedPolicyHash)))invalid();
  if(action==='return'&&(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>5000))invalid();
  if(action==='activate'&&(body.migrateExisting!==undefined&&typeof body.migrateExisting!=='boolean'||body.previewToken!==undefined&&typeof body.previewToken!=='string'))invalid();
  return run(principal,studyId,async(tx,ctx,canManage,user)=>{
   if(!canManage)fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理方案审批。');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${ctx.executionProjectId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM public.study_protocol_version WHERE id=${protocolId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} FOR UPDATE`;
   const protocol=await find(tx,ctx,protocolId),saved=await repository.getReceipt(tx,user,body.requestKey),key='protocol.'+action;
   if(saved){if(saved.request_hash!==requestHash(body)||saved.action!==key||saved.target_id!==protocolId)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容，请重新操作。');if(saved.result?.receipt?.proofVersion===1&&(saved.result.receipt.authVersion!==user.authVersion||saved.result.receipt.actorId!==user.accountId||saved.result.receipt.studyId!==studyId||saved.result.receipt.requestHash!==saved.request_hash||saved.result.receipt.requestKey!==body.requestKey||saved.result.receipt.action!==key||saved.result.receipt.targetId!==protocolId))fail(409,'RESEARCH_RECEIPT_UNCONFIRMED','原操作证据与当前会话不一致，请核对当前方案。');return saved.result;}
   if(presentProtocol(protocol).revision!==body.expectedRevision)fail(409,'RESEARCH_VERSION_CONFLICT','方案已改变，请刷新核对；输入已保留。');
   if(policyBound&&['check','submit'].includes(action)){const policy=await latestPolicy(tx,ctx,protocolId);if(protocol.status!=='draft'||!policy||policy.id!==body.policyVersionId||policy.contentHash!==body.expectedPolicyHash||policy.status!=='draft')fail(409,'EXECUTION_POLICY_CONFLICT','研究政策或方案状态已变化，请重新核对。');}
   const current=actor(user,ctx);let impact=null,check=null;
   if(action==='check'){const raw=await core.runProtocolReleaseCheckInTransaction(current,protocolId,tx,ctx.studyGroupId,ctx.executionProjectId);const fixedReferences=await core.fixedReferenceStatusInTransaction(tx,ctx.tenantId,ctx.studyGroupId,ctx.executionProjectId,protocolId);check={...raw,fixedReferences,gate:{...raw.gate,ready:raw.gate.ready&&fixedReferences.ready}};}
   if(action==='submit')await core.transitionProtocolInTransaction(current,protocolId,'pending_review',undefined,tx,ctx.studyGroupId,ctx.executionProjectId);
   if(action==='return')await core.transitionProtocolInTransaction(current,protocolId,'draft',body.reason,tx,ctx.studyGroupId,ctx.executionProjectId);
   if(action==='approve')await core.approveProtocolInTransaction(current,protocolId,body.policyVersionId,body.expectedPolicyHash,tx,ctx.studyGroupId,ctx.executionProjectId);
   if(action==='activate'){
    if(body.migrateExisting)fail(409,'PROTOCOL_MIGRATION_PREVIEW_REQUIRED','历史入组转版尚需预览并显式确认。');
    impact=(await core.activateProtocolInTransaction(current,protocolId,tx,ctx.studyGroupId,ctx.executionProjectId)).impact;
   }
   const auditId='rh-audit-'+randomUUID(),receiptId='rh-op-'+randomUUID();
   await tx.auditLog.createMany({data:{id:auditId,...scope(ctx),accountId:user.accountId,action:'researchhub.'+key,target:protocolId,meta:{requestKey:body.requestKey,requestHash:requestHash(body),authVersion:user.authVersion}}});
   const finalProtocol=await find(tx,ctx,protocolId);
   const result=JSON.parse(JSON.stringify({approvedPolicy:finalProtocol.approvedPolicyVersionId?{id:finalProtocol.approvedPolicyVersionId,contentHash:finalProtocol.approvedPolicyHash}:null,protocol:presentProtocol(finalProtocol),policy:await latestPolicy(tx,ctx,protocolId),...(impact?{impact}:{}),...(check?{check}:{}),receipt:{proofVersion:1,id:receiptId,requestKey:body.requestKey,requestHash:requestHash(body),authVersion:user.authVersion,actorId:user.accountId,studyId,action:key,targetId:protocolId}}));
   await repository.saveReceipt(tx,user,{id:receiptId,key:body.requestKey,hash:requestHash(body),action:key,target:protocolId,result,auditId});return result;
  });
 };
 return {
  receipt:(principal,studyId,protocolId,requestKey,input={})=>{
   only(input,['action','requestHash']);if(input.requestHash!==undefined&&(typeof input.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(input.requestHash)))invalid();if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(requestKey)||!['check','submit','return','approve','activate','policy'].includes(input.action))invalid();
   return run(principal,studyId,async(tx,ctx,canManage,user)=>{
    if(!canManage)fail(403,'RESEARCH_FORBIDDEN','当前账号无权核对方案操作结果。');
    await find(tx,ctx,protocolId);
    const saved=await repository.getReceipt(tx,user,requestKey);if(!saved)return{found:false};
    const action=input.action==='policy'?'protocol.policy.save':'protocol.'+input.action;
    if(saved.action!==action||saved.target_id!==protocolId)fail(404,'RESEARCH_NOT_FOUND','此操作记录不存在或当前账号无权查看。');
    if(input.requestHash!==undefined){
     if(saved.request_hash!==input.requestHash)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','此请求与原操作不一致，请保留原记录并核对。');
     const proof=saved.result?.receipt;
     if(proof?.proofVersion!==1||proof.requestHash!==input.requestHash||proof.authVersion!==user.authVersion||proof.actorId!==user.accountId||proof.studyId!==studyId||proof.targetId!==protocolId||proof.action!==action||proof.requestKey!==requestKey)fail(409,'RESEARCH_RECEIPT_UNCONFIRMED','原操作证据尚不能严格核定，请保留记录并核对当前方案。');
    }
    return{found:true,result:saved.result};
   });
  },
  get:(principal,studyId,protocolId)=>run(principal,studyId,async(tx,ctx,canManage,user)=>{
   const p=await find(tx,ctx,protocolId),policy=await latestPolicy(tx,ctx,protocolId),release=await core.protocolReleaseStatusInTransaction(tx,ctx.studyGroupId,ctx.executionProjectId,protocolId),fixedReferences=await core.fixedReferenceStatusInTransaction(tx,ctx.tenantId,ctx.studyGroupId,ctx.executionProjectId,protocolId);
   const policyIssues=policy?core.previewExecutionPolicy(policy,user.accountId):['policy_missing'],submissionPolicyIssues=policy?core.previewSubmissionPolicy(policy):['policy_missing'];
   return{approvedPolicy:p.approvedPolicyVersionId?{id:p.approvedPolicyVersionId,contentHash:p.approvedPolicyHash}:null,protocol:presentProtocol(p),policy:await releasePolicyPeople(tx,ctx,policy),release,fixedReferences,policyIssues,submissionPolicyIssues,capabilities:releaseCapabilities(canManage,p,policyIssues,release,fixedReferences,submissionPolicyIssues)};
  }),
  check:(user,studyId,protocolId,body)=>command('check',user,studyId,protocolId,body),
  submit:(user,studyId,protocolId,body)=>command('submit',user,studyId,protocolId,body),
  returnToDraft:(user,studyId,protocolId,body)=>command('return',user,studyId,protocolId,body),
  approve:(user,studyId,protocolId,body)=>command('approve',user,studyId,protocolId,body),
  activate:(user,studyId,protocolId,body)=>command('activate',user,studyId,protocolId,body),
 };
}
