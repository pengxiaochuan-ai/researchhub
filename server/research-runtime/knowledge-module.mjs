import {createRuntimeKnowledge} from './knowledge-runtime.mjs';
import {createRuntimeChatStatus} from './chat-status.mjs';
import {createKnowledgeQueueFence} from './knowledge-queue.mjs';

// Both launchers use this K01 assembly. It creates no fixtures, permissions,
// grants, services or model calls; connection bindings belong to the launcher.
export function assembleKnowledgeModule({prisma,load,config,env,read,services,chatBudget,agentId=config.scope.defaultTenantId+'-kb-research'}){
 const knowledge=createRuntimeKnowledge({prisma,load,config,services,chatBudget,agentId});
 if(!knowledge)return null;
 const status=createRuntimeChatStatus({read,load,services,tenantId:config.scope.defaultTenantId,agentId,env,config,chatBudget,
  invalid:()=>{throw Object.assign(Error('当前问答身份无法核对，请重新登录。'),{code:'KNOWLEDGE_CONTEXT_INVALID',status:403});},
 });
 return{...knowledge,queueFence:createKnowledgeQueueFence({prisma,load,scope:config.scope,agentId,knowledge}),
  async status(user,kbId){
   await knowledge.evidence.authorize(user,kbId);
   const result=await status(user),campaign=knowledge.quota(user,kbId),canStart=result.enabled&&result.quota.businessReady&&!campaign.blocked;
   return{...result,quota:{...result.quota,...campaign,canStart,blocked:!canStart,message:!result.quota.businessReady?'当前AI可用额度不足，请联系管理员。':campaign.message??'当前可用额度充足。'}};
  },
 };
}
