import {assertApprovedInTransaction} from '../admission/service.mjs';

export function createRuntimeChatStatus({read,load,services,tenantId,agentId,env,config,chatBudget,invalid}){
 async function status(user,{tx:existingTx}={}){
  let businessQuota={businessReady:false,requiredTokens:'0',effectiveRemainingTokens:'0'};
  const inspect=async tx=>{
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true}});
   if(!account)invalid();await assertApprovedInTransaction(tx,user,'lingshu-xinyu');
   const agent=await tx.agent.findFirst({where:{id:agentId,tenantId,status:'active',type:'research'},select:{id:true}});
   const result=[];
   if(!agent)result.push('HUB_CHAT_AGENT_NOT_CONFIGURED');
   else{
    const access=await tx.agentAccess.findFirst({where:{tenantId,agentId,accountId:user.accountId,scopeKey:user.accountId,enabled:true},select:{id:true}});
    if(!access)result.push('HUB_CHAT_ACCESS_NOT_GRANTED');
    const model=await tx.agentConfig.findFirst({where:{tenantId,agentId,active:true,archivedAt:null},orderBy:{version:'desc'},select:{model:true,tools:true}});
    let valid=false,configuredRoute;
    if(model&&Array.isArray(model.tools)&&model.tools.includes('knowledge.search'))try{
     const route=await load('common/model-route-resolver','resolveConfiguredDeepSeekModelRoute')(tx,tenantId,model.model);
     configuredRoute=route;
     valid=route.provider==='deepseek'&&typeof route.model==='string'&&route.model.trim().length>0&&Boolean(env[route.secretRef||'DEEPSEEK_API_KEY']);
    }catch{valid=false;}
    if(!valid)result.push('HUB_CHAT_MODEL_NOT_CONFIGURED');
    if(valid){const required=load('billing/token-quota-policy','estimateRunTokenBudget')(Number(configuredRoute.maxTokens??4096)),quota=await services.billing.quotaSnapshotFrom(tx,tenantId,user.accountId);businessQuota={businessReady:quota.effectiveRemaining>=required,requiredTokens:required.toString(),effectiveRemainingTokens:quota.effectiveRemaining.toString()};}
   }
   if(env.HUB_PAID_AI_ENABLED!=='true')result.push('HUB_CHAT_MODEL_DISABLED');
   if(!config.scope.enabledWorkerKinds.includes('knowledge-chat'))result.push('HUB_CHAT_CONSUMER_DISABLED');
   return result;
  };
  const reasons=existingTx?await inspect(existingTx):await read(user,inspect);
  if(chatBudget&&!chatBudget.admission.accounts.includes(user.accountId)&&!reasons.includes('HUB_CHAT_ACCESS_NOT_GRANTED'))reasons.push('HUB_CHAT_ACCESS_NOT_GRANTED');
  const campaign=chatBudget?.quota(user.accountId)??{blocked:false},canStart=businessQuota.businessReady&&!campaign.blocked&&reasons.length===0;
  return{enabled:reasons.length===0,readOnly:true,code:reasons.length?'HUB_CHAT_NOT_CONFIGURED':null,reasons,quota:{...businessQuota,...campaign,canStart,blocked:!canStart,message:!businessQuota.businessReady?'当前AI可用额度不足，请联系管理员。':campaign.message??'当前可用额度充足。'},materialUpload:{enabled:false,analysisReady:false}};
 }
 return status;
}
