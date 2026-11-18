import {assertSessionOrigin} from '../auth/session.mjs';
/** Registers separately from ResearchStudiesController; application global session guard remains required. */
export function createVisitFilesController({require,origin,uploads,files}){
 const {Controller,Get,Post,Req,Res,Body,Param,Query,HttpCode,HttpException}=require('@nestjs/common');
 class VisitFilesController{}Controller('research-studies/:studyId/visits/:visitId/files')(VisitFilesController);const p=VisitFilesController.prototype;
 const run=async(res,fn)=>{res.setHeader('Cache-Control','no-store');try{return await fn();}catch(e){if(e instanceof HttpException)throw e;if(e.code==='AUTH_ORIGIN_REJECTED')throw new HttpException({code:e.code,message:'请从当前站点提交。'},403);if(e.status)throw new HttpException({code:e.code??'RESEARCH_UNAVAILABLE',message:e.message},e.status);throw new HttpException({code:'FILE_SERVICE_UNAVAILABLE',message:'文件服务暂时不可用，请保留输入并重试。'},503);}};
 p.list=function(req,res,params,query){return run(res,()=>files.list(req.user,params.studyId,params.visitId,query));};
 p.upload=function(req,res,body,params){return run(res,async()=>{assertSessionOrigin(req,origin);return uploads.upload(req.user,params.studyId,params.visitId,body);});};
 p.receipt=function(req,res,params){return run(res,()=>uploads.receipt(req.user,params.studyId,params.visitId,params.requestKey));};
 for(const [name,verb,path] of [['list',Get,''],['upload',Post,'preprocessed'],['receipt',Get,'receipts/:requestKey']]){const d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);HttpCode(200)(p,name,d);Req()(p,name,0);Res({passthrough:true})(p,name,1);if(name==='upload'){Body()(p,name,2);Param()(p,name,3);}else{Param()(p,name,2);if(name==='list')Query()(p,name,3);}}
 return VisitFilesController;
}
