import {randomUUID} from 'node:crypto';
import {invalid,only,validateMutation,requestHash,researchError} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {cursorCodec,cursorBinding,pageLimit} from './capture-cursor.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
function baseline(body){validateMutation(body);if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)invalid();}
function reference(ref,assignmentId){
 only(ref,['responseId','assignmentId','revisionNo','contentHash']);
 if(!id(ref.responseId)||ref.assignmentId!==assignmentId||!Number.isSafeInteger(ref.revisionNo)||ref.revisionNo<1||typeof ref.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(ref.contentHash))invalid();
}
function reason(value,required=false){if(value!==undefined&&(typeof value!=='string'||!value.trim()||value.length>5000)||required&&value===undefined)invalid();}
/** Product mapping only. Current authority, policy, locks and facts stay in the shared transaction core. */
export function createFormalCaptureService({studies,core,receipts=repository,cursorSecret}){
 const cursor=cursorCodec(cursorSecret);
 const presentRevisions=(tx,s,items)=>core.presentRevisions?core.presentRevisions(tx,s,items):items;
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>fn(tx,scope(ctx)));
 const result=(studyId,assignmentId,action,body,value)=>({studyId,result:value,receipt:{requestKey:body.requestKey,action:'form.'+action,targetId:assignmentId}});
 async function assignmentReplay(tx,user,s,studyId,visitId,saved,requestKey){
  const value=saved?.result;
  if(!saved||saved.action!=='form.assign'||saved.target_id!==visitId||value?.studyId!==studyId||value.visitId!==visitId||value.receipt?.requestKey!==requestKey||value.receipt?.action!==saved.action||value.receipt?.targetId!==visitId||!id(value.result?.id))throw researchError(404,'FORM_RECEIPT_NOT_FOUND','尚未找到可确认的操作结果，请保留原操作状态。');
  const current=await core.read(tx,user,s,value.result.id);
  if(current.assignment.subjectVisitId!==visitId||current.assignment.formVersion.id!==value.result.formVersionId)throw researchError(409,'FORM_ASSIGNMENT_CHANGED','表单与访视的关联已变化，请重新核对。');
  return value;
 }
 return {
  historyList:(user,studyId,assignmentId,input={})=>{
   if(!id(assignmentId))invalid();only(input,['limit','cursor']);const limit=pageLimit(input.limit),binding=cursorBinding(user,studyId,'response-history',assignmentId);
   const beforeRevisionNo=input.cursor===undefined?undefined:cursor.decode(input.cursor,binding,value=>Number.isSafeInteger(value)&&value>0);
   return run(user,studyId,async(tx,s)=>{const page=await core.listRevisions(tx,user,s,assignmentId,{limit,...(beforeRevisionNo?{beforeRevisionNo}:{})});return {studyId,assignmentId,items:await presentRevisions(tx,s,page.items),legacyUnversioned:page.legacyUnversioned,nextCursor:page.nextBeforeRevisionNo?cursor.encode(binding,page.nextBeforeRevisionNo):null};});
  },
  historyRead:(user,studyId,assignmentId,ref)=>{
   if(!id(assignmentId))invalid();reference(ref,assignmentId);return run(user,studyId,async(tx,s)=>({studyId,assignmentId,revision:(await presentRevisions(tx,s,[await core.readRevision(tx,user,s,assignmentId,ref)]))[0]}));
  },
  read:(user,studyId,assignmentId)=>{
   if(!id(assignmentId))invalid();
   return run(user,studyId,async(tx,s)=>({studyId,...await core.read(tx,user,s,assignmentId)}));
  },
  receipt:(user,studyId,assignmentId,requestKey,query={})=>{
   if(!id(assignmentId))invalid();validateMutation({requestKey});only(query,['operation']);
   if(!['draft','submit','correct','review','lock','unlock'].includes(query.operation))invalid();
   return run(user,studyId,async(tx,s)=>result(studyId,assignmentId,query.operation,{requestKey},await core.receipt(tx,user,s,assignmentId,requestKey,query.operation)));
  },
  assignmentReceipt:(user,studyId,visitId,requestKey)=>{
   if(!id(visitId))invalid();validateMutation({requestKey});
   return run(user,studyId,async(tx,s)=>{
    await core.authorize(tx,user,s.studyGroupId,s.researchProjectId);
    return assignmentReplay(tx,user,s,studyId,visitId,await receipts.getReceipt(tx,user,requestKey),requestKey);
   });
  },
  assign:(user,studyId,visitId,body)=>{
   if(!id(visitId))invalid();only(body,['requestKey','formVersionId']);validateMutation(body);if(!id(body.formVersionId))invalid();
   return run(user,studyId,async(tx,s)=>{
    await core.authorize(tx,user,s.studyGroupId,s.researchProjectId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
    const saved=await receipts.getReceipt(tx,user,body.requestKey);
    if(saved){
     if(saved.request_hash!==requestHash(body))throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容。');
     return assignmentReplay(tx,user,s,studyId,visitId,saved,body.requestKey);
    }
    const value={...result(studyId,visitId,'assign',body,await core.assign(tx,user,s,visitId,body.formVersionId)),visitId};
    const auditId='rh-audit-'+randomUUID(),receiptId='rh-op-'+randomUUID();
    await tx.auditLog.createMany({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.form.assign',target:visitId,meta:{requestKey:body.requestKey,assignmentId:value.result.id,studyId}}});
    await receipts.saveReceipt(tx,user,{id:receiptId,key:body.requestKey,hash:requestHash(body),action:'form.assign',target:visitId,result:value,auditId});
    return value;
   });
  },
  write:(user,studyId,assignmentId,action,body)=>{
   if(!id(assignmentId)||!['draft','submit','correct'].includes(action))invalid();
   only(body,['requestKey','expectedVersion','answers',...(action==='correct'?['expectedRef','reason']:[])]);baseline(body);
   if(!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))invalid();
   if(action==='correct'){reference(body.expectedRef,assignmentId);reason(body.reason,true);}
   return run(user,studyId,async(tx,s)=>result(studyId,assignmentId,action,body,await core.write(tx,user,s,assignmentId,{...body,kind:action})));
  },
  review:(user,studyId,assignmentId,action,body)=>{
   if(!id(assignmentId)||!['review','lock','unlock'].includes(action))invalid();
   only(body,['requestKey','expectedVersion','expectedRef','reason',...(action==='review'?['decision']:[])]);baseline(body);reference(body.expectedRef,assignmentId);
   if(action==='review'&&!['approved','returned'].includes(body.decision))invalid();
   reason(body.reason,action==='unlock'||body.decision==='returned');
   const {decision,...command}=body,kind=action==='review'?'review_'+decision:action;
   return run(user,studyId,async(tx,s)=>result(studyId,assignmentId,action,body,await core.review(tx,user,s,assignmentId,{...command,kind})));
  },
 };
}
