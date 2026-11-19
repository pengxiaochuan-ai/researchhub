import {createHubSession,readSessionToken,assertSessionOrigin,sessionCookie,sessionError} from './session.mjs';
// ResearchHub owns its HTTP/guard policy; the old authentication service stays unchanged.
export function createHubAuth({require,load,jwt,prisma,scope,cookieName,origin,secureCookie,profileProjection=async p=>p}){
 const {Controller,Get,Post,Req,Res,Body,HttpCode,HttpException,SetMetadata}=require('@nestjs/common');
 if(new URL(origin).origin!==origin||(!origin.startsWith('https://')&&!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)))throw Error('RESEARCHHUB_SESSION_ORIGIN_REQUIRED');
 const session=createHubSession({jwt,scope,transaction:fn=>prisma.elevated.$transaction(fn),lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')}),auth=new(load('auth/auth.service','AuthService'))(prisma,jwt,scope);
 const invoke=async(res,fn)=>{res.setHeader('Cache-Control','no-store');try{return await fn();}catch(e){if(e instanceof HttpException)throw e;throw new HttpException({code:e.code==='AUTH_ORIGIN_REJECTED'?e.code:e.status===401?'AUTH_SESSION_EXPIRED':e.status===403?'AUTH_FORBIDDEN':'AUTH_UNAVAILABLE',message:e.status?e.message:'认证服务暂时不可用，请重试。'},e.status??503);}};
 const isSecure=req=>origin.startsWith('https://')||secureCookie(req);
 const setCookie=(req,res,value)=>res.cookie(cookieName,value.token,sessionCookie(value,{secure:isSecure(req)}));
 class HubAuthController{}
 Controller('auth')(HubAuthController);
 for(const [name,verb,publicRoute]of [['login',Post,true],['logout',Post,true],['renew',Post,true],['me',Get,false]]){
  HubAuthController.prototype[name]=function(req,res,body){return invoke(res,async()=>{
   if(name==='me')return {...await profileProjection(await auth.me(req.user),req.user),authVersion:req.user.authVersion};
   assertSessionOrigin(req,origin);
   if(name==='login'){
    if(!body||Object.keys(body).some(x=>!['tenantSlug','username','password'].includes(x))||['tenantSlug','username','password'].some(x=>typeof body[x]!=='string'||!body[x])||body.tenantSlug.length>160||body.username.length>320||body.password.length>64)throw sessionError(400,'请填写有效的账号和密码。');
    const result=await auth.login(body),claims=await jwt.verifyAsync(result.token),value=await session.issue(claims);setCookie(req,res,value);return{user:await profileProjection(result.user,claims),expiresAt:value.expiresAt};
   }
   if(body&&Object.keys(body).length)throw sessionError(400,'会话请求不接受额外字段。');
   const token=readSessionToken(req,cookieName);
   if(name==='renew'){const value=await session.renew(token);setCookie(req,res,value);return{ok:true,expiresAt:value.expiresAt};}
   try{if(token)await session.logout(token);}catch(e){if(e.status!==401)throw e;}
   res.clearCookie(cookieName,sessionCookie(null,{secure:isSecure(req)}));return{ok:true};
  });};
  const d=Object.getOwnPropertyDescriptor(HubAuthController.prototype,name);verb(name)(HubAuthController.prototype,name,d);HttpCode(name==='login'?201:200)(HubAuthController.prototype,name,d);Req()(HubAuthController.prototype,name,0);Res({passthrough:true})(HubAuthController.prototype,name,1);if(name!=='me')Body()(HubAuthController.prototype,name,2);if(publicRoute)SetMetadata('isPublic',true)(HubAuthController.prototype,name,d);
 }
 const guard=reflector=>({async canActivate(ctx){if(reflector.getAllAndOverride('isPublic',[ctx.getHandler(),ctx.getClass()]))return true;const req=ctx.switchToHttp().getRequest(),res=ctx.switchToHttp().getResponse();return invoke(res,async()=>{req.user=await session.authenticate(readSessionToken(req,cookieName));if(reflector.getAllAndOverride('controlPlane',[ctx.getHandler(),ctx.getClass()])&&(!scope.controlPlaneEnabled||req.user.role!=='platform_admin'))throw sessionError(403,'无权访问控制面');return true;});}});
 return{Controller:HubAuthController,guard,session};
}
