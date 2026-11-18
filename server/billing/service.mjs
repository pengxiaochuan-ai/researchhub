import {createHash} from 'node:crypto';
import {verifiedUsage} from './attempts.mjs';
import {PROTECTED_EXPIRY} from './attempt-protection.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code});};
const conflict=()=>fail(409,'HUB_TOKEN_CONFLICT','记录或核验依据已变化，请核对最新状态。');
const notFound=()=>fail(404,'HUB_TOKEN_NOT_FOUND','记录不存在或不可访问。');

export function createHubBilling({scope,transaction,billing}){
 async function actor(tx,user,admin=false){
  if(!user||!scope.allowedTenantIds.includes(user.tenantId)||!Number.isSafeInteger(user.authVersion))fail(401,'HUB_TOKEN_UNAUTHENTICATED','登录会话已失效，请重新登录。');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wp01:tenant:${user.tenantId}`},0))`;
  const a=await tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true}});
  if(!a)fail(401,'HUB_TOKEN_UNAUTHENTICATED','登录会话已失效，请重新登录。');
  if(admin&&(a.role!=='tenant_admin'||!a.isTenantAdmin))fail(403,'HUB_TOKEN_FORBIDDEN','当前账号无权处理用量对账。');
  return a;
 }
 async function locks(tx,user,id){
  if(!scope.allowedTenantIds.includes(user.tenantId))notFound();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wp01:tenant:${user.tenantId}`},0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aisci-token-quota:${user.tenantId}`},0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  await tx.$queryRaw`SELECT id FROM public.token_quota_reservation WHERE id=${id} AND "tenantId"=${user.tenantId} FOR UPDATE`;
 }
 async function inspect(tx,user,id){
  const row=await tx.tokenQuotaReservation.findFirst({where:{id,tenantId:user.tenantId},include:{account:{select:{displayName:true}}}});if(!row)notFound();
  const events=await tx.auditLog.findMany({where:{tenantId:user.tenantId,target:id,action:{in:['hub.token.attempt.started','hub.token.attempt.completed','hub.token.attempt.unknown','hub.token.execution.sealed','hub.token.execution.inconsistent']}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  const binding=events[0]?.meta,usage=binding?verifiedUsage(events,binding):null;
  const job=binding?await tx.knowledgeChatJob.findFirst({where:{id:binding.jobId,tenantId:user.tenantId,accountId:row.accountId,sessionId:binding.sessionId},select:{status:true,leaseExpiresAt:true,assistantMessageId:true,executionToken:true,workerOwner:true,requestKey:true}}):null;
  const [clock]=await tx.$queryRaw`SELECT clock_timestamp() AS now`;
  const live=job?.status==='processing'&&job.leaseExpiresAt>clock.now;
  const pending=row.status==='reconciliation_required'||row.status==='active'&&row.expiresAt.getTime()===PROTECTED_EXPIRY.getTime();
  const executionMatches=!!(job&&binding.accountId===row.accountId&&binding.reservationId===row.id&&job.executionToken===binding.executionToken&&job.workerOwner===binding.workerOwner&&row.requestKey===`chat:${binding.sessionId}:${job.requestKey}`);
  const failureReady=!!(pending&&usage&&executionMatches&&!job.assistantMessageId&&job.status!=='completed'&&!row.reconciliationUsageRecordId);
  const canSettle=failureReady&&!live;
  const fingerprint=digest([row.id,row.status,row.actualTokens?.toString()??null,events.map(e=>[e.id,e.meta])]);
  return{row,events,binding,usage,canSettle,failureReady,live,fingerprint};
 }
 function view(d){return{id:d.row.id,accountName:d.row.account.displayName,createdAt:d.row.createdAt,status:d.row.status,reservedTokens:d.row.reservedTokens.toString(),actualTokens:d.row.actualTokens?.toString()??null,usage:d.usage?{promptTokens:d.usage.promptTokens,completionTokens:d.usage.completionTokens,totalTokens:d.usage.totalTokens,callCount:d.usage.callCount,model:d.usage.model}:null,canSettle:d.canSettle,canRelease:false,executing:d.live,fingerprint:d.fingerprint,message:d.row.status==='settled'?'已按实际用量结算。':d.row.status==='released'?'已释放预留。':d.canSettle?'已取得完整用量，可确认结算。':d.live?'任务仍在执行。':'尚缺完整用量凭据，请保留待核实。'};}
 async function detailView(tx,user,d){
  const job=await tx.knowledgeChatJob.findFirst({where:{tenantId:user.tenantId,accountId:d.row.accountId,...(d.binding?{id:d.binding.jobId,sessionId:d.binding.sessionId}:{requestKey:d.row.requestKey.split(':').at(-1)})},select:{text:true,sessionId:true}});
  const receipt=await tx.auditLog.findFirst({where:{tenantId:user.tenantId,target:d.row.id,action:{in:['hub.token.reconciled','token_quota_reconciliation_settled','token_quota_reconciliation_released']}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{accountId:true,createdAt:true}});
  const operator=receipt?await tx.account.findFirst({where:{id:receipt.accountId,tenantId:user.tenantId},select:{displayName:true}}):null;
  const starts=[...new Map(d.events.filter(e=>e.action==='hub.token.attempt.started').map(e=>[e.meta.attemptId,e])).values()];
  const attempts=starts.map((e,i)=>{const end=d.events.find(r=>r.action==='hub.token.attempt.completed'&&r.meta.attemptId===e.meta.attemptId);return{number:i+1,model:e.meta.model,status:end?'known':'unknown',totalTokens:end?.meta?.usage?.totalTokens??null};});
  return{...view(d),taskLabel:job?.text??'历史模型会话（未留存任务说明）',attempts,knownPartialTokens:attempts.reduce((n,x)=>n+(x.totalTokens??0),0),resolution:receipt?{operatorName:operator?.displayName??'历史处理人员',processedAt:receipt.createdAt,actualTokens:d.row.actualTokens?.toString()??null}:null};
 }
 async function commitUsage(tx,actorId,d,requestKey,inputHash){
  const u=d.usage;if(!u)conflict();
  const usage=await tx.usageRecord.create({data:{tenantId:d.row.tenantId,accountId:d.row.accountId,sessionId:d.binding.sessionId,provider:'deepseek',model:u.model,promptTokens:u.promptTokens,completionTokens:u.completionTokens,totalTokens:u.totalTokens,callCount:u.callCount,runtime:'hub-provider-reconciliation',mode:'verified-receipts',usedMock:false,byModel:u.byModel}});
  const changed=await tx.tokenQuotaReservation.updateMany({where:{id:d.row.id,tenantId:d.row.tenantId,status:d.row.status,reconciliationUsageRecordId:null},data:{status:'settled',actualTokens:BigInt(u.totalTokens),usedMock:false,settledAt:new Date(),reconciliationUsageRecordId:usage.id}});if(changed.count!==1)conflict();
  const result={id:d.row.id,status:'settled',actualTokens:u.totalTokens,usageRecordId:usage.id};
  await tx.auditLog.create({data:{tenantId:d.row.tenantId,accountId:actorId,action:'hub.token.reconciled',target:d.row.id,meta:{schema:'rh-token-reconciliation.v1',requestKey,inputHash,affectedAccountId:d.row.accountId,receiptHash:u.receiptHash,actualTokens:u.totalTokens,result}}});
  return result;
 }
 return{
  async me(user){return transaction(async tx=>{await actor(tx,user);return billing.myTokenQuota(user);});},
  async detail(user,id){return transaction(async tx=>{await actor(tx,user,true);return detailView(tx,user,await inspect(tx,user,id));});},
  async list(user,query={}){
   if(Object.keys(query).some(k=>!['page','status'].includes(k))||query.status&&!['pending','settled'].includes(query.status))fail(400,'HUB_TOKEN_QUERY_INVALID','查询条件无效。');
   const page=Number(query.page??1);if(!Number.isSafeInteger(page)||page<1||page>10000)fail(400,'HUB_TOKEN_QUERY_INVALID','页码无效。');
   return transaction(async tx=>{
    await actor(tx,user,true);const where={tenantId:user.tenantId,...(query.status==='settled'?{status:{in:['settled','released']}}:{OR:[{status:'reconciliation_required'},{status:'active',expiresAt:PROTECTED_EXPIRY}]})};
    const total=await tx.tokenQuotaReservation.count({where}),rows=await tx.tokenQuotaReservation.findMany({where,orderBy:[{createdAt:'asc'},{id:'asc'}],skip:(page-1)*20,take:20,select:{id:true}});
    const items=[];for(const r of rows)items.push(view(await inspect(tx,user,r.id)));return{items,page,pageSize:20,total};
   });
  },
  async resolve(user,id,input){
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestKey','fingerprint','action'].includes(k))||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey)||typeof input.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(input.fingerprint)||!['settle','release'].includes(input.action))fail(422,'HUB_TOKEN_INPUT_INVALID','请核对当前记录后重新提交。');
   return transaction(async tx=>{
    await locks(tx,user,id);await actor(tx,user,true);
    const inputHash=digest([id,input.action,input.fingerprint]);
    const replay=await tx.auditLog.findFirst({where:{tenantId:user.tenantId,action:'hub.token.reconciled',meta:{path:['requestKey'],equals:input.requestKey}}});
    if(replay){if(replay.target!==id||replay.meta?.inputHash!==inputHash)conflict();return replay.meta.result;}
    const d=await inspect(tx,user,id);if(d.fingerprint!==input.fingerprint)conflict();
    if(input.action!=='settle'||!d.canSettle)fail(422,'HUB_TOKEN_EVIDENCE_REQUIRED','尚无足够核验依据，记录已保留待核实。');
    return commitUsage(tx,user.accountId,d,input.requestKey,inputHash);
   });
  },
  // In-process Sessions catch only; never register this method as an HTTP route.
  async settleFailure(user,id){return transaction(async tx=>{
   await locks(tx,user,id);const d=await inspect(tx,user,id);
   if(d.row.accountId!==user.accountId||!d.failureReady||d.row.status!=='active')return null;
   return commitUsage(tx,user.accountId,d,'auto-'+id,digest(['automatic-failed',d.usage.receiptHash]));
  });},
 };
}
