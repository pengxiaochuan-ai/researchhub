import {AsyncLocalStorage}from'node:async_hooks';
import {createKnowledgeEvidence,knowledgeContextId}from'./knowledge-evidence.mjs';
import {createKnowledgeTurnRuntime}from'./knowledge-turn.mjs';
import {bindHubTransactionScope}from'./hub-turn.mjs';
import {assertHubAgent}from'../hub-sources/visible-repository.mjs';
import {compileKnowledgeQuery}from'./knowledge-search-query.mjs';
import {knowledgePublicError}from'./knowledge-errors.mjs';
import {createKnowledgeAccounting}from'./knowledge-accounting.mjs';

const reject=()=>{throw Object.assign(Error('当前知识库尚未开放资料问答。'),{code:'KNOWLEDGE_AI_SCOPE_NOT_ADMITTED',status:403});};
const pdfHashes={
 'rh-kb-local-b0e2af9d-admin':'3b83d035edc68e9c2593a400dee1168a535ab1c87bae741cc4be52d927ce1988',
 'rh-kb-local-b0e2af9d-owner':'edc10bafa65d30529aa9122d6bd9dee5a27a4be059aea857281b924d249dd2dc',
};
export async function assertImportedKnowledgeSource(tx,u,kbId,source,allowed){
 const imported=await tx.knowledgeImportTask.findFirst({where:{id:allowed.importTaskId,tenantId:u.tenantId,studyGroupId:u.studyGroupId,kbId,createdBy:u.accountId,docId:source.docId,status:'complete'},include:{sourceFile:true}});
 if(!imported||imported.status!=='complete'||imported.sourceFile?.sha256!==pdfHashes[u.accountId]||imported.sourceFile.docId!==source.docId||imported.sourceFile.kbId!==kbId||imported.sourceFile.createdBy!==u.accountId)reject();
}
export function createRuntimeKnowledge({prisma,load,services,agentId,chatBudget,config}){
 const admission=chatBudget?.admission;
 if(chatBudget&&admission?.schema!=='hub-chat-admission.v2'||!chatBudget&&config.executionProfile!=='standard')return null;
 const tenantId=admission?.tenantId??config.scope.defaultTenantId;
 const {knowledge,retrieval}=services,nativeRead=load('knowledge/retrieval.service','withCurrentKnowledgeRead'),sessionAdmission=new AsyncLocalStorage();
 const binding=(u,kbId)=>{
  if(!admission){if(u.tenantId!==tenantId||!/^[-A-Za-z0-9_]{1,160}$/.test(kbId??''))reject();return null;}
  if(u.tenantId!==admission.tenantId||u.studyGroupId!==admission.k01.studyGroupId||u.researchProjectId!==admission.k01.researchProjectId)reject();
  const found=admission.k01.bindings.find(x=>x.accountId===u.accountId&&x.kbId===kbId);if(!found)reject();return found;
 };
 const nativeInTx=(tx,u,fn)=>{
  const bound={withTenantTransaction:(_t,_g,_p,callback)=>callback(tx),elevated:{$transaction:callback=>callback(tx)}};
  return nativeRead(bound,u,async actual=>{await bindHubTransactionScope(actual,u);await assertHubAgent({db:actual,principal:u,tenantId,hubKey:'lingshu-xinyu'});return fn?.(actual);});
 };
 const evidence=createKnowledgeEvidence({
  compileQuery:compileKnowledgeQuery,
  readCurrent:(u,fn)=>nativeRead(prisma,u,async tx=>{await bindHubTransactionScope(tx,u);await assertHubAgent({db:tx,principal:u,tenantId,hubKey:'lingshu-xinyu'});return fn(tx);}),
  authorizeInTransaction:(tx,u)=>nativeInTx(tx,u),
  authorizePurpose:async(tx,u,kbId,sources)=>{
   // Standard KB use is governed by native current visibility, document review
   // and source-version checks above. Asset/report purpose grants are separate.
   if(!admission){binding(u,kbId);return;}
   const allowed=binding(u,kbId),kb=await tx.knowledgeBase.findUnique({where:{id:kbId}});
   const created=kb?new Date(kb.createdAt).getTime():NaN;
   if(!kb||kb.ownerAccountId!==u.accountId||kb.visibility!=='private'||!Number.isFinite(created)||created<new Date(admission.k01.issuedAt).getTime())reject();
   for(const source of sources??[]){
    if(!Number.isSafeInteger(source.version)||source.version<1||source.version>3)reject();
    if(source.docId===allowed.positiveDocId)continue;
    await assertImportedKnowledgeSource(tx,u,kbId,source,allowed);
   }
  },
  accessibleKbIds:(u,ids,tx)=>retrieval.accessibleKbIds(u,ids,tx),search:(u,input)=>knowledge.search(u,input),
 });
 const runtime=createKnowledgeTurnRuntime({prisma,agentId,evidence,...services,
  accounting:!admission&&services.billing?({context,verify})=>createKnowledgeAccounting({prisma,context,billing:services.billing,verify,scope:config.scope,load}):undefined,
  publicError:knowledgePublicError,
  NativeSessions:load('sessions/sessions.service','SessionsService'),NativeOrchestrator:load('orchestrator/orchestrator.service','OrchestratorService'),
  mutate:(u,fn)=>load('common/worker-publication','withAuthorizationMutation')(prisma,u.tenantId,fn,{studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,includeOfficial:true}),
  adminToolKeys:(kind,configured)=>load('common/tool-catalog','effectiveRuntimeToolKeys')(kind,configured,load('common/hub-knowledge-admin','hubChatAdminToolPermissions')()).filter(k=>k==='knowledge.search'),
  onSessionEnsured:async(tx,u,result)=>{
   const pending=sessionAdmission.getStore();if(chatBudget&&(!pending||pending.accountId!==u.accountId))reject();
   const s=await tx.session.findFirst({where:{id:result.id,accountId:u.accountId,tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,agentId,channel:'knowledge',deletedAt:null}});
   if(!s)reject();
   const kbId=knowledgeContextId(s.contextKey);await evidence.authorize(u,kbId,tx);
   if(chatBudget){if(kbId!==pending.kbId)reject();chatBudget.bindSession(u.accountId,pending.key,s);}
  },
 });
 return{...runtime,evidence,binding,
  async ensure(u,kbId){
   const base=await evidence.authorize(u,kbId),key='kb-session-'+kbId,contextKey='kb:'+kbId;
   if(!chatBudget)return runtime.sessions.ensureKnowledgeSession(u,agentId,contextKey,'知识库·'+base.name);
   const slot=chatBudget.reserveSession(u.accountId,key,contextKey);
   if(slot.sessionId){const s=await runtime.sessions.assertKnowledgeSession(u,slot.sessionId);if(s.contextKey!==contextKey)reject();return{id:s.id};}
   return sessionAdmission.run({accountId:u.accountId,kbId,key},()=>runtime.sessions.ensureKnowledgeSession(u,agentId,contextKey,'知识库·'+base.name));
  },
  quota:(u,kbId)=>{binding(u,kbId);return chatBudget?chatBudget.quota(u.accountId,'kb:'+kbId):{blocked:false};},
 };
}
