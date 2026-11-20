import {coreSourcePath} from '../server/research-runtime/dependencies.mjs';
// Independent new drafts only; original method and collection rows remain read-only.
import assert from'node:assert/strict';
import{edcDigest,exactEdcFields}from'./synthetic-edc-contract.mjs';
import{hashText}from'./knowledge-ai-contract.mjs';
import{reportDocumentSources}from'./synthetic-report-contract.mjs';
import{CRF_REPORT_MARKER,buildCrfMethodReportFacts,crfReportCurrent,crfReportNotesOperation,renderCrfMethodReport}from'./synthetic-crf-methods-report-contract.mjs';
export function createCrfMethodReports({root,ids,methods,edc,ai,storage,load,require}){
 const{HttpException}=require('@nestjs/common'),Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService'),{canonicalArtifactJson}=require(coreSourcePath('research-artifacts/research-artifact-integrity')),prefix='rh-crf-method-report-20261025:';
 const fail=(code,message,status=409)=>{throw new HttpException({code,message},status);},seal=b=>({...b,seal:edcDigest(b)}),service=tx=>new Artifacts({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)},storage,null,null);
 const checked=fn=>{try{return fn();}catch(e){if(e instanceof assert.AssertionError){const code=e.message.startsWith('CRF_REPORT_')?e.message:'CRF_REPORT_INPUT_INVALID';fail(code,'报告输入、版本、说明或来源无法核对',code==='CRF_REPORT_NO_CHANGE'?422:code==='CRF_REPORT_CAPACITY'?429:code==='CRF_REPORT_INPUT_INVALID'?400:409);}throw e;}};
 const where=(u,raw,id)=>({...id?{id}:{},tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,ownerAccountId:u.accountId,createdBy:u.accountId,typeKey:'data_quality_report',status:'draft',deletedAt:null,idempotencyKey:{startsWith:prefix+u.accountId+':'+raw.id+':'}});
 const nativeSources=facts=>JSON.parse(canonicalArtifactJson([{sourceType:'data_snapshot',sourceId:facts.packet.versionId,sourceVersion:String(facts.packet.versionNo),snapshot:{kind:CRF_REPORT_MARKER,collectionId:facts.packet.id,versionNo:facts.packet.versionNo,basis:facts.basis,quality:facts.quality}},{sourceType:'research_method_run',sourceId:facts.method.runId,sourceVersion:facts.method.runVersion,snapshot:facts.method},...reportDocumentSources(facts.sources),...(facts.ai.resultMessageId?[{sourceType:'message',sourceId:facts.ai.resultMessageId,snapshot:{kind:CRF_REPORT_MARKER,sessionId:facts.ai.sessionId,binding:facts.ai.binding,itemsHash:edcDigest(facts.ai.items)}}]:[])]));
 function ready(u,view){methods.authorized(u,'R03');if(view.sourceStatus!=='current'||view.status!=='needs_review'||!view.result||view.resultHash!==edcDigest(view.result))fail('CRF_REPORT_STALE','当前来源、数据、质控或方法已变化，不能新建或修订报告');}
 async function frozen(tx,u,p,c,raw){
  const s=raw.inputSummary.localCrfMethod,packet=await edc.readPacket(tx,u,p,c,s.versionNo),pv=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:p,versionNo:s.binding.parentRootVersionNo}}}),b=pv?.contentBlocks?.[0],unsigned={...b};delete unsigned.seal;
  if(!b||b.seal!==edcDigest(unsigned)||b.ownerAccountId!==u.accountId||b.sessionId!==s.binding.sessionId||b.kbId!==s.binding.kbId||edcDigest(b.sources)!==s.binding.sourcesHash)fail('CRF_REPORT_CONTEXT_INVALID','报告原方案来源无法核对');
  return{packet:packet.b,packetVersion:{collectionId:c,versionId:packet.v.id,versionNo:packet.v.versionNo},snapshot:s,pico:b.pico,sources:b.sources};
 }
 async function loadReport(tx,u,p,c,parent,state,pack,view,raw,id,no){
  methods.authorized(u,'R03');const a=await tx.researchArtifact.findFirst({where:where(u,raw,id)});if(!a)fail('CRF_REPORT_FORBIDDEN','无法访问该本人方法报告',403);
  const v=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:id,versionNo:no??a.currentVersionNo}},include:{sources:true}});if(!v)fail('CRF_REPORT_VERSION_MISSING','本人报告版本不存在',404);const b=v.contentBlocks?.[0],unsigned={...b};delete unsigned.seal;
  if(v.contentBlocks?.length!==1||b?.type!==CRF_REPORT_MARKER||b.ownerAccountId!==u.accountId||b.planId!==p||b.collectionId!==c||b.runId!==raw.id||b.seal!==edcDigest(unsigned)||b.factsHash!==edcDigest(b.facts)||v.contentMd!==renderCrfMethodReport(b.facts,b.notes)||v.contentHash!==hashText(v.contentMd))fail('CRF_REPORT_CONTEXT_INVALID','报告、机器事实或真实父对象无法核对');
  // Reconstruct immutable facts, but freshness below always follows the actual current head.
  const expected=buildCrfMethodReportFacts({run:{...view,sourceStatus:'current'},...await frozen(tx,u,p,c,raw),ai:{selected:null,job:null}});
  if(edcDigest({...expected,ai:null})!==edcDigest({...b.facts,ai:null}))fail('CRF_REPORT_CONTEXT_INVALID','报告与实际不可变方法、包版本或来源不一致');
  let aiStatus=null;if(b.facts.ai.resultMessageId){const r=await ai.readResult(tx,u,parent,state,pack,view,raw,b.facts.ai.resultMessageId),e=r.explanation;if(!e||edcDigest(e.items)!==edcDigest(b.facts.ai.items)||edcDigest(e.binding)!==edcDigest(b.facts.ai.binding)||edcDigest(e.sources)!==edcDigest(b.facts.ai.sources))fail('CRF_REPORT_CONTEXT_INVALID','报告解释与原真实消息不符');aiStatus=e.status;}
  const expectedSources=nativeSources(b.facts),actual=v.sources.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,...s.sourceVersion?{sourceVersion:s.sourceVersion}:{},snapshot:s.snapshot}));
  if(edcDigest(actual.sort((a,b)=>(a.sourceType+a.sourceId).localeCompare(b.sourceType+b.sourceId)))!==edcDigest([...expectedSources].sort((a,b)=>(a.sourceType+a.sourceId).localeCompare(b.sourceType+b.sourceId)))||v.sourceSnapshotHash!==hashText(JSON.stringify(expectedSources)))fail('CRF_REPORT_CONTEXT_INVALID','报告原生来源不一致');
  for(const s of v.sources){const wanted=expectedSources.find(w=>w.sourceType===s.sourceType&&w.sourceId===s.sourceId);if(s.hash!==hashText(JSON.stringify(wanted.snapshot)))fail('CRF_REPORT_CONTEXT_INVALID','报告来源指纹损坏');}
  const versions=await tx.researchArtifactVersion.findMany({where:{artifactId:id},select:{versionNo:true,createdAt:true,changeSummary:true},orderBy:{versionNo:'desc'},take:30}),current=crfReportCurrent(b.facts,view)&&aiStatus!=='stale';
  return{id:a.id,typeKey:a.typeKey,status:'draft',version:v.versionNo,currentVersion:a.currentVersionNo,sourceStatus:current?'current':'stale',canEdit:current&&v.versionNo===a.currentVersionNo,notes:b.notes,facts:b.facts,factsHash:b.factsHash,contentMd:v.contentMd,sourceRows:v.sources.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,sourceVersion:s.sourceVersion,hash:s.hash})),versions,_block:b};
 }
 const publicView=v=>{const{_block,...rest}=v;return rest;};
 const read=(u,p,c,id,r,no)=>methods.withRun(u,p,c,id,'artifact.read',async(tx,parent,state,pack,view,raw)=>{methods.authorized(u,'R03');if(state==='restricted')return{id:r,sourceStatus:'restricted',message:'当前来源或授权受限，不交付报告正文与说明'};return publicView(await loadReport(tx,u,p,c,parent,state,pack,view,raw,r,no));});
 const write=(u,p,c,id,permission,cb)=>methods.withRun(u,p,c,id,permission,async tx=>{await tx.$queryRaw`SELECT id FROM research_method_run WHERE id=${id} AND "tenantId"=${u.tenantId} AND "studyGroupId"=${u.studyGroupId} AND "researchProjectId"=${u.researchProjectId} AND "accountId"=${u.accountId} FOR UPDATE`;return methods.inRun(tx,u,p,c,id,permission,cb);});
 async function reply(u,p,c,id,r,key,versionNo){return{...(await methods.read(u,p,c,id)),report:await read(u,p,c,id,r),operation:{id:key,reportId:r,versionNo}};}
 async function create(u,p,c,id,body){checked(()=>{exactEdcFields(body,['baseRunVersion','resultHash','interpretationMessageId','requestKey']);assert(typeof body.baseRunVersion==='string'&&Number.isFinite(Date.parse(body.baseRunVersion))&&typeof body.resultHash==='string'&&typeof body.requestKey==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey));assert(body.interpretationMessageId===null||typeof body.interpretationMessageId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(body.interpretationMessageId));});
  const operation=await write(u,p,c,id,'artifact.create',async(tx,parent,state,pack,view,raw)=>{
   methods.authorized(u,'R03');const key=prefix+u.accountId+':'+id+':'+body.requestKey,hash=edcDigest(body),prior=await tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:u.tenantId,idempotencyKey:key}}});
   if(prior){if(prior.creationRequestHash!==hash)fail('CRF_REPORT_KEY_CONFLICT','请求标识已用于其他报告输入');await loadReport(tx,u,p,c,parent,state,pack,view,raw,prior.id);return{id:prior.id};}
   ready(u,view);if(view.runVersion!==body.baseRunVersion||view.resultHash!==body.resultHash)fail('CRF_REPORT_VERSION_CONFLICT','方法版本或结果已变化');if(await tx.researchArtifact.count({where:where(u,raw)})>=30)fail('CRF_REPORT_CAPACITY','本run达到30份报告草稿上限',429);
   const live=await ai.live(tx,u,parent,state,pack,view,raw),selected=body.interpretationMessageId?(await ai.readResult(tx,u,parent,state,pack,view,raw,body.interpretationMessageId)).explanation:null;
   if(body.interpretationMessageId&&selected?.status!=='current')fail('CRF_REPORT_AI_STALE','所选解释不可交付或已过期');
   const original=await frozen(tx,u,p,c,raw),facts=checked(()=>buildCrfMethodReportFacts({run:view,...original,ai:{...live,selected}})),block={type:CRF_REPORT_MARKER,ownerAccountId:u.accountId,planId:p,collectionId:c,runId:id,facts,factsHash:edcDigest(facts),notes:'',operations:[]};
   const reportId=await service(tx).createWithSourcesInTx(u,{title:'本人合成科研方法报告草稿',typeKey:'data_quality_report',idempotencyKey:key,creationRequestHash:hash,contentMd:renderCrfMethodReport(facts,''),contentBlocks:[seal(block)]},nativeSources(facts),u.accountId,tx);
   await tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId,action:'local_crf_method_report',target:reportId,meta:{runId:id,inputHash:view.inputHash,resultHash:view.resultHash,interpretationMessageId:body.interpretationMessageId,requestKey:body.requestKey}}});await loadReport(tx,u,p,c,parent,state,pack,view,raw,reportId);return{id:reportId};
  });return reply(u,p,c,id,operation.id,body.requestKey,1);
 }
 async function save(u,p,c,id,r,body){
  const op=await write(u,p,c,id,'artifact.edit',async(tx,parent,state,pack,view,raw)=>{ready(u,view);const report=await loadReport(tx,u,p,c,parent,state,pack,view,raw,r);if(report.sourceStatus!=='current')fail('CRF_REPORT_STALE','报告或所选解释已经过期');
   const change=checked(()=>crfReportNotesOperation({versionNo:report.currentVersion,notes:report.notes,operations:report._block.operations},body));if(change.idempotent)return change.operation;
   const block={...report._block,notes:change.notes,operations:[...report._block.operations,change.operation]};delete block.seal;
   await service(tx).createVersion(u,r,{baseVersionNo:body.baseVersionNo,contentMd:renderCrfMethodReport(block.facts,block.notes),contentBlocks:[seal(block)],changeSummary:'本人说明修订；机器事实、实际方法与来源不变'});return change.operation;
  });return reply(u,p,c,id,r,body.requestKey,op.versionNo);
 }
 async function live(tx,u,view,raw){try{methods.authorized(u,'R03');const reports=await tx.researchArtifact.findMany({where:where(u,raw),orderBy:[{createdAt:'desc'},{id:'desc'}],take:31,select:{id:true,currentVersionNo:true,createdAt:true}});if(reports.length>30)fail('CRF_REPORT_CAPACITY','报告容量记录异常');return{reportDrafts:reports,reportStatus:'available',actions:{canCreateReport:view.sourceStatus==='current'&&view.status==='needs_review'&&Boolean(view.result)&&reports.length<30}};}catch{return{reportDrafts:[],reportStatus:'restricted',actions:{canCreateReport:false}};}}
 async function inReport(tx,u,p,c,id,r,no){
  // Consumes the caller's existing authorization transaction; never calls read().
  return methods.inRun(tx,u,p,c,id,'artifact.read',async(tx,parent,state,pack,view,raw)=>{
   methods.authorized(u,'R03');if(state==='restricted')fail('CRF_REPORT_FORBIDDEN','当前来源或授权受限，不交付报告',403);
   const report=await loadReport(tx,u,p,c,parent,state,pack,view,raw,r,no);
   const version=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:r,versionNo:report.version}},select:{id:true}});
   return{report:publicView(report),reportVersionId:version.id,nativeSources:nativeSources(report.facts),run:view};
  });
 }
 return{read,create,save,live,inReport};
}
