import {withDeploymentTransaction} from '../database/transactions.mjs';
import {assertApprovedInTransaction} from '../admission/service.mjs';
import {assertHubAgent} from '../hub-sources/visible-repository.mjs';
import {runHubSourceSearch,assertCurrentAiSources,assertHubPublicationSources} from '../hub-sources/agent-retrieval.mjs';
import {ensureHubConversation} from '../../scripts/hub-conversation-session.mjs';
import {isHubConversation,projectHubMessages} from '../../scripts/hub-agent-contract.mjs';
import {hubHistoryQuery,projectHubHistoryPage} from '../../scripts/hub-conversation-history.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
import {createHubTurnRuntime,fenceHubQueue} from './hub-turn.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';

export const HUB_CHAT=Symbol.for('researchhub.runtime.chat');
const unavailable=()=>{throw Object.assign(Error('科研问答尚未配置，请联系管理员。'),{status:503,code:'HUB_CHAT_NOT_CONFIGURED'});};
const invalid=()=>{throw Object.assign(Error('问答参数或会话范围无效，请重新打开。'),{status:400,code:'HUB_CHAT_INPUT_INVALID'});};
export function createRuntimeChat({config,env,transactionEnv,prisma,load,services,chatBudget}){
 const tenantId=config.scope.defaultTenantId,agentId=tenantId+'-kb-research';
 const scope=(db,principal)=>({db,principal,tenantId,hubKey:'lingshu-xinyu'});
 const sessionAdmission=new AsyncLocalStorage();
 const read=(user,fn)=>withDeploymentTransaction(transactionEnv,'app',async tx=>{
  if(user?.tenantId!==tenantId)invalid();
  if(user.studyGroupId&&user.researchProjectId)await tx.$executeRawUnsafe("SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true)",user.studyGroupId,user.researchProjectId);
  return fn(tx);
 },{readOnly:true});
 async function status(user){
  const reasons=await read(user,async tx=>{
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true}});
   if(!account)invalid();await assertApprovedInTransaction(tx,user,'lingshu-xinyu');
   const agent=await tx.agent.findFirst({where:{id:agentId,tenantId,status:'active',type:'research'},select:{id:true}});
   const result=[];
   if(!agent)result.push('HUB_CHAT_AGENT_NOT_CONFIGURED');
   else{
    const access=await tx.agentAccess.findFirst({where:{tenantId,agentId,accountId:user.accountId,scopeKey:user.accountId,enabled:true},select:{id:true}});
    if(!access)result.push('HUB_CHAT_ACCESS_NOT_GRANTED');
    const model=await tx.agentConfig.findFirst({where:{tenantId,agentId,active:true,archivedAt:null},orderBy:{version:'desc'},select:{model:true,tools:true}});
    let valid=false;
    if(model&&Array.isArray(model.tools)&&model.tools.includes('knowledge.search'))try{
     const route=await load('common/model-route-resolver','resolveConfiguredDeepSeekModelRoute')(tx,tenantId,model.model);
     valid=route.provider==='deepseek'&&typeof route.model==='string'&&route.model.trim().length>0&&Boolean(env[route.secretRef||'DEEPSEEK_API_KEY']);
    }catch{valid=false;}
    if(!valid)result.push('HUB_CHAT_MODEL_NOT_CONFIGURED');
   }
   if(env.HUB_PAID_AI_ENABLED!=='true')result.push('HUB_CHAT_MODEL_DISABLED');
   if(!config.scope.enabledWorkerKinds.includes('knowledge-chat'))result.push('HUB_CHAT_CONSUMER_DISABLED');
   return result;
  });
  if(chatBudget&&!chatBudget.admission.accounts.includes(user.accountId)&&!reasons.includes('HUB_CHAT_ACCESS_NOT_GRANTED'))reasons.push('HUB_CHAT_ACCESS_NOT_GRANTED');
  return{enabled:reasons.length===0,readOnly:true,code:reasons.length?'HUB_CHAT_NOT_CONFIGURED':null,reasons,...chatBudget&&{quota:chatBudget.quota(user.accountId)},materialUpload:{enabled:false,analysisReady:false}};
 }
 async function requireReady(user){if(!(await status(user)).enabled)unavailable();}
 async function authorize(user,tx){
  // The native publication already holds official/tenant authorization locks;
  // no nested transaction may weaken its same-transaction source fence.
  if(tx)return assertHubAgent(scope(tx,user));
  await requireReady(user);return read(user,db=>assertHubAgent(scope(db,user)));
 }
 const current=(user,sources,tx)=>tx?assertHubPublicationSources({...scope(tx,user),sources}):read(user,db=>assertCurrentAiSources({...scope(db,user),sources}));
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 const queueFence=fenceHubQueue(prisma,async(tx,user,sessionId)=>{
  await lock(tx,user.tenantId,{includeOfficial:true});
  await authorize(user,tx);
  const session=await tx.session.findFirst({where:{id:sessionId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId,channel:'knowledge',deletedAt:null}});
  if(!session||!isHubConversation(session.contextKey))invalid();
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
 return{...runtime,status,requireReady,agentId,current,read,queueFence,chatBudget,withSessionAdmission};
}

export function createRuntimeChatController({require,load,getChat,getQueue}){
 const {Controller,Get,Post,Patch,Req,Body,Param,Query,HttpException}=require('@nestjs/common');
 const body=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))invalid();return v;};
 async function own(chat,user,id){const s=await chat.sessions.assertKnowledgeSession(user,id);if(s.agentId!==chat.agentId||!isHubConversation(s.contextKey))invalid();return s;}
 class HubChatController{
  async agents(req){const chat=getChat();return(await chat.status(req.user)).enabled?[{id:chat.agentId,type:'research',name:'岐研科研 Agent'}]:[];}
  async status(req){return getChat().status(req.user);}
   async ensureHub(req,input){const chat=getChat();body(input,['agentId','hubKey','conversationKey']);await chat.requireReady(req.user);if(input.agentId!==chat.agentId||input.hubKey!=='lingshu-xinyu')invalid();return chat.withSessionAdmission(req.user,input.conversationKey,()=>ensureHubConversation({sessions:chat.sessions,authorize:chat.requireReady,user:req.user,agentId:chat.agentId,conversationKey:input.conversationKey}));}
  async history(req,q){const chat=getChat();await chat.requireReady(req.user);const args=hubHistoryQuery(req.user,chat.agentId,q);return chat.read(req.user,async db=>{const rows=await db.session.findMany(args);return{items:await projectHubHistoryPage(rows,req.user,db,Number(q.limit??20)),hasMore:rows.length>Number(q.limit??20),page:Number(q.page??1)};});}
  async state(req,id,q){const chat=getChat();await chat.requireReady(req.user);await own(chat,req.user,id);if(Object.keys(q).some(k=>!['limit','before'].includes(k)))invalid();const limit=Number(q.limit??60);if(!Number.isSafeInteger(limit)||limit<1||limit>100)invalid();const result=await getQueue().state(req.user,id,{limit,...(q.before?{before:q.before}:{})});return{...result,...chat.chatBudget&&{quota:chat.chatBudget.isAdmittedSession(req.user.accountId,id)?chat.chatBudget.quota(req.user.accountId):{blocked:true,message:'此历史会话仅供查看，请使用新对话提问。'}},messages:await projectHubMessages(result.messages,s=>chat.current(req.user,s)),hubContext:{kind:'hub',sessionId:id}};}
  async send(req,id,input){const chat=getChat();body(input,['text','requestKey','kbIds','networkIntent']);await chat.requireReady(req.user);await own(chat,req.user,id);
    if(chat.chatBudget){chat.chatBudget.assertAdmittedSession(req.user.accountId,id);chat.chatBudget.assertCanEnqueue(req.user.accountId,{sessionId:id,requestKey:input.requestKey});}
   if(agentQuestionError(input.text)||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey??'')||!Array.isArray(input.kbIds)||input.kbIds.length)invalid();
   if(input.networkIntent&&(![false,undefined].includes(input.networkIntent.enabled)||Object.keys(input.networkIntent).some(k=>k!=='enabled')))unavailable();
   return getQueue().enqueue(req.user,id,{text:input.text,requestKey:input.requestKey,kbIds:[]});
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
  async source(req,id,messageId,index){const chat=getChat();await chat.requireReady(req.user);await own(chat,req.user,id);const n=Number(index);if(!Number.isSafeInteger(n)||n<1)invalid();return chat.read(req.user,async db=>{const message=await db.message.findFirst({where:{id:messageId,sessionId:id,tenantId:req.user.tenantId,role:'assistant'}}),sources=message?.meta?.provenance?.hubSources;if(!Array.isArray(sources)||!sources[n-1])invalid();await assertCurrentAiSources({db,principal:req.user,tenantId:req.user.tenantId,hubKey:'lingshu-xinyu',sources:[sources[n-1]]});return{...sources[n-1],index:n,status:'current'};});}
  async notConfigured(req){await getChat().requireReady(req.user);unavailable();}
 }
 Controller()(HubChatController);
 const routes=[['agents',Get,'agents',[]],['status',Get,'knowledge/ai-status',[]],['ensureHub',Post,'sessions/hub-source',[Body()]],['history',Get,'sessions/hub-source/history',[Query()]],['state',Get,'sessions/:id/knowledge-state',[Param('id'),Query()]],['send',Post,'sessions/:id/knowledge-messages',[Param('id'),Body()]],['commands',Get,'sessions/:id/commands',[Param('id')]],['command',Post,'sessions/:id/commands',[Param('id'),Body()]],['source',Get,'sessions/:id/knowledge-sources/:messageId/:index',[Param('id'),Param('messageId'),Param('index')]]];
 // Separate contexts must never silently execute as a different evidence scope.
 for(const [verb,path]of [[Post,'sessions/knowledge'],[Get,'hub-sources/article-context/:recordId'],[Patch,'sessions/:id/history-action']]){
  const name='unavailable'+routes.length;HubChatController.prototype[name]=HubChatController.prototype.notConfigured;routes.push([name,verb,path,[]]);
 }
 for(const [method,verb,path,params]of routes){
  const original=HubChatController.prototype[method];HubChatController.prototype[method]=async function(...args){try{return await original.apply(this,args);}catch(e){if(e.getStatus)throw e;throw new HttpException({code:e.code??'HUB_CHAT_UNAVAILABLE',message:e.status===400?e.message:e.code==='HUB_CHAT_NOT_CONFIGURED'?'科研问答尚未配置，请联系管理员。':e.code==='HUB_CHAT_COMMIT_PENDING'?'前次请求状态待核对，请联系管理员，暂勿重复提交。':e.code==='HUB_CHAT_SESSION_NOT_ADMITTED'?'此历史会话仅供查看，请使用新对话提问。':/^HUB_CHAT_(BUDGET_|SESSION_LIMIT)/.test(e.code??'')?'当前AI使用额度不可用，请联系管理员。':'当前会话或来源暂不可用，请重新核对后重试。'},e.status??503);}};
  const p=HubChatController.prototype;verb(path)(p,method,Object.getOwnPropertyDescriptor(p,method));Req()(p,method,0);params.forEach((d,i)=>d(p,method,i+1));
  if(!['status','agents'].includes(method))for(const decorate of [load('common/decorators','RequireStudyGroup')(),load('common/decorators','RequireResearchProject')(),load('common/decorators','RequireStudyGroupMenu')('workbench'),load('common/decorators','RequireStudyGroupPermission')('chat.use')])decorate(p,method,Object.getOwnPropertyDescriptor(p,method));
 }
 return HubChatController;
}
