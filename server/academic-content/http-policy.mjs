export function academicContentBodyRoute(path,method){return ['POST','PATCH'].includes(method)&&/^\/api\/hubs\/lingshu-xinyu\/content-management(?:\/[^/?]+(?:\/(?:publications|withdrawals))?)?$/.test(path);}
export function installAcademicContentBodyPolicy(app,{require}){
 const express=require(require.resolve('express',{paths:[require.resolve('@nestjs/platform-express/package.json')]})),parse=express.json({limit:256*1024,strict:true});
 app.use((req,res,next)=>academicContentBodyRoute(req.path,req.method)?parse(req,res,next):next(),(error,_req,res,next)=>{
  if(error?.type==='entity.too.large')return res.status(413).json({code:'CONTENT_INPUT_TOO_LARGE',message:'内容超过256KiB，请保留输入并减少本次内容。'});
  if(error?.type==='entity.parse.failed')return res.status(400).json({code:'CONTENT_INPUT_INVALID',message:'提交内容格式无效，请保留输入后重试。'});
  next(error);
 });
}
import {assertSessionOrigin} from '../auth/session.mjs';
export function assertAcademicContentOrigin(req,origin){
 const localSave=origin==='http://127.0.0.1:19501'&&req.method==='PATCH'&&/^\/api\/hubs\/lingshu-xinyu\/content-management\/[A-Za-z0-9_-]{1,160}$/.test(req.path??'')&&Object.keys(req.query??{}).length===0;
 // Only the F03 save verb differs; reuse every existing independent browser-proof check.
 return assertSessionOrigin(localSave?{method:'POST',headers:req.headers,socket:req.socket}:req,origin);
}
