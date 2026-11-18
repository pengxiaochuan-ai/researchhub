import {randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const missing=()=>fail(404,'RESEARCH_NOT_FOUND','被试不存在或当前账号无权查看。');
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const code=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x);
async function permissions(tx,user,ctx){
 if(!await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ctx.tenantId,featureKey:'study_operations',enabled:true}}))fail(403,'FEATURE_NOT_ENABLED','该功能尚未向当前租户开放。');
 const [account,projectMember,groupMember]=await Promise.all([
  tx.account.findFirst({where:{id:user.accountId,tenantId:ctx.tenantId},select:{role:true,isTenantAdmin:true}}),
  tx.researchProjectMembership.findFirst({where:{...scope(ctx),accountId:user.accountId,status:'active'}}),
  tx.studyGroupMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}}),
 ]);
 const admin=account?.role==='tenant_admin'&&account.isTenantAdmin===true, role=groupMember?.role;
 const member=Boolean(account?.role==='researcher'&&account.isTenantAdmin===false&&projectMember&&role?.tenantId===ctx.tenantId&&role.status==='active');
 const has=(kind,value)=>Array.isArray(role?.[kind])&&role[kind].includes(value);
 return {canRead:admin||member&&has('menuPermissions','subjects'),canCreate:admin||member&&has('menuPermissions','subjects')&&has('buttonPermissions','subject.create'),canExecute:admin||member&&has('menuPermissions','workbench')&&has('buttonPermissions','study.execute')};
}
export function createSubjectsService({studies,core,receipts=repository,limitedImportRead,limitedMediaRead}){
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>fn(tx,ctx,await permissions(tx,user,ctx)));
 const readLimit=async(tx,user,ctx,p)=>{
  if(p.canRead)return null;
  const values=[],valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);let denied;
  for(const reader of [limitedImportRead,limitedMediaRead].filter(Boolean)){
   let value;try{value=await reader(tx,user,ctx);}catch(e){if([403,404].includes(e.status??e.getStatus?.())){denied??=e;continue;}throw e;}
   if(value==null)continue;
   if(!Array.isArray(value.subjectIds)||!Array.isArray(value.visitIds)||value.subjectIds.length>1000||value.visitIds.length>1000||[...value.subjectIds,...value.visitIds].some(x=>!valid(x)))fail(403,'RESEARCH_FORBIDDEN','当前账号无权查看被试。');values.push(value);
  }
  if(!values.length){if(denied)throw denied;fail(403,'RESEARCH_FORBIDDEN','当前账号无权查看被试。');}
  return{subjectIds:[...new Set(values.flatMap(x=>x.subjectIds))],visitIds:[...new Set(values.flatMap(x=>x.visitIds))]};
 };
 return {
  receipt:(user,studyId,requestKey)=>{
   validateMutation({requestKey});
   return run(user,studyId,async(tx,ctx,p)=>{
    if(!p.canCreate)fail(403,'RESEARCH_FORBIDDEN','当前账号无权核对建档操作。');
    const saved=await receipts.getReceipt(tx,user,requestKey),result=saved?.result;
    if(!saved||saved.action!=='subject.create'||saved.target_id!==studyId||result?.studyId!==studyId||result.receipt?.requestKey!==requestKey||result.receipt?.action!==saved.action||result.receipt?.targetId!==studyId)fail(404,'RESEARCH_RECEIPT_NOT_FOUND','尚未找到可确认的操作结果，请保留原操作状态。');
    return result;
   });
  },
  list:(user,studyId,input={})=>{
   only(input,['query','limit','cursor']);const query=input.query??'',raw=input.limit??'20';
   if(typeof query!=='string'||query.length>64||!/^[-A-Za-z0-9_]*$/.test(query)||typeof raw!=='string'||!/^[1-9]\d{0,2}$/.test(raw)||Number(raw)>100)invalid();
   let after='';if(input.cursor!==undefined){try{const x=JSON.parse(Buffer.from(input.cursor,'base64url').toString());if(typeof input.cursor!=='string'||input.cursor.length>2048||x.tenant!==user.tenantId||x.actor!==user.accountId||x.studyId!==studyId||x.query!==query||!code(x.after))invalid();after=x.after;}catch{invalid();}}
   return run(user,studyId,async(tx,ctx,p)=>{const limited=await readLimit(tx,user,ctx,p);
    const rows=await tx.subject.findMany({where:{...scope(ctx),acceptanceFixture:false,deletedAt:null,...(limited?{id:{in:limited.subjectIds},createdBy:user.accountId}:{}),subjectId:{...(query?{contains:query,mode:'insensitive'}:{}),...(after?{gt:after}:{})}},select:{id:true,subjectId:true},orderBy:{subjectId:'asc'},take:Number(raw)+1});
    const items=rows.slice(0,Number(raw));return {items,nextCursor:rows.length>Number(raw)?Buffer.from(JSON.stringify({tenant:user.tenantId,actor:user.accountId,studyId,query,after:items.at(-1).subjectId})).toString('base64url'):null,capabilities:limited?{...p,canRead:true}:p};
   });
  },
  detail:(user,studyId,subjectId)=>{if(typeof subjectId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(subjectId))invalid();return run(user,studyId,async(tx,ctx,p)=>{
   const limited=await readLimit(tx,user,ctx,p);if(limited&&!limited.subjectIds.includes(subjectId))missing();const s=scope(ctx);
   const subject=await tx.subject.findFirst({where:{...s,id:subjectId,acceptanceFixture:false,deletedAt:null,...(limited?{createdBy:user.accountId}:{})},select:{id:true,subjectId:true,createdAt:true}});if(!subject)missing();
   const enrollment=await tx.studyEnrollment.findFirst({where:{...s,subjectId:subject.id,acceptanceFixture:false},select:{id:true,status:true,protocolVersionId:true,enrolledAt:true,withdrawnAt:true}});
   const rows=enrollment?await tx.subjectVisit.findMany({where:{...s,subjectId:subject.id,enrollmentId:enrollment.id,acceptanceFixture:false,...(limited?{id:{in:limited.visitIds}}:{})},select:{id:true,status:true,visitPlanId:true,protocolVersionId:true,targetDate:true,windowStart:true,windowEnd:true,scheduleState:true},orderBy:{createdAt:'asc'}}):[];
   const plans=rows.length?await tx.visitPlan.findMany({where:{...s,id:{in:[...new Set(rows.map(v=>v.visitPlanId))]}},select:{id:true,protocolVersionId:true,name:true,sequence:true}}):[];
   const visits=rows.map(row=>{const plan=plans.find(p=>p.id===row.visitPlanId);if(!plan||plan.protocolVersionId!==row.protocolVersionId)fail(409,'SUBJECT_VISIT_BINDING_UNAVAILABLE','访视与研究方案的关联尚需核对，请联系研究负责人。');return {...row,visitPlan:{name:plan.name,sequence:plan.sequence}};});
   return JSON.parse(JSON.stringify({subject,enrollment,visits,capabilities:limited?{...p,canRead:true}:p}));
  });},
  create:async(user,studyId,body)=>{
   only(body,['requestKey','subjectId']);validateMutation(body);if(!code(body.subjectId))invalid();
   return run(user,studyId,async(tx,ctx,p)=>{
    if(!p.canCreate)fail(403,'RESEARCH_FORBIDDEN','当前账号无权建档。');
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
    const action='subject.create',saved=await receipts.getReceipt(tx,user,body.requestKey);
    if(saved){if(saved.action!==action||saved.target_id!==studyId||saved.request_hash!==requestHash(body))fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容，请重新操作。');return saved.result;}
    const current={...user,...scope(ctx)},row=await core.createInTransaction(tx,current,{subjectId:body.subjectId});
    const auditId='rh-audit-'+randomUUID(),id='rh-op-'+randomUUID();await tx.auditLog.createMany({data:{id:auditId,...scope(ctx),accountId:user.accountId,action:'researchhub.'+action,target:row.subjectId,meta:{requestKey:body.requestKey,studyId}}});
    const result={studyId,subject:{id:row.id,subjectId:row.subjectId},receipt:{id,requestKey:body.requestKey,action,targetId:studyId}};
    await receipts.saveReceipt(tx,user,{id,key:body.requestKey,hash:requestHash(body),action,target:studyId,result,auditId});return result;
   });
  },
 };
}
