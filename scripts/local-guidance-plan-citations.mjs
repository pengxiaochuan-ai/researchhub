// Approved local-only human references. Excerpts are resolved, never stored in a plan or sent to AI.
import {randomUUID} from 'node:crypto';
import {citationHash,planParagraphs,validateCitationInput,citationTargetState,assertCitationAddition} from './guidance-plan-citation-contract.mjs';
import {editablePlanContent,PLAN_MARKER} from './research-plan-contract.mjs';
import {sourceState} from './knowledge-ai-contract.mjs';
import {assertPreparationIdle} from './research-execution-preparation-contract.mjs';
import {initialFive,initialDocumentId} from '../server/hub-sources/initial-five.mjs';
import {getVisibleGuidanceDocument} from '../server/hub-sources/external-visible.mjs';

export function createLocalGuidancePlanCitations({root,ids,load,require,plans,storage}){
 const {Controller,Get,Post,Req,Res,Body,Param,Query,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(root+'app/server/src/common/decorators.ts');
 const {canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts');
 const Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService');
 const fail=(code,message,status=409)=>{throw new HttpException({code,message},status);};
 const hubKey='lingshu-xinyu',documentIds=initialFive.filter(s=>s.mimeType==='application/pdf').map(s=>initialDocumentId(ids.tenant,hubKey,s)).sort();
 const refs=p=>p.block.guidanceCitations??[];
 const body=p=>editablePlanContent(p.v.contentMd);
 async function catalog(tx){
  // Same document keys as importer/reviewer, acquired in a deterministic order.
  for(const id of documentIds)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ids.tenant+':'+hubKey+':'+id},0))`;
  const rows=[];
  for(const documentId of documentIds){const s=await getVisibleGuidanceDocument({db:tx,tenantId:ids.tenant,hubKey,documentId});if(s?.clausesStatus==='approved')rows.push(s);}
  return rows;
 }
 function resolve(ref,sources){
  const source=sources.find(s=>s.documentId===ref.source.documentId),e=source?.clauseDetails;
  if(!e||e.extractionId!==ref.source.extractionId||e.sourceSha256!==ref.source.sourceSha256||e.payloadSha256!==ref.source.payloadSha256||source.reviewVersion!==ref.bibliographicReviewVersion||e.reviewVersion!==ref.clauseReviewVersion)return null;
  const clause=e.clauses.find(c=>c.id===ref.clauseId);
  return clause?{title:source.title,externalKey:source.externalKey,documentId:source.documentId,details:{...e,clauses:[clause]}}:null;
 }
 async function historical(tx,user,head,versionNo){
  const v=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:head.a.id,versionNo}}});
  if(!v)fail('CITATION_VERSION_NOT_FOUND','本人草稿不存在该历史版本。',404);
  const block=v.contentBlocks?.find(x=>x.type===PLAN_MARKER),unsigned={...block};delete unsigned.seal;
  if(!block||block.ownerAccountId!==user.accountId||block.sessionId!==head.block.sessionId||block.kbId!==head.block.kbId||block.seal!==citationHash(canonicalArtifactJson(unsigned)))fail('CITATION_CONTEXT_INVALID','历史草稿上下文无法核对。');
  let state='current';for(const s of block.sources){const next=sourceState(s,await tx.knowledgeDoc.findUnique({where:{id:s.docId}}),await tx.knowledgeChunk.findUnique({where:{id:s.chunkId}}));if(next==='restricted'){state=next;break;}if(next==='stale')state=next;}
  return{p:{...head,a:{...head.a,currentVersionNo:versionNo},v,block},state};
 }
 async function view(tx,user,p,state,{currentVersion=p.a.currentVersionNo,readOnly=false}={}){
  const version=p.a.currentVersionNo;
  if(state==='restricted')return{id:p.a.id,version,currentVersion,readOnly:true,sourceStatus:state,message:'方案原资料或当前授权失效，不交付段落、条款和引用正文。'};
  const references=refs(p);if(!Array.isArray(references)||references.length>12)fail('CITATION_CONTEXT_INVALID','引用上下文无法核对。');
  let idle=true;try{await assertPreparationIdle(p,id=>tx.knowledgeChatJob.findUnique({where:{id}}));}catch{idle=false;}
  const text=body(p),paragraphs=planParagraphs(text),sources=await catalog(tx);
  return{id:p.a.id,version,currentVersion,readOnly,sourceStatus:state,canEdit:!readOnly&&idle&&state==='current'&&p.block.stage==='protocol_draft'&&!!p.block.confirmation,
   paragraphs,sources,citations:references.map(ref=>{
    const found=resolve(ref,sources),targetStatus=citationTargetState(ref,text),target=paragraphs.find(t=>t.start===ref.target.start&&t.end===ref.target.end&&t.sha256===ref.target.sha256);
    return{citationId:ref.citationId,purpose:ref.purpose,createdAt:ref.createdAt,createdBy:ref.createdBy,planVersion:ref.planVersion,targetStatus,target:target??null,sourceStatus:found?'current':'unavailable',...(found??{})};
   }),versions:await tx.researchArtifactVersion.findMany({where:{artifactId:p.a.id},select:{versionNo:true,changeSummary:true},orderBy:{versionNo:'desc'},take:30})};
 }
 async function read(user,id,query={}){
  if(!query||Object.keys(query).some(k=>k!=='versionNo')||(query.versionNo!==undefined&&(typeof query.versionNo!=='string'||!/^[1-9][0-9]{0,5}$/.test(query.versionNo))))fail('CITATION_INPUT_INVALID','历史版本参数无效。',400);
  return plans.withDraft(user,id,'artifact.read',async(tx,head,state)=>{
   if(state==='restricted')return view(tx,user,head,state);
   if(query.versionNo!==undefined){const h=await historical(tx,user,head,Number(query.versionNo));return view(tx,user,h.p,h.state,{currentVersion:head.a.currentVersionNo,readOnly:true});}
   return view(tx,user,head,state);
  });
 }
 async function change(user,id,input){
  try{validateCitationInput(input);}catch{fail('CITATION_INPUT_INVALID','请核对段落、条款定位、版本、用途与明确确认；不接受原文或页码字段。',400);}
  return plans.withDraft(user,id,'artifact.edit',async(tx,p,state)=>{
   if(state!=='current')fail('CITATION_PLAN_RESTRICTED','方案原资料或版本已变化，当前不能修改引用。');
   const hash=citationHash(canonicalArtifactJson(input)),old=p.block.operations?.find(o=>o.key===input.requestKey);
   if(old){if(old.kind!=='指南人工引用'||old.hash!==hash)fail('CITATION_REQUEST_KEY_CONFLICT','请求标识已用于不同操作或输入。');return{appliedVersionNo:old.appliedVersionNo,replayed:true,view:await view(tx,user,p,state)};}
   if(input.baseVersionNo!==p.a.currentVersionNo)fail('CITATION_VERSION_CONFLICT','方案版本已变化；请核对当前版本后重新选择，未覆盖引用。');
   if(p.block.stage!=='protocol_draft'||!p.block.confirmation)fail('CITATION_PROTOCOL_REQUIRED','请先确认PICO并保存本人方案草稿。');
   try{await assertPreparationIdle(p,jobId=>tx.knowledgeChatJob.findUnique({where:{id:jobId}}));}catch{fail('CITATION_JOB_PENDING','当前方案存在在途任务或上下文不可核对，不能修改引用。');}
   let next=[...refs(p)],added;
   if(input.action==='add'){
    if(citationTargetState(input,body(p))!=='matched')fail('CITATION_TARGET_CHANGED','目标必须是当前已保存的完整段落，请重新选择。');
    try{assertCitationAddition(next,input);}catch(e){fail(e.message,e.message==='CITATION_DUPLICATE'?'该段落已关联同一条款；未重复保存。':'本人草稿最多保留12条当前引用。');}
    const sources=await catalog(tx),s=sources.find(s=>s.documentId===input.source.documentId),e=s?.clauseDetails;
    if(!e||e.extractionId!==input.source.extractionId||e.sourceSha256!==input.source.sourceSha256||e.payloadSha256!==input.source.payloadSha256||!e.clauses.some(c=>c.id===input.clauseId))fail('CITATION_SOURCE_CHANGED','来源、条款审核或版本已变化，请重新核对后选择。');
    added={citationId:'gc-'+randomUUID().replaceAll('-',''),source:input.source,target:input.target,clauseId:input.clauseId,purpose:input.purpose,createdBy:user.accountId,createdAt:new Date().toISOString(),planVersion:p.a.currentVersionNo,bibliographicReviewVersion:s.reviewVersion,clauseReviewVersion:e.reviewVersion};next.push(added);
   }else{
    if(!next.some(r=>r.citationId===input.citationId))fail('CITATION_NOT_FOUND','当前版本不存在该本人引用。');next=next.filter(r=>r.citationId!==input.citationId);
   }
   const appliedVersionNo=p.a.currentVersionNo+1,block={...p.block,guidanceCitations:next};delete block.seal;
   block.operations=[...(block.operations??[]),{kind:'指南人工引用',key:input.requestKey,hash,appliedVersionNo}];
   if(block.operations.length>64)fail('PLAN_HISTORY_LIMIT','本轮草稿已达到64条修订记录上限，未截断或覆盖历史。');
   const contentMd=plans.formatContent(p.v.contentMd,block),sealed={...block,seal:citationHash(canonicalArtifactJson(block))};
   const bound={forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)};
   await new Artifacts(bound,storage,null,null).createVersion(user,p.a.id,{baseVersionNo:p.a.currentVersionNo,contentMd,contentBlocks:[sealed],changeSummary:input.action==='add'?'新增指南人工引用':'解除指南人工引用'});
   await tx.auditLog.create({data:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,action:'local_guidance_plan_citation',target:p.a.id,meta:{action:input.action,requestKey:input.requestKey,requestHash:hash,baseVersionNo:p.a.currentVersionNo,appliedVersionNo,citationId:added?.citationId??input.citationId}}});
   const updated={...p,a:{...p.a,currentVersionNo:appliedVersionNo},v:{...p.v,versionNo:appliedVersionNo,contentMd,contentBlocks:[sealed]},block:sealed};
   const result=await view(tx,user,updated,state);
   // Expiration is time-based: a lock alone cannot hold an expired approval valid.
   if(added&&result.citations.find(r=>r.citationId===added.citationId)?.sourceStatus!=='current')fail('CITATION_SOURCE_CHANGED','提交前来源有效期或审核已变化，引用和新版本均未提交。');
   return{appliedVersionNo,replayed:false,view:result};
  });
 }
 class GuidanceCitationsController{
  read(req,id,q,res){res.setHeader('Cache-Control','no-store');return read(req.user,id,q);}
  change(req,id,b,res){res.setHeader('Cache-Control','no-store');return change(req.user,id,b);}
 }
 Controller('research-plan-drafts')(GuidanceCitationsController);RequireStudyGroup()(GuidanceCitationsController);RequireResearchProject()(GuidanceCitationsController);RequireStudyGroupMenu('artifacts')(GuidanceCitationsController);RequireStudyGroupPermission('artifact.read')(GuidanceCitationsController);
 for(const [name,verb]of [['read',Get],['change',Post]]){verb(':id/guidance-citations')(GuidanceCitationsController.prototype,name,Object.getOwnPropertyDescriptor(GuidanceCitationsController.prototype,name));Req()(GuidanceCitationsController.prototype,name,0);Param('id')(GuidanceCitationsController.prototype,name,1);(name==='read'?Query():Body())(GuidanceCitationsController.prototype,name,2);Res({passthrough:true})(GuidanceCitationsController.prototype,name,3);}
 return{Controller:GuidanceCitationsController,read,change};
}
