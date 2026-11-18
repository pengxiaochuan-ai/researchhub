import{readFileSync}from'node:fs';import{pipeline}from'node:stream/promises';
import{materialDigest}from'../server/ai-agent/session-material-contract.mjs';
import{createSessionMediaIngests}from'../server/ai-agent/session-media-ingests.mjs';
import{createMediaIngestNative}from'./ai-session-media-ingest-native.mjs';
import{createLocalMaterialAccess}from'./local-session-materials.mjs';import{createLocalResearchPrisma}from'./research-creation-local-integration.mjs';import{createResearchStudiesService}from'../server/research-studies/commands.mjs';
import{inspectMediaIngestSchema,mediaIngestSqlHash}from'./ai-session-media-ingest-schema.mjs';import{withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';import{mediaSourceAllowed}from'../server/ai-agent/session-media-origin.mjs';
import{validateMediaIngestScope}from'./ai-session-media-ingest-scope.mjs';
const cfgFile=new URL('../.tmp/ai-video-binding-2026-11-16/authorized-scope.json',import.meta.url);
export async function createLocalSessionMediaIngests({env,ids,load,require,storage}){
 const constraints={checkpoint:JSON.parse(readFileSync(new URL('../.tmp/ai-media-origin-2026-11-16/live/checkpoint.json',import.meta.url))),registered:JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url))).registeredObjects};
 const initial=validateMediaIngestScope(JSON.parse(readFileSync(cfgFile)),ids,constraints),fingerprint=materialDigest(initial);
 const config=()=>{const c=validateMediaIngestScope(JSON.parse(readFileSync(cfgFile)),ids,constraints);if(materialDigest(c)!==fingerprint)throw Error('MEDIA_INGEST_CONFIG_CHANGED');return c;};
 const ready=await withFixtureTransaction(env,'direct',tx=>inspectMediaIngestSchema(tx),{readOnly:true});if(ready.tables!==2||ready.receipt?.sqlHash!==mediaIngestSqlHash||ready.receipt.catalogHash!==ready.catalogHash)throw Error('MEDIA_INGEST_SCHEMA_NOT_READY');
 const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:fn=>withFixtureTransaction(env,'app',fn)}),studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('MEDIA_INGEST_CREATION_FORBIDDEN');}});
 const boundary=(u,c,source,mid)=>{const cfg=config(),a=Object.values(cfg.actors).find(a=>a.accountId===u.accountId);if(!a||c.studyId!==cfg.target.studyId||source.sessionId!==a.sessionId)return{mediaIds:[],subjectIds:[],visitIds:[]};return{mediaIds:[a.mediaId],subjectIds:[a.subjectId],visitIds:a.visit?[a.visit.id]:[]};};
 const service=createSessionMediaIngests({studies,sourceAccess:createLocalMaterialAccess({env,ids,load}),native:createMediaIngestNative({load,scopeKey:initial.scopeKey,boundary}),storage,scopeKey:initial.scopeKey,sourceScope:initial.source,allowedStudyIds:[initial.target.studyId],parseRange:load('sessions/sessions.service','parseAttachmentByteRange')});
 const {Controller,Get,Post,Req,Res,Param,Body,Query,HttpException}=require('@nestjs/common');
 const messages={MEDIA_INGEST_INPUT:'关联信息无效，请核对所选研究和被试。',MEDIA_INGEST_NOT_FOUND:'登记记录不存在，或当前无权查看。',MEDIA_INGEST_PERMISSION:'当前没有此视频或被试的登记／读取权限。',MEDIA_INGEST_PERMISSION_CHANGED:'登记权限已变化，请重新核对关联信息。',MEDIA_INGEST_SOURCE_UNAVAILABLE:'视频尚未通过画面和文件检查，请先核对视频状态。',MEDIA_INGEST_TARGET_NOT_READY:'当前访视暂不能登记视频，请核对访视状态。',MEDIA_INGEST_TARGET_CHANGED:'研究或被试状态已变化，请重新核对。',MEDIA_INGEST_SOURCE_CHANGED:'原件或关联依据已变化，本次未继续登记。',MEDIA_INGEST_VERSION:'登记状态已变化，请先核对原操作结果。',MEDIA_INGEST_REQUEST_CONFLICT:'此操作已对应另一份关联信息，请先核对原操作。',MEDIA_INGEST_ALREADY_REGISTERED:'视频已有登记记录，请查看原回执。'};
 const invoke=async(req,fn)=>{req.res?.setHeader('Cache-Control','no-store');if(!mediaSourceAllowed(req))throw new HttpException({code:'MEDIA_ORIGIN_REJECTED',message:'请求来源未通过核验，请刷新当前页面后核对原操作。'},403);try{return await fn();}catch(e){if(e.getStatus){if(e.getStatus()===416){const r=e.getResponse()?.contentRange;if(/^bytes \*\/[0-9]+$/.test(r??''))req.res?.setHeader('Content-Range',r);}throw e;}throw new HttpException({code:messages[e.code]?e.code:'MEDIA_INGEST_UNAVAILABLE',message:messages[e.code]??'暂时无法核对视频登记结果，请保留原操作并核对，不要重复登记。'},e.status??503);}};
 class SessionMediaIngestController{
  targets(req,sid,mid){return invoke(req,()=>service.targets(req.user,sid,mid));}
  prepare(req,sid,mid,body){return invoke(req,()=>service.prepare(req.user,sid,mid,body));}
  get(req,sid,mid,operation){return invoke(req,()=>service.get(req.user,sid,mid,operation));}
  confirm(req,sid,mid,operation,body){return invoke(req,()=>service.confirm(req.user,sid,mid,operation,body));}
  receipt(req,sid,mid,key){return invoke(req,()=>service.receipt(req.user,sid,mid,key));}
 }
 Controller('sessions/:id/media/:mediaId')(SessionMediaIngestController);
 const p=SessionMediaIngestController.prototype;
 for(const[name,verb,path]of[['targets',Get,'ingest-targets'],['prepare',Post,'ingests'],['get',Get,'ingests/:operationId'],['confirm',Post,'ingests/:operationId/confirm'],['receipt',Get,'ingest-receipts/:requestKey']]){
  const d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);Req()(p,name,0);Param('id')(p,name,1);Param('mediaId')(p,name,2);
  if(name==='prepare')Body()(p,name,3);else if(name==='get'||name==='confirm')Param('operationId')(p,name,3);else if(name==='receipt')Param('requestKey')(p,name,3);
  if(name==='confirm')Body()(p,name,4);
 }
 class SubjectMediaIngestController{
  list(req,studyId,subjectId,query){return invoke(req,()=>service.subjectList(req.user,studyId,subjectId,query));}
  get(req,studyId,subjectId,ingestId){return invoke(req,()=>service.subjectGet(req.user,studyId,subjectId,ingestId));}
  async content(req,studyId,subjectId,ingestId,res){const value=await invoke(req,()=>service.content(req.user,studyId,subjectId,ingestId,req.headers.range));res.status(value.status);res.set(value.headers);try{await pipeline(value.stream,res);}catch{if(!res.destroyed)res.destroy();}}
 }
 Controller('research-studies/:studyId/subjects/:subjectId/session-media-ingests')(SubjectMediaIngestController);
 const q=SubjectMediaIngestController.prototype;
 for(const[name,path]of[['list',''],['get',':ingestId'],['content',':ingestId/content']]){const d=Object.getOwnPropertyDescriptor(q,name);Get(path)(q,name,d);Req()(q,name,0);Param('studyId')(q,name,1);Param('subjectId')(q,name,2);if(name==='list')Query()(q,name,3);else Param('ingestId')(q,name,3);if(name==='content')Res()(q,name,4);}
 return{Controllers:[SessionMediaIngestController,SubjectMediaIngestController],service,limitedReadInTx:service.limitedReadInTx};
}
