import {randomUUID} from 'node:crypto';
import {invalid,only,validateMutation,requestHash,researchError} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const binding=(user,studyId,subjectId)=>({actor:user.accountId,tenant:user.tenantId,authVersion:user.authVersion,studyId,subjectId:subjectId??null});
export function createVisitsService({studies,core,receipts=repository}){
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>fn(tx,scope(ctx)));
 async function replay(tx,user,s,studyId,visitId,operation,requestKey,saved){
  const value=saved?.result;
  if(!saved||saved.action!=='visit.'+operation||saved.target_id!==visitId||value?.studyId!==studyId||value.visit?.id!==visitId||value.receipt?.requestKey!==requestKey||value.receipt?.action!==saved.action||value.receipt?.targetId!==visitId)throw researchError(404,'VISIT_RECEIPT_NOT_FOUND','尚未找到可确认的操作结果，请保留原操作状态。');
  await core.read(tx,user,s,visitId);return value;
 }
 return {
  command:(user,studyId,visitId,operation,body)=>{
   if(!id(visitId)||!['start','complete','reverify'].includes(operation))invalid();
   only(body,['requestKey','expectedVersion',...(operation==='complete'?['notes']:operation==='reverify'?['reason']:[])]);validateMutation(body);
   if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.notes!==undefined&&(typeof body.notes!=='string'||body.notes.length>5000)||operation==='reverify'&&(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>5000))invalid();
   return run(user,studyId,async(tx,s)=>{
    await core.authorize(tx,user,s,operation);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
    const saved=await receipts.getReceipt(tx,user,body.requestKey);
    if(saved){if(saved.request_hash!==requestHash(body))throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容。');return replay(tx,user,s,studyId,visitId,operation,body.requestKey,saved);}
    const {requestKey,...command}=body;
    await core[operation](tx,user,s,visitId,command);
    const visit=await core.read(tx,user,s,visitId);
    const auditId='rh-audit-'+randomUUID(),receiptId='rh-op-'+randomUUID();
    const value=JSON.parse(JSON.stringify({studyId,visit,receipt:{requestKey,action:'visit.'+operation,targetId:visitId}}));
    await tx.auditLog.createMany({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.visit.'+operation,target:visitId,meta:{requestKey,studyId}}});
    await receipts.saveReceipt(tx,user,{id:receiptId,key:requestKey,hash:requestHash(body),action:'visit.'+operation,target:visitId,result:value,auditId});return value;
   });
  },
  receipt:(user,studyId,visitId,requestKey,query={})=>{
   if(!id(visitId))invalid();validateMutation({requestKey});only(query,['operation']);if(!['start','complete','reverify'].includes(query.operation))invalid();
   return run(user,studyId,async(tx,s)=>{await core.authorize(tx,user,s,query.operation);return replay(tx,user,s,studyId,visitId,query.operation,requestKey,await receipts.getReceipt(tx,user,requestKey));});
  },
  list:(user,studyId,query={})=>{
   only(query,['subjectId','limit','cursor']);
   if(query.subjectId!==undefined&&!id(query.subjectId))invalid();
   const raw=query.limit??'20';if(typeof raw!=='string'||!/^[1-9]\d{0,2}$/.test(raw)||Number(raw)>100)invalid();
   const identity=binding(user,studyId,query.subjectId);let afterId;
   if(query.cursor!==undefined){
    if(typeof query.cursor!=='string'||query.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(query.cursor))invalid();
    let value;try{value=JSON.parse(Buffer.from(query.cursor,'base64url').toString('utf8'));}catch{invalid();}
    if(!value||Object.keys(value).sort().join(',')!=='actor,afterId,authVersion,studyId,subjectId,tenant'||Object.entries(identity).some(([k,v])=>value[k]!==v)||!id(value.afterId))invalid();
    afterId=value.afterId;
   }
   return run(user,studyId,async(tx,s)=>{
    const value=await core.list(tx,user,s,{limit:Number(raw),...(query.subjectId?{subjectId:query.subjectId}:{}),...(afterId?{afterId}:{})});
    return {studyId,items:value.items,nextCursor:value.nextAfterId?Buffer.from(JSON.stringify({...identity,afterId:value.nextAfterId})).toString('base64url'):null};
   });
  },
  read:(user,studyId,visitId)=>{
   if(!id(visitId))invalid();
   return run(user,studyId,async(tx,s)=>({studyId,visit:await core.read(tx,user,s,visitId)}));
  },
 };
}
