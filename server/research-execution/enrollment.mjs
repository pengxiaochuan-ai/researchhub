import {randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const actor=(user,ctx)=>({...user,...scope(ctx)});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
function currentActor(principal,ctx,value){
 if(!value||value.accountId!==principal.accountId||value.tenantId!==ctx.tenantId||!Number.isSafeInteger(value.authVersion)||value.authVersion<0||value.authVersion!==principal.authVersion)fail(401,'AUTH_SESSION_EXPIRED','登录会话已变化，请重新登录。');
 return actor(value,ctx);
}
function confirmProof(saved,user,studyId,subjectId,requestKey,action,hash){
 const result=saved.result,p=result?.receipt;
 const bound=p?.proofVersion===1&&validId(p.id)&&p.id===saved.id&&p.requestKey===requestKey&&p.requestHash===hash&&p.actorId===user.accountId&&p.authVersion===user.authVersion&&p.studyId===studyId&&p.subjectId===subjectId&&p.targetId===subjectId&&p.action===action&&result.studyId===studyId&&result.subject?.id===subjectId&&validId(p.protocolId)&&p.protocolId===result.protocol?.id&&validId(p.policyVersionId)&&p.policyVersionId===result.policy?.id&&typeof p.policyHash==='string'&&/^[a-f0-9]{64}$/.test(p.policyHash)&&p.policyHash===result.policy?.contentHash;
 if(!bound)fail(409,'RESEARCH_RECEIPT_UNCONFIRMED','原操作证据尚不能严格核定，请保留记录并核对。');
 if(action==='participation.record'){
  const event=result.event,facts=Array.isArray(result.events)?result.events.filter(f=>f.id===p.eventId):[];
  if(!validId(p.eventId)||!Number.isSafeInteger(p.eventSequence)||p.eventSequence<1||!['screening','research_consent','data_use_consent','exit'].includes(p.eventKind)||event?.id!==p.eventId||event.sequence!==p.eventSequence||event.protocolVersionId!==p.protocolId||event.policyVersionId!==p.policyVersionId||event.policyHash!==p.policyHash||facts.length!==1||facts[0].sequence!==p.eventSequence||facts[0].kind!==p.eventKind||facts[0].recordedBy!==user.accountId)fail(409,'RESEARCH_RECEIPT_UNCONFIRMED','原参与记录证据不完整，请保留记录并核对。');
 }
 if(action==='participation.enroll'&&(!validId(result.enrollment?.id)||result.enrollment.subjectId!==subjectId||result.enrollment.protocolVersionId!==p.protocolId||result.enrollment.status!=='enrolled'))fail(409,'RESEARCH_RECEIPT_UNCONFIRMED','原入组证据不完整，请保留记录并核对。');
}
const snapshot=(context,evaluate)=>{
 const {enrollment,protocol,policy,events}=context, sections=policy.sections??{},issues=evaluate(policy,events);
 const active=!!enrollment&&['enrolled','grouped','in_progress'].includes(enrollment.status),open=!enrollment||active;
 const supported=section=>section?.status==='configured'||section?.status==='not_applicable';
 const screening=supported(sections.screening)&&(sections.screening.status==='not_applicable'||sections.screening.rules?.decisionMethod==='manual');
 const last=kind=>events.filter(event=>event.kind===kind).at(-1);
 const capabilities={canRecordScreening:!enrollment&&screening,canRecordResearchConsent:open&&supported(sections.researchConsent),canRecordDataUseConsent:open&&supported(sections.dataUse),canEnroll:!enrollment&&issues.length===0,canWithdrawResearchConsent:active&&last('research_consent')?.decision==='granted',canWithdrawDataUseConsent:active&&last('data_use_consent')?.decision==='granted',canExit:active};
 const reason={canRecordScreening:enrollment?'已经入组，不能更改筛选决定':'当前筛选政策未支持人工记录',canRecordResearchConsent:open?'当前研究同意政策尚不可用':'参与已结束',canRecordDataUseConsent:open?'当前数据用途政策尚不可用':'参与已结束',canEnroll:enrollment?'该被试已有入组记录':'请先完成筛选和同意',canWithdrawResearchConsent:active?'当前没有已授予的研究同意':'没有活动入组',canWithdrawDataUseConsent:active?'当前没有已授予的数据用途同意':'没有活动入组',canExit:'没有活动入组'};
 const disableReasons=Object.fromEntries(Object.entries(capabilities).filter(([,enabled])=>!enabled).map(([key])=>[key,reason[key]]));
 return {subject:{id:context.subject.id,subjectId:context.subject.subjectId},enrollment,protocol:{id:protocol.id,status:protocol.status,title:protocol.title,versionNumber:protocol.versionNumber},policy:{id:policy.id,contentHash:policy.contentHash,sections},events,eligibility:{ready:capabilities.canEnroll,issues},capabilities,disableReasons};
};
/** core is the existing operations service plus participation-events transaction functions. */
export function createEnrollmentService({studies,core,receipts=repository,centers}){
 const run=(user,id,fn)=>studies.withResearchStudyTransaction(user,id,'read',async(tx,ctx)=>fn(tx,ctx,actor(user,ctx)));
 const state=(tx,current,ctx,subjectId)=>core.context(tx,current,scope(ctx),subjectId);
 async function view(tx,ctx,principal,context,selected){
  const result=snapshot(context,core.evaluate);
  if(!centers)return result;
  const centerOptions=await centers.enrollmentOptions(tx,principal,ctx);
  const enrollmentCenter=selected??(context.enrollment?await centers.enrollmentCenter(tx,principal,ctx,context.enrollment.id):null);
  const centerCorrections=context.enrollment&&centers.enrollmentCenterCorrections
   ?await centers.enrollmentCenterCorrections(tx,principal,ctx,context.enrollment.id):null;
  return {...result,centerOptions,enrollmentCenter,centerCorrections};
 }
 async function visibleReceipt(tx,ctx,current,result){
  if(!centers||!result.centerOptions)return result;
  const centerOptions=await centers.enrollmentOptions(tx,current,ctx);
  const allowedIds=new Set(centerOptions.items.map(center=>center.id));
  const enrollmentId=result.enrollment?.id;
  // Keep the committed center in recovery only if it is still within the current scope.
  const visibleCenter=enrollmentId?await centers.enrollmentCenter(tx,current,ctx,enrollmentId):null;
  const enrolledCenter=result.enrollmentCenter;
  const enrollmentCenter=enrolledCenter&&(allowedIds.has(enrolledCenter.id)||visibleCenter?.id===enrolledCenter.id)?enrolledCenter:null;
  const centerCorrections=result.centerCorrections&&enrollmentId&&centers.enrollmentCenterCorrections
   ?await centers.enrollmentCenterCorrections(tx,current,ctx,enrollmentId):null;
  return {...result,centerOptions,enrollmentCenter,centerCorrections};
 }
 const command=(kind,user,studyId,subjectId,body)=>{
  only(body,kind==='record'?['requestKey','expectedPolicyVersionId','expectedPolicyHash','expectedLastEventId','event']:['requestKey','expectedPolicyVersionId','expectedPolicyHash','expectedLastEventId','armCode','siteId','centerId']);
  validateMutation(body);
  if(typeof body.expectedPolicyVersionId!=='string'||!body.expectedPolicyVersionId||typeof body.expectedPolicyHash!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedPolicyHash))invalid();
  if(Object.hasOwn(body,'expectedLastEventId')&&body.expectedLastEventId!==null&&!validId(body.expectedLastEventId))invalid();
  if(kind==='record'){only(body.event,['kind','decision','effectiveAt','evidence','reason','method','signer','textVersion','scope','siteId']);}
  else if(body.siteId!==undefined||body.centerId!==undefined&&(!centers||!validId(body.centerId))||body.armCode!==undefined&&(typeof body.armCode!=='string'||!body.armCode.trim()||body.armCode.length>100))invalid();
  return run(user,studyId,async(tx,ctx,principal)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const before=await state(tx,principal,ctx,subjectId),current=currentActor(user,ctx,before.actor),key='participation.'+kind,hash=requestHash(body),saved=await receipts.getReceipt(tx,current,body.requestKey);
   if(saved){if(saved.request_hash!==hash||saved.action!==key||saved.target_id!==subjectId)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容，请重新操作。');if(saved.result?.receipt?.proofVersion===1)confirmProof(saved,current,studyId,subjectId,body.requestKey,key,hash);return visibleReceipt(tx,ctx,current,saved.result);}
   if(before.policy.id!==body.expectedPolicyVersionId||before.policy.contentHash!==body.expectedPolicyHash)fail(409,'PARTICIPATION_POLICY_CHANGED','研究政策已变化，请刷新核对。');
   if(Object.hasOwn(body,'expectedLastEventId')&&body.expectedLastEventId!==(before.events.at(-1)?.id??null))fail(409,'PARTICIPATION_CHANGED','参与记录已变化，请刷新核对；输入已保留。');
   let event=null,center=null;
   if(kind==='record')event=await core.record(tx,current,scope(ctx),subjectId,body.event);
   else{
    center=centers?await centers.resolveEnrollmentCenter(tx,current,ctx,body.centerId):null;
    const enrolled=await core.enroll(current,{subjectId,armCode:body.armCode},tx,ctx.studyGroupId,ctx.executionProjectId);
    if(center)await centers.bindEnrollment(tx,current,ctx,enrolled.id,center);
   }
   const after=await state(tx,current,ctx,subjectId),auditId='rh-audit-'+randomUUID(),receiptId='rh-op-'+randomUUID();
   await tx.auditLog.createMany({data:{id:auditId,...scope(ctx),accountId:current.accountId,action:'researchhub.'+key,target:subjectId,meta:{requestKey:body.requestKey,requestHash:hash,authVersion:current.authVersion,...(center?{centerId:center.id}:{})}}});
   const result=JSON.parse(JSON.stringify({studyId,...await view(tx,ctx,current,after,center),...(event?{event}:{}),receipt:{proofVersion:1,id:receiptId,requestKey:body.requestKey,requestHash:hash,actorId:current.accountId,authVersion:current.authVersion,studyId,subjectId,protocolId:before.protocol.id,policyVersionId:before.policy.id,policyHash:before.policy.contentHash,action:key,targetId:subjectId,...(event?{eventId:event.id,eventSequence:event.sequence,eventKind:body.event.kind}:{})}}));
   confirmProof({id:receiptId,result},current,studyId,subjectId,body.requestKey,key,hash);
   await receipts.saveReceipt(tx,current,{id:receiptId,key:body.requestKey,hash,action:key,target:subjectId,result,auditId});return result;
  });
 };
 return {
  receipt:(user,studyId,subjectId,requestKey,input={})=>{
   validateMutation({requestKey});
   only(input,['action','requestHash']);
   if(input.action!==undefined&&!['record','enroll'].includes(input.action)||input.requestHash!==undefined&&(typeof input.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(input.requestHash)||input.action===undefined))invalid();
   return run(user,studyId,async(tx,ctx,principal)=>{
    const current=currentActor(user,ctx,await core.authorize(tx,principal,ctx.studyGroupId,ctx.executionProjectId));
    if(!await tx.subject.findFirst({where:{...scope(ctx),id:subjectId,deletedAt:null,acceptanceFixture:false},select:{id:true}}))fail(404,'RESEARCH_NOT_FOUND','被试不存在或当前账号无权查看。');
    const saved=await receipts.getReceipt(tx,current,requestKey),result=saved?.result;
    if(!saved||!['participation.record','participation.enroll'].includes(saved.action)||input.action!==undefined&&saved.action!=='participation.'+input.action||saved.target_id!==subjectId||result?.studyId!==studyId||result.receipt?.requestKey!==requestKey||result.receipt?.action!==saved.action||result.receipt?.targetId!==subjectId)fail(404,'RESEARCH_RECEIPT_NOT_FOUND','尚未找到可确认的操作结果，请保留原操作状态。');
    if(input.requestHash!==undefined){if(saved.request_hash!==input.requestHash)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','此请求与原操作不一致，请保留原记录并核对。');confirmProof(saved,current,studyId,subjectId,requestKey,saved.action,input.requestHash);}
    return visibleReceipt(tx,ctx,current,result);
   });
  },
  get:(user,studyId,subjectId)=>run(user,studyId,async(tx,ctx,principal)=>{
   const context=await state(tx,principal,ctx,subjectId);
   return view(tx,ctx,centers?currentActor(user,ctx,context.actor):principal,context);
  }),record:(user,studyId,subjectId,body)=>command('record',user,studyId,subjectId,body),enroll:(user,studyId,subjectId,body)=>command('enroll',user,studyId,subjectId,body),
 };
}
