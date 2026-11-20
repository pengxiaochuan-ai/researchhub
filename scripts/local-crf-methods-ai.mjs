import {coreSourcePath} from '../server/research-runtime/dependencies.mjs';
import assert from'node:assert/strict';
import{AsyncLocalStorage}from'node:async_hooks';
import{edcDigest,exactEdcFields}from'./synthetic-edc-contract.mjs';
import{assertDesignSources}from'./research-design-contract.mjs';
import{sourceState}from'./knowledge-ai-contract.mjs';
import{CRF_AI_REQUEST_TEXT,crfMethodsTask,bindCrfMethodsTask,crfInterpretationBinding,crfInterpretationModel,selectCrfEvidence,parseCrfMethodInterpretation,crfPrompt,crfToolEvidence,crfProviderOptions}from'./synthetic-crf-methods-ai-contract.mjs';

export function createCrfMethodsAi({root,ids,methods,edc,prisma,quota,own,ownInTx,require}){
 const{HttpException}=require('@nestjs/common'),{lockAuthorizationMutation}=require(coreSourcePath('common/worker-publication'));
 const enqueue=new AsyncLocalStorage();let queue;
 const fail=(code,message,status=409)=>{throw new HttpException({code,message},status);};
 const checked=fn=>{try{return fn();}catch(e){if(e instanceof assert.AssertionError)fail('CRF_AI_INPUT_INVALID','方法结果、选择或任务绑定无法核对',400);throw e;}};
 const taskOf=j=>{try{return crfMethodsTask(j?.payload);}catch{fail('CRF_AI_CONTEXT_INVALID','方法解释任务上下文损坏');}};
 const current=view=>{if(view.sourceStatus!=='current'||view.status!=='needs_review'||!view.result||edcDigest(view.result)!==view.resultHash)fail('CRF_AI_SOURCE_CHANGED','当前方法结果、数据或来源已变化，未交付解释');};
 async function admit(user){const s=methods.authorized(user,'R02');if(s.implementationHold)fail('CRF_AI_NOT_READY','方法解读当前暂停，请核对执行状态',409);await quota.assert(user);}
 function jobOwner(j,user,b){if(!j||j.tenantId!==user.tenantId||j.studyGroupId!==user.studyGroupId||j.researchProjectId!==user.researchProjectId||j.accountId!==user.accountId||j.sessionId!==b.sessionId||j.payload?.kbIds?.length!==1||j.payload.kbIds[0]!==b.kbId)fail('CRF_AI_CONTEXT_INVALID','任务不属于本人当前研究和会话');}
 const jobsWhere=(user,raw)=>({tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,sessionId:raw.sessionId,AND:[{payload:{path:['researchCrfMethods','kind'],equals:'result_interpretation'}},{payload:{path:['researchCrfMethods','binding','runId'],equals:raw.id}},{payload:{path:['researchCrfMethods','binding','planId'],equals:raw.inputSummary.localCrfMethod.binding.planId}},{payload:{path:['researchCrfMethods','binding','collectionId'],equals:raw.dataSources.collectionId}}]});
 const latestJob=(tx,user,raw)=>tx.knowledgeChatJob.findFirst({where:jobsWhere(user,raw),orderBy:[{createdAt:'desc'},{id:'desc'}],take:1});
 async function idle(tx,user,raw){const j=await tx.knowledgeChatJob.findFirst({where:{...jobsWhere(user,raw),status:{in:['queued','processing']}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1});if(j){taskOf(j);fail('CRF_AI_PENDING','本方法已有解释在途，请等待实际终态');}}
 function checkTask(j,user,view,raw){const t=taskOf(j);if(!t)fail('CRF_AI_CONTEXT_INVALID','方法解释选择缺失');jobOwner(j,user,t.binding);const key='rh-crf-ai-'+edcDigest({tenantId:user.tenantId,accountId:user.accountId,requestKey:t.requestKey});if(j.requestKey!==key||t.baseRunVersion!==view.runVersion||edcDigest(crfInterpretationBinding(view,t.evidenceIds))!==edcDigest(t.binding))fail('CRF_AI_CONTEXT_INVALID','方法解释与冻结运行不一致');return t;}
 async function ensureExecution(tx,user,view,raw,j,binding){
  methods.authorized(user,'R02');await ownInTx(tx,user,binding.sessionId,binding.kbId);current(view);jobOwner(j,user,binding);
  const t=checkTask(j,user,view,raw),latest=await latestJob(tx,user,raw);if(j.status!=='processing'||latest?.id!==j.id||edcDigest(t.binding)!==edcDigest(binding))fail('CRF_AI_CONTEXT_CHANGED','在途结果、选择或任务已变化，解释未交付');
 }
 async function run(user,p,c,id,body){
  checked(()=>{exactEdcFields(body,['baseRunVersion','resultHash','evidenceIds','requestKey']);assert(typeof body.baseRunVersion==='string'&&Number.isFinite(Date.parse(body.baseRunVersion)));assert(typeof body.resultHash==='string');assert.match(body.requestKey,/^[A-Za-z0-9_-]{8,128}$/);});
  const hash=edcDigest(body),jobKey='rh-crf-ai-'+edcDigest({tenantId:user.tenantId,accountId:user.accountId,requestKey:body.requestKey});
  const prepared=await methods.withRun(user,p,c,id,'artifact.edit',async(tx,parent,state,pack,view,raw)=>{
   methods.authorized(user,'R02');const prior=await tx.knowledgeChatJob.findUnique({where:{tenantId_requestKey:{tenantId:user.tenantId,requestKey:jobKey}}});
   if(prior){const t=checkTask(prior,user,view,raw);if(t.binding.runId!==id||t.requestHash!==hash)fail('CRF_AI_KEY_CONFLICT','请求标识已用于其他解释');return{existing:true,jobId:prior.id};}
   current(view);if(view.runVersion!==body.baseRunVersion||view.resultHash!==body.resultHash)fail('CRF_AI_VERSION_CONFLICT','方法运行已更新，选择保留，请核对后重试');checked(()=>selectCrfEvidence(view,body.evidenceIds));await idle(tx,user,raw);await admit(user);
   return{binding:crfInterpretationBinding(view,body.evidenceIds),sessionId:parent.block.sessionId,kbId:parent.block.kbId};
  });
  let jobId=prepared.jobId;if(!prepared.existing){await own(user,prepared.sessionId);const queued=await enqueue.run({user,p,c,id,body,hash,jobKey,...prepared},()=>queue.enqueue(user,prepared.sessionId,{text:CRF_AI_REQUEST_TEXT,requestKey:jobKey,kbIds:[prepared.kbId]}));jobId=queued.job?.id??queued.id;await methods.withRun(user,p,c,id,'artifact.read',async(tx,parent,state,pack,view,raw)=>{const t=checkTask(await tx.knowledgeChatJob.findUnique({where:{id:jobId}}),user,view,raw);if(t.requestHash!==hash)fail('CRF_AI_KEY_CONFLICT','并发请求标识已用于其他解释');});}
  return{...(await methods.read(user,p,c,id)),operation:{id:body.requestKey,jobId}};
 }
 async function result(tx,user,parent,state,pack,view,raw,j){
  const t=taskOf(j);if(!t||t.binding.runId!==raw.id||t.binding.planId!==parent.a.id||t.binding.collectionId!==pack.a.id)fail('CRF_AI_CONTEXT_INVALID','解释与真实方法父对象不匹配');methods.authorized(user,'R02');jobOwner(j,user,t.binding);await ownInTx(tx,user,j.sessionId,t.binding.kbId);if(state==='restricted')fail('CRF_AI_RESTRICTED','来源或授权受限',403);
  checkTask(j,user,view,raw);
  if(j.status!=='completed'||!j.assistantMessageId)return{job:{id:j.id,status:j.status,errorCode:j.errorCode,errorMessage:j.status==='failed'?'方法解释失败或上下文失效，未交付且不会自动重试。':null},explanation:null};
  const frozen=await edc.readPacket(tx,user,parent.a.id,pack.a.id,raw.inputSummary.localCrfMethod.versionNo),pv=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:parent.a.id,versionNo:t.binding.parentRootVersionNo}}}),block=pv?.contentBlocks?.[0];
  const unsigned={...block};delete unsigned.seal;if(!block||block.seal!==edcDigest(unsigned)||block.ownerAccountId!==user.accountId||block.sessionId!==t.binding.sessionId||block.kbId!==t.binding.kbId||edcDigest(block.sources)!==t.binding.sourcesHash)fail('CRF_AI_CONTEXT_INVALID','真实不可变方案来源无法核对');
  const m=await tx.message.findFirst({where:{id:j.assistantMessageId,sessionId:j.sessionId,role:'assistant'}}),provenance=m?.meta?.provenance,r=provenance?.researchCrfMethodsResult;
  if(!r||Object.keys(r).sort().join(',')!=='binding,items'||edcDigest(r.binding)!==edcDigest(t.binding))fail('CRF_AI_CONTEXT_INVALID','不可变方法解释损坏');assertDesignSources(block.sources,provenance.knowledgeSources);
  const modelView=crfInterpretationModel(view,t.evidenceIds,frozen.b.config,block.pico,provenance.knowledgeSources);checked(()=>parseCrfMethodInterpretation(JSON.stringify({items:r.items}),{ids:t.evidenceIds,config:frozen.b.config,modelView}));
  let stale=view.sourceStatus!=='current'||(await latestJob(tx,user,raw))?.id!==j.id;for(const s of provenance.knowledgeSources){const status=sourceState(s,await tx.knowledgeDoc.findUnique({where:{id:s.docId}}),await tx.knowledgeChunk.findUnique({where:{id:s.chunkId}}));if(status==='restricted')fail('CRF_AI_RESTRICTED','引用来源受限',403);if(status==='stale')stale=true;}
  return{job:{id:j.id,status:j.status},explanation:{...r,resultMessageId:m.id,sessionId:j.sessionId,status:stale?'stale':'current',historical:stale,sources:provenance.knowledgeSources,methodRefs:modelView.methodRefs},message:m};
 }
 async function live(tx,user,parent,state,pack,view,raw){
  const tokenQuota=await quota.status(user);
  let value={job:null,explanation:null};try{const scope=methods.authorized(user,'R02'),j=await latestJob(tx,user,raw);if(j)value=await result(tx,user,parent,state,pack,view,raw,j);return{job:value.job,explanation:value.explanation,quota:tokenQuota,aiHold:scope.implementationHold??null,actions:{canInterpret:view.sourceStatus==='current'&&view.status==='needs_review'&&!['queued','processing'].includes(value.job?.status)&&!scope.implementationHold&&tokenQuota.canStart,canCreateReport:false}};}
  catch{return{job:null,explanation:null,aiStatus:'restricted',quota:tokenQuota,actions:{canInterpret:false,canCreateReport:false},aiMessage:'方法解释上下文受限或无法核对，不交付正文或来源。'};}
 }
 async function projectMessage(user,m){
  const j=await prisma.forTenant(user.tenantId,user.studyGroupId,user.researchProjectId).knowledgeChatJob.findFirst({where:{assistantMessageId:m.id,accountId:user.accountId,sessionId:m.sessionId}}),marked=Object.hasOwn(m.meta?.provenance??{},'researchCrfMethodsResult')||Object.hasOwn(j?.payload??{},'researchCrfMethods');if(!marked)return null;
  try{const t=taskOf(j);if(!t)throw Error('missing-task');return await methods.withRun(user,t.binding.planId,t.binding.collectionId,t.binding.runId,'artifact.read',async(tx,parent,state,pack,view,raw)=>{const r=await result(tx,user,parent,state,pack,view,raw,await tx.knowledgeChatJob.findUnique({where:{id:j.id}}));if(r.explanation?.resultMessageId!==m.id)throw Error('missing-result');return{id:m.id,sessionId:m.sessionId,role:'assistant',createdAt:m.createdAt,content:r.message.content,meta:{sourceStatus:r.explanation.status,historical:r.explanation.historical,provenance:{knowledgeSources:r.explanation.sources,researchCrfMethodsResult:{binding:r.explanation.binding,items:r.explanation.items}}}};});}
  catch{return{id:m.id,sessionId:m.sessionId,role:'assistant',createdAt:m.createdAt,content:'该方法解释的授权、来源或真实运行上下文已失效，正文与来源不再交付。',meta:{sourceStatus:'restricted'}};}
 }
 return{run,live,projectMessage,prompt:crfPrompt,toolEvidence:crfToolEvidence,providerOptions:crfProviderOptions,setQueue:q=>{queue=q;},
  async readResult(tx,user,parent,state,pack,view,raw,messageId){const j=await tx.knowledgeChatJob.findFirst({where:{assistantMessageId:messageId,accountId:user.accountId,sessionId:raw.sessionId}});if(!j)fail('CRF_AI_CONTEXT_INVALID','报告指定的真实解释不存在');return result(tx,user,parent,state,pack,view,raw,j);},
  async readMessageSource(user,m,index){const projected=await projectMessage(user,m);if(!projected)return null;if(projected.meta.sourceStatus==='restricted')fail('CRF_AI_RESTRICTED','方法解释来源受限',403);const r=projected.meta.provenance.researchCrfMethodsResult,t=r.binding;return methods.withRun(user,t.planId,t.collectionId,t.runId,'artifact.read',async(tx,parent,state,pack,view,raw)=>{const complete=await result(tx,user,parent,state,pack,view,raw,await tx.knowledgeChatJob.findFirst({where:{assistantMessageId:m.id,accountId:user.accountId,sessionId:m.sessionId}})),match=/^(M)?([1-9]\d*)$/.exec(index);if(!match)fail('CRF_AI_SOURCE_INVALID','来源编号无效',400);const kind=match[1]?'method':'knowledge',n=Number(match[2]);if(!r.items.some(i=>i.sourceRefs.some(s=>s.kind===kind&&s.index===n)))fail('CRF_AI_SOURCE_INVALID','不是实际引用来源',400);return kind==='knowledge'?{...complete.explanation.sources[n-1],kind,index:n,status:complete.explanation.status,sourceStatus:complete.explanation.status,historical:complete.explanation.historical}:{kind,index:n,runId:t.runId,inputHash:t.inputHash,resultHash:t.resultHash,evidence:selectCrfEvidence(view,[complete.explanation.methodRefs[n-1].evidenceId])[0],status:complete.explanation.status,sourceStatus:complete.explanation.status,historical:complete.explanation.historical};});},
  async onJobCreate(tx,args,next){
   crfMethodsTask(args.data.payload);const a=enqueue.getStore();if(!a)return next(args);
   await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});
   const rows=await tx.$queryRaw`SELECT id FROM research_method_run WHERE id=${a.id} AND "tenantId"=${a.user.tenantId} AND "studyGroupId"=${a.user.studyGroupId} AND "researchProjectId"=${a.user.researchProjectId} AND "accountId"=${a.user.accountId} FOR UPDATE`;
   if(rows.length!==1)fail('CRF_AI_CONTEXT_INVALID','真实本人方法不存在');
   return methods.inRun(tx,a.user,a.p,a.c,a.id,'artifact.edit',async(tx,parent,state,pack,view,raw)=>{
    current(view);if(view.runVersion!==a.body.baseRunVersion||view.resultHash!==a.body.resultHash)fail('CRF_AI_VERSION_CONFLICT','入队前方法已变化');
    await idle(tx,a.user,raw);await admit(a.user);await ownInTx(tx,a.user,a.sessionId,a.kbId);
    if(edcDigest(crfInterpretationBinding(view,a.body.evidenceIds))!==edcDigest(a.binding))fail('CRF_AI_CONTEXT_CHANGED','入队前选择或来源已变化');
    const job=await next({...args,data:{...args.data,payload:bindCrfMethodsTask(args.data.payload,a.binding,{evidenceIds:a.body.evidenceIds,requestHash:a.hash,baseRunVersion:a.body.baseRunVersion,requestKey:a.body.requestKey})}});
    await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.user.accountId,action:'local_crf_method_interpretation',target:raw.id,meta:{jobId:job.id,inputHash:raw.inputHash,resultHash:raw.artifactRefs.resultHash,selectedIdsHash:a.binding.selectedIdsHash,requestHash:a.hash,runVersion:view.runVersion}}});return job;
   });
  },
  async prepare(user,jobId){const j=await prisma.forTenant(user.tenantId,user.studyGroupId,user.researchProjectId).knowledgeChatJob.findUnique({where:{id:jobId}}),t=taskOf(j);if(!t)return null;return methods.withRun(user,t.binding.planId,t.binding.collectionId,t.binding.runId,'artifact.edit',async(tx,parent,state,pack,view,raw)=>{await ensureExecution(tx,user,view,raw,j,t.binding);const ids=t.evidenceIds;return{...t,ids,config:pack.b.config,sources:parent.block.sources,modelView:crfInterpretationModel(view,ids,pack.b.config,parent.block.pico,parent.block.sources)};});},
  accept(r,turn){if(!turn.crf)return;assertDesignSources(turn.crf.sources,turn.sources);if(r.providerOutcome!=='known'||r.usedMock!==false||!r.usage||r.provenance?.deterministicSynthesisFallback||r.provenance?.numericBoundaryBlocked||r.provenance?.dataBoundaryBlocked)fail('CRF_AI_NOT_DELIVERABLE','实际Agent工具或模型未交付可核对结果',422);let parsed;try{parsed=parseCrfMethodInterpretation(r.finalText,turn.crf);}catch{fail('CRF_AI_OUTPUT_INVALID','解释未通过方法引用、JSON或数值边界校验；费用保留，不自动重试',422);}r.provenance={...r.provenance,researchCrfMethodsResult:{binding:turn.crf.binding,items:parsed.items}};r.finalText='## 合成科研方法解释（待本人核对）\n\n'+parsed.items.map(i=>i.explanation+(i.question?'\n\n'+i.question:'')).join('\n\n');},
  async validateTurn(tx,turn){if(!turn.crf)return;const b=turn.crf.binding;await methods.inRun(tx,turn.user,b.planId,b.collectionId,b.runId,'artifact.edit',async(tx,parent,state,pack,view,raw)=>{await ensureExecution(tx,turn.user,view,raw,await tx.knowledgeChatJob.findUnique({where:{id:turn.jobId}}),b);assertDesignSources(parent.block.sources,turn.sources);});},
 };
}
