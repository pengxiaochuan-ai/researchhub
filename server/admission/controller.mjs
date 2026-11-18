import {admissionException,fail,only} from './policy.mjs';
import {assertSessionOrigin} from '../auth/session.mjs';
export function createAdmissionGuard({reflector,service,HttpException}){
 return{async canActivate(ctx){
  if(reflector.getAllAndOverride('isPublic',[ctx.getHandler(),ctx.getClass()]))return true;
  const req=ctx.switchToHttp().getRequest();
  if(admissionException(req.method,req.path.replace(/\/$/,''),service.hubKey))return true;
  try{await service.assertApproved(req.user);return true;}catch(e){throw new HttpException({code:e.code??'HUB_ADMISSION_UNAVAILABLE',message:e.status?e.message:'加入审核暂时无法核对，请稍后重试。'},e.status??503);}
 }};
}
export function createAdmissionController({require,service,origin}){
 const {Controller,Get,Post,Req,Res,Body,Param,Query,HttpCode,HttpException}=require('@nestjs/common');
 const invoke=async(req,res,hub,input,op,args=[])=>{
  res.setHeader('Cache-Control','no-store');
  try{
   if(hub!==service.hubKey)fail(404,'HUB_ADMISSION_NOT_FOUND','未找到当前平台的申请。');
   if(req.method==='POST')only(req.query??{},[]);
   if(req.method==='POST')assertSessionOrigin(req,origin);
   if(Buffer.byteLength(JSON.stringify(input??{}))>8192)fail(413,'HUB_ADMISSION_INPUT_TOO_LARGE','本次输入过大，请减少内容。');
   if(req.method==='GET'&&!['list','operation'].includes(op))only(input??{},[]);
   return await service[op](req.user,...args,...(op==='self'||op==='detail'||op==='operation'?[]:[input]));
  }catch(e){throw new HttpException({code:e.code??'HUB_ADMISSION_UNAVAILABLE',message:e.status?e.message:'加入审核服务暂时不可用，请核对后重试。'},e.status??503);}
 };
 class AdmissionController{
  self(req,res,hub,q){return invoke(req,res,hub,q,'self');}
  submit(req,res,hub,b){return invoke(req,res,hub,b,'submit');}
  operation(req,res,hub,key,q){return invoke(req,res,hub,q,'operation',[key,q]);}
  list(req,res,hub,q){return invoke(req,res,hub,q,'list');}
  detail(req,res,hub,id,q){return invoke(req,res,hub,q,'detail',[id]);}
  decide(req,res,hub,id,b){return invoke(req,res,hub,b,'decide',[id]);}
 }
 Controller('hubs/:hubKey')(AdmissionController);
 for(const [method,verb,path,kind,param]of [['self',Get,'admission','query'],['submit',Post,'admission/submissions','body'],['operation',Get,'admission/operations/:requestKey','query','requestKey'],['list',Get,'admissions','query'],['detail',Get,'admissions/:applicationId','query','applicationId'],['decide',Post,'admissions/:applicationId/decisions','body','applicationId']]){
  const p=AdmissionController.prototype,d=Object.getOwnPropertyDescriptor(p,method);verb(path)(p,method,d);HttpCode(200)(p,method,d);Req()(p,method,0);Res({passthrough:true})(p,method,1);Param('hubKey')(p,method,2);if(param)Param(param)(p,method,3);(kind==='query'?Query():Body())(p,method,param?4:3);
 }
 return AdmissionController;
}
