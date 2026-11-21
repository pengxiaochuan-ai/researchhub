import{fileURLToPath}from'node:url';import{isDeepStrictEqual}from'node:util';
import{createMaterialAccess}from'../ai-agent/session-materials-controller.mjs';import{createSessionMaterials}from'../ai-agent/session-materials.mjs';
import{createPrivateMaterialReader}from'../ai-agent/private-materials.mjs';import{createPrivateMaterialSelection}from'../ai-agent/private-material-selection.mjs';
import{createPrivateMaterialSession}from'../ai-agent/private-material-session.mjs';import{createSessionSkillRouting}from'../ai-agent/session-skill-routing.mjs';
import{createHubDefaultSkills}from'../ai-agent/default-skills.mjs';import{loadSkillCatalog,verifySkillSnapshot}from'../ai-agent/skill-catalog.mjs';
import{createConversationCommands,createCommandScanner,commandScanQuery}from'../ai-agent/conversation-commands.mjs';
import{isPrivateMaterialSession,privateMaterialContext,parsePrivateMaterialContext,PRIVATE_NATIVE_RUNTIME}from'../ai-agent/private-material-context.mjs';
import{materialDigest}from'../ai-agent/session-material-contract.mjs';import{hubOpenCodeBinary}from'../ai-agent/opencode-installation.mjs';
import{isHubConversation}from'../../scripts/hub-agent-contract.mjs';import{assertHubAgent}from'../hub-sources/visible-repository.mjs';
import{bindHubTransactionScope,fenceHubQueue}from'./hub-turn.mjs';import{createPrivateMaterialTurn}from'./private-material-turn.mjs';
const fail=(code,message='当前附件、会话或授权已变化，请核对后再操作。',status=409)=>{throw Object.assign(Error(code),{code,publicMessage:message,status})};
export const PRIVATE_COMMAND_CONSUMER='researchhub-native-private.v1';
export async function createRuntimePrivateMaterials({config,prisma,load,services,agentId=config.scope.defaultTenantId+'-kb-research',root=fileURLToPath(new URL('../../',import.meta.url))}){
 const tenantId=config.scope.defaultTenantId,scope=config.scope,lock=load('common/worker-publication','lockAuthorizationMutation');
 await hubOpenCodeBinary();
 const transaction=(fn,u)=>load('common/worker-publication','withAuthorizationMutation')(prisma,tenantId,fn,{studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,includeOfficial:true});
 const access=createMaterialAccess({ids:{tenant:tenantId},load,transaction:(u,fn)=>transaction(fn,u)}),reader=createPrivateMaterialReader({access}),selection=createPrivateMaterialSelection({access,reader,refreshInTx:createSessionMaterials({access}).refreshInTx});
 async function authorize(tx,u,sid){
  if(u?.tenantId!==tenantId)fail('HUB_PRIVATE_ACCESS_REJECTED',undefined,403);
  await bindHubTransactionScope(tx,u);await assertHubAgent({db:tx,principal:u,tenantId,hubKey:'lingshu-xinyu'});
  return access.inTransaction(tx,u,sid,async(_db,current)=>current);
 }
 async function commandAuthorize(tx,u,sid){
  if(u?.tenantId!==tenantId)fail('HUB_PRIVATE_ACCESS_REJECTED',undefined,403);
  await bindHubTransactionScope(tx,u);await assertHubAgent({db:tx,principal:u,tenantId,hubKey:'lingshu-xinyu'});
  const [a,s,g,p,m,pm]=await Promise.all([
   tx.account.findFirst({where:{id:u.accountId,tenantId,status:'active',authVersion:u.authVersion,tenant:{status:'active'}}}),
   tx.session.findFirst({where:{id:sid,tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,agentId,channel:'knowledge',status:'active',deletedAt:null}}),
   tx.studyGroup.findFirst({where:{id:u.studyGroupId,tenantId,status:'active'}}),
   tx.researchProject.findFirst({where:{id:u.researchProjectId,tenantId,studyGroupId:u.studyGroupId,status:'active'}}),
   tx.studyGroupMembership.findFirst({where:{tenantId,studyGroupId:u.studyGroupId,accountId:u.accountId,status:'active',role:{status:'active',tenantId}},include:{role:true}}),
   tx.researchProjectMembership.findFirst({where:{tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId,status:'active'}}),
  ]);
  const admin=a?.role==='tenant_admin'&&a.isTenantAdmin===true,has=load('common/permission-catalog','hasRequiredPermissions');
  if(!a||!s||!g||!p||!(isHubConversation(s.contextKey)||isPrivateMaterialSession(s))||!admin&&(!m||!pm||!has(m.role.menuPermissions,['workbench'])||!has(m.role.buttonPermissions,['chat.use'])))fail('HUB_PRIVATE_ACCESS_REJECTED',undefined,403);
  return{tenantId,accountId:a.id,authVersion:a.authVersion,role:a.role,isTenantAdmin:a.isTenantAdmin,username:a.username,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId};
 }
 const catalog=await loadSkillCatalog(root),defaults=createHubDefaultSkills({scope,tenantId,agentId,catalog,transaction:fn=>prisma.elevated.$transaction(fn),lockAuthorization:lock,resolveEffectiveSkillCatalog:load('agents/effective-skills-policy','resolveEffectiveSkillCatalog')});
 const routing=createSessionSkillRouting({tenantId,agentId,catalog,contextOf:()=>({kind:'hub'}),transaction,effectiveInTx:defaults.listInTransaction,verifySource:source=>verifySkillSnapshot(root,source),privateMaterialsEnabled:true});
 const executionCurrent=async(t,tx)=>{
  if(!t.execution?.claim)fail('HUB_PRIVATE_EXECUTION_REQUIRED');
  if(!tx)return t.assertExecution();
  await authorize(tx,t.user,t.sessionId);
  const job=await tx.knowledgeChatJob.findFirst({where:{id:t.jobId,tenantId,accountId:t.user.accountId,sessionId:t.sessionId,status:'processing'}});
  if(job?.payload?.hubPrivateNative?.schema!==PRIVATE_NATIVE_RUNTIME)fail('HUB_PRIVATE_EXECUTION_REQUIRED');
  await load('common/worker-claim','assertLiveClaim')(tx,scope,t.execution.claim);
  await load('common/worker-authorization','assertWorkerAuthorized')(tx,scope,t.execution.claim,{toolKeys:['knowledge.search','file.read']});
 };
 const analysis=createPrivateMaterialSession({root,tenantId,routing,reader,transaction,executionCurrent,filterText:text=>load('orchestrator/model-data-boundary','enforceModelDataBoundary')(text).text});
 const turn=createPrivateMaterialTurn({prisma,load,scope,services,agentId,getAnalysis:()=>analysis,getRouting:()=>routing,authorize:(u,tx)=>tx?authorize(tx,u,turn.context.getStore()?.sessionId):transaction(db=>authorize(db,u,turn.context.getStore()?.sessionId),u)});
 let queue,timer;
 const currentRows=async(tx,u,sid)=>tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_materials WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5 AND deleted_at IS NULL LIMIT 1',tenantId,u.studyGroupId,u.researchProjectId,u.accountId,sid);
 const belongs=async(u,sid)=>transaction(async tx=>{await bindHubTransactionScope(tx,u);const s=await tx.session.findFirst({where:{id:sid,tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,agentId,channel:'knowledge',deletedAt:null}});return Boolean(s&&(isPrivateMaterialSession(s)||isHubConversation(s.contextKey)&&(await currentRows(tx,u,sid)).length))},u);
 async function previousCommands(tx,u,job){
  const older=await tx.message.findMany({where:{tenantId,sessionId:job.sessionId,id:{not:job.userMessageId},AND:[{meta:{path:['hubCommand','schema'],equals:'hub-conversation-command.v1'}},{NOT:{meta:{path:['hubCommand','consumerKey'],equals:PRIVATE_COMMAND_CONSUMER}}},{OR:['waiting','paused','dispatched'].map(status=>({meta:{path:['hubCommand','status'],equals:status}}))}]},select:{id:true,meta:true,createdAt:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:101});
  for(const m of older){const c=m.meta.hubCommand;if(c.jobId){const j=await tx.knowledgeChatJob.findFirst({where:{id:c.jobId,tenantId,sessionId:job.sessionId,accountId:u.accountId}});if(j&&['completed','failed'].includes(j.status))continue;}
   fail('HUB_PRIVATE_WAITING_PREVIOUS','本会话前序问题尚未结束；完成或处理后，将继续本条附件问题。');
  }
 }
 const commands=createConversationCommands({tenantId,consumerKey:PRIVATE_COMMAND_CONSUMER,transaction,authorize:commandAuthorize,
  async admit(tx,u,sid,input){if(input.networkIntent.enabled)fail('HUB_PRIVATE_NETWORK_DISABLED','请先关闭智能搜索，再分析本人附件。',400);const picked=await selection.captureInTx(tx,u,sid);if(!picked.materials.length)fail('HUB_PRIVATE_MATERIAL_REQUIRED','请先上传可用资料。');return{hubPrivateSelection:picked};},
  revise:async(tx,u,sid,_old,input)=>{if(input.networkIntent.enabled)fail('HUB_PRIVATE_NETWORK_DISABLED');return{hubPrivateSelection:await selection.captureInTx(tx,u,sid)}},
  async stage(tx,u,job){
   await tx.$executeRawUnsafe('SAVEPOINT hub_private_stage');try{
   await previousCommands(tx,u,job);const pack=await selection.prepareInTx(tx,u,job.sessionId,job.payload.hubPrivateSelection);if(!pack)fail('HUB_PRIVATE_MATERIAL_REQUIRED');
   const s=await tx.session.findFirst({where:{id:job.sessionId,tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,status:'active',deletedAt:null,agentId,channel:'knowledge'}});if(!s)fail('HUB_PRIVATE_CONTEXT_CHANGED');
   const previous=parsePrivateMaterialContext(s),original=previous?.originalContextKey??s.contextKey,contextKey=privateMaterialContext(s.id,original);
   const transition={schema:'hub-private-context.v1',sessionId:s.id,originalContextKey:original,contextKey};
   if(!previous){if(!isHubConversation(s.contextKey))fail('HUB_PRIVATE_CONTEXT_CHANGED');const changed=await tx.session.updateMany({where:{id:s.id,tenantId,accountId:u.accountId,contextKey:s.contextKey,status:'active',deletedAt:null},data:{contextKey}});if(changed.count!==1)fail('HUB_PRIVATE_CONTEXT_CHANGED');}
   const payload={...job.payload,hubPrivateEvidence:pack,hubPrivateNative:{schema:PRIVATE_NATIVE_RUNTIME,transition,transitionHash:materialDigest(transition)}};
   const staged=await routing.stagePendingInTx(tx,u,{...job,payload});
   await services.billing.assertTokenQuota(u,Number(load('billing/token-quota-policy','estimateRunTokenBudget')(await analysis.estimateReservation(pack,job.text))));
   await tx.$executeRawUnsafe('RELEASE SAVEPOINT hub_private_stage');return staged;
   }catch(error){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT hub_private_stage');await tx.$executeRawUnsafe('RELEASE SAVEPOINT hub_private_stage');throw error;}
  },schedule:(u,sid,input)=>{if(!queue)fail('HUB_PRIVATE_CONSUMER_UNAVAILABLE');return privateQueue.enqueue(u,sid,input)},
 });
 const queueFence=fenceHubQueue(prisma,async(tx,u,sid)=>{await lock(tx,tenantId,{includeOfficial:true});await authorize(tx,u,sid);const s=await tx.session.findFirst({where:{id:sid,tenantId,accountId:u.accountId}});if(!isPrivateMaterialSession(s))fail('HUB_PRIVATE_CONTEXT_CHANGED')},(tx,u,result)=>load('common/worker-authorization','assertWorkerAuthorized')(tx,scope,{kind:'knowledge-chat',tenantId,taskId:result.id}));
 let privateQueue;
 const scanner=createCommandScanner({readPage:cursor=>prisma.elevated.message.findMany(commandScanQuery(tenantId,PRIVATE_COMMAND_CONSUMER,cursor)),processSession:m=>commands.tick({tenantId,accountId:m.session.accountId,studyGroupId:m.session.studyGroupId,researchProjectId:m.session.researchProjectId,authVersion:m.meta.hubCommand.authVersion},m.sessionId)});
 return{analysis,routing,sessions:turn.sessions,queueFence,belongs,commands,ready:true,
  async ownsCommand(u,sid,id){return transaction(async tx=>{await commandAuthorize(tx,u,sid);const m=await tx.message.findFirst({where:{id,tenantId,sessionId:sid}});return m?.meta?.hubCommand?.consumerKey===PRIVATE_COMMAND_CONSUMER},u);},
  async canAnalyze(tx,u){try{return(await defaults.listInTransaction(tx,u)).items.some(s=>s.key==='doubao-medical-literature-interpretation')}catch{return false}},
  bindQueue(instance){if(queue)fail('HUB_PRIVATE_CONSUMER_DUPLICATE');queue=instance;privateQueue=queueFence.bind({enqueue:queue.enqueue.bind(queue)});},
  start(){if(timer||!queue||!scope.enabledWorkerKinds?.includes('knowledge-chat'))return;timer=setInterval(()=>{void scanner().catch(()=>{})},1500);timer.unref();},
  stop(){clearInterval(timer)},
  async submit(u,sid,input){const result=await commands.submit(u,sid,input);await commands.tick(u,sid);return result;},
  onJobCreate:(tx,args,next)=>commands.onJobCreate(tx,args,next,()=>fail('HUB_PRIVATE_JOB_CONTEXT_REQUIRED')),
 };
}
