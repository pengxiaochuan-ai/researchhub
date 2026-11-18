// Local WP09 purpose only. Original services, locks and permissions stay authoritative.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readAssetApplicabilityScope,APPLICABILITY_MARKER,APPLICABILITY_PREFIX,applicabilityId} from './asset-applicability-scope.mjs';
import {edcDigest,exactEdcFields} from './synthetic-edc-contract.mjs';
import {hashText,sourceState} from './knowledge-ai-contract.mjs';
import {applicabilityInput,compareApplicability,applyApplicabilityOpinions,renderApplicability as render} from './asset-applicability-contract.mjs';
import {readPreparationBlock,preparationBasis,preparationCurrent} from './research-execution-preparation-contract.mjs';
import {applicabilityTask,assertApplicabilityExecution,buildApplicabilityModel,parseApplicabilityResult,parseApplicabilityModelResult} from './asset-applicability-ai-contract.mjs';
import {assertDesignSources} from './research-design-contract.mjs';

export function createAssetApplicability({root,ids,plans,assets,prisma,storage,load,require,scope,quota,access}){
 const {HttpException,Controller,Get,Post,Req,Param,Body,Query}=require('@nestjs/common'),Sessions=load('sessions/sessions.service','SessionsService'),Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService');
 const {canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(root+'app/server/src/common/decorators.ts');
 const fail=(code,message,status=409)=>{throw new HttpException({code,message},status);};
 const invalid=()=>fail('APPLICABILITY_INPUT_INVALID','核对字段、版本或标识无效',400);
 const bound=tx=>({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)});
 const sessionService=tx=>new Sessions(bound(tx),storage,null,null,null,{});
 const enqueue=new AsyncLocalStorage();let queue;
 const requestText='请核对本人资产与目标方案的声明差异，给出有来源的定性解释和待人工确认的问题，不判断临床适用性。';
 const jobKey=(u,key)=>'rh-applicability-ai-'+edcDigest({tenantId:u.tenantId,accountId:u.accountId,requestKey:key});
 const canonical=v=>JSON.parse(canonicalArtifactJson(v));
 const version=v=>{if(!Number.isSafeInteger(v)||v<1||v>30)invalid();return v;};
 const identity=v=>{if(!applicabilityId(v))invalid();return v;};
 const input=(b,keys)=>{try{exactEdcFields(b,keys);}catch{invalid();}if(typeof b.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(b.requestKey))invalid();};
 const where=u=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:u.accountId,createdBy:u.accountId,typeKey:'research_report',status:'draft',deletedAt:null,idempotencyKey:{startsWith:APPLICABILITY_PREFIX+u.accountId+':'}});
 const capacityWhere=u=>({tenantId:ids.tenant,ownerAccountId:u.accountId,createdBy:u.accountId,idempotencyKey:{startsWith:APPLICABILITY_PREFIX+u.accountId+':'}});
 function sealed(b){const v=canonical({...b,seal:edcDigest(b)});if(Buffer.byteLength(JSON.stringify(b.basis))>1048576||Buffer.byteLength(JSON.stringify(v))>1572864||Buffer.byteLength(render(b))>524288)fail('APPLICABILITY_CAPACITY','本轮核对超过快照或正文容量',429);return v;}
 async function actorLock(tx,u){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'rh-asset-applicability:'+ids.tenant+':'+u.accountId},0))`;}
 const pair=(u,r)=>({accountId:u.accountId,assetId:r.assetId,targetPlanId:r.targetPlanId});
 const purpose=(u,op='U01',p)=>{try{return access?access.purpose(u,op,p):readAssetApplicabilityScope(scope,ids,u,op,p);}catch{fail('APPLICABILITY_SCOPE_RESTRICTED','当前账号无权使用此资产核对。',403);}};
 async function authorized(tx,u,op='U01',p){
  if(access){try{return await access.authorized(tx,u,op,p);}catch(e){if(e instanceof assert.AssertionError&&e.message==='APPLICABILITY_ACCESS_RESTRICTED')fail('APPLICABILITY_SCOPE_RESTRICTED','当前账号无权使用此资产核对。',403);throw e;}}
  const s=purpose(u,op,p),a=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,action:'local_asset_applicability_authorized',target:ids.project,meta:{path:['registrationHash'],equals:edcDigest({pairs:s.pairs,fixtures:s.fixtures})}},orderBy:{createdAt:'desc'}});
  if(!a||a.meta.approvedAt!==s.approvedAt||a.meta.expiresAt!==s.expiresAt||a.meta.marker!==APPLICABILITY_MARKER||a.meta.prefix!==APPLICABILITY_PREFIX||edcDigest(a.meta.accounts)!==edcDigest(s.accounts)||!s.operations.every(o=>a.meta.operations?.includes(o)))fail('APPLICABILITY_SCOPE_RESTRICTED','本轮核对授权未登记或不匹配',403);return s;
 }
 async function loadApplicabilityBasis(tx,u,refs){
  try{exactEdcFields(refs,['assetId','assetVersionNo','targetPlanId','targetVersionNo']);}catch{invalid();}
  if(!applicabilityId(refs.assetId)||!applicabilityId(refs.targetPlanId)||![refs.assetVersionNo,refs.targetVersionNo].every(v=>Number.isSafeInteger(v)&&v>0&&v<=30))invalid();
  await authorized(tx,u,'U01',pair(u,refs));
  const source=await assets.inAsset(tx,u,refs.assetId,refs.assetVersionNo),a=source.asset;
  const rows=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${refs.targetPlanId} AND "tenantId"=${u.tenantId} AND "studyGroupId"=${u.studyGroupId} AND "researchProjectId"=${u.researchProjectId} AND "ownerAccountId"=${u.accountId} FOR SHARE`;
  if(rows.length!==1)fail('APPLICABILITY_FORBIDDEN','本人目标方案不可访问',403);
  return plans.inDraft(tx,u,refs.targetPlanId,'artifact.read',async(_tx,p,state)=>{
   if(state==='restricted'||a.sourceStatus==='restricted')fail('APPLICABILITY_FORBIDDEN','来源或目标授权已失效',403);
   if(p.block.stage!=='protocol_draft'||!p.block.confirmation?.hash)fail('APPLICABILITY_TARGET_INVALID','目标方案尚未完成原PICO确认及方案草稿');
   let preparation;try{preparation=readPreparationBlock(p.block);}catch{fail('APPLICABILITY_CONTEXT_INVALID','目标准备配置完整性无法核对');}
   const actual=preparationBasis(p),preparationStatus=preparationCurrent(preparation,p.a.currentVersionNo)&&['artifactId','contentHash','picoConfirmationHash','sourcesHash'].every(k=>preparation.basis[k]===actual[k])?'current':'not_current';
   const target={id:p.a.id,version:p.v.versionNo,currentVersion:p.a.currentVersionNo,sourceStatus:state,stage:p.block.stage,pico:p.block.pico,confirmation:p.block.confirmation,derivedFrom:p.block.derivedFrom,preparationStatus,config:preparation?.config};
   const assetVersion=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:a.id,versionNo:a.version}}});
   const nativeTarget=(await tx.researchArtifactVersion.findUnique({where:{id:p.v.id},include:{sources:true}})).sources.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,...(s.sourceVersion!=null?{sourceVersion:s.sourceVersion}:{}),snapshot:s.snapshot}));
   const fixed=[{sourceType:'data_snapshot',sourceId:assetVersion.id,sourceVersion:String(a.version),snapshot:{kind:'applicability_source_asset',artifactId:a.id,contentHash:a.contentHash,snapshotHash:a.snapshotHash}},{sourceType:'data_snapshot',sourceId:p.v.id,sourceVersion:String(p.v.versionNo),snapshot:{kind:'applicability_target_plan',artifactId:p.a.id,contentHash:p.v.contentHash,confirmationHash:p.block.confirmation.hash}}],nativeSources=[];
   for(const s of [...source.nativeSources,...nativeTarget,...fixed]){const same=nativeSources.find(v=>v.sourceType===s.sourceType&&v.sourceId===s.sourceId);if(same&&edcDigest(same)!==edcDigest(s))fail('APPLICABILITY_CONTEXT_INVALID','双端同一来源的固定版本矛盾');if(!same)nativeSources.push(s);}
   const binding={tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,ownerAccountId:u.accountId,sourceAsset:{id:a.id,versionNo:a.version,versionId:assetVersion.id,contentHash:a.contentHash,snapshotHash:a.snapshotHash,ancestors:a.lineage.map(v=>({id:v.id,versionNo:v.version,contentHash:v.contentHash}))},sourceRoot:{...a.rootReference,nativeSourcesHash:edcDigest(source.nativeSources)},targetPlan:{id:p.a.id,versionNo:p.v.versionNo,versionId:p.v.id,contentHash:p.v.contentHash,confirmationHash:p.block.confirmation.hash,configHash:preparationStatus==='current'?edcDigest(preparation.config):null,preparationBasisHash:preparation?edcDigest(preparation.basis):null},assetSourcesHash:edcDigest(a.snapshot.knowledgeSources??a.snapshot.historicalFacts?.sources??[]),targetSourcesHash:edcDigest(p.block.sources),rulesVersion:'rh-asset-applicability-rules.v1'};
   const sourceStatus=a.sourceStatus==='current'&&a.version===a.currentVersion&&state==='current'&&p.v.versionNo===refs.targetVersionNo?'current':'stale';
   await authorized(tx,u,'U01',pair(u,refs));
   return{binding,input:sourceStatus==='current'?applicabilityInput({asset:a,target}):null,sourceStatus,assetView:a,targetView:target,nativeSources,sources:structuredClone(p.block.sources),kbId:p.block.kbId,targetSessionId:p.block.sessionId};
  });
 }
 async function createPurposeSession(tx,u,recordId,{kbId,agentId}){
  await authorized(tx,u,'U03');if(!applicabilityId(recordId)||!applicabilityId(kbId)||!applicabilityId(agentId))invalid();
  const contextKey='rh-asset-applicability:'+recordId;
  if(await tx.session.findFirst({where:{tenantId:u.tenantId,accountId:u.accountId,contextKey}}))fail('APPLICABILITY_CONTEXT_INVALID','新核对会话已存在，不恢复或覆盖');
  const ss=sessionService(tx);await ss.assertAgentAccess(u,agentId);
  const session=await ss.ensureKnowledgeSession(u,agentId,contextKey,'本人资产适用性核对（合成草稿）');
  await authorized(tx,u,'U03');return session;
 }
 async function ownPurposeInTx(tx,u,sessionId,{allowStale=false}={}){
  await authorized(tx,u,'U03');const ss=sessionService(tx),s=await ss.assertKnowledgeSession(u,sessionId);await ss.assertAgentAccess(u,s.agentId);
  if(!s.contextKey?.startsWith('rh-asset-applicability:'))fail('APPLICABILITY_FORBIDDEN','会话目的不匹配',403);
  const recordId=s.contextKey.slice('rh-asset-applicability:'.length),record=await stored(tx,u,recordId),{b}=record;
  if(b.executionSessionId!==s.id||b.basis.executionSessionId!==s.id)fail('APPLICABILITY_FORBIDDEN','会话未绑定本人当前核对记录',403);
  const basis=await loadApplicabilityBasis(tx,u,b.refs);if(b.kbId!==basis.kbId)fail('APPLICABILITY_FORBIDDEN','会话KB绑定失效',403);
  const sourceStatus=basis.sourceStatus==='current'&&edcDigest(basis.binding)===edcDigest(b.basis.binding)?'current':'stale';if(!allowStale&&sourceStatus!=='current')fail('APPLICABILITY_SOURCE_CHANGED','核对依据已变化');
  await authorized(tx,u,'U03',pair(u,b.refs));return{session:s,kbId:b.kbId,recordId,record,basis,sourceStatus};
 }
 async function assertGenericSend(tx,u,sessionId){const s=await sessionService(tx).assertKnowledgeSession(u,sessionId);if(s.contextKey?.startsWith('rh-asset-applicability:'))fail('APPLICABILITY_GENERIC_SEND_FORBIDDEN','核对专用会话不接受通用聊天或其他任务',403);return s;}
 async function stored(tx,u,id,no,operation=no===undefined?'U01':'U02'){
  identity(id);if(no!==undefined)version(no);const s=await authorized(tx,u,operation),a=await tx.researchArtifact.findFirst({where:{...where(u),id}});
  if(!a||(!access&&a.createdAt.getTime()<Date.parse(s.approvedAt)))fail('APPLICABILITY_FORBIDDEN','本人核对记录不可访问',403);
  const v=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:a.id,versionNo:no??a.currentVersionNo}},include:{sources:true}});if(!v)fail('APPLICABILITY_VERSION_MISSING','该固定版本不存在',404);
  const b=v.contentBlocks?.[0],unsigned={...b};delete unsigned.seal;
  if(v.contentBlocks.length!==1||b?.type!==APPLICABILITY_MARKER||b.ownerAccountId!==u.accountId||b.seal!==edcDigest(unsigned)||b.basisHash!==edcDigest(b.basis)||b.rulesHash!==edcDigest(b.rules)||edcDigest(compareApplicability(b.basis))!==b.rulesHash||hashText(v.contentMd)!==v.contentHash||render(b)!==v.contentMd)fail('APPLICABILITY_CONTEXT_INVALID','核对版本、规则或正文完整性无法核对');
  const native=canonical(b.nativeSources),shape=r=>r.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,...(s.sourceVersion!=null?{sourceVersion:s.sourceVersion}:{}),snapshot:s.snapshot})).sort((a,b)=>(a.sourceType+a.sourceId).localeCompare(b.sourceType+b.sourceId));
  if(edcDigest(shape(v.sources))!==edcDigest(shape(native))||v.sourceSnapshotHash!==hashText(JSON.stringify(native))||v.sources.some(r=>r.hash!==hashText(JSON.stringify(native.find(s=>s.sourceType===r.sourceType&&s.sourceId===r.sourceId)?.snapshot))))fail('APPLICABILITY_CONTEXT_INVALID','原生来源指纹无法核对');
  await authorized(tx,u,operation,pair(u,b.refs));return{a,v,b};
 }
 async function view(tx,u,r,no){
  const {a,v,b}=r,ctx=await loadApplicabilityBasis(tx,u,b.refs),sourceStatus=ctx.sourceStatus==='current'&&edcDigest(ctx.binding)===edcDigest(b.basis.binding)&&edcDigest(ctx.input)===edcDigest(b.basis.input)?'current':'stale';
  const session=await sessionService(tx).assertKnowledgeSession(u,b.executionSessionId);await sessionService(tx).assertAgentAccess(u,session.agentId);
  if(session.contextKey!=='rh-asset-applicability:'+a.id||b.kbId!==ctx.kbId||b.basis.executionSessionId!==b.executionSessionId||b.basis.kbId!==b.kbId)fail('APPLICABILITY_CONTEXT_INVALID','独立核对会话绑定无法核对');
  const s=await authorized(tx,u,'U01',pair(u,b.refs)),canOpinions=s.operations.includes('U02')&&sourceStatus==='current'&&v.versionNo===a.currentVersionNo&&v.versionNo<30;
  const opinionAccess=s.operations.includes('U02'),aiAccess=s.operations.includes('U03'),j=aiAccess&&b.pending?await tx.knowledgeChatJob.findUnique({where:{id:b.pending.jobId}}):null;
  const live=aiAccess?await resultInTx(tx,u,r,j,ctx):{ai:{status:'unavailable',message:'本轮AI目的授权不可用'},job:null},pending=['queued','processing'].includes(live.job?.status);
  const tokenQuota=await quota.status(u);
  return{id:a.id,title:a.title,version:v.versionNo,currentVersion:a.currentVersionNo,sourceStatus,readOnly:no!==undefined||sourceStatus!=='current',canOpinions:no===undefined&&canOpinions&&!pending,canReadHistory:opinionAccess,canAi:no===undefined&&sourceStatus==='current'&&v.versionNo<30&&!pending&&aiAccess&&tokenQuota.canStart,quota:tokenQuota,ai:live.ai,job:live.job,basis:b.basis,basisHash:b.basisHash,rules:b.rules,rulesHash:b.rulesHash,opinions:opinionAccess?b.opinions:{},opinionHead:opinionAccess?b.opinionHead:null,opinionHistory:opinionAccess?b.opinionHistory:[],opinionsUnavailable:!opinionAccess,contentMd:opinionAccess?v.contentMd:render({...b,opinions:{}}),executionSessionId:b.executionSessionId,kbId:b.kbId,versions:opinionAccess?await tx.researchArtifactVersion.findMany({where:{artifactId:a.id},select:{versionNo:true,createdAt:true,changeSummary:true},orderBy:{versionNo:'desc'},take:30}):[]};
 }
 async function receipt(tx,u,key,hash,operation){
  const w={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_asset_applicability_request',target:u.accountId+':'+hashText(key)},prior=await tx.auditLog.findFirst({where:w});
  if(prior&&prior.meta?.requestHash!==hash)fail('APPLICABILITY_KEY_CONFLICT','请求标识已用于其他输入或操作');
  if(operation&&!prior)await tx.auditLog.create({data:{...w,meta:{requestHash:hash,operation}}});return prior?.meta?.operation;
 }
 async function read(u,id,no){const v=await plans.withScope(u,'artifact.read',async tx=>view(tx,u,await stored(tx,u,id,no),no));purpose(u,no===undefined?'U01':'U02');return v;}
 async function create(u,b){
  input(b,['assetId','assetVersionNo','targetPlanId','targetVersionNo','requestKey']);identity(b.assetId);identity(b.targetPlanId);version(b.assetVersionNo);version(b.targetVersionNo);
  const refs=Object.fromEntries(['assetId','assetVersionNo','targetPlanId','targetVersionNo'].map(k=>[k,b[k]])),hash=edcDigest({action:'create',body:b});
  const operation=await plans.withScope(u,'artifact.create',async tx=>{
   await authorized(tx,u,'U01',pair(u,refs));await actorLock(tx,u);const prior=await receipt(tx,u,b.requestKey,hash);if(prior){await view(tx,u,await stored(tx,u,prior.recordId));return prior;}
   const ctx=await loadApplicabilityBasis(tx,u,refs);if(ctx.sourceStatus!=='current')fail('APPLICABILITY_SOURCE_CHANGED','资产或目标不再是当前有效版本');
   if(await tx.researchArtifact.count({where:capacityWhere(u)})>=30)fail('APPLICABILITY_CAPACITY','本人本轮核对记录达到30份上限',429);
   let rules;try{rules=compareApplicability(ctx.input);}catch(e){if(e instanceof assert.AssertionError)fail('APPLICABILITY_RULE_CAPACITY','声明比较超过每组32子项，不截断',422);throw e;}
   const recordId=randomUUID(),oldSession=await tx.session.findUnique({where:{id:ctx.targetSessionId}});if(!oldSession)fail('APPLICABILITY_CONTEXT_INVALID','目标原会话不可用');
   const session=await createPurposeSession(tx,u,recordId,{kbId:ctx.kbId,agentId:oldSession.agentId}),basis={binding:ctx.binding,input:ctx.input,executionSessionId:session.id,kbId:ctx.kbId};
   const block=canonical({type:APPLICABILITY_MARKER,ownerAccountId:u.accountId,refs,basis,basisHash:edcDigest(basis),rules,rulesHash:edcDigest(rules),nativeSources:ctx.nativeSources,executionSessionId:session.id,kbId:ctx.kbId,opinions:{},opinionHead:null,opinionHistory:[],pending:null,operations:[]});
   let allocated=false;
   const createDb=new Proxy(tx,{get(t,k){if(k!=='researchArtifact')return t[k];return new Proxy(t.researchArtifact,{get(model,m){if(m!=='create')return model[m];return async args=>{if(allocated||args.data.id!==undefined||args.data.typeKey!=='research_report'||args.data.idempotencyKey!==APPLICABILITY_PREFIX+u.accountId+':'+b.requestKey||await tx.researchArtifact.findUnique({where:{id:recordId}}))fail('APPLICABILITY_CONTEXT_INVALID','仅允许本次新记录预分配ID');allocated=true;return model.create({...args,data:{...args.data,id:recordId}});};}});}});
   const id=await new Artifacts(bound(createDb),storage,null,null).createWithSourcesInTx(u,{title:'本人资产适用性核对草稿',typeKey:'research_report',idempotencyKey:APPLICABILITY_PREFIX+u.accountId+':'+b.requestKey,creationRequestHash:hash,contentMd:render(block),contentBlocks:[sealed(block)]},block.nativeSources,u.accountId,createDb);if(!allocated||id!==recordId)fail('APPLICABILITY_CONTEXT_INVALID','新记录未沿原服务一次创建');
   await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_asset_applicability_create',target:id,meta:{basisHash:block.basisHash,rulesHash:block.rulesHash}}});
   const op={id:b.requestKey,recordId:id,versionNo:1};await receipt(tx,u,b.requestKey,hash,op);await view(tx,u,await stored(tx,u,id));await authorized(tx,u,'U01',pair(u,refs));return op;
  });return{record:await read(u,operation.recordId),operation};
 }
 async function list(u,q={}){
  if(!q||Object.keys(q).some(k=>!['limit','before'].includes(k))||q.limit!==undefined&&!/^(?:[1-9]|1[0-9]|20)$/.test(String(q.limit))||q.before!==undefined&&!applicabilityId(q.before))invalid();
  const result=await plans.withScope(u,'artifact.read',async tx=>{const s=await authorized(tx,u),limit=Number(q.limit??20);if(q.before)await stored(tx,u,q.before);const rows=await tx.researchArtifact.findMany({where:{...where(u),...(!access?{createdAt:{gte:new Date(s.approvedAt)}}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(q.before?{cursor:{id:q.before},skip:1}:{})}),items=[];for(const a of rows.slice(0,limit)){const r=await view(tx,u,await stored(tx,u,a.id));items.push({id:r.id,title:r.title,version:r.version,sourceStatus:r.sourceStatus,assetId:r.basis.binding.sourceAsset.id,targetPlanId:r.basis.binding.targetPlan.id});}return{items,nextCursor:rows.length>limit?rows[limit-1].id:null};});purpose(u);return result;
 }
 async function saveOpinions(u,id,b){
  identity(id);input(b,['baseVersionNo','resultMessageId','basisChangeConfirmed','decisions','requestKey']);version(b.baseVersionNo);const hash=edcDigest({action:'opinions',recordId:id,body:b});
  const operation=await plans.withScope(u,'artifact.edit',async tx=>{
   await authorized(tx,u,'U02');await actorLock(tx,u);const prior=await receipt(tx,u,b.requestKey,hash);if(prior){await view(tx,u,await stored(tx,u,prior.recordId));return prior;}
   let r=await stored(tx,u,id);await loadApplicabilityBasis(tx,u,r.b.refs);
   const rows=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${id} AND "tenantId"=${u.tenantId} AND "ownerAccountId"=${u.accountId} FOR UPDATE`;if(rows.length!==1)fail('APPLICABILITY_FORBIDDEN','本人核对记录不可访问',403);
   r=await stored(tx,u,id);const current=await view(tx,u,r);if(current.sourceStatus!=='current')fail('APPLICABILITY_SOURCE_CHANGED','资产或目标依据已变化，不能写入意见');
   let pending=false;if(r.b.pending){const job=await tx.knowledgeChatJob.findUnique({where:{id:r.b.pending.jobId}});if(!job||job.sessionId!==r.b.executionSessionId||job.accountId!==u.accountId)fail('APPLICABILITY_CONTEXT_INVALID','核对任务与真实父对象不匹配');pending=['queued','processing'].includes(job.status);}
   let result=null;if(b.resultMessageId!==null){await authorized(tx,u,'U03');const j=await tx.knowledgeChatJob.findFirst({where:{tenantId:u.tenantId,accountId:u.accountId,sessionId:r.b.executionSessionId,assistantMessageId:b.resultMessageId}}),ai=(await resultInTx(tx,u,r,j)).ai;if(ai.status==='current'&&ai.result?.resultMessageId===b.resultMessageId)result={current:true,resultMessageId:b.resultMessageId,executionRecordVersion:ai.result.binding.executionRecordVersion};}
   let next;try{next=applyApplicabilityOpinions({record:r.b,body:b,versionNo:r.a.currentVersionNo,accountId:u.accountId,at:new Date().toISOString(),pending,result});}catch(e){if(e instanceof assert.AssertionError){const code=/APPLICABILITY_[A-Z_]+/.exec(e.message)?.[0]??'APPLICABILITY_INPUT_INVALID';fail(code,'意见、依据或版本无法核对；当前输入请保留',code==='APPLICABILITY_INPUT_INVALID'?400:code==='APPLICABILITY_NO_CHANGE'?422:code==='APPLICABILITY_VERSION_CAPACITY'?429:409);}throw e;}
   delete next.seal;next.operations=[...next.operations,{kind:'opinions',requestKey:b.requestKey,requestHash:hash,versionNo:r.a.currentVersionNo+1}];
   await new Artifacts(bound(tx),storage,null,null).createVersion(u,id,{baseVersionNo:b.baseVersionNo,contentMd:render(next),contentBlocks:[sealed(next)],changeSummary:'记录本人复用意见；固定双端声明及规则不变'});
   await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_asset_applicability_opinions',target:id,meta:{versionNo:r.a.currentVersionNo+1,basisHash:next.basisHash,rulesHash:next.rulesHash,resultMessageId:b.resultMessageId}}});
   const op={id:b.requestKey,recordId:id,versionNo:r.a.currentVersionNo+1};await receipt(tx,u,b.requestKey,hash,op);await view(tx,u,await stored(tx,u,id));await authorized(tx,u,'U02',pair(u,r.b.refs));return op;
  });return{record:await read(u,operation.recordId),operation};
 }
 async function admit(tx,u){await authorized(tx,u,'U03');await quota.assert(u);}
 const executionBinding=(r,ctx)=>({recordId:r.a.id,executionRecordVersion:r.a.currentVersionNo+1,ownerAccountId:r.a.ownerAccountId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,executionSessionId:r.b.executionSessionId,kbId:r.b.kbId,basisHash:r.b.basisHash,rulesHash:r.b.rulesHash,selectedSourcesHash:edcDigest(ctx.sources)});
 async function idle(tx,u,r){if(!r.b.pending)return;const j=await tx.knowledgeChatJob.findUnique({where:{id:r.b.pending.jobId}}),t=applicabilityTask(j?.payload);if(!j||j.accountId!==u.accountId||j.sessionId!==r.b.executionSessionId||t?.binding.recordId!==r.a.id)fail('APPLICABILITY_CONTEXT_INVALID','核对任务与真实记录不匹配');if(['queued','processing'].includes(j.status))fail('APPLICABILITY_JOB_PENDING','当前核对仍在途，不重复创建');}
 async function run(u,id,b){
  identity(id);input(b,['baseVersionNo','basisHash','requestKey']);version(b.baseVersionNo);if(typeof b.basisHash!=='string'||!/^[a-f0-9]{64}$/.test(b.basisHash))invalid();
  const hash=edcDigest({action:'jobs',recordId:id,body:b}),prepared=await plans.withScope(u,'artifact.edit',async tx=>{
   await authorized(tx,u,'U03');await actorLock(tx,u);const prior=await receipt(tx,u,b.requestKey,hash);if(prior){await view(tx,u,await stored(tx,u,prior.recordId));return{existing:prior};}
   const r=await stored(tx,u,id),current=await view(tx,u,r);
   if(current.sourceStatus!=='current'||b.baseVersionNo!==current.version||b.basisHash!==current.basisHash)fail('APPLICABILITY_SOURCE_CHANGED','请先核对当前双端版本与依据');
   if(r.a.currentVersionNo>=30)fail('APPLICABILITY_VERSION_CAPACITY','本轮核对达到30版上限',429);await idle(tx,u,r);await admit(tx,u);const ctx=await loadApplicabilityBasis(tx,u,r.b.refs);await ownPurposeInTx(tx,u,r.b.executionSessionId);return{sessionId:r.b.executionSessionId,kbId:r.b.kbId,binding:executionBinding(r,ctx)};
  });
  let operation=prepared.existing;
  if(!operation){if(!queue)fail('APPLICABILITY_AI_NOT_READY','本片队列尚未装配',503);await enqueue.run({user:u,id,body:b,hash,...prepared},()=>queue.enqueue(u,prepared.sessionId,{text:requestText,requestKey:jobKey(u,b.requestKey),kbIds:[prepared.kbId]}));operation=await plans.withScope(u,'artifact.read',async tx=>{await authorized(tx,u,'U03');const op=await receipt(tx,u,b.requestKey,hash);if(!op?.jobId||op.recordId!==id)fail('APPLICABILITY_CONTEXT_INVALID','原子队列回执缺失');return op;});}
  return{record:await read(u,id),operation};
 }
 async function onJobCreate(tx,args,next){
  let supplied;try{supplied=applicabilityTask(args.data.payload);}catch{fail('APPLICABILITY_CONTEXT_INVALID','核对任务意图混合或绑定损坏');}
  const active=enqueue.getStore();if(!active){if(supplied)fail('APPLICABILITY_CONTEXT_INVALID','新核对任务缺少服务端提交上下文');return next(args);}
  const u=active.user;await load('common/worker-publication','lockAuthorizationMutation')(tx,ids.tenant,{includeOfficial:true});await authorized(tx,u,'U03');await actorLock(tx,u);
  let r=await stored(tx,u,active.id),ctx=await loadApplicabilityBasis(tx,u,r.b.refs);
  await tx.$executeRaw`SELECT 1 FROM research_artifact WHERE id=${r.a.id} AND "tenantId"=${u.tenantId} AND "ownerAccountId"=${u.accountId} FOR UPDATE`;
  r=await stored(tx,u,active.id);const current=await view(tx,u,r);if(current.sourceStatus!=='current'||r.a.currentVersionNo!==active.body.baseVersionNo||r.b.basisHash!==active.body.basisHash||edcDigest(executionBinding(r,ctx))!==edcDigest(active.binding))fail('APPLICABILITY_SOURCE_CHANGED','入队前核对依据或版本已变化');
  await idle(tx,u,r);await admit(tx,u);await ownPurposeInTx(tx,u,r.b.executionSessionId);
  const d=args.data,m=await tx.message.findUnique({where:{id:d.userMessageId}});
  if(d.tenantId!==u.tenantId||d.studyGroupId!==u.studyGroupId||d.researchProjectId!==u.researchProjectId||d.accountId!==u.accountId||d.sessionId!==r.b.executionSessionId||d.requestKey!==jobKey(u,active.body.requestKey)||d.text!==requestText||m?.sessionId!==d.sessionId||m.role!=='user'||m.content!==requestText||edcDigest(d.payload.kbIds)!==edcDigest([r.b.kbId])||d.payload.attachments?.length)fail('APPLICABILITY_CONTEXT_INVALID','新核对队列、用户消息或KB归属不符');
  const payload={...d.payload,researchAssetApplicability:{kind:'applicability',binding:active.binding,requestHash:active.hash,requestKey:active.body.requestKey}};applicabilityTask(payload);
  const j=await next({...args,data:{...d,payload}}),block={...r.b,pending:{jobId:j.id,bindingHash:edcDigest(active.binding),requestHash:active.hash,requestKey:active.body.requestKey},operations:[...r.b.operations,{kind:'jobs',requestKey:active.body.requestKey,requestHash:active.hash,versionNo:r.a.currentVersionNo+1}]};delete block.seal;
  if(block.opinionHead)block.opinionHead={...block.opinionHead,lastRecordVersion:r.a.currentVersionNo+1};
  await new Artifacts(bound(tx),storage,null,null).createVersion(u,r.a.id,{baseVersionNo:r.a.currentVersionNo,contentMd:render(block),contentBlocks:[sealed(block)],changeSummary:'请求本人资产定性核对；不改固定依据或意见依据'});
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_asset_applicability_ai_request',target:r.a.id,meta:{jobId:j.id,basisHash:block.basisHash,rulesHash:block.rulesHash}}});await receipt(tx,u,active.body.requestKey,active.hash,{id:active.body.requestKey,recordId:r.a.id,versionNo:r.a.currentVersionNo+1,jobId:j.id});await authorized(tx,u,'U03',pair(u,r.b.refs));return j;
 }
 async function execution(tx,u,j,t){
  await authorized(tx,u,'U03');const owned=await ownPurposeInTx(tx,u,j.sessionId),r=owned.record,ctx=owned.basis;
  if(t.binding.recordId!==r.a.id||j.tenantId!==u.tenantId||j.studyGroupId!==u.studyGroupId||j.researchProjectId!==u.researchProjectId||j.accountId!==u.accountId||j.requestKey!==jobKey(u,t.requestKey)||j.text!==requestText||r.b.pending?.jobId!==j.id||r.b.pending.bindingHash!==edcDigest(t.binding)||r.b.pending.requestHash!==t.requestHash||edcDigest(j.payload.kbIds)!==edcDigest([r.b.kbId]))fail('APPLICABILITY_CONTEXT_INVALID','真实核对任务、上下文或选择不匹配');
  const current={...executionBinding(r,ctx),executionRecordVersion:r.a.currentVersionNo,recordVersion:r.a.currentVersionNo,sourceStatus:ctx.sourceStatus,status:j.status,jobId:j.id,pendingJobId:r.b.pending.jobId};try{assertApplicabilityExecution(t.binding,current);}catch{fail('APPLICABILITY_EXECUTION_CHANGED','在途核对依据已变化，不交付旧结果');}return{r,ctx};
 }
 async function prepare(u,jobId){const j=await prisma.forTenant(u.tenantId,u.studyGroupId,u.researchProjectId).knowledgeChatJob.findUnique({where:{id:jobId}}),t=applicabilityTask(j?.payload);if(!t)return null;return plans.withScope(u,'artifact.edit',async tx=>{const actual=await tx.knowledgeChatJob.findUnique({where:{id:jobId}});if(!actual)fail('APPLICABILITY_CONTEXT_INVALID','核对任务不存在');const {r,ctx}=await execution(tx,u,actual,t);return{...t,basis:r.b.basis.input,rules:r.b.rules,sources:ctx.sources,modelView:buildApplicabilityModel(r.b.basis,r.b.rules,ctx.sources)};});}
 async function validateTurn(tx,turn){if(!turn.applicability)return;const j=await tx.knowledgeChatJob.findUnique({where:{id:turn.jobId}}),t=applicabilityTask(j?.payload);if(!j||!t||edcDigest(t.binding)!==edcDigest(turn.applicability.binding))fail('APPLICABILITY_EXECUTION_CHANGED','最终核对执行绑定已变化');const {ctx}=await execution(tx,turn.user,j,t);assertDesignSources(ctx.sources,turn.sources);}
 function accept(result,turn){if(!turn.applicability)return;if(!turn.toolExecuted||result.providerOutcome!=='known'||result.usedMock!==false||!result.usage||result.provenance?.deterministicSynthesisFallback||result.provenance?.numericBoundaryBlocked||result.provenance?.dataBoundaryBlocked)fail('APPLICABILITY_AI_NOT_DELIVERABLE','真实工具/模型执行没有可核对结果',422);assertDesignSources(turn.applicability.sources,turn.sources);let parsed;try{parsed=parseApplicabilityModelResult(result.finalText,turn.applicability);}catch{fail('APPLICABILITY_AI_OUTPUT_INVALID','定性解释未通过JSON、同组引用或科学边界；不自动重试',422);}result.provenance={...result.provenance,researchAssetApplicabilityResult:{binding:turn.applicability.binding,items:parsed.items}};result.finalText='## 本人资产定性核对（待人工确认）\n\n'+parsed.items.map(i=>i.explanation+'\n\n'+i.question).join('\n\n');}
 async function resultInTx(tx,u,r,j,context){
  await authorized(tx,u,'U03',pair(u,r.b.refs));
  if(!j)return{job:null,ai:{status:'not_requested',message:'尚未请求AI；可先记录免费声明核对意见'}};
  const t=applicabilityTask(j.payload),b=t?.binding;
  if(!t||b.recordId!==r.a.id||j.tenantId!==u.tenantId||j.studyGroupId!==u.studyGroupId||j.researchProjectId!==u.researchProjectId||j.accountId!==u.accountId||j.sessionId!==r.b.executionSessionId||b.executionSessionId!==j.sessionId||b.ownerAccountId!==u.accountId||b.tenantId!==u.tenantId||b.studyGroupId!==u.studyGroupId||b.researchProjectId!==u.researchProjectId||j.requestKey!==jobKey(u,t.requestKey)||j.text!==requestText||edcDigest(j.payload.kbIds)!==edcDigest([r.b.kbId]))fail('APPLICABILITY_CONTEXT_INVALID','AI结果与本人真实核对父对象不符');
  const frozen=await stored(tx,u,r.a.id,b.executionRecordVersion,'U01');
  if(frozen.b.pending?.jobId!==j.id||frozen.b.pending.bindingHash!==edcDigest(b)||frozen.b.pending.requestHash!==t.requestHash||frozen.b.basisHash!==b.basisHash||frozen.b.rulesHash!==b.rulesHash||frozen.b.kbId!==b.kbId)fail('APPLICABILITY_CONTEXT_INVALID','任务执行版与固定依据不符');
  const ctx=context??await loadApplicabilityBasis(tx,u,r.b.refs),job={id:j.id,status:j.status,errorCode:j.errorCode,errorMessage:j.status==='failed'?'AI核对失败或上下文失效；费用按实际请求保留，不自动重试。':null};
  if(j.status!=='completed')return{job,ai:{status:['queued','processing'].includes(j.status)?'pending':'failed',message:['queued','processing'].includes(j.status)?'正在核对；人工意见暂不可保存':'未交付可用AI结果，不自动重试'}};
  const m=await tx.message.findFirst({where:{id:j.assistantMessageId,sessionId:j.sessionId,role:'assistant',tenantId:u.tenantId}}),p=m?.meta?.provenance,result=p?.researchAssetApplicabilityResult;
  if(!result||Object.keys(result).sort().join(',')!=='binding,items'||edcDigest(result.binding)!==edcDigest(b))fail('APPLICABILITY_CONTEXT_INVALID','不可变AI结果完整性无法核对');
  const target=await tx.researchArtifactVersion.findUnique({where:{id:frozen.b.basis.binding.targetPlan.versionId}}),targetSources=target?.contentBlocks?.[0]?.sources;
  if(!target||target.artifactId!==frozen.b.refs.targetPlanId||target.contentHash!==frozen.b.basis.binding.targetPlan.contentHash||hashText(target.contentMd)!==target.contentHash||edcDigest(targetSources)!==b.selectedSourcesHash)fail('APPLICABILITY_CONTEXT_INVALID','固定目标来源无法核对');
  assertDesignSources(targetSources,p.knowledgeSources);
  const modelView=buildApplicabilityModel(frozen.b.basis,frozen.b.rules,p.knowledgeSources),parsed=parseApplicabilityResult(JSON.stringify({items:result.items}),{basis:frozen.b.basis,rules:frozen.b.rules,modelView});
  const text='## 本人资产定性核对（待人工确认）\n\n'+parsed.items.map(i=>i.explanation+'\n\n'+i.question).join('\n\n');if(m.content!==text)fail('APPLICABILITY_CONTEXT_INVALID','不可变回答正文与结果不符');
  let stale=ctx.sourceStatus!=='current'||edcDigest(ctx.binding)!==edcDigest(r.b.basis.binding)||r.b.pending?.jobId!==j.id||r.v.versionNo!==r.a.currentVersionNo||r.b.basisHash!==b.basisHash||r.b.rulesHash!==b.rulesHash;
  for(const s of p.knowledgeSources){const state=sourceState(s,await tx.knowledgeDoc.findUnique({where:{id:s.docId}}),await tx.knowledgeChunk.findUnique({where:{id:s.chunkId}}));if(state==='restricted')fail('APPLICABILITY_FORBIDDEN','AI引用来源已失权或撤审',403);if(state==='stale')stale=true;}
  return{job,ai:{status:stale?'stale':'current',result:{...result,resultMessageId:m.id,sessionId:j.sessionId,sourceStatus:stale?'stale':'current',historical:stale,sources:p.knowledgeSources,assetRefs:modelView.assetRefs,targetRefs:modelView.targetRefs},message:'仅为定性核对草稿，最终复用建议由本人确认'},message:m,frozen};
 }
 async function ownPurpose(u,sessionId){return plans.withScope(u,'artifact.read',tx=>ownPurposeInTx(tx,u,sessionId,{allowStale:true}));}
 async function projectMessage(u,m){
  return plans.withScope(u,'artifact.read',async tx=>{
   const owned=await ownPurposeInTx(tx,u,m.sessionId,{allowStale:true}),j=await tx.knowledgeChatJob.findFirst({where:{tenantId:u.tenantId,accountId:u.accountId,sessionId:m.sessionId,assistantMessageId:m.id}});
   if(!j)fail('APPLICABILITY_CONTEXT_INVALID','专用会话中不存在可信核对结果');const value=await resultInTx(tx,u,owned.record,j);if(!value.message||value.message.id!==m.id)fail('APPLICABILITY_CONTEXT_INVALID','专用回答尚未可信完成');
   return{id:m.id,sessionId:m.sessionId,role:'assistant',createdAt:m.createdAt,content:value.message.content,meta:{sourceStatus:value.ai.status,historical:value.ai.status==='stale',provenance:{knowledgeSources:value.ai.result.sources,researchAssetApplicabilityResult:value.ai.result}}};
  });
 }
 async function readMessageSource(u,m,index){
  return plans.withScope(u,'artifact.read',async tx=>{
   const owned=await ownPurposeInTx(tx,u,m.sessionId,{allowStale:true}),j=await tx.knowledgeChatJob.findFirst({where:{tenantId:u.tenantId,accountId:u.accountId,sessionId:m.sessionId,assistantMessageId:m.id}});if(!j)fail('APPLICABILITY_CONTEXT_INVALID','专用结果不存在');const value=await resultInTx(tx,u,owned.record,j),result=value.ai.result,match=/^([AT])?([1-9]\d*)$/.exec(index);
   if(!result||!match)fail('APPLICABILITY_SOURCE_INVALID','来源编号无效',400);const kind=match[1]==='A'?'asset':match[1]==='T'?'target':'knowledge',n=Number(match[2]);if(!result.items.some(i=>i.sourceRefs.some(s=>s.kind===kind&&s.index===n)))fail('APPLICABILITY_SOURCE_INVALID','该来源未被本结果实际引用',400);
   const state={kind,index:n,status:value.ai.status,sourceStatus:value.ai.status,historical:value.ai.status==='stale'};if(kind==='knowledge')return{...result.sources[n-1],...state};
   const ref=(kind==='asset'?result.assetRefs:result.targetRefs)[n-1],item=value.frozen.b.rules.items.find(g=>g.ruleId===ref.ruleId).subitems.find(i=>i.path===ref.path);return{...state,ref,declaration:item[kind==='asset'?'source':'target'],fixedObject:kind==='asset'?value.frozen.b.basis.binding.sourceAsset:value.frozen.b.basis.binding.targetPlan};
  });
 }
 const empty=q=>{try{exactEdcFields(q,[]);}catch{invalid();}};
 class ApplicabilityController{create(r,b,q){empty(q);return create(r.user,b);}list(r,q){return list(r.user,q);}read(r,id,q){empty(q);return read(r.user,id);}history(r,id,no,q){empty(q);if(!/^(?:[1-9]|[12][0-9]|30)$/.test(no))invalid();return read(r.user,id,Number(no));}opinions(r,id,b,q){empty(q);return saveOpinions(r.user,id,b);}run(r,id,b,q){empty(q);return run(r.user,id,b);}}
 Controller('asset-applicability-drafts')(ApplicabilityController);RequireStudyGroup()(ApplicabilityController);RequireResearchProject()(ApplicabilityController);RequireStudyGroupMenu('artifacts')(ApplicabilityController);RequireStudyGroupPermission('artifact.read')(ApplicabilityController);
 for(const [name,verb,path,params]of [['create',Post,'',[Body(),Query()]],['list',Get,'',[Query()]],['read',Get,':id',[Param('id'),Query()]],['history',Get,':id/versions/:no',[Param('id'),Param('no'),Query()]],['opinions',Post,':id/opinions',[Param('id'),Body(),Query()]],['run',Post,':id/jobs',[Param('id'),Body(),Query()]]]){verb(path)(ApplicabilityController.prototype,name,Object.getOwnPropertyDescriptor(ApplicabilityController.prototype,name));Req()(ApplicabilityController.prototype,name,0);params.forEach((d,i)=>d(ApplicabilityController.prototype,name,i+1));}
 return{Controller:ApplicabilityController,create,list,read,saveOpinions,run,onJobCreate,prepare,validateTurn,beforeProvider:turn=>plans.withScope(turn.user,'artifact.edit',tx=>validateTurn(tx,turn)),accept,ownPurpose,projectMessage,readMessageSource,resultInTx,setQueue:q=>{queue=q;},loadApplicabilityBasis,createPurposeSession,ownPurposeInTx,assertGenericSend,authorized,purpose};
}
