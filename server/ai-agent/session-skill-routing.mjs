import {AsyncLocalStorage} from 'node:async_hooks';
import {routeSkillTask,bindSkillRoute,assertSkillRoute,routeDigest} from './skill-routing.mjs';
import {VIDEO_MODE} from './video-chat-contract.mjs';
import {GENERAL_MODE} from './general-conversation-policy.mjs';
import {isLiteratureRequest} from './natural-literature-plan.mjs';
import {normalizeNetworkIntent,effectiveNetworkIntent} from './network-intent.mjs';
const failure=(code,message,status=409)=>{throw Object.assign(Error(code),{code,publicMessage:message,status});};
export function routeReceipt(route){return{schema:route.schema,snapshotHash:route.snapshotHash,skill:route.skill,adapter:route.decision.mode,scope:route.decision.scope,runtime:[GENERAL_MODE,'hub-literature-search','hub-literature-interpretation','hub-smart-search','hub-private-materials','hub-research-data',VIDEO_MODE].includes(route.decision.mode)?'hub-opencode':'existing-hub-kb-adapter',...(route.decision.previousJobId?{previousJobId:route.decision.previousJobId}:{})};}

export function createSessionSkillRouting({tenantId,agentId,catalog,contextOf,transaction,effectiveInTx,verifySource,literatureEnabled=false,interpretationEnabled=false,naturalPlanningEnabled=false,smartSearchEnabled=false,privateMaterialsEnabled=false,researchDataEnabled=false,videoContentEnabled=false}){
 const request=new AsyncLocalStorage();
 const owner=user=>({tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId});
 const sourceBinding=(s,payload)=>routeDigest({contextKey:s.contextKey,packHash:payload?.articleEvidence?.packHash??null,...(payload?.hubMediaEvidence?{videoPackHash:payload.hubMediaEvidence.packHash}:{}),...(payload?.hubPrivateEvidence?{privatePackHash:payload.hubPrivateEvidence.packHash}:{}),...(payload?.hubResearchDataEvidence?{dataPackHash:payload.hubResearchDataEvidence.packHash}:{})});
 async function own(tx,user,id){
  if(user?.tenantId!==tenantId)failure('HUB_SKILL_ACCESS_DENIED','当前账号无法访问此会话。',403);
  const session=await tx.session.findFirst({where:{...owner(user),id,agentId,status:'active',deletedAt:null}});
  if(!session)failure('HUB_SKILL_ACCESS_DENIED','当前账号无法访问此会话。',403);
  return session;
 }
 async function previous(tx,user,sessionId,route){
  const where={...owner(user),sessionId,status:'completed',...(route?.decision?.previousJobId?{id:route.decision.previousJobId}:{})};
  const job=await tx.knowledgeChatJob.findFirst({where,orderBy:[{createdAt:'desc'},{id:'desc'}]});
  const old=job?.payload?.hubSkillRoute;if(!old)return undefined;
  return{jobId:job.id,skillKey:old.skill?.key,anchorQuestion:old.decision.anchorQuestion,mode:old.decision.mode,taskAsOf:old.decision.taskPlan?.asOf,taskPlan:old.decision.taskPlan};
 }
 async function bind(tx,user,session,text,payload,stored,read=false){
  if(stored&&stored.inputHash!==routeDigest(text.trim()))failure('HUB_SKILL_ROUTE_CHANGED','任务输入与路由快照不一致。');
  const current=await effectiveInTx(tx,user);
  const networkIntent=smartSearchEnabled&&(!stored||stored.schema==='hub-medical-router.v2')?normalizeNetworkIntent(payload?.networkIntent):undefined;
  // Ordinary history is frozen in hubGeneralContext, not inherited as a
  // scientific Skill task. Later research must not reclassify an old “继续”.
  const prior=stored?.decision.mode===GENERAL_MODE?undefined:await previous(tx,user,session.id,stored);
  let retrieval;
  if(interpretationEnabled){
   const parentId=stored?.decision?.taskPlan?.parentJobId??(/^(?:继续|再详细|展开|接着说)/.test(text)&&prior?.mode==='hub-literature-interpretation'?prior.taskPlan?.parentJobId:undefined);
   const parent=await tx.knowledgeChatJob.findFirst({where:{...owner(user),sessionId:session.id,status:'completed',payload:{path:['hubSkillRoute','decision','mode'],equals:'hub-literature-search'},...(parentId?{id:parentId}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}]});
   const evidence=parent?.payload?.hubLiteratureEvidence;
   if(evidence?.schema==='hub-literature-evidence.v1'){const{hash,...body}=evidence;if(routeDigest(body)===hash)retrieval={jobId:parent.id,hash,selected:evidence.selected};}
  }
  const videoContext=payload?.hubMediaEvidence?{kind:'video-content'}:null;
  if(videoContext&&(!videoContentEnabled||contextOf(session).kind!=='hub'||payload.hubMediaEvidence.schema!=='hub-video-pack.v1'||!/^[a-f0-9]{64}$/.test(payload.hubMediaEvidence.packHash??'')||payload.hubPrivateEvidence||payload.hubResearchDataEvidence))failure('HUB_SKILL_ROUTE_CHANGED','视频与会话无法核对。');
  const dataContext=payload?.hubResearchDataEvidence?{kind:'research-data'}:null;
  if(dataContext&&(!researchDataEnabled||contextOf(session).kind!=='hub'||payload.hubResearchDataEvidence.schema!=='hub-data-overview.v1'||!/^[a-f0-9]{64}$/.test(payload.hubResearchDataEvidence.packHash??'')||payload.hubPrivateEvidence))failure('HUB_SKILL_ROUTE_CHANGED','研究数据与会话无法核对。');
  const privateContext=payload?.hubPrivateEvidence?{kind:'private-materials'}:null;
  if(privateContext&&(contextOf(session).kind!=='hub'||payload.hubPrivateEvidence.schema!=='hub-private-material-pack.v1'||!/^[a-f0-9]{64}$/.test(payload.hubPrivateEvidence.packHash??'')))failure('HUB_SKILL_ROUTE_CHANGED','任务资料与会话无法核对。');
  const decision=routeSkillTask({text,context:videoContext??dataContext??privateContext??contextOf(session),videoContentEnabled,researchDataEnabled,privateMaterialsEnabled,previous:privateContext||dataContext||videoContext?undefined:prior,retrieval,networkIntent,smartSearchEnabled:smartSearchEnabled&&(!stored||stored.schema==='hub-medical-router.v2'),naturalPlanningEnabled:naturalPlanningEnabled&&(!stored||isLiteratureRequest(stored.decision.taskPlan)),interpretationEnabled:interpretationEnabled&&(!stored||stored.decision.mode==='hub-literature-interpretation'),literatureEnabled:literatureEnabled&&(!stored||stored.decision.mode==='hub-literature-search'),asOf:stored?.decision?.taskPlan?.asOf,legacySingleCharacterRead:read&&Boolean(stored)&&stored.decision.mode===GENERAL_MODE});
  if(decision.status==='clarify')failure('HUB_SKILL_CLARIFICATION',decision.question,422);
  if(decision.mode===GENERAL_MODE||decision.mode==='hub-research-data'||decision.mode===VIDEO_MODE){
   const args={user:read?{...user,authVersion:stored.principal.authVersion}:user,session,text,decision,skill:null,sourceBinding:sourceBinding(session,payload),availableTools:decision.mode===VIDEO_MODE?['media_content_read']:decision.mode==='hub-research-data'?['research_data_result_read']:[],networkIntent};
   return stored?assertSkillRoute(stored,args):bindSkillRoute(args);
  }
  const descriptor=current.items.find(s=>s.key===decision.skillKey),source=catalog.skills.find(s=>s.key===decision.skillKey);
  if(!descriptor)failure('HUB_SKILL_NOT_EQUIPPED','此能力当前已停用或未对账号开放。');
  if(!await verifySource(source))failure('HUB_SKILL_SOURCE_CHANGED','技能版本已变化，请稍后重新核对。');
  if(decision.requiredTools?.includes('pubmed_search_articles')){
   const key='pubmed-medical-literature',dependency=current.items.find(s=>s.key===key),snapshot=catalog.skills.find(s=>s.key===key);
   if(!dependency)failure('HUB_SKILL_NOT_EQUIPPED','PubMed能力当前已停用。');
   if(!await verifySource(snapshot))failure('HUB_SKILL_SOURCE_CHANGED','PubMed能力版本已变化。');
   decision.dependencySkills=[{...dependency,sourceHash:snapshot.snapshotHash}];
  }
  if(decision.mode==='unavailable')failure('HUB_SKILL_RUNTIME_UNAVAILABLE','这项任务目前还不能执行。问题已保留；不会自动调用其他能力替代。',422);
  const args={user:read?{...user,authVersion:stored.principal.authVersion}:user,session,text,decision,skill:{...descriptor,sourceHash:source.snapshotHash},sourceBinding:sourceBinding(session,payload),networkIntent,availableTools:privateContext?['private_material_read']:[...(contextOf(session).kind==='article'?['hub_article_evidence']:['hub_source_search',...(literatureEnabled?['pubmed_search_articles','pubmed_fetch_articles']:[]),...(interpretationEnabled?['hub_fixed_interpretation_evidence']:[])]),...(smartSearchEnabled?['websearch','hub_public_webfetch','hub_web_snapshot']:[])]};
  return stored?assertSkillRoute(stored,args):bindSkillRoute(args);
 }
 async function validateInTx(tx,user,sid,jid,route,read=false){
  const session=await own(tx,user,sid),job=await tx.knowledgeChatJob.findFirst({where:{...owner(user),id:jid,sessionId:sid,status:read?'completed':'processing'}});
  if(!job?.payload?.hubSkillRoute)failure('HUB_SKILL_ROUTE_CHANGED','任务的技能版本无法核对。');
  const current=await bind(tx,user,session,job.text,job.payload,job.payload.hubSkillRoute,read);
  if(route&&routeDigest(current)!==routeDigest(route))failure('HUB_SKILL_ROUTE_CHANGED','任务的技能版本已变化。');
  return current;
 }
 return{
  async stagePendingInTx(tx,user,job){const session=await own(tx,user,job.sessionId);return{...job.payload,hubSkillRoute:await bind(tx,user,session,job.text,job.payload)};},
  withRequest:(user,session,input,next)=>request.run({user,session,input},next),
  async onJobCreate(tx,args,next){
   const a=request.getStore();
   if(!a)return next(args); // Non-Hub legacy task chains remain unchanged.
   if(args.data.accountId!==a.user.accountId||args.data.tenantId!==tenantId||args.data.sessionId!==a.session.id||args.data.text!==a.input.text.trim()||args.data.requestKey!==a.input.requestKey)failure('HUB_SKILL_ROUTE_CHANGED','请求内容与会话不一致。');
   const session=await own(tx,a.user,a.session.id),payload={...args.data.payload,...(smartSearchEnabled?{networkIntent:normalizeNetworkIntent(a.input.networkIntent)}:{})},route=await bind(tx,a.user,session,args.data.text,payload);
   return next({...args,data:{...args.data,payload:{...payload,hubSkillRoute:route}}});
  },
  prepare:(user,sid,jid)=>transaction(tx=>validateInTx(tx,user,sid,jid),user),
  validate:(user,sid,jid,route)=>transaction(tx=>validateInTx(tx,user,sid,jid,route),user),
  validateInTx,
  async assertNetwork(user,sid,jid){return transaction(async tx=>{
   await validateInTx(tx,user,sid,jid);const j=await tx.knowledgeChatJob.findFirst({where:{...owner(user),sessionId:sid,id:jid,status:'processing'}});
   if(!j||!effectiveNetworkIntent(j.payload.networkIntent,j.text).enabled)failure('HUB_NETWORK_DISABLED','请先开启“智能搜索”，再发送联网检索问题。',403);
   return true;
  },user);},
  async project(user,session,messages){
   return Promise.all(messages.map(async m=>{
    const receipt=m.meta?.provenance?.hubSkillRoute;if(m.role!=='assistant'||!receipt)return m;
    try{
     const route=await transaction(async tx=>{
      const job=await tx.knowledgeChatJob.findFirst({where:{...owner(user),sessionId:session.id,assistantMessageId:m.id,status:'completed'}});
      if(!job)failure('HUB_SKILL_ROUTE_CHANGED','任务不存在。');
      return validateInTx(tx,user,session.id,job.id,undefined,true);
     },user);
     if(routeDigest(routeReceipt(route))!==routeDigest(receipt))throw Error('receipt-changed');return m;
    }catch{return{...m,content:'此回答的技能或访问授权已变化，当前无法交付。',meta:{sourceStatus:'restricted'}};}
   }));
  },
 };
}
