import{bindRuntimeTransactions,verifyRuntimeSchema,withDeploymentTransaction}from'../database/transactions.mjs';
import{deploymentRequestPolicy}from'../http/deployment-request.mjs';
import{storageSettings,createRuntimeStorage}from'./storage.mjs';
import{createRuntimeProviders}from'./providers.mjs';
import{createHubController}from'../hub/controller.mjs';
import{createHubSourceReadController}from'../hub-sources/read-controller.mjs';
import{createHubSourceReviewController}from'../hub-sources/review-controller.mjs';
import{createHubSourceAgentController}from'../hub-sources/agent-retrieval.mjs';
import{createDirectoryController}from'../directory/controller.mjs';
import{createReferenceController}from'../reference/controller.mjs';
import{createResearchIdentityController}from'../research-identity/controller.mjs';
import{createGovernanceAuditController}from'../governance-audit/controller.mjs';
import{createGovernanceSystemController}from'../governance-system/controller.mjs';
import{createGovernanceUsers}from'../governance-users/service.mjs';
import{createGovernanceUsersController}from'../governance-users/controller.mjs';
import{createMyResearchController}from'../../scripts/my-research-overview.mjs';
import{boundWorkerLifecycle}from'./worker-lifecycle.mjs';
import{createRuntimeChat,createRuntimeChatController}from'./chat.mjs';
import{createPmcObjectReader}from'./pmc-storage.mjs';
import{loadChatAdmission,createChatBudget}from'./chat-budget.mjs';
import{BOUNDED_CHAT_CORE,KNOWLEDGE_CHAT_CORE}from'./chat-execution.mjs';
const field=(env,key,pattern)=>{if(!pattern.test(env[key]??''))throw Error('RESEARCH_RUNTIME_CONFIGURATION_REQUIRED:'+key);return env[key];};
export async function createRuntimeFoundation({config,env,load,require,prisma,jwt}){
 if(config.scope.allowedTenantIds.length!==1)throw Error('RESEARCH_RUNTIME_SINGLE_HUB_TENANT_REQUIRED');
 const transactionEnv=bindRuntimeTransactions({prisma,expected:config.identity});
 const schemas=field(env,'HUB_MANAGED_SCHEMAS',/^[a-z][a-z0-9_]*(?:,[a-z][a-z0-9_]*)*$/).split(',');
 await verifyRuntimeSchema(transactionEnv,{schemas,fingerprint:field(env,'HUB_SCHEMA_FINGERPRINT',/^[a-f0-9]{32}$/)});
 const runtimePolicy=deploymentRequestPolicy({origin:config.origin,apiAuthority:field(env,'HUB_API_AUTHORITY',/^[a-zA-Z0-9.:[\]-]{1,260}$/)});
 const ids=Object.freeze({tenant:config.scope.defaultTenantId,admin:field(env,'HUB_SOURCE_REVIEWER_ACCOUNT_ID',/^[A-Za-z0-9_-]{1,160}$/)});
 if(env!==process.env)throw Error('RESEARCH_RUNTIME_DEDICATED_PROCESS_ENV_REQUIRED');
 const embeddingMode=field(env,'HUB_EMBEDDING_MODE',/^(?:service|keyword-only)$/);
 if(embeddingMode==='service'){const url=new URL(env.KB_EMBED_URL);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||env.EMBEDDING_BASE_URL)throw Error('RESEARCH_RUNTIME_EMBEDDING_CONFIG_REJECTED');}
 if(!['true','false'].includes(env.HUB_PAID_AI_ENABLED))throw Error('RESEARCH_RUNTIME_AI_ADMISSION_REQUIRED');
 if(config.scope.enabledWorkerKinds.some(kind=>!['knowledge-import','raw-processing','knowledge-chat'].includes(kind)))throw Error('RESEARCH_RUNTIME_WORKER_NOT_ADAPTED');
 if(env.HUB_PAID_AI_ENABLED==='false'&&config.scope.enabledWorkerKinds.some(kind=>!['knowledge-import','raw-processing'].includes(kind)))throw Error('RESEARCH_RUNTIME_WORKER_ADMISSION_REQUIRED');
 const stopGates=[];
 let chatBudget;
 if(['bounded-hub-chat-v1','bounded-hub-knowledge-v2'].includes(config.executionProfile)){
  const admission=loadChatAdmission(env.HUB_CHAT_ADMISSION_FILE,env.HUB_CHAT_ADMISSION_SHA256);
  const bridge=config.core.digest===KNOWLEDGE_CHAT_CORE&&admission.schema==='hub-chat-admission.v1'&&admission.coreDigest===BOUNDED_CHAT_CORE;
  if(admission.database!==config.identity.database||admission.tenantId!==config.scope.defaultTenantId||admission.coreDigest!==config.core.digest&&!bridge||
   config.executionProfile==='bounded-hub-knowledge-v2'&&admission.schema!=='hub-chat-admission.v2'||config.executionProfile==='bounded-hub-chat-v1'&&admission.schema!=='hub-chat-admission.v1')throw Error('HUB_CHAT_ADMISSION_BINDING_CHANGED');
  chatBudget=createChatBudget({admission,admissionSha:env.HUB_CHAT_ADMISSION_SHA256,directory:env.HUB_CHAT_LEDGER_DIR});
 }
 const storage=createRuntimeStorage({load,require,settings:storageSettings(env)});
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 const bound=(tx,tenant)=>({withTenantTransaction:(t,_g,_p,fn)=>{if(t!==tenant)throw Error('RESEARCH_RUNTIME_TENANT_REJECTED');return fn(tx);}});
 const users=createGovernanceUsers({transact:(p,fn)=>{
  if(p?.tenantId!==ids.tenant)throw Object.assign(Error('当前账号无权执行此操作。'),{status:403});
  return withDeploymentTransaction(transactionEnv,'app',async tx=>{await lock(tx,p.tenantId,{includeOfficial:true});return fn(tx);});
 },legacyUpdate:(tx,user,id,dto)=>new(load('accounts/accounts.service','AccountsService'))(bound(tx,user.tenantId)).update(user,id,dto),legacyChangeMember:(tx,user,id,input)=>new(load('pi-governance/pi-governance.service','PiGovernanceService'))(bound(tx,user.tenantId)).changeMember(user,id,input)});
 const readState=async()=>({account:{configured:true},email:{configured:env.HUB_MAIL_MODE==='capture'},parser:{configured:Boolean(env.KB_DOC_PARSER_URL)},vector:{configured:Boolean(env.KB_EMBED_URL)},ai:{configured:env.HUB_PAID_AI_ENABLED==='true'&&Boolean(env.DEEPSEEK_API_KEY)}});
 let chat,queue;
 const ChatController=createRuntimeChatController({require,load,getChat:()=>chat,getQueue:()=>queue});
 const Controllers=[load('knowledge/knowledge.controller','KnowledgeController'),ChatController,
  createHubController({env:transactionEnv,ids,require}),createHubSourceReadController({env:transactionEnv,ids,require,secret:config.jwtSecret,readPmcAsset:createPmcObjectReader(storage,ids.tenant)}),createHubSourceReviewController({env:transactionEnv,ids,require,readPmcAsset:createPmcObjectReader(storage,ids.tenant)}),createHubSourceAgentController({env:transactionEnv,ids,require}),
  await createDirectoryController({env:transactionEnv,ids,require,runtimePolicy}),await createReferenceController({env:transactionEnv,require,runtimePolicy}),await createResearchIdentityController({env:transactionEnv,ids,load,require,runtimePolicy}),
  createGovernanceAuditController({env:transactionEnv,ids,require,load}),createGovernanceSystemController({env:transactionEnv,ids,require,readState}),createGovernanceUsersController({require,service:users,origin:config.origin}),
  createMyResearchController({ids,prisma,load,require,runtime:true})];
 const providers=createRuntimeProviders({load,require,prisma,scope:config.scope,cookieName:config.cookieName,jwt,storage,embeddingMode,stopGates,modelEnabled:env.HUB_PAID_AI_ENABLED==='true',chatBudget,coreDigest:config.core.digest,createChat:services=>(chat=createRuntimeChat({config,env,transactionEnv,prisma,load,services,chatBudget}))});
 return{Controllers,providers,storage,transactionEnv,runtimePolicy,ids,
  bindWorkers:app=>{queue=app.get(load('sessions/knowledge-chat-queue.service','KnowledgeChatQueueService'));for(const[path,name]of [['knowledge/knowledge-import.service','KnowledgeImportService'],['ingest/raw-processing.service','RawProcessingService']]){
   const instance=app.get(load(path,name));
   if(name==='KnowledgeImportService'&&config.executionProfile==='bounded-hub-knowledge-v2'){
    if(chatBudget?.admission.schema!=='hub-chat-admission.v2'||typeof instance.scopeWhere!=='function')throw Error('KNOWLEDGE_IMPORT_ADMISSION_REQUIRED');
    const a=chatBudget.admission;instance.scopeWhere=()=>({tenantId:a.tenantId,AND:[{OR:a.k01.bindings.map(b=>({id:b.importTaskId,kbId:b.kbId,createdBy:b.accountId,studyGroupId:a.k01.studyGroupId}))}]});
   }
   boundWorkerLifecycle(instance,stopGates);
  }},
  stop:()=>stopGates.forEach(stop=>stop())};
}
