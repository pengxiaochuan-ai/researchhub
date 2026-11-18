import {pipeline} from 'node:stream/promises';
import {createSessionMedia} from '../server/ai-agent/session-media.mjs';
import {createLocalMaterialAccess} from './local-session-materials.mjs';
import {createMediaInspection} from './ai-session-media-inspection.mjs';
import {inspectMediaSchema,mediaSqlHash} from './ai-session-media-schema.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createMediaChunkSnapshot} from '../server/ai-agent/session-media-snapshot.mjs';
import {mediaSourceAllowed,mediaSourceMetadata} from '../server/ai-agent/session-media-origin.mjs';

export async function createLocalSessionMedia({env,ids,load,require,storage,directory}){
 const state=await withFixtureTransaction(env,'direct',tx=>inspectMediaSchema(tx),{readOnly:true});
 if(state.receipt?.sqlHash!==mediaSqlHash||state.receipt.catalogHash!==state.catalogHash)throw Error('MEDIA_SCHEMA_NOT_READY');
 const Chunk=load('sessions/chat-chunk-upload','ChatChunkUploadStore');
 const chunks=new Chunk({rootDirectory:directory,allowedExtensions:new Set(['.mp4','.mov','.webm'])});
 const service=createSessionMedia({access:createLocalMaterialAccess({env,ids,load}),chunks,storage,readChunks:createMediaChunkSnapshot({directory}),
  inspectSignature:load('sessions/chat-upload-inspector','inspectChatUploadFile'),
  inspectMedia:createMediaInspection({parse:load('ingest/media-inspection','parseFfprobeOutput'),classify:load('ingest/media-inspection','classifyFfprobeFailure')}),
  parseRange:load('sessions/sessions.service','parseAttachmentByteRange')});
 const {Controller,Get,Post,Req,Res,Param,Body,Query,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(new URL('../../app/server/src/common/decorators.ts',import.meta.url).pathname);
 const only=(v,fields)=>{if(!v||Array.isArray(v)||Object.keys(v).some(k=>!fields.includes(k)))throw new HttpException({code:'MEDIA_INPUT',message:'视频请求无效，请核对后重试。'},400);};
 const messages={MEDIA_INPUT:'请选择MP4、MOV或WebM视频，单份不超过500MiB。',MEDIA_FILE_INVALID:'视频格式检查未通过，请核对文件后重新上传。',MEDIA_NOT_FOUND:'视频不存在或当前无权查看。',MEDIA_VERSION:'视频状态已变化，请重新核对。',MEDIA_REQUEST_CONFLICT:'本次操作对应的视频已不同，请核对原上传。',MEDIA_SOURCE_CHANGED:'视频原件或状态无法核对，当前未继续读取。',MEDIA_NOT_ARCHIVED:'视频尚未归档完成，请核对上传状态。',MEDIA_CHECK_RUNNING:'视频正在检查，请稍后核对。',MEDIA_ALREADY_ARCHIVED:'视频已归档，请核对已有结果。',HUB_MATERIAL_ACCESS_REJECTED:'当前会话或视频权限已变化，请核对后再操作。'};
 messages.MEDIA_UPLOAD_EXPIRED='视频上传已过期，未完成归档。请重新选择文件上传。';
 messages.MEDIA_FILE_IDENTITY_CHANGED='上传内容与原视频不一致，请重新选择原视频继续上传。';
 messages.MEDIA_CHUNKS_UNAVAILABLE='暂时无法核对已上传的内容，请稍后核对原上传。';
 async function invoke(req,operation){
  req.res?.setHeader('Cache-Control','no-store');
  if(!mediaSourceAllowed(req)){
   console.warn(JSON.stringify({event:'local_media_source_rejected',...mediaSourceMetadata(req)}));
   throw new HttpException({code:'MEDIA_ORIGIN_REJECTED',message:'上传请求的页面来源未通过核验，本次未继续。请刷新当前页面，再继续原上传。'},403);
  }
  try{return await operation();}catch(e){if(e?.getStatus){if(e.getStatus()===416){const value=e.getResponse()?.contentRange;if(/^bytes \*\/[0-9]+$/.test(value??''))req.res?.setHeader('Content-Range',value);}throw e;}throw new HttpException({code:messages[e.code]?e.code:'MEDIA_UNAVAILABLE',message:messages[e.code]??'视频服务暂不可用，结果尚未确认。请先核对原上传，不要重复提交。'},e.status??503);}
 }
 class SessionMediaController{
  onModuleInit(){chunks.onModuleInit();}
  onModuleDestroy(){chunks.onModuleDestroy();}
  initialize(req,sid,body){return invoke(req,()=>service.initialize(req.user,sid,body));}
  chunk(req,sid,uploadId,index){return invoke(req,()=>{
   if(req.headers['content-type']?.split(';')[0]!=='application/octet-stream')throw new HttpException('请使用视频分片上传。',400);
   return service.chunk(req.user,sid,uploadId,Number(index),req,Number(req.headers['content-length']));
  });}
  complete(req,sid,uploadId,body){only(body,[]);return invoke(req,()=>service.complete(req.user,sid,uploadId));}
  snapshot(req,sid,uploadId,query){only(query,[]);return invoke(req,()=>service.snapshot(req.user,sid,uploadId));}
  list(req,sid,query){only(query,['limit','cursor']);return invoke(req,()=>service.list(req.user,sid,query));}
  receipt(req,sid,key,query){only(query,[]);return invoke(req,()=>service.receipt(req.user,sid,key));}
  recheck(req,sid,mediaId,body){only(body,['requestKey','expectedVersion']);return invoke(req,()=>service.recheck(req.user,sid,mediaId,body));}
 }
 Controller('sessions')(SessionMediaController);RequireStudyGroup()(SessionMediaController);RequireResearchProject()(SessionMediaController);
 RequireStudyGroupMenu('workbench')(SessionMediaController);RequireStudyGroupPermission('chat.use')(SessionMediaController);
 for(const[name,verb,path]of [['initialize',Post,':id/media-uploads'],['chunk',Post,':id/media-uploads/:uploadId/chunks/:index'],['complete',Post,':id/media-uploads/:uploadId/complete'],['snapshot',Get,':id/media-uploads/:uploadId'],['list',Get,':id/media'],['receipt',Get,':id/media/receipts/:requestKey'],['recheck',Post,':id/media/:mediaId/recheck']]){
  const p=SessionMediaController.prototype,d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);Req()(p,name,0);Param('id')(p,name,1);
  if(name==='initialize')Body()(p,name,2);else if(name==='list')Query()(p,name,2);
  else if(name==='receipt'){Param('requestKey')(p,name,2);Query()(p,name,3);}
  else{Param(name==='recheck'?'mediaId':'uploadId')(p,name,2);if(name==='chunk')Param('index')(p,name,3);else if(name==='snapshot')Query()(p,name,3);else Body()(p,name,3);}
 }
 class SessionMediaContentController{
  async content(req,sid,mediaId,res){
   const value=await invoke(req,()=>{
    only(req.query,[]);
    // Native video requests have no custom scope headers. This assembly is
    // restricted to exactly the configured synthetic project; ownSession and
    // every current permission are still checked by the same access service.
    return service.content({...req.user,studyGroupId:ids.group,researchProjectId:ids.project},sid,mediaId,req.headers.range);
   });
   res.status(value.status);res.set(value.headers);
   try{await pipeline(value.stream,res);}catch{if(!res.destroyed)res.destroy();}
  }
 }
 Controller('sessions')(SessionMediaContentController);
 const p=SessionMediaContentController.prototype,d=Object.getOwnPropertyDescriptor(p,'content');
 Get(':id/media/:mediaId/content')(p,'content',d);Req()(p,'content',0);Param('id')(p,'content',1);Param('mediaId')(p,'content',2);Res()(p,'content',3);
 return{Controllers:[SessionMediaController,SessionMediaContentController],service};
}
