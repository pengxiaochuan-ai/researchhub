import {randomUUID} from 'node:crypto';
import {invalid,only,validateMutation,requestHash,researchError} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
/** Only the process that committed a new attempt holds its transient token. Receipt replay only reads state. */
export function createOutreachService({studies,core,mailer,baseUrl,receipts=repository}){
 let origin;try{origin=new URL(baseUrl);}catch{throw Error('OUTREACH_BASE_URL_INVALID');}
 if((origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('OUTREACH_BASE_URL_INVALID');
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>fn(tx,scope(ctx)));
 const read=(user,studyId,invitationId)=>run(user,studyId,async(tx,s)=>({studyId,...await core.read(tx,user,s,invitationId)}));
 const receipt=(user,studyId,visitId,requestKey)=>{
  if(!id(visitId))invalid();validateMutation({requestKey});
  return run(user,studyId,async(tx,s)=>{const saved=await receipts.getReceipt(tx,user,requestKey);
   if(!saved||saved.action!=='outreach.email'||saved.target_id!==visitId||saved.result?.studyId!==studyId||!id(saved.result?.invitationId))throw researchError(404,'OUTREACH_RECEIPT_NOT_FOUND','尚未查到发送结果，请稍后再次核对。');
   const value=await core.read(tx,user,s,saved.result.invitationId);if(value.visitId!==visitId)throw researchError(409,'OUTREACH_BINDING_CHANGED','邀请关联已变化。');return {studyId,...value};});
 };
 return {read,receipt,send:async(user,studyId,visitId,body)=>{
  if(!id(visitId))invalid();only(body,['requestKey','formVersionId','address','emailConsentConfirmed']);validateMutation(body);
  if(!id(body.formVersionId)||typeof body.address!=='string'||body.address.length>254||body.emailConsentConfirmed!==true)invalid();
  let transient;
  const prepared=await run(user,studyId,async(tx,s)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const saved=await receipts.getReceipt(tx,user,body.requestKey),hash=requestHash(body);
   if(saved){
    if(saved.action!=='outreach.email'||saved.target_id!==visitId||saved.request_hash!==hash||saved.result?.studyId!==studyId||!id(saved.result?.invitationId))throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容。');
    const current=await core.read(tx,user,s,saved.result.invitationId);if(current.visitId!==visitId)throw researchError(409,'OUTREACH_BINDING_CHANGED','邀请关联已变化。');
    return saved.result;
   }
   if(typeof mailer!=='function')throw researchError(503,'OUTREACH_CHANNEL_UNAVAILABLE','邮件服务尚不可用，请联系管理员配置后再发送。');
   const participant=await core.register(tx,user,s,{visitId,address:body.address,emailConsentConfirmed:true});
   const created=await core.prepare(tx,user,s,{visitId,formVersionId:body.formVersionId,participantId:participant.participantId});
   transient=created.capability;
   const value={studyId,invitationId:created.invitationId,assignmentId:created.assignmentId,visitId};const auditId='rh-audit-'+randomUUID();
   await tx.auditLog.create({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.outreach.email',target:created.invitationId,meta:{requestKey:body.requestKey,studyId}}});
   await receipts.saveReceipt(tx,user,{id:'rh-op-'+randomUUID(),key:body.requestKey,hash,action:'outreach.email',target:visitId,result:value,auditId});return value;
  });
  if(transient){
   const deadline=Date.now()+6000;
   try{await run(user,studyId,(tx,s)=>core.send(tx,user,s,transient,async(address,token)=>{
    if(Date.now()>=deadline)return {status:'unknown'};
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),Math.min(5000,deadline-Date.now()));
    try{return await mailer({studyId,address,invitationUrl:new URL('/h5/questionnaire/'+encodeURIComponent(token),origin).href,signal:abort.signal});}finally{clearTimeout(timer);}
   }));}catch{/* Conservatively retain unknown; never retry an already committed attempt. */}
  }
  return read(user,studyId,prepared.invitationId);
 }};
}
