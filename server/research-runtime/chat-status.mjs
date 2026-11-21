import {assertApprovedInTransaction} from '../admission/service.mjs';
import {MATERIAL_MAX_BYTES} from '../ai-agent/session-materials.mjs';

export function materialUploadCapability({assembled,account,roles,tools,effective,permissions}){
 const admin=account?.role==='tenant_admin'&&account.isTenantAdmin===true;
 const candidates=admin?[{menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']}]:roles;
 const allowed=assembled&&candidates.some(role=>permissions(role.menuPermissions,['knowledge','workbench'])&&permissions(role.buttonPermissions,['knowledge.edit','chat.use'])&&effective('research',tools,role).includes('file.read'));
 return{schema:'hub-material-upload.v1',enabled:Boolean(allowed),analysisReady:false,maxBytes:MATERIAL_MAX_BYTES,extensions:['pdf','docx','txt','md']};
}

export function createRuntimeChatStatus({read,load,services,tenantId,agentId,env,config,chatBudget,invalid,privateMaterials}){
 async function status(user,{tx:existingTx}={}){
  let materialUpload={enabled:false,analysisReady:false};
  let businessQuota={businessReady:false,requiredTokens:'0',effectiveRemainingTokens:'0'};
  const inspect=async tx=>{
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true}});
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
    const members=account.role==='tenant_admin'&&account.isTenantAdmin===true?[]:await tx.studyGroupMembership.findMany({where:{tenantId,accountId:user.accountId,status:'active',studyGroup:{status:'active'},role:{status:'active'},...(user.studyGroupId?{studyGroupId:user.studyGroupId}:{})},select:{role:{select:{menuPermissions:true,buttonPermissions:true}}}});
    materialUpload=materialUploadCapability({assembled:config.profile==='full'&&Boolean(env.KB_DOC_PARSER_URL)&&config.scope.enabledWorkerKinds.includes('knowledge-import'),account,roles:members.map(m=>m.role),tools:model?.tools??[],effective:load('common/tool-catalog','effectiveRuntimeToolKeys'),permissions:load('common/permission-catalog','hasRequiredPermissions')});
    if(materialUpload.enabled&&valid&&configuredRoute.model==='deepseek-v4-pro'&&privateMaterials?.ready)materialUpload.analysisReady=await privateMaterials.canAnalyze(tx,user);
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
  return{enabled:reasons.length===0,readOnly:true,code:reasons.length?'HUB_CHAT_NOT_CONFIGURED':null,reasons,quota:{...businessQuota,...campaign,canStart,blocked:!canStart,message:!businessQuota.businessReady?'当前AI可用额度不足，请联系管理员。':campaign.message??'当前可用额度充足。'},materialUpload};
 }
 return status;
}
