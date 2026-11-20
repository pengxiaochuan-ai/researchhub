import {coreSourcePath} from '../server/research-runtime/dependencies.mjs';
// Local, approved candidate-only adapter. Old domain services and tables remain authoritative.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {hashText,buildSourceSnapshot,sourceState} from './knowledge-ai-contract.mjs';
import {PLAN_MARKER,confirmPico,parsePicoCandidate,parsePlanCandidate,stagePrompt,stageRequestText,assertDraftBinding,renderCandidate,editablePlanContent,planRetrievalQuery} from './research-plan-contract.mjs';
import {readDesignBlock,researchDesignNextAction,assertDesignWriteIdle,assertDesignRequestSize,designInputBinding,designTaskBinding,evidenceBindingCurrent,designSuggestionsCurrent,assertDesignFreshRequestKey} from './research-design-contract.mjs';
import {preparationSummary,assertPreparationIdle} from './research-execution-preparation-contract.mjs';

export async function createLocalResearchPlans({root,ids,prisma,knowledge,storage,load,require,quota,own}){
 const {Controller,Get,Post,Req,Body,Param,Query,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(coreSourcePath('common/decorators'));
 const {withCurrentKnowledgeRead}=require(coreSourcePath('knowledge/retrieval.service'));
 const {lockAuthorizationMutation}=require(coreSourcePath('common/worker-publication'));
 const {buildResearchStudyPlanDraft}=require(coreSourcePath('research-evidence/research-study-plan'));
 const {canonicalArtifactJson}=require(coreSourcePath('research-artifacts/research-artifact-integrity'));
 const Retrieval=load('knowledge/retrieval.service','RetrievalService'),Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService');
 const retrieval=new Retrieval(prisma,null),enqueue=new AsyncLocalStorage();let queue;
 const error=(code,message,status=409)=>new HttpException({code,message},status);
 const deny=()=>{throw error('PLAN_FORBIDDEN','当前账号或研究范围没有本轮草稿权限',403);};
 const invalid=message=>{throw error('PLAN_INPUT_INVALID',message,400);};
 const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))invalid('标识格式无效');return value;};
 function body(value,keys){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))invalid('草稿请求字段不匹配');return value;}
 function writeInput(value,keys){body(value,keys);id(value.requestKey);if(value.requestKey.length<8||!Number.isSafeInteger(value.baseVersionNo)||value.baseVersionNo<1)invalid('版本或请求标识无效');}
 const boundPrisma=tx=>({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)});
 const service=tx=>new Artifacts(boundPrisma(tx),storage,null,null);
 async function authorize(tx,user,permission='artifact.read'){
  if(user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(user.accountId))deny();
  const account=await tx.account.findUnique({where:{id:user.accountId},include:{tenant:true}});
  const member=await tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:user.accountId,status:'active',studyGroup:{status:'active'},role:{status:'active'}},include:{role:true}});
  const project=await tx.researchProject.findFirst({where:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group,status:'active'}});
  const pm=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,status:'active'}});
  if(!account||account.tenantId!==ids.tenant||account.status!=='active'||account.tenant.status!=='active'||account.authVersion!==user.authVersion||!member||!project||!pm)deny();
  if(!['knowledge','workbench','artifacts'].every(k=>member.role.menuPermissions.includes(k))||!['chat.use',permission].every(k=>member.role.buttonPermissions.includes(k)))deny();
 }
 const locked=(user,permission,cb)=>withCurrentKnowledgeRead(prisma,user,async tx=>{await authorize(tx,user,permission);return cb(tx);});
 // Apply once, to exactly the two already-approved fixture memberships. Never restore revoked grants on restart.
 await prisma.elevated.$transaction(async tx=>{
  await lockAuthorizationMutation(tx,ids.tenant);
  if(await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_research_plan_authorized',target:ids.role}}))return;
  const members=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,roleId:ids.role},select:{accountId:true}});
  assert.deepEqual(members.map(x=>x.accountId).sort(),[ids.owner,ids.admin].sort());
  const role=await tx.permissionRole.findUnique({where:{id:ids.role}});assert.equal(role.tenantId,ids.tenant);
  await tx.permissionRole.update({where:{id:ids.role},data:{menuPermissions:[...new Set([...role.menuPermissions,'artifacts'])],buttonPermissions:[...new Set([...role.buttonPermissions,'artifact.read','artifact.create','artifact.edit'])]}});
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:'local_research_plan_authorized',target:ids.role,meta:{accounts:[ids.owner,ids.admin],menus:['artifacts'],buttons:['artifact.read','artifact.create','artifact.edit'],scope:'local-own-current-study-protocol-candidate-only',reviewReleaseExport:false}}});
 });
 async function loadPlan(tx,user,artifactId){
  const a=await tx.researchArtifact.findFirst({where:{id:id(artifactId),tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:user.accountId,createdBy:user.accountId,typeKey:'protocol_draft',status:'draft',deletedAt:null,idempotencyKey:{startsWith:'rh-plan-20261022:'}}});if(!a)deny();
  const v=await tx.researchArtifactVersion.findFirst({where:{artifactId:a.id,versionNo:a.currentVersionNo}}),block=v?.contentBlocks?.find(x=>x.type===PLAN_MARKER);if(!block||block.ownerAccountId!==user.accountId)deny();
  const seal={...block};delete seal.seal;if(block.seal!==hashText(canonicalArtifactJson(seal)))throw error('PLAN_CONTEXT_INVALID','草稿上下文完整性校验失败');
  const s=await tx.session.findFirst({where:{id:block.sessionId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,channel:'knowledge',deletedAt:null}});if(!s||s.contextKey!=='kb:'+block.kbId)deny();
  return{a,v,block};
 }
 async function sourcesState(tx,user,sources,kbId){
  if(!(await retrieval.accessibleKbIds(user,[kbId],tx)).includes(kbId))return'restricted';
  let state='current';for(const s of sources){const d=await tx.knowledgeDoc.findUnique({where:{id:s.docId}}),c=await tx.knowledgeChunk.findUnique({where:{id:s.chunkId}});const next=sourceState(s,d,c);if(next==='restricted')return next;if(next==='stale')state=next;}return state;
 }
 async function current(tx,user,plan){const state=await sourcesState(tx,user,plan.block.sources,plan.block.kbId);if(state!=='current')throw error('PLAN_SOURCE_CHANGED','资料版本、审核或访问已变化，请返回知识资料核对后建立新候选。');}
 const seal=block=>({...block,seal:hashText(canonicalArtifactJson(block))});
 function content(text,block){const clean=editablePlanContent(text);return clean+'\n\n<!-- rh-plan-provenance -->\n\n## 来源与确认记录\n\n仅限合成研究候选；来源快照不代表正式方法学确认。\n\n'+block.sources.map((s,i)=>`- [${i+1}]《${s.docTitle}》v${s.version} · ${s.chunkId} · ${s.contentHash}`).join('\n')+'\n\nPICO确认：'+(block.confirmation?`${block.confirmation.accountId} · ${block.confirmation.at} · ${block.confirmation.hash}`:'尚未确认')+'\n\n上下文SHA256：'+hashText(JSON.stringify(block))+'\n<!-- /rh-plan-provenance -->';}
 async function version(tx,user,plan,block,text,kind,key,requestHash){
  const clean={...block};delete clean.seal;
  clean.operations=[...(clean.operations??[]),{kind,key,hash:requestHash}];if(clean.operations.length>64)throw error('PLAN_HISTORY_LIMIT','本机候选已达到修订记录上限，请另建候选。');
  await service(tx).createVersion(user,plan.a.id,{baseVersionNo:plan.a.currentVersionNo,contentMd:content(text,clean),contentBlocks:[seal(clean)],changeSummary:kind});
 }
 function repeat(plan,kind,key,requestHash){const old=plan.block.operations?.find(x=>x.key===key);if(!old)return false;if(old.kind!==kind||old.hash!==requestHash)throw error('PLAN_REQUEST_KEY_CONFLICT','请求标识已用于其他草稿操作');return true;}
 function expected(plan,base){if(plan.a.currentVersionNo!==base)throw error('PLAN_VERSION_CONFLICT','草稿版本已变化，当前输入保留；请先刷新核对。');}
 function freshKey(plan,key){try{assertDesignFreshRequestKey(plan.block.operations,key);}catch{throw error('PLAN_REQUEST_KEY_CONFLICT','请求标识已被草稿操作使用，未发起新的收费任务。');}}
 async function designIdle(tx,plan){try{await assertPreparationIdle(plan,id=>tx.knowledgeChatJob.findUnique({where:{id}}));}catch(e){throw error(e.message.includes('JOB_PENDING')?'PLAN_JOB_PENDING':'PLAN_CONTEXT_INVALID','当前草稿任务在途或上下文无法核对，请先核对任务状态。');}}
 async function pendingResult(tx,user,plan){
  if(!plan.block.pending)return{};
  const job=await tx.knowledgeChatJob.findUnique({where:{id:plan.block.pending.jobId}});
  if(!job||job.accountId!==user.accountId||job.sessionId!==plan.block.sessionId||job.payload?.researchPlan?.artifactId!==plan.a.id)deny();
  const view={job:{id:job.id,status:job.status,errorCode:job.errorCode,errorMessage:job.errorMessage}};
  if(job.status!=='completed'||!job.assistantMessageId)return view;
  const m=await tx.message.findFirst({where:{id:job.assistantMessageId,sessionId:job.sessionId,role:'assistant'}}),result=m?.meta?.provenance?.researchPlanResult;
  if(!result||result.artifactId!==plan.a.id||result.stage!==plan.block.pending.stage||result.version!==plan.a.currentVersionNo)throw error('PLAN_RESULT_BINDING','AI结果不属于当前草稿版本');
  const sources=m.meta.provenance.knowledgeSources;
  if(await sourcesState(tx,user,sources,plan.block.kbId)!=='current')throw error('PLAN_SOURCE_CHANGED','AI候选来源已经变化，请核对后重新生成。');
  return{...view,proposal:{...result,sourceMessageId:m.id,sources,...(result.stage==='protocol'?{contentMd:renderCandidate(plan.block.pico,result.candidate)}:{})}};
 }
 async function view(tx,user,plan){
  const state=await sourcesState(tx,user,plan.block.sources,plan.block.kbId);
  if(state==='restricted')return{id:plan.a.id,version:plan.a.currentVersionNo,stage:'restricted',sourceStatus:state,message:'资料撤审、删除或访问失效，原草稿和摘录不再交付。'};
  const pending=state==='current'?await pendingResult(tx,user,plan):{};
  return{id:plan.a.id,version:plan.a.currentVersionNo,title:plan.a.title,stage:plan.block.stage,sourceStatus:state,sources:plan.block.sources,sessionId:plan.block.sessionId,pico:plan.block.pico??null,picoCandidate:plan.block.picoProposal??null,confirmation:plan.block.confirmation??null,contentMd:plan.block.stage==='protocol_draft'?editablePlanContent(plan.v.contentMd):'',versions:await tx.researchArtifactVersion.findMany({where:{artifactId:plan.a.id},select:{versionNo:true,changeSummary:true,createdAt:true},orderBy:{versionNo:'desc'},take:30}),...pending,quota:await quota.status(user)};
 }
 async function create(user,input){
  body(input,['sessionId','requestKey']);id(input.sessionId);id(input.requestKey);if(input.requestKey.length<8)invalid('请求标识无效');const s=await own(user,input.sessionId),kbId=s.contextKey.slice(3),key='rh-plan-20261022:'+user.accountId+':'+input.requestKey,requestHash=hashText(input.sessionId);
  const existing=await locked(user,'artifact.create',tx=>tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:ids.tenant,idempotencyKey:key}}}));if(existing){if(existing.creationRequestHash!==requestHash)throw error('PLAN_REQUEST_KEY_CONFLICT','请求标识已用于另一会话');return read(user,existing.id);}
  const hits=await knowledge.search(user,{query:planRetrievalQuery('',true),kbIds:[kbId],topK:6});if(!hits.length)throw error('PLAN_NO_EVIDENCE','当前库没有可用已审核资料，未建立候选、未调用模型。',422);
  const artifactId=await locked(user,'artifact.create',async tx=>{
   const sources=[];for(const h of hits)sources.push(buildSourceSnapshot(h,await tx.knowledgeDoc.findUnique({where:{id:h.docId}}),await tx.knowledgeChunk.findUnique({where:{id:h.chunkId}})));
   if(await sourcesState(tx,user,sources,kbId)!=='current')throw error('PLAN_SOURCE_CHANGED','当前资料已变化');
   const block={type:PLAN_MARKER,ownerAccountId:user.accountId,sessionId:s.id,kbId,sources,stage:'awaiting_pico',operations:[]};
   return(await service(tx).create(user,{title:'合成研究方案候选',typeKey:'protocol_draft',idempotencyKey:key,creationRequestHash:requestHash,contentMd:content('PICO候选尚未生成，研究者尚未确认。',block),contentBlocks:[seal(block)]})).id;
  });return read(user,artifactId);
 }
 const read=(user,artifactId)=>locked(user,'artifact.read',async tx=>view(tx,user,await loadPlan(tx,user,artifactId)));
 async function list(user,query){
  if(Object.keys(query).some(k=>!['limit','before'].includes(k)))invalid('列表参数无效');const limit=Number(query.limit??20);if(!Number.isSafeInteger(limit)||limit<1||limit>30)invalid('每页需为1–30条');if(query.before)id(query.before);
  return locked(user,'artifact.read',async tx=>{
   const where={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:user.accountId,createdBy:user.accountId,typeKey:'protocol_draft',status:'draft',deletedAt:null,idempotencyKey:{startsWith:'rh-plan-20261022:'}};
   if(query.before&&!await tx.researchArtifact.findFirst({where:{...where,id:query.before}}))deny();
   const rows=await tx.researchArtifact.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(query.before?{cursor:{id:query.before},skip:1}:{})});const hasMore=rows.length>limit,items=[];
   for(const a of rows.slice(0,limit)){try{
    const p=await loadPlan(tx,user,a.id),state=await sourcesState(tx,user,p.block.sources,p.block.kbId),design=readDesignBlock(p.block);
    const pendingId=design?.pending?.jobId??p.block.pending?.jobId,job=pendingId?await tx.knowledgeChatJob.findUnique({where:{id:pendingId}}):null;
    if(job&&(job.accountId!==user.accountId||job.sessionId!==p.block.sessionId))deny();
    let evidence=design?.evidence,suggestions=design?.suggestions;
    if(state==='current'&&design?.pending&&job?.status==='completed'&&job.assistantMessageId){const task=designTaskBinding(job.payload),m=await tx.message.findFirst({where:{id:job.assistantMessageId,sessionId:job.sessionId,role:'assistant'}}),result=m?.meta?.provenance?.researchDesignResult;if(!task||result?.kind!==task.kind||canonicalArtifactJson(result.binding)!==canonicalArtifactJson(task.binding))throw error('PLAN_CONTEXT_INVALID','列表设计结果绑定无法核对');if(result.kind==='evidence')evidence={...result,rows:result.candidate.rows};else suggestions={...result,resultMessageId:m.id,items:result.candidate.items};}
    const currentBinding=p.block.confirmation?designInputBinding(p,user):null;
    const nextAction=researchDesignNextAction({sourceStatus:state,stage:p.block.stage,confirmation:p.block.confirmation,job,evidence:evidenceBindingCurrent(evidence?.binding,currentBinding)?evidence.rows:undefined,suggestions:suggestions&&designSuggestionsCurrent(suggestions,currentBinding,a.currentVersionNo,design?.adoptionHead)?suggestions.items:undefined});
    items.push({id:a.id,version:a.currentVersionNo,stage:state==='restricted'?'restricted':p.block.stage,sourceStatus:state,createdAt:a.createdAt,nextAction,
     ...(state==='current'?{displayTitle:p.block.pico?.question??a.title,coverage:{selectedFragments:p.block.sources.length,scope:'fixed_fragment_set'},preparation:preparationSummary(p.block,a.currentVersionNo)}:{})});
   }catch{items.push({id:a.id,version:a.currentVersionNo,stage:'unavailable',sourceStatus:'restricted',createdAt:a.createdAt,nextAction:{key:'restricted',label:'上下文或授权待核对'}});}}
   return{items,nextCursor:hasMore?items.at(-1)?.id:null};
  });
 }
 async function run(user,artifactId,input){
  writeInput(input,['baseVersionNo','stage','requestKey']);if(!['pico','protocol'].includes(input.stage))invalid('不支持的候选阶段');await own(user,(await locked(user,'artifact.edit',async tx=>(await loadPlan(tx,user,artifactId)).block.sessionId)));
  const prepared=await locked(user,'artifact.edit',async tx=>{const plan=await loadPlan(tx,user,artifactId);await current(tx,user,plan);const existing=await tx.knowledgeChatJob.findUnique({where:{tenantId_requestKey:{tenantId:ids.tenant,requestKey:input.requestKey}}});if(existing){if(existing.accountId!==user.accountId||existing.sessionId!==plan.block.sessionId||existing.text!==stageRequestText(input.stage)||existing.payload?.researchPlan?.artifactId!==artifactId||existing.payload.researchPlan.stage!==input.stage)throw error('PLAN_REQUEST_KEY_CONFLICT','请求标识已用于其他操作');return{existing:true};}
   freshKey(plan,input.requestKey);expected(plan,input.baseVersionNo);await designIdle(tx,plan);const pending=await pendingResult(tx,user,plan);if(['queued','processing'].includes(pending.job?.status))throw error('PLAN_JOB_PENDING','当前候选仍在执行，不重复入队');
   if(input.stage==='pico'&&!['awaiting_pico','pico_pending'].includes(plan.block.stage)||input.stage==='protocol'&&!['pico_confirmed','protocol_pending'].includes(plan.block.stage))throw error('PLAN_PICO_REQUIRED','请先补齐并确认PICO，再生成方案候选。');
   await quota.assert(user);
   return{sessionId:plan.block.sessionId,kbId:plan.block.kbId,binding:{artifactId,version:plan.a.currentVersionNo,stage:input.stage,...(plan.block.confirmation?{confirmationHash:plan.block.confirmation.hash}:{})}};
  });if(prepared.existing)return read(user,artifactId);
  await enqueue.run({user,input,...prepared},()=>queue.enqueue(user,prepared.sessionId,{text:stageRequestText(input.stage),requestKey:input.requestKey,kbIds:[prepared.kbId]}));return read(user,artifactId);
 }
 async function confirm(user,artifactId,input){
  writeInput(input,['baseVersionNo','requestKey','pico']);let confirmed;try{confirmed=confirmPico(input.pico);}catch{invalid('请明确核心研究问题和P/I/C/O；问题须以问号结尾，不用“待确认”代替字段。');}
  await locked(user,'artifact.edit',async tx=>{const plan=await loadPlan(tx,user,artifactId);await current(tx,user,plan);const requestHash=hashText(JSON.stringify(confirmed.values));if(repeat(plan,'确认PICO',input.requestKey,requestHash))return;expected(plan,input.baseVersionNo);
   await designIdle(tx,plan);const pending=await pendingResult(tx,user,plan);if(['queued','processing'].includes(pending.job?.status))throw error('PLAN_JOB_PENDING','AI仍在执行，请等待后确认');if(plan.block.confirmation?.picoHash===confirmed.hash)return;
   const proposal=pending.proposal?.stage==='pico'?pending.proposal:null;if(!proposal&&!plan.block.picoProposal)throw error('PLAN_PICO_CANDIDATE_REQUIRED','请先生成成功的真实PICO候选');
   const sourceMessageId=proposal?.sourceMessageId??plan.block.picoProposal.sourceMessageId;
   const block={...plan.block,stage:'pico_confirmed',pico:confirmed.values,picoProposal:proposal??plan.block.picoProposal,confirmation:{accountId:user.accountId,at:new Date().toISOString(),sourceMessageId,hash:hashText(JSON.stringify({pico:confirmed.values,sourceMessageId,sources:plan.block.sources})),picoHash:confirmed.hash},pending:null};
   await version(tx,user,plan,block,['## 研究者确认的候选PICO',confirmed.values.question,...['p','i','c','o'].map(k=>k.toUpperCase()+'：'+confirmed.values[k])].join('\n\n'),'确认PICO',input.requestKey,requestHash);
  });return read(user,artifactId);
 }
 async function history(user,artifactId,number){
  if(typeof number!=='string'||!/^([1-9][0-9]{0,5})$/.test(number))invalid('历史版本须为有效正整数。');
  return locked(user,'artifact.read',async tx=>{const p=await loadPlan(tx,user,artifactId),v=await tx.researchArtifactVersion.findFirst({where:{artifactId:p.a.id,versionNo:Number(number)}});if(!v)throw error('PLAN_VERSION_NOT_FOUND','本人草稿不存在该历史版本。',404);const block=v.contentBlocks?.find(x=>x.type===PLAN_MARKER),unsigned={...block};delete unsigned.seal;if(!block||block.ownerAccountId!==user.accountId||block.sessionId!==p.block.sessionId||block.kbId!==p.block.kbId||block.seal!==hashText(canonicalArtifactJson(unsigned)))throw error('PLAN_CONTEXT_INVALID','历史草稿上下文无法核对');const state=await sourcesState(tx,user,block.sources,block.kbId);if(state==='restricted')return{id:p.a.id,version:v.versionNo,sourceStatus:state,message:'历史来源或当前访问失效，不交付历史正文。'};return{id:p.a.id,version:v.versionNo,currentVersion:p.a.currentVersionNo,sourceStatus:state,stage:block.stage,contentMd:block.stage==='protocol_draft'?editablePlanContent(v.contentMd):'',pico:block.pico??null,confirmation:block.confirmation??null,sources:block.sources,design:readDesignBlock(block),changeSummary:v.changeSummary,createdAt:v.createdAt,readOnly:true};});
 }
 async function save(user,artifactId,input,rawBytes){
  writeInput(input,['baseVersionNo','requestKey','contentMd']);if(typeof input.contentMd!=='string'||!input.contentMd.trim()||input.contentMd.length>24000)invalid('草稿正文需为1–24000字');
  try{assertDesignRequestSize('versions',input,rawBytes);}catch{invalid('原方案保存请求超过192KiB上限。');}
  await locked(user,'artifact.edit',async tx=>{const plan=await loadPlan(tx,user,artifactId);await current(tx,user,plan);const requestHash=hashText(input.contentMd);if(repeat(plan,'保存方案草稿',input.requestKey,requestHash))return;expected(plan,input.baseVersionNo);await designIdle(tx,plan);const pending=await pendingResult(tx,user,plan);
   const proposal=pending.proposal?.stage==='protocol'?pending.proposal:null;if(plan.block.stage!=='protocol_draft'&&!proposal)throw error('PLAN_PROTOCOL_CANDIDATE_REQUIRED','尚无可采纳的真实方案候选');
   const block={...plan.block,stage:'protocol_draft',protocolProposal:proposal??plan.block.protocolProposal,pending:null};await version(tx,user,plan,block,input.contentMd,'保存方案草稿',input.requestKey,requestHash);
  });return read(user,artifactId);
 }
 class LocalResearchPlansController{create(req,b){return create(req.user,b);}list(req,q){return list(req.user,q);}read(req,p){return read(req.user,p);}history(req,p,n){return history(req.user,p,n);}run(req,p,b){return run(req.user,p,b);}confirm(req,p,b){return confirm(req.user,p,b);}save(req,p,b){return save(req.user,p,b,req.researchDesignBytes);}}
 Controller('research-plan-drafts')(LocalResearchPlansController);RequireStudyGroup()(LocalResearchPlansController);RequireResearchProject()(LocalResearchPlansController);RequireStudyGroupMenu('artifacts')(LocalResearchPlansController);RequireStudyGroupPermission('artifact.read')(LocalResearchPlansController);
 for(const[method,verb,path]of[['create',Post,''],['read',Get,':id'],['run',Post,':id/jobs'],['confirm',Post,':id/pico-confirmations'],['save',Post,':id/versions']]){verb(path)(LocalResearchPlansController.prototype,method,Object.getOwnPropertyDescriptor(LocalResearchPlansController.prototype,method));Req()(LocalResearchPlansController.prototype,method,0);if(method==='create')Body()(LocalResearchPlansController.prototype,method,1);else{Param('id')(LocalResearchPlansController.prototype,method,1);if(method!=='read')Body()(LocalResearchPlansController.prototype,method,2);}}
 Get('')(LocalResearchPlansController.prototype,'list',Object.getOwnPropertyDescriptor(LocalResearchPlansController.prototype,'list'));Req()(LocalResearchPlansController.prototype,'list',0);Query()(LocalResearchPlansController.prototype,'list',1);
 Get(':id/versions/:version')(LocalResearchPlansController.prototype,'history',Object.getOwnPropertyDescriptor(LocalResearchPlansController.prototype,'history'));Req()(LocalResearchPlansController.prototype,'history',0);Param('id')(LocalResearchPlansController.prototype,'history',1);Param('version')(LocalResearchPlansController.prototype,'history',2);
 return{Controller:LocalResearchPlansController,setQueue:q=>{queue=q;},formatContent:content,
  withScope:locked,
  inDraft:async(tx,user,artifactId,permission,callback)=>{await authorize(tx,user,permission);const plan=await loadPlan(tx,user,artifactId);return callback(tx,plan,await sourcesState(tx,user,plan.block.sources,plan.block.kbId));},
  withDraft:(user,artifactId,permission,callback)=>locked(user,permission,async tx=>{const plan=await loadPlan(tx,user,artifactId);const state=await sourcesState(tx,user,plan.block.sources,plan.block.kbId);return callback(tx,plan,state);}),
  async onJobCreate(tx,args,next){const active=enqueue.getStore();if(!active)return next(args);await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});await authorize(tx,active.user,'artifact.edit');const plan=await loadPlan(tx,active.user,active.binding.artifactId);await current(tx,active.user,plan);freshKey(plan,active.input.requestKey);expected(plan,active.binding.version);await designIdle(tx,plan);await quota.assert(active.user);const binding={...active.binding,version:plan.a.currentVersionNo+1};const job=await next({...args,data:{...args.data,payload:{...args.data.payload,researchPlan:binding}}});const block={...plan.block,stage:active.input.stage+'_pending',pending:{jobId:job.id,stage:active.input.stage,requestKey:active.input.requestKey}};await version(tx,active.user,plan,block,plan.v.contentMd,'请求'+active.input.stage,active.input.requestKey,hashText(stageRequestText(active.input.stage)));return job;},
  async prepare(user,jobId){const record=await prisma.forTenant(user.tenantId,user.studyGroupId,user.researchProjectId).knowledgeChatJob.findUnique({where:{id:jobId}});if(!record?.payload?.researchPlan)return null;return locked(user,'artifact.edit',async tx=>{const job=await tx.knowledgeChatJob.findUnique({where:{id:jobId}});const binding=job?.payload?.researchPlan;if(!binding||job.accountId!==user.accountId)deny();const plan=await loadPlan(tx,user,binding.artifactId);await current(tx,user,plan);assertDraftBinding(binding,{...plan.a,stage:plan.block.stage,confirmation:plan.block.confirmation});return{binding,pico:plan.block.pico,sources:plan.block.sources};});},
  prompt:turn=>turn.plan?stagePrompt(turn.plan.binding.stage,turn.plan.pico):'',
  accept(result,turn){if(!turn.plan)return;const binding=turn.plan.binding;const candidate=binding.stage==='pico'?parsePicoCandidate(result.finalText,turn.sources):parsePlanCandidate(result.finalText,turn.sources,turn.plan.pico,buildResearchStudyPlanDraft);result.provenance={...result.provenance,researchPlanResult:{...binding,candidate}};result.finalText=binding.stage==='pico'?['## 待研究者确认的PICO候选',candidate.question,...['p','i','c','o'].map(k=>k.toUpperCase()+'：'+(candidate[k]??'待研究者明确')),candidate.rationale,'待确认：'+candidate.unknowns.join('；')].join('\n\n'):renderCandidate(turn.plan.pico,candidate);},
  async validateTurn(tx,turn){if(!turn.plan)return;await authorize(tx,turn.user,'artifact.edit');const plan=await loadPlan(tx,turn.user,turn.plan.binding.artifactId);await current(tx,turn.user,plan);assertDraftBinding(turn.plan.binding,{...plan.a,stage:plan.block.stage,confirmation:plan.block.confirmation});},
 };
}
