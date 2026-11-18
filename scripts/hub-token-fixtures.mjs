// Named NEW synthetic tenant only. Test consumption never affects experience
// accounts/tenant quotas. No model endpoint or credential is present here.
import {randomUUID} from 'node:crypto';
import {protectAttempt} from '../server/billing/attempt-protection.mjs';
import {finishAttempt,sealExecution} from '../server/billing/attempts.mjs';
export async function createTokenFixture(transaction){
 const tenantId='rh-token-accept-'+randomUUID(),accountId=tenantId+'-owner',adminId=tenantId+'-admin',group=tenantId+'-group',project=tenantId+'-study',agent=tenantId+'-agent';
 return transaction(async tx=>{
  await tx.tenant.create({data:{id:tenantId,slug:tenantId,name:'[合成验收] Hub用量对账独立租户'}});
  for(const [id,role,displayName]of [[accountId,'researcher','[合成验收] 科研人员'],[adminId,'tenant_admin','[合成验收] 对账管理员']])await tx.account.create({data:{id,tenantId,username:role+'@billing.example.test',displayName,passwordHash:'unusable-synthetic-no-login',role,isTenantAdmin:role==='tenant_admin'}});
  await tx.studyGroup.create({data:{id:group,tenantId,name:'[合成验收] 对账组',slug:group}});
  await tx.researchProject.create({data:{id:project,tenantId,studyGroupId:group,code:project,name:'[合成验收] 独立对账研究'}});
  await tx.agent.create({data:{id:agent,tenantId,key:'synthetic-no-model',type:'research',name:'[合成验收] 无模型调用',opencodeRoot:'synthetic-no-network'}});
  for(const account of [null,accountId])await tx.tokenQuotaGrant.create({data:{tenantId,accountId:account,scopeKey:account??'*',deltaTokens:100000n,reason:'独立合成验收账，非体验租户，无模型费用'}});
  const user={tenantId,accountId,authVersion:0,studyGroupId:group,researchProjectId:project},admin={...user,accountId:adminId};
  const records={};
  for(const key of ['normal','lost-response','concurrent','unknown','live']){
   const sessionId=tenantId+'-'+key;
   await tx.session.create({data:{id:sessionId,tenantId,studyGroupId:group,researchProjectId:project,accountId,agentId:agent}});
   const message=await tx.message.create({data:{tenantId,sessionId,role:'user',content:'[合成验收] '+key+'，无真实模型请求'}});
   const job=await tx.knowledgeChatJob.create({data:{tenantId,studyGroupId:group,researchProjectId:project,sessionId,accountId,roleSnapshot:'researcher',requestKey:randomUUID(),text:'[合成验收] '+key,payload:{syntheticOnly:true},userMessageId:message.id,status:'processing',executionToken:randomUUID(),workerOwner:'fixture:hub-token',leaseExpiresAt:new Date(Date.now()+120000)}});
   const reservation=await tx.tokenQuotaReservation.create({data:{tenantId,accountId,requestKey:'chat:'+sessionId+':'+job.requestKey,reservedTokens:12288n,expiresAt:new Date(Date.now()+60000)}});
   const binding={user,tenantId,accountId,reservationId:reservation.id,attemptId:randomUUID(),jobId:job.id,sessionId,claim:{executionToken:job.executionToken,workerOwner:job.workerOwner},executionToken:job.executionToken,workerOwner:job.workerOwner,model:'deepseek-v4-pro'};
   await protectAttempt(tx,binding);
   await finishAttempt(tx,binding,key==='unknown'?{}:{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});await sealExecution(tx,binding);
   if(key!=='live')await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
   records[key]={id:reservation.id,jobId:job.id};
  }
  return{tenantId,user,admin,records};
 });
}
