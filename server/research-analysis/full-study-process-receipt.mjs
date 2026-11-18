import {researchError,validateMutation} from '../research-studies/contract.mjs';
import * as repo from '../research-studies/repository.mjs';
import {fail} from './full-study-projection.mjs';

export function createFullStudyProcessReceipt({transaction,group,rows,present,analysis,verifyProcessRunInTransaction}){
 return async(u,studyId,id,key)=>{
  validateMutation({requestKey:key});
  return transaction(u,studyId,async(tx,s,actor)=>{
   const saved=await repo.getReceipt(tx,u,key);
   if(!saved||saved.action!=='full.analysis.run.process'||saved.target_id!==id||saved.result?.studyId!==studyId||saved.result?.runGroupId!==id)throw researchError(404,'FULL_STUDY_PROCESS_RECEIPT_NOT_FOUND','暂未查到原计算请求，请保留原核对记录。');
   const g=await group(tx,u,s,studyId,id);
   if(g.a.accountId!==u.accountId||g.a.meta.authVersion!==u.authVersion)throw researchError(403,'FULL_STUDY_RUN_ACTOR_CHANGED','请使用发起计算时的账号重新核对。');
   const claim=await tx.auditLog.findFirst({where:{...s,id:saved.result.claimId,accountId:u.accountId,action:'researchhub.full.analysis.process.claim',target:id}});
   if(!claim||claim.meta?.requestKey!==key||claim.meta.authVersion!==u.authVersion||typeof claim.meta.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(claim.meta.requestDigest)||saved.request_hash!==claim.meta.requestDigest||saved.audit_id!==claim.id)fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');
   const binding=g.a.meta.slices.find(b=>b.methodKey===claim.meta.methodKey&&b.snapshotId===claim.meta.snapshotId);if(!binding)fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');
   const currentRows=await rows(tx,s,g),matches=currentRows.filter(r=>r.idempotencyKey===binding.methodKey);if(matches.length>1)fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');
   let actual=matches[0],executionConfirmed=false,status='processing';
   if(actual){
    if(actual.accountId!==u.accountId||actual.skillKey!=='descriptive-statistics'||actual.inputSummary?.studyId!==studyId||actual.inputSummary?.snapshotId!==binding.snapshotId||!['tenantId','studyGroupId','researchProjectId'].every(k=>actual[k]===s[k]))fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');
    if(typeof verifyProcessRunInTransaction!=='function')throw researchError(503,'FULL_STUDY_PROCESS_AUTHORITY_UNAVAILABLE','当前计算结果暂不可核对。');
    const proof=new Map([[studyId+':'+g.current.basis.planId+':'+g.current.basis.planReviewId,{manifest:g.current.manifest,hash:g.current.basis.manifestHash}]]);
    const current=await analysis.assertCurrent(tx,u,s,studyId,binding.snapshotId,'snapshot',proof);
    actual=await verifyProcessRunInTransaction(tx,actor,actual,current);
    executionConfirmed=['needs_review','completed','needs_input','failed','cancelled'].includes(actual.status);
    if(executionConfirmed)status=['failed','cancelled'].includes(actual.status)?'failed':'completed';
   }
   // A finished HTTP attempt is not a native terminal proof. In particular an
   // abandoned running claim is never restarted or called complete by this GET.
   return{studyId,runGroupId:id,requestKey:key,status,executionConfirmed,group:{...present(studyId,g,currentRows),capabilities:{canReview:false,canCancel:false,canProcessRun:false}},receipt:{requestKey:key,action:'full.analysis.run.process',targetId:id}};
  });
 };
}
