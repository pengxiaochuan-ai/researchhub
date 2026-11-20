import {fenceHubQueue} from './hub-turn.mjs';
import {knowledgeContextId} from './knowledge-evidence.mjs';

export async function authorizeKnowledgeEnqueue({tx,user,sessionId,agentId,load,knowledge}){
 await load('common/worker-publication','lockAuthorizationMutation')(tx,user.tenantId,{includeOfficial:true});
 const session=await tx.session.findFirst({where:{id:sessionId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId,channel:'knowledge',deletedAt:null}});
 if(!session)throw Error('KNOWLEDGE_CONTEXT_INVALID');
 await knowledge.evidence.authorize(user,knowledgeContextId(session.contextKey),tx);
}
export function createKnowledgeQueueFence({prisma,load,scope,agentId,knowledge}){
 return fenceHubQueue(prisma,(tx,user,sessionId)=>authorizeKnowledgeEnqueue({tx,user,sessionId,agentId,load,knowledge}),
  (tx,user,result)=>load('common/worker-authorization','assertWorkerAuthorized')(tx,scope,{kind:'knowledge-chat',taskId:result.id,tenantId:user.tenantId}));
}
