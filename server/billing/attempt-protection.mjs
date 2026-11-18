// Called inside a trusted Hub transaction, after business/source authorization.
// No network operation belongs in this transaction.
export const ATTEMPT_SCHEMA='rh-token-attempt.v1';
export const PROTECTED_EXPIRY=new Date('9999-12-31T00:00:00.000Z');
const fail=code=>{throw Error(code);};
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,200}$/.test(value);

export async function protectAttempt(tx,input){
 const {user,reservationId,attemptId,jobId,sessionId,claim,model}=input;
 if(!user||![user.tenantId,user.accountId,reservationId,attemptId,jobId,sessionId,claim?.executionToken,claim?.workerOwner].every(identifier)||!Number.isSafeInteger(user.authVersion)||model!=='deepseek-v4-pro')fail('HUB_TOKEN_BINDING_INVALID');
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wp01:tenant:${user.tenantId}`},0))`;
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aisci-token-quota:${user.tenantId}`},0))`;
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reservationId},0))`;
 const account=await tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true}});
 if(!account)fail('HUB_TOKEN_ACCESS_DENIED');
 const [clock]=await tx.$queryRaw`SELECT clock_timestamp() AS now`;
 const job=await tx.knowledgeChatJob.findFirst({where:{id:jobId,tenantId:user.tenantId,accountId:user.accountId,sessionId,status:'processing',executionToken:claim.executionToken,workerOwner:claim.workerOwner,leaseExpiresAt:{gt:clock.now},session:{status:'active',deletedAt:null}},select:{requestKey:true,studyGroupId:true,researchProjectId:true}});
 if(!job)fail('HUB_TOKEN_EXECUTION_CHANGED');
 const rows=await tx.$queryRaw`SELECT id,"accountId","requestKey",status,"expiresAt" FROM public.token_quota_reservation WHERE id=${reservationId} AND "tenantId"=${user.tenantId} FOR UPDATE`;
 const reservation=rows[0];
 if(!reservation||reservation.accountId!==user.accountId||reservation.requestKey!==`chat:${sessionId}:${job.requestKey}`||reservation.status!=='active')fail('HUB_TOKEN_RESERVATION_CHANGED');
 const meta={schema:ATTEMPT_SCHEMA,tenantId:user.tenantId,accountId:user.accountId,reservationId,attemptId,jobId,sessionId,executionToken:claim.executionToken,workerOwner:claim.workerOwner,model};
 if(await tx.auditLog.findFirst({where:{tenantId:user.tenantId,target:reservationId,action:'hub.token.execution.sealed'},select:{id:true}}))fail('HUB_TOKEN_EXECUTION_SEALED');
 const existing=await tx.auditLog.findFirst({where:{tenantId:user.tenantId,target:reservationId,action:'hub.token.attempt.started',meta:{path:['attemptId'],equals:attemptId}}});
 if(existing){
  if(!Object.entries(meta).every(([key,value])=>existing.meta?.[key]===value))fail('HUB_TOKEN_ATTEMPT_CONFLICT');
  return existing;
 }
 if(reservation.expiresAt<=clock.now)fail('HUB_TOKEN_RESERVATION_EXPIRED');
 const changed=await tx.tokenQuotaReservation.updateMany({where:{id:reservationId,tenantId:user.tenantId,accountId:user.accountId,status:'active'},data:{expiresAt:PROTECTED_EXPIRY}});
 if(changed.count!==1)fail('HUB_TOKEN_RESERVATION_CHANGED');
 return tx.auditLog.create({data:{tenantId:user.tenantId,accountId:user.accountId,studyGroupId:job.studyGroupId,researchProjectId:job.researchProjectId,action:'hub.token.attempt.started',target:reservationId,meta:{...meta,originalExpiresAt:reservation.expiresAt.toISOString()}}});
}
