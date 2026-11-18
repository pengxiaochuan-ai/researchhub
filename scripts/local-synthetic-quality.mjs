// Approved local synthetic snapshot adapter, not a Study-wide data/release API.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateSyntheticDataset,qualitySourceRows,reviseSyntheticDataset,assertSyntheticBinding,datasetHash,locateSyntheticFinding} from './synthetic-quality-contract.mjs';
import {hashText} from './knowledge-ai-contract.mjs';
import {createLocalSyntheticReports} from './local-synthetic-reports.mjs';

export async function createLocalSyntheticQuality({root,dir,ids,prisma,plans,storage,load,require}){
 const {Controller,Get,Post,Req,Body,Param,Query,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(root+'app/server/src/common/decorators.ts');
 const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 const {assembleQualityManifest}=require(root+'app/server/src/research-methods/research-method-quality-manifest.ts');
 const {executeDeterministicDataQuality}=require(root+'app/server/src/research-methods/data-quality-execution.ts');
 const {buildDataQualityGateEvaluation}=require(root+'app/server/src/research-methods/data-quality-release.service.ts');
 const {canonicalManifestHash}=require(root+'app/server/src/research-methods/data-quality-release-policy.ts');
 const {transitionResearchMethodStatus}=require(root+'app/server/src/research-methods/research-method-run-policy.ts');
 const Worker=load('research-methods/research-method-worker.client','ResearchMethodWorkerClient'),agentId=ids.tenant+'-kb-research',skillId=ids.tenant+'-synthetic-dq',prefix='rh-sim-20261022:',active=new Set(),interrupted=new Set();
 const traceDir=dir+'synthetic-traces/';mkdirSync(traceDir,{recursive:true,mode:0o700});
 const error=(code,message,status=409)=>new HttpException({code,message},status),invalid=()=>{throw error('SYNTHETIC_INPUT_INVALID','合成试运行字段、数值、日期或修改原因不符合要求',400);};
 const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))invalid();};
 const key=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(v))invalid();return v;};
 await prisma.elevated.$transaction(async tx=>{
  await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});
  if(await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_synthetic_quality_authorized',target:agentId}}))return;
  assert.match(ids.tenant,/^rh-kb-local-/);const members=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,roleId:ids.role},select:{accountId:true}});assert.deepEqual(members.map(m=>m.accountId).sort(),[ids.owner,ids.admin].sort());
  await tx.tenantFeatureEntitlement.create({data:{tenantId:ids.tenant,featureKey:'research_methods_worker',enabled:true,updatedBy:ids.admin,enabledAt:new Date(),config:{syntheticTrialOnly:true,accounts:[ids.owner,ids.admin]}}});
  await tx.skill.create({data:{id:skillId,tenantId:ids.tenant,key:'research-data-quality',name:'本机合成数据质量检查',kind:'quality_alert',status:'published',version:1,author:ids.admin,reviewedBy:ids.admin,intent:'用户批准的软件测试Skill；复用旧安全汇总算子，不是临床方法审核，不自动修复。',backend:{lib:'research-methods-worker',call:'research-data-quality',executorKey:'research-data-quality',runtime_state:'ready',operatorVersion:'t19-1'},ioContract:{input:'t19-1 compact PHI-free manifest',output:'research-methods-worker.v1'},rules:{llm_forbidden:true,auto_repair:'forbidden',review_policy:'not_exposed_in_local_slice'},onViolation:{action:'reject-and-record'}}});
  for(const accountId of [ids.owner,ids.admin])await tx.skillAssignment.create({data:{tenantId:ids.tenant,skillId,agentId,accountId,scopeKey:accountId,enabled:true}});
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:'local_synthetic_quality_authorized',target:agentId,meta:{accounts:[ids.owner,ids.admin],skillKey:'research-data-quality',feature:'research_methods_worker',ownDerivedSnapshotsOnly:true,noAdditionalRolePermissions:true,reviewLockReleaseExport:false}}});
 });
 async function authorized(tx,user){
  if(![ids.owner,ids.admin].includes(user.accountId))throw error('SYNTHETIC_FORBIDDEN','没有本轮合成试运行授权',403);
  const feature=await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ids.tenant,featureKey:'research_methods_worker',enabled:true}}),assignment=await tx.skillAssignment.findFirst({where:{tenantId:ids.tenant,skillId,agentId,accountId:user.accountId,scopeKey:user.accountId,enabled:true,skill:{tenantId:ids.tenant,key:'research-data-quality',version:1,status:'published'}}});
  if(!feature||!assignment)throw error('SYNTHETIC_FORBIDDEN','本轮质控计算或Skill当前授权已失效',403);
 }
 const guarded=(user,planId,permission,cb)=>plans.withDraft(user,planId,permission,async(tx,plan,state)=>{await authorized(tx,user);return cb(tx,plan,state);});
 const binding=(plan,state)=>({planId:plan.a.id,version:plan.a.currentVersionNo,contentHash:hashText(plan.v.contentMd),picoHash:plan.block.confirmation?.hash,sourceStatus:state});
 function current(plan,state,inputBinding){if(state!=='current'||plan.block.stage!=='protocol_draft'||!plan.block.confirmation)throw error('SYNTHETIC_PLAN_CHANGED','请先保存来源有效的方案草稿；旧试跑不能自动重绑');if(inputBinding)try{assertSyntheticBinding(inputBinding,binding(plan,state));}catch{throw error('SYNTHETIC_PLAN_CHANGED','方案、PICO或资料版本已变化，请核对后从新版本建立试跑');}}
 const where=(user,planId)=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,agentId,skillKey:'research-data-quality',idempotencyKey:{startsWith:prefix},inputSummary:{path:['localSyntheticTrial','plan','planId'],equals:planId}});
 function snapshot(run){const s=run.inputSummary?.localSyntheticTrial;if(!s||s.schema!=='local-synthetic-trial.v1'||datasetHash(s.dataset)!==s.datasetHash||datasetHash(run.inputSummary)!==run.inputHash)throw error('SYNTHETIC_SNAPSHOT_INVALID','合成输入完整性校验失败');return s;}
 async function ownRun(tx,user,planId,runId){const run=await tx.researchMethodRun.findFirst({where:{...where(user,planId),id:runId}});if(!run)throw error('SYNTHETIC_FORBIDDEN','无法访问该合成试跑',403);snapshot(run);return run;}
 const inflight=run=>['queued','validating','running'].includes(run.status);
 const wasInterrupted=run=>inflight(run)&&(run.environment?.hostPid!==process.pid||interrupted.has(run.id));
 async function history(tx,user,planId,trialId){return tx.researchMethodRun.findMany({where:{...where(user,planId),AND:[{inputSummary:{path:['localSyntheticTrial','trialId'],equals:trialId}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:30});}
 async function present(tx,user,plan,state,run){
  if(state==='restricted')return{id:run.id,status:'restricted',sourceStatus:state,message:'资料撤审或访问失效，原试跑数据和结果不再交付'};
  const s=snapshot(run),live=binding(plan,state),sourceStatus=state==='current'&&['planId','version','contentHash','picoHash'].every(k=>s.plan[k]===live[k])?'current':'stale',past=await history(tx,user,plan.a.id,s.trialId),outputs=run.artifactRefs?.outputs;
  return{id:run.id,trialId:s.trialId,revision:s.revision,plan:s.plan,sourceStatus,status:wasInterrupted(run)?'interrupted':run.status,reviewStatus:run.reviewStatus,dataset:s.dataset,datasetHash:s.datasetHash,changes:s.changes,reason:s.reason,latestRunId:past[0]?.id,versions:past.map(r=>({id:r.id,revision:snapshot(r).revision,status:wasInterrupted(r)?'interrupted':r.status,createdAt:r.createdAt})),numericEvidence:run.numericEvidence??[],findings:(outputs?.findings??[]).map(f=>({...f,cells:locateSyntheticFinding(s.dataset,f)})),summary:run.artifactRefs?.summary,evaluation:run.artifactRefs?.evaluation,manifestHash:run.dataSources?.manifestHash,operatorVersion:run.executorVersion,error:run.errorCode?{code:run.errorCode,message:run.errorMessage}:null,limitations:run.limits??[],createdAt:run.createdAt};
 }
 const read=(user,planId,runId)=>guarded(user,planId,'artifact.read',async(tx,plan,state)=>present(tx,user,plan,state,await ownRun(tx,user,planId,runId)));
 async function list(user,planId,query){if(Object.keys(query).some(k=>!['limit','before'].includes(k)))invalid();const limit=Number(query.limit??10);if(!Number.isInteger(limit)||limit<1||limit>20)invalid();return guarded(user,planId,'artifact.read',async(tx,plan,state)=>{if(query.before)await ownRun(tx,user,planId,query.before);const runs=await tx.researchMethodRun.findMany({where:where(user,planId),orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(query.before?{cursor:{id:query.before},skip:1}:{})});return{items:runs.slice(0,limit).map(r=>({id:r.id,revision:snapshot(r).revision,status:state==='restricted'?'restricted':wasInterrupted(r)?'interrupted':r.status,createdAt:r.createdAt})),nextCursor:runs.length>limit?runs[limit-1].id:null};});}
 async function persist(tx,user,plan,s,requestKey,requestHash){
  const inputSummary={localSyntheticTrial:{...s,datasetHash:datasetHash(s.dataset)}},inputHash=datasetHash(inputSummary);
  const run=await tx.researchMethodRun.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,sessionId:plan.block.sessionId,agentId,skillKey:'research-data-quality',skillVersion:1,executorName:'research-data-quality-manifest',executorVersion:'t19-1',idempotencyKey:prefix+user.accountId+':'+requestKey,requestHash,status:'queued',stage:'queued',reviewStatus:'pending_review',inputSummary,inputHash,randomSeed:String(s.dataset.seed),environment:{syntheticOnly:true,hostPid:process.pid},dataSources:{plan:s.plan,datasetHash:datasetHash(s.dataset)}}});
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,action:'local_synthetic_snapshot_create',target:run.id,meta:{plan:s.plan,trialId:s.trialId,revision:s.revision,parentRunId:s.parentRunId??null,inputHash,changes:s.changes??[],reason:s.reason}}});return run.id;
 }
 async function duplicate(tx,user,planId,requestKey,requestHash){const old=await tx.researchMethodRun.findUnique({where:{tenantId_idempotencyKey:{tenantId:ids.tenant,idempotencyKey:prefix+user.accountId+':'+requestKey}}});if(!old)return null;if(old.requestHash!==requestHash||snapshot(old).plan.planId!==planId)throw error('SYNTHETIC_KEY_CONFLICT','幂等标识已用于其他输入');return old.id;}
 async function create(user,planId,input){exact(input,['baseVersionNo','seed','requestKey']);key(input.requestKey);let dataset;try{dataset=generateSyntheticDataset(input.seed);}catch{invalid();}if(!Number.isSafeInteger(input.baseVersionNo))invalid();const requestHash=datasetHash(input);const runId=await guarded(user,planId,'artifact.edit',async(tx,plan,state)=>{current(plan,state);const old=await duplicate(tx,user,planId,input.requestKey,requestHash);if(old)return old;if(plan.a.currentVersionNo!==input.baseVersionNo)throw error('SYNTHETIC_VERSION_CONFLICT','方案已变更，请刷新核对后创建');return persist(tx,user,plan,{schema:'local-synthetic-trial.v1',trialId:randomUUID(),revision:1,plan:binding(plan,state),dataset,reason:'固定seed代码生成的软件夹具，不是临床数据',changes:[]},input.requestKey,requestHash);});schedule(user,planId,runId);return read(user,planId,runId);}
 async function revise(user,planId,runId,input){
  exact(input,['requestKey','reason','edits']);key(input.requestKey);const requestHash=datasetHash({runId,...input});
  const next=await guarded(user,planId,'artifact.edit',async(tx,plan,state)=>{
   const base=await ownRun(tx,user,planId,runId),s=snapshot(base);current(plan,state,s.plan);
   const old=await duplicate(tx,user,planId,input.requestKey,requestHash);if(old)return old;
   const past=await history(tx,user,planId,s.trialId);if(past[0]?.id!==runId)throw error('SYNTHETIC_VERSION_CONFLICT','已有更新的合成版本，当前输入保留，请先核对');
   if(inflight(base)&&!wasInterrupted(base))throw error('SYNTHETIC_RUN_PENDING','当前质控尚在运行，请等待后修订');
   if(s.revision>=30)throw error('SYNTHETIC_HISTORY_LIMIT','本机合成试跑最多30版，请从方案另建试跑');
   let revision;try{if(Array.isArray(input.edits)&&input.edits.length===0&&(base.status==='failed'||wasInterrupted(base))){assert.ok(typeof input.reason==='string'&&input.reason.trim().length>=8&&input.reason.length<=500);revision={dataset:s.dataset,changes:[],reason:input.reason.trim()};}else revision=reviseSyntheticDataset(s.dataset,input.edits,input.reason);}catch{invalid();}
   return persist(tx,user,plan,{...s,...revision,revision:s.revision+1,parentRunId:runId},input.requestKey,requestHash);
  });schedule(user,planId,next);return read(user,planId,next);
 }
 async function execute(user,planId,runId){
  const token=randomUUID(),claimed=await guarded(user,planId,'artifact.edit',async(tx,plan,state)=>{
   const run=await ownRun(tx,user,planId,runId);if(run.status!=='queued'||run.environment?.hostPid!==process.pid)return null;
   current(plan,state,snapshot(run).plan);
   let status=transitionResearchMethodStatus('queued','validating');await tx.researchMethodRun.update({where:{id:runId},data:{status,stage:status}});
   status=transitionResearchMethodStatus(status,'running');return tx.researchMethodRun.update({where:{id:runId},data:{status,stage:status,startedAt:new Date(),environment:{syntheticOnly:true,hostPid:process.pid,localExecution:token}}});
  });if(!claimed)return;
  try{
   const s=snapshot(claimed),manifest=assembleQualityManifest(qualitySourceRows(s.dataset)),manifestHash=canonicalManifestHash(manifest);
   const trace={runId,startedAt:new Date().toISOString(),endpoint:'http://127.0.0.1:19505/v1/execute',plan:s.plan,datasetHash:s.datasetHash,manifestHash};
   const worker=new Worker({url:trace.endpoint.replace('/v1/execute',''),token:JSON.parse(readFileSync(dir+'quality-worker.json')).token,fetchImpl:async(url,init)=>{
    const request=JSON.parse(init.body);assert.equal(String(url),trace.endpoint);assert.equal(request.executorKey,'research-data-quality');assert.equal(request.requestId,runId);trace.request=request;writeFileSync(traceDir+runId+'.json',JSON.stringify(trace,null,2),{mode:0o600});
    const response=await globalThis.fetch(url,init);trace.httpStatus=response.status;trace.response=await response.clone().json();trace.finishedAt=new Date().toISOString();writeFileSync(traceDir+runId+'.json',JSON.stringify(trace,null,2),{mode:0o600});return response;
   }});
   const {result}=await executeDeterministicDataQuality(worker,manifest,{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,sessionId:claimed.sessionId,agentId,skillKey:'research-data-quality',skillVersion:1,inputHash:claimed.inputHash},runId);
   const evaluation=buildDataQualityGateEvaluation(manifest,result.outputs,manifestHash);
   await guarded(user,planId,'artifact.edit',async(tx,plan,state)=>{
    const live=await ownRun(tx,user,planId,runId);current(plan,state,snapshot(live).plan);
    if(live.status!=='running'||live.environment?.localExecution!==token||live.inputHash!==claimed.inputHash)throw error('SYNTHETIC_EXECUTION_CHANGED','当前运行已失效，结果未提交');
    const status=transitionResearchMethodStatus(live.status,result.status),published=await tx.researchMethodRun.updateMany({where:{id:runId,status:'running',updatedAt:claimed.updatedAt,inputHash:claimed.inputHash},data:{status,stage:status,completedAt:new Date(),numericEvidence:result.numericEvidence,warnings:result.warnings,limits:result.limitations,nextSteps:[],artifactRefs:{summary:result.summary,outputs:result.outputs,evaluation},environment:{...result.provenance,syntheticOnly:true,hostPid:process.pid},dataSources:{plan:s.plan,datasetHash:s.datasetHash,manifestHash}}});if(published.count!==1)throw error('SYNTHETIC_EXECUTION_CHANGED','当前运行版本已变化，结果未提交');
    await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,action:'local_synthetic_quality_result',target:runId,meta:{inputHash:claimed.inputHash,manifestHash,status,operatorVersion:'t19-1',approved:false}}});
   });
  }catch(reason){
   const response=reason.getResponse?.(),code=response?.code??reason.code??'SYNTHETIC_EXECUTION_FAILED';
   try{await guarded(user,planId,'artifact.edit',async(tx)=>{const live=await ownRun(tx,user,planId,runId);if(live.status!=='running'||live.environment?.localExecution!==token||live.inputHash!==claimed.inputHash)return;const status=transitionResearchMethodStatus(live.status,'failed');await tx.researchMethodRun.updateMany({where:{id:runId,status:'running',updatedAt:claimed.updatedAt},data:{status,stage:status,errorCode:String(code),errorMessage:'本次确定性质控未交付，请核对来源、授权或计算服务；不自动重试。',completedAt:new Date()}});});}catch{interrupted.add(runId);}
  }
 }
 function schedule(user,planId,runId){if(active.has(runId))return;active.add(runId);setImmediate(()=>execute(user,planId,runId).catch(()=>{interrupted.add(runId);}).finally(()=>active.delete(runId)));}
 const reports=await createLocalSyntheticReports({root,ids,prisma,storage,load,require,withScope:plans.withScope,inRun:(tx,user,p,r,permission,cb)=>plans.inDraft(tx,user,p,permission,async(tx,plan,state)=>{await authorized(tx,user);const raw=await ownRun(tx,user,p,r);return cb(tx,plan,state,raw,await present(tx,user,plan,state,raw));}),withRun:(user,p,r,permission,cb)=>guarded(user,p,permission,async(tx,plan,state)=>{const raw=await ownRun(tx,user,p,r);return cb(tx,plan,state,raw,await present(tx,user,plan,state,raw));})});
 class LocalSyntheticQualityController{
  create(req,planId,input){return create(req.user,planId,input);}
  list(req,planId,query){return list(req.user,planId,query);}
  read(req,planId,runId){return read(req.user,planId,runId);}
  revise(req,planId,runId,input){return revise(req.user,planId,runId,input);}
  report(req,p,r){return reports.read(req.user,p,r);}
  reportVersion(req,p,r,no){if(!/^[1-9][0-9]?$/.test(no))invalid();return reports.read(req.user,p,r,Number(no));}
  createReport(req,p,r,input){return reports.create(req.user,p,r,input);}
  saveReport(req,p,r,input){return reports.save(req.user,p,r,input);}
  createAsset(req,p,r,input){return reports.assets.create(req.user,p,r,input);}
 }
 for(const[method,verb,path,last]of[['report',Get,':runId/report-draft',null],['reportVersion',Get,':runId/report-draft/versions/:versionNo','versionNo'],['createReport',Post,':runId/report-draft',true],['saveReport',Post,':runId/report-draft/versions',true]]){verb(path)(LocalSyntheticQualityController.prototype,method,Object.getOwnPropertyDescriptor(LocalSyntheticQualityController.prototype,method));Req()(LocalSyntheticQualityController.prototype,method,0);Param('planId')(LocalSyntheticQualityController.prototype,method,1);Param('runId')(LocalSyntheticQualityController.prototype,method,2);if(last)(last===true?Body():Param(last))(LocalSyntheticQualityController.prototype,method,3);}
 Post(':runId/report-draft/asset-drafts')(LocalSyntheticQualityController.prototype,'createAsset',Object.getOwnPropertyDescriptor(LocalSyntheticQualityController.prototype,'createAsset'));Req()(LocalSyntheticQualityController.prototype,'createAsset',0);Param('planId')(LocalSyntheticQualityController.prototype,'createAsset',1);Param('runId')(LocalSyntheticQualityController.prototype,'createAsset',2);Body()(LocalSyntheticQualityController.prototype,'createAsset',3);
 Controller('research-plan-drafts/:planId/synthetic-trials')(LocalSyntheticQualityController);RequireStudyGroup()(LocalSyntheticQualityController);RequireResearchProject()(LocalSyntheticQualityController);RequireStudyGroupMenu('artifacts')(LocalSyntheticQualityController);RequireStudyGroupPermission('artifact.read')(LocalSyntheticQualityController);
 for(const[method,verb,path]of [['create',Post,''],['list',Get,''],['read',Get,':runId'],['revise',Post,':runId/revisions']]){
  verb(path)(LocalSyntheticQualityController.prototype,method,Object.getOwnPropertyDescriptor(LocalSyntheticQualityController.prototype,method));Req()(LocalSyntheticQualityController.prototype,method,0);Param('planId')(LocalSyntheticQualityController.prototype,method,1);
  if(method==='create')Body()(LocalSyntheticQualityController.prototype,method,2);else if(method==='list')Query()(LocalSyntheticQualityController.prototype,method,2);else{Param('runId')(LocalSyntheticQualityController.prototype,method,2);if(method==='revise')Body()(LocalSyntheticQualityController.prototype,method,3);}
 }
 return{Controller:LocalSyntheticQualityController,AssetsController:reports.assets.Controller,active:()=>active.size};
}
