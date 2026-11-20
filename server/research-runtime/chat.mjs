import {createRuntimeArticle} from './article-runtime.mjs';
import {parseArticleContext} from '../hub-sources/article-evidence.mjs';
import {createPmcObjectReader} from './pmc-storage.mjs';
import {withQueueBranches} from './queue-branches.mjs';
import {authorizeKnowledgeEnqueue} from './knowledge-queue.mjs';
import {createRuntimeChatStatus} from './chat-status.mjs';
import {withDeploymentTransaction} from '../database/transactions.mjs';
import {assertApprovedInTransaction} from '../admission/service.mjs';
import {assertHubAgent} from '../hub-sources/visible-repository.mjs';
import {runHubSourceSearch,assertCurrentAiSources,assertHubPublicationSources} from '../hub-sources/agent-retrieval.mjs';
import {ensureHubConversation} from '../../scripts/hub-conversation-session.mjs';
import {isHubConversation,projectHubMessages} from '../../scripts/hub-agent-contract.mjs';
import {hubHistoryQuery,projectHubHistoryPage} from '../../scripts/hub-conversation-history.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
import {createHubTurnRuntime,fenceHubQueue,bindHubTransactionScope} from './hub-turn.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createRuntimeKnowledge}from'./knowledge-runtime.mjs';
import {assembleKnowledgeModule}from'./knowledge-module.mjs';
import {knowledgeContextId}from'./knowledge-evidence.mjs';

export const HUB_CHAT=Symbol.for('researchhub.runtime.chat');
const unavailable=()=>{throw Object.assign(Error('科研问答尚未配置，请联系管理员。'),{status:503,code:'HUB_CHAT_NOT_CONFIGURED'});};
const invalid=()=>{throw Object.assign(Error('问答参数或会话范围无效，请重新打开。'),{status:400,code:'HUB_CHAT_INPUT_INVALID'});};
export async function knowledgeEntryAvailability(authorize){
 try{await authorize();return{enabled:true};}
 catch(error){if(error?.code!=='KNOWLEDGE_AI_SCOPE_NOT_ADMITTED')throw error;return{enabled:false,code:'KNOWLEDGE_AI_NOT_CONFIGURED',message:'当前知识库尚未开放资料问答。'};}
}
export function createRuntimeChat({config,env,transactionEnv,prisma,load,services,chatBudget}){
 const tenantId=config.scope.defaultTenantId,agentId=tenantId+'-kb-research';
 const scope=(db,principal)=>({db,principal,tenantId,hubKey:'lingshu-xinyu'});
 const sessionAdmission=new AsyncLocalStorage();
 const read=(user,fn)=>withDeploymentTransaction(transactionEnv,'app',async tx=>{
  if(user?.tenantId!==tenantId)invalid();
  await tx.$executeRawUnsafe("SELECT set_config('app.account_id',$1,true),set_config('app.auth_version',$2,true)",user.accountId,String(user.authVersion));
  if(user.studyGroupId&&user.researchProjectId)await tx.$executeRawUnsafe("SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true)",user.studyGroupId,user.researchProjectId);
  return fn(tx);
 },{readOnly:true});
 const status=createRuntimeChatStatus({read,load,services,tenantId,agentId,env,config,chatBudget,invalid});
 async function requireReady(user){if(!(await status(user)).enabled)unavailable();}
 async function authorize(user,tx){
  // The native publication already holds official/tenant authorization locks;
  // no nested transaction may weaken its same-transaction source fence.
  if(tx){if(user?.tenantId!==tenantId)invalid();await bindHubTransactionScope(tx,user);return assertHubAgent(scope(tx,user));}
  await requireReady(user);return read(user,db=>assertHubAgent(scope(db,user)));
 }
 const current=(user,sources,tx)=>tx?assertHubPublicationSources({...scope(tx,user),sources}):read(user,db=>assertCurrentAiSources({...scope(db,user),sources}));
 const knowledge=config.executionProfile==='standard'?assembleKnowledgeModule({prisma,load,services,agentId,config,env,read}):createRuntimeKnowledge({prisma,load,services,agentId,chatBudget,config});
 const article=config.executionProfile==='standard'?createRuntimeArticle({config,prisma,load,services,status,agentId,readPmcAsset:createPmcObjectReader(services.storage,tenantId)}):null;
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 const queueFence=fenceHubQueue(prisma,async(tx,user,sessionId)=>{
  await lock(tx,user.tenantId,{includeOfficial:true});
  const session=await tx.session.findFirst({where:{id:sessionId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId,channel:'knowledge',deletedAt:null}});
  if(!session)invalid();
  if(isHubConversation(session.contextKey))await authorize(user,tx);
  else if(knowledge)await authorizeKnowledgeEnqueue({tx,user,sessionId,agentId,load,knowledge});
  else invalid();
 },async(tx,user,result)=>{
  if(!result?.id)invalid();
  await load('common/worker-authorization','assertWorkerAuthorized')(tx,config.scope,{kind:'knowledge-chat',taskId:result.id,tenantId:user.tenantId});
  if(chatBudget){const job=await tx.knowledgeChatJob.findFirst({where:{id:result.id,tenantId:user.tenantId,accountId:user.accountId}});if(!job)invalid();chatBudget.admitJob(user.accountId,job);}
 });
 const runtime=createHubTurnRuntime({prisma,agentId,NativeSessions:load('sessions/sessions.service','SessionsService'),NativeOrchestrator:load('orchestrator/orchestrator.service','OrchestratorService'),...services,
  mutate:(user,fn)=>load('common/worker-publication','withAuthorizationMutation')(prisma,user.tenantId,fn,{studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId}),
  adminToolKeys:(kind,configured)=>load('common/tool-catalog','effectiveRuntimeToolKeys')(kind,configured,load('common/hub-knowledge-admin','hubChatAdminToolPermissions')()).filter(key=>key==='knowledge.search'),
  authorize,retrieve:(user,query)=>read(user,db=>runHubSourceSearch({...scope(db,user),query})),revalidate:current,
  onSessionEnsured:chatBudget?async(tx,user,result)=>{
   const admitted=sessionAdmission.getStore();if(!admitted||admitted.accountId!==user.accountId)invalid();
   const session=await tx.session.findFirst({where:{id:result.id,tenantId:user.tenantId,accountId:user.accountId,agentId,channel:'knowledge',deletedAt:null},select:{id:true,accountId:true,tenantId:true,createdAt:true,contextKey:true}});
   if(!session||!isHubConversation(session.contextKey))invalid();chatBudget.bindSession(user.accountId,admitted.key,session);
  }:undefined});
 const withSessionAdmission=async(user,key,fn)=>{
  if(!chatBudget)return fn();
  const slot=chatBudget.reserveSession(user.accountId,key);
  if(slot.sessionId){try{await runtime.sessions.assertKnowledgeSession(user,slot.sessionId);}catch(e){if((e.status??e.getStatus?.())===404)throw Object.assign(Error('HUB_CHAT_COMMIT_PENDING'),{code:'HUB_CHAT_COMMIT_PENDING',status:409});throw e;}return{id:slot.sessionId};}
  return sessionAdmission.run({accountId:user.accountId,key},fn);
 };
 const sessions=new Proxy(runtime.sessions,{get(target,key){
  if(key==='sendMessage')return async(user,id,text,options)=>{const s=await target.assertKnowledgeSession(user,id);if(parseArticleContext(s.contextKey)){if(!article)unavailable();return article.sessions.sendMessage(user,id,text,options);}if(isHubConversation(s.contextKey))return target.sendMessage(user,id,text,options);if(!knowledge)unavailable();return knowledge.sessions.sendMessage(user,id,text,options);};
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
 const entryStatus=async(user,query={})=>{
  if(Object.keys(query).some(k=>k!=='kbId'))invalid();const result=await status(user);
  if(!query.kbId)return result;
  if(knowledge?.status)return{...await knowledge.status(user,query.kbId),researchPlans:{enabled:false}};
  if(!knowledge)return{...result,enabled:false,code:'KNOWLEDGE_AI_NOT_CONFIGURED',message:'当前知识库尚未开放资料问答。',quota:{blocked:true}};
  const available=await knowledgeEntryAvailability(()=>knowledge.evidence.authorize(user,query.kbId));
  if(!available.enabled)return{...result,...available,quota:{...result.quota,canStart:false,blocked:true,message:available.message},researchPlans:{enabled:false}};
  const campaign=knowledge.quota(user,query.kbId),canStart=result.enabled&&result.quota.businessReady&&!campaign.blocked;
  return{...result,quota:{...result.quota,...campaign,canStart,blocked:!canStart,message:!result.quota.businessReady?'当前AI可用额度不足，请联系管理员。':campaign.message??'当前可用额度充足。'},researchPlans:{enabled:false}};
 };
 return{...runtime,sessions,knowledge,article,status:entryStatus,requireReady,agentId,current,read,queueFence:article?{prisma:withQueueBranches(queueFence.prisma,[article.queueFence]),bind:queueFence.bind}:queueFence,chatBudget,withSessionAdmission};
}

export function createRuntimeChatController({require,load,getChat,getQueue}){
 const {Controller,Get,Post,Patch,Req,Body,Param,Query,HttpException}=require('@nestjs/common');
 const body=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))invalid();return v;};
 async function own(chat,user,id){const s=await chat.sessions.assertKnowledgeSession(user,id);if(s.agentId!==chat.agentId)invalid();if(parseArticleContext(s.contextKey)){if(!chat.article)unavailable();return chat.article.authorizeSession(user,id);}if(!isHubConversation(s.contextKey)){if(!chat.knowledge)unavailable();await chat.knowledge.evidence.authorize(user,knowledgeContextId(s.contextKey));}return s;}
 class HubChatController{
  async agents(req){const chat=getChat();return(await chat.status(req.user)).enabled?[{id:chat.agentId,type:'research',name:'岐研科研 Agent'}]:[];}
  async status(req,q){
   // This status route also serves the global Hub, so its global request stays
   // unscoped. KB readiness uses explicit headers and the native current-read
   // fence still verifies the real account, membership, parents and visibility.
   const user=q?.kbId?{...req.user,
    studyGroupId:load('common/study-group-context','requireStudyGroupHeader')(req.headers?.['x-study-group-id']),
    researchProjectId:load('common/research-project-context','requireResearchProjectHeader')(req.headers?.['x-research-project-id']),
   }:req.user;
   return getChat().status(user,q);
  }
  async ensureKnowledge(req,input){const chat=getChat();body(input,['agentId','kbId','kbName']);await chat.requireReady(req.user);if(input.agentId!==chat.agentId||typeof input.kbId!=='string')invalid();if(!chat.knowledge)unavailable();return chat.knowledge.ensure(req.user,input.kbId);}
   async ensureHub(req,input){const chat=getChat();body(input,['agentId','hubKey','conversationKey','articleBinding']);await chat.requireReady(req.user);if(input.agentId!==chat.agentId||input.hubKey!=='lingshu-xinyu')invalid();if(Object.hasOwn(input,'articleBinding')){if(Object.hasOwn(input,'conversationKey'))invalid();if(!chat.article)unavailable();return chat.article.ensure(req.user,input.articleBinding);}return chat.withSessionAdmission(req.user,input.conversationKey,()=>ensureHubConversation({sessions:chat.sessions,authorize:chat.requireReady,user:req.user,agentId:chat.agentId,conversationKey:input.conversationKey}));}
  async history(req,q){const chat=getChat();await chat.requireReady(req.user);const args=hubHistoryQuery(req.user,chat.agentId,q);return chat.read(req.user,async db=>{const rows=await db.session.findMany(args);return{items:await projectHubHistoryPage(rows,req.user,db,Number(q.limit??20)),hasMore:rows.length>Number(q.limit??20),page:Number(q.page??1)};});}
  async state(req,id,q){const chat=getChat();await chat.requireReady(req.user);const session=await own(chat,req.user,id);if(Object.keys(q).some(k=>!['limit','before'].includes(k)))invalid();const limit=Number(q.limit??60);if(!Number.isSafeInteger(limit)||limit<1||limit>100)invalid();const result=await getQueue().state(req.user,id,{limit,...(q.before?{before:q.before}:{})});if(parseArticleContext(session.contextKey))return chat.article.state(req.user,session,result);const hub=isHubConversation(session.contextKey),kbId=hub?null:knowledgeContextId(session.contextKey);return{...result,...chat.chatBudget&&{quota:chat.chatBudget.isAdmittedSession(req.user.accountId,id)?chat.chatBudget.quota(req.user.accountId,session.contextKey):{blocked:true,message:'此历史会话仅供查看，请使用新对话提问。'}},messages:hub?await projectHubMessages(result.messages,s=>chat.current(req.user,s)):await chat.knowledge.evidence.project(req.user,kbId,result.messages),hubContext:{kind:hub?'hub':'knowledge',sessionId:id,...kbId&&{kbId}}};}
  async send(req,id,input){const chat=getChat();body(input,['text','requestKey','kbIds','networkIntent']);await chat.requireReady(req.user);const session=await own(chat,req.user,id);if(parseArticleContext(session.contextKey)){if(input.networkIntent&&(input.networkIntent.enabled!==false||Object.keys(input.networkIntent).some(k=>k!=='enabled')))invalid();return chat.article.enqueue(req.user,id,input,getQueue());}const hub=isHubConversation(session.contextKey),kbId=hub?null:knowledgeContextId(session.contextKey);
    if(chat.chatBudget){chat.chatBudget.assertAdmittedSession(req.user.accountId,id);chat.chatBudget.assertCanEnqueue(req.user.accountId,{sessionId:id,requestKey:input.requestKey});}
   if(agentQuestionError(input.text)||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey??'')||!Array.isArray(input.kbIds)||(hub?input.kbIds.length:input.kbIds.length!==1||input.kbIds[0]!==kbId))invalid();
   if(input.networkIntent&&(![false,undefined].includes(input.networkIntent.enabled)||Object.keys(input.networkIntent).some(k=>k!=='enabled')))unavailable();
   return getQueue().enqueue(req.user,id,{text:input.text,requestKey:input.requestKey,kbIds:hub?[]:[kbId]});
  }
  async commands(req,id){
   const state=await this.state(req,id,{}),messages=new Map(state.messages.map(m=>[m.id,m]));
   const items=state.jobs.map(j=>({id:j.id,sessionId:id,status:j.status,version:1,requestKey:messages.get(j.userMessageId)?.meta?.requestKey,text:messages.get(j.userMessageId)?.content??'',createdAt:j.createdAt}));
   return{items,recent:items.filter(j=>['completed','failed'].includes(j.status)),paused:false};
  }
  async command(req,id,input){
   body(input,['text','requestKey','kbIds','networkIntent']);
   if(input.networkIntent&&(input.networkIntent.schema!=='hub-network-intent.v1'||input.networkIntent.enabled!==false||Object.keys(input.networkIntent).some(k=>!['schema','enabled'].includes(k))))unavailable();
   const result=await this.send(req,id,{...input,...input.networkIntent&&{networkIntent:{enabled:false}}});
   return{id:result.id,sessionId:id,status:result.status,version:1,requestKey:input.requestKey};
  }
  async source(req,id,messageId,index){const chat=getChat();await chat.requireReady(req.user);const session=await own(chat,req.user,id);const n=Number(index);if(parseArticleContext(session.contextKey)){if(n!==1)invalid();const message=await chat.read(req.user,db=>db.message.findFirst({where:{id:messageId,sessionId:id,tenantId:req.user.tenantId,role:'assistant'}}));if(!message)invalid();return chat.article.source(req.user,session,message);}const hub=isHubConversation(session.contextKey);if(!Number.isSafeInteger(n)||n<1)invalid();const source=await chat.read(req.user,async db=>{const message=await db.message.findFirst({where:{id:messageId,sessionId:id,tenantId:req.user.tenantId,role:'assistant'}}),sources=message?.meta?.provenance?.[hub?'hubSources':'knowledgeSources'];if(!Array.isArray(sources)||!sources[n-1])invalid();if(hub)await assertCurrentAiSources({db,principal:req.user,tenantId:req.user.tenantId,hubKey:'lingshu-xinyu',sources:[sources[n-1]]});return sources[n-1];});const status=hub?'current':await chat.knowledge.evidence.status(req.user,knowledgeContextId(session.contextKey),source);if(status==='restricted')throw Object.assign(Error('当前来源不可查看，请刷新核对。'),{status:403,code:'KNOWLEDGE_SOURCE_RESTRICTED'});return{...source,index:n,status};}
  async articleContext(req,recordId,q){const chat=getChat();await chat.requireReady(req.user);if(Object.keys(q).some(k=>k!=='requestKey'))invalid();if(!chat.article)unavailable();req.res?.setHeader('Cache-Control','no-store');return chat.article.context(req.user,recordId,q.requestKey);}
  async notConfigured(req){await getChat().requireReady(req.user);unavailable();}
 }
 Controller()(HubChatController);
 const routes=[['agents',Get,'agents',[]],['status',Get,'knowledge/ai-status',[Query()]],['ensureHub',Post,'sessions/hub-source',[Body()]],['ensureKnowledge',Post,'sessions/knowledge',[Body()]],['history',Get,'sessions/hub-source/history',[Query()]],['state',Get,'sessions/:id/knowledge-state',[Param('id'),Query()]],['send',Post,'sessions/:id/knowledge-messages',[Param('id'),Body()]],['commands',Get,'sessions/:id/commands',[Param('id')]],['command',Post,'sessions/:id/commands',[Param('id'),Body()]],['source',Get,'sessions/:id/knowledge-sources/:messageId/:index',[Param('id'),Param('messageId'),Param('index')]]];
 // Separate contexts must never silently execute as a different evidence scope.
 routes.push(['articleContext',Get,'hub-sources/article-context/:recordId',[Param('recordId'),Query()]]);
 {const name='unavailable'+routes.length;HubChatController.prototype[name]=HubChatController.prototype.notConfigured;routes.push([name,Patch,'sessions/:id/history-action',[]]);}
 for(const [method,verb,path,params]of routes){
  const original=HubChatController.prototype[method];HubChatController.prototype[method]=async function(...args){try{return await original.apply(this,args);}catch(e){if(e.getStatus)throw e;throw new HttpException({code:e.code??'HUB_CHAT_UNAVAILABLE',message:e.status===400?e.message:e.code==='HUB_CHAT_NOT_CONFIGURED'?'科研问答尚未配置，请联系管理员。':e.code==='HUB_CHAT_COMMIT_PENDING'?'前次请求状态待核对，请联系管理员，暂勿重复提交。':e.code==='HUB_CHAT_SESSION_NOT_ADMITTED'?'此历史会话仅供查看，请使用新对话提问。':/^HUB_CHAT_(BUDGET_|SESSION_LIMIT)/.test(e.code??'')?'当前AI使用额度不可用，请联系管理员。':'当前会话或来源暂不可用，请重新核对后重试。'},e.status??503);}};
  const p=HubChatController.prototype;verb(path)(p,method,Object.getOwnPropertyDescriptor(p,method));Req()(p,method,0);params.forEach((d,i)=>d(p,method,i+1));
  if(!['status','agents'].includes(method))for(const decorate of [load('common/decorators','RequireStudyGroup')(),load('common/decorators','RequireResearchProject')(),load('common/decorators','RequireStudyGroupMenu')('workbench'),load('common/decorators','RequireStudyGroupPermission')('chat.use')])decorate(p,method,Object.getOwnPropertyDescriptor(p,method));
 }
 return HubChatController;
}
