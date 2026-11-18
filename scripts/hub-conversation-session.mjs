import {HUB_CONTEXT_KEY,HUB_CONVERSATION_PREFIX} from './hub-agent-contract.mjs';

export async function ensureHubConversation({sessions,authorize,user,agentId,conversationKey}){
 if(conversationKey!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(typeof conversationKey==='string'?conversationKey:''))throw Object.assign(Error('新会话标识无效'),{status:400});
 await authorize(user);
 return sessions.ensureKnowledgeSession(user,agentId,conversationKey===undefined?HUB_CONTEXT_KEY:HUB_CONVERSATION_PREFIX+conversationKey,conversationKey===undefined?'ResearchHub·已审核公开来源':'新对话');
}
