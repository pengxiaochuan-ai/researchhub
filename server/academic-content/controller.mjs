import {fail,only} from './policy.mjs';
import {assertAcademicContentOrigin} from './http-policy.mjs';
export function createAcademicContentControllers({require,service,origin}){
 const {Controller,Get,Post,Patch,Req,Res,Body,Param,Query,HttpCode,HttpException,SetMetadata}=require('@nestjs/common');
 async function invoke(req,res,hub,input,fn,{write=false,member=false}={}){
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  try{
   if(hub!==service.hubKey)fail(404,'CONTENT_NOT_FOUND','内容不存在或当前不可访问。');
   if(member&&!req.user)fail(401,'AUTH_SESSION_EXPIRED','请先登录。');
   if(write){only(req.query??{},[]);assertAcademicContentOrigin(req,origin);}
   if(Buffer.byteLength(JSON.stringify(input??{}))>256*1024)fail(413,'CONTENT_INPUT_TOO_LARGE','内容过长，请保留输入并减少本次内容。');
   return await fn();
  }catch(e){const known=Number.isInteger(e.status)&&e.status>=400&&e.status<500;throw new HttpException({code:known?e.code??'CONTENT_REQUEST_REJECTED':'CONTENT_UNAVAILABLE',message:known?e.message:'内容服务暂不可用，请保留输入后核对。'},known?e.status:503);}
 }
 function readController(prefix,publicRead){
  class ReadingController{
   list(req,res,hub,q){return invoke(req,res,hub,q,()=>service.list(publicRead?null:req.user,q),{member:!publicRead});}
   detail(req,res,hub,id,q){return invoke(req,res,hub,q,()=>{only(q??{},[]);return service.detail(publicRead?null:req.user,id);},{member:!publicRead});}
   resource(req,res,hub,id,key,q){return invoke(req,res,hub,q,async()=>{only(q??{},[]);const result=await service.resource(publicRead?null:req.user,id,key);return res.redirect(302,result.url);},{member:!publicRead});}
  }
  Controller(prefix)(ReadingController);
  for(const [name,path]of [['list',''],['detail',':id'],['resource',':id/resources/:key']]){
   const p=ReadingController.prototype,d=Object.getOwnPropertyDescriptor(p,name);Get(path)(p,name,d);Req()(p,name,0);Res({passthrough:name!=='resource'})(p,name,1);Param('hubKey')(p,name,2);
   if(name!=='list')Param('id')(p,name,3);if(name==='resource')Param('key')(p,name,4);Query()(p,name,name==='list'?3:name==='detail'?4:5);if(publicRead)SetMetadata('isPublic',true)(p,name,d);
  }
  return ReadingController;
 }
 class ManagementController{
  list(req,res,hub,q){return invoke(req,res,hub,q,()=>service.adminList(req.user,q),{member:true});}
  create(req,res,hub,b){return invoke(req,res,hub,b,()=>service.create(req.user,b),{write:true,member:true});}
  createOperation(req,res,hub,key,q){return invoke(req,res,hub,q,()=>service.operation(req.user,null,key,q),{member:true});}
  detail(req,res,hub,id,q){return invoke(req,res,hub,q,()=>{only(q??{},[]);return service.adminDetail(req.user,id);},{member:true});}
  save(req,res,hub,id,b){return invoke(req,res,hub,b,()=>service.save(req.user,id,b),{write:true,member:true});}
  publish(req,res,hub,id,b){return invoke(req,res,hub,b,()=>service.publish(req.user,id,b),{write:true,member:true});}
  withdraw(req,res,hub,id,b){return invoke(req,res,hub,b,()=>service.withdraw(req.user,id,b),{write:true,member:true});}
  operation(req,res,hub,id,key,q){return invoke(req,res,hub,q,()=>service.operation(req.user,id,key,q),{member:true});}
  history(req,res,hub,id,q){return invoke(req,res,hub,q,()=>{only(q??{},[]);return service.history(req.user,id);},{member:true});}
 }
 Controller('hubs/:hubKey/content-management')(ManagementController);
 for(const [name,verb,path,body,params]of [['list',Get,'',false,[]],['create',Post,'',true,[]],['createOperation',Get,'operations/:requestKey',false,['requestKey']],['detail',Get,':id',false,['id']],['save',Patch,':id',true,['id']],['publish',Post,':id/publications',true,['id']],['withdraw',Post,':id/withdrawals',true,['id']],['operation',Get,':id/operations/:requestKey',false,['id','requestKey']],['history',Get,':id/history',false,['id']]]){
  const p=ManagementController.prototype,d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);HttpCode(200)(p,name,d);Req()(p,name,0);Res({passthrough:true})(p,name,1);Param('hubKey')(p,name,2);params.forEach((key,i)=>Param(key)(p,name,3+i));(body?Body():Query())(p,name,3+params.length);
 }
 return[readController('public/hubs/:hubKey/academic-content',true),readController('hubs/:hubKey/academic-content',false),ManagementController];
}
