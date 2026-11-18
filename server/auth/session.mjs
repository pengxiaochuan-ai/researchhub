import {randomUUID} from 'node:crypto';
export const SESSION_SECONDS=12*60*60;
export const sessionError=(status,message)=>Object.assign(new Error(message),{status});
const unauthorized=()=>{throw sessionError(401,'登录会话已失效，请重新登录。');};
export function sessionCookie(session,{secure}){return{httpOnly:true,sameSite:'lax',secure,path:'/api',...(session?{expires:new Date(session.expiresAt)}:{})};}
export function readSessionToken(req,cookieName){const h=req.headers??{},bearer=h.authorization;if(typeof bearer==='string'&&bearer.startsWith('Bearer '))return bearer.slice(7);const matches=String(h.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));if(matches.length!==1)return '';try{return decodeURIComponent(matches[0].slice(cookieName.length+1));}catch{return '';}}
function verifiedLocalSessionBrowser(req,origin){
 const h=req.headers??{};
 if(origin!=='http://127.0.0.1:19501'||h.origin!=='http://127.0.0.1'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||['forwarded','x-forwarded-host','x-forwarded-proto'].some(k=>Object.hasOwn(h,k)))return false;
 if(req.method!=='POST'||h['sec-fetch-site']!=='same-origin'||h['sec-fetch-mode']!=='same-origin'||h['sec-fetch-dest']!=='empty'||h['x-researchhub-request']!=='session-v1')return false;
 try{const page=new URL(h.referer);return page.origin===origin&&!page.username&&!page.password;}catch{return false;}
}
export function assertSessionOrigin(req,origin){if(req.headers?.origin!==origin&&!verifiedLocalSessionBrowser(req,origin)||!/^application\/json(?:\s*;.*)?$/i.test(req.headers?.['content-type']??'')||req.headers?.['sec-fetch-site']==='cross-site')throw Object.assign(sessionError(403,'请从当前站点操作登录会话。'),{code:'AUTH_ORIGIN_REJECTED'});}
export function createHubSession({jwt,scope,transaction,lockAuthorization=async()=>{},now=Date.now}){
 if(scope.product!=='researchhub'||!scope.deploymentId)throw Error('RESEARCHHUB_SESSION_SCOPE_REQUIRED');
 async function decode(token){if(!token)unauthorized();let p;try{p=await jwt.verifyAsync(token,{algorithms:['HS256'],clockTimestamp:Math.floor(now()/1000)});}catch{unauthorized();}if(p.hubDeployment!==scope.deploymentId||typeof p.hubSessionId!=='string'||!/^rh-session-[a-f0-9-]{36}$/.test(p.hubSessionId)||!Number.isInteger(p.exp)||p.exp<=Math.floor(now()/1000))unauthorized();return p;}
 async function active(tx,p){if(typeof p.accountId!=='string'||!scope.allowedTenantIds.includes(p.tenantId)||!Number.isInteger(p.authVersion))unauthorized();const a=await tx.account.findFirst({where:{id:p.accountId,tenantId:p.tenantId},select:{id:true,tenantId:true,username:true,role:true,isTenantAdmin:true,status:true,authVersion:true,tenant:{select:{status:true}}}});if(!a||a.status!=='active'||a.tenant?.status!=='active'||a.authVersion!==p.authVersion)unauthorized();if(p.hubSessionId&&await tx.auditLog.findFirst({where:{tenantId:a.tenantId,accountId:a.id,action:'researchhub.session.logout',target:p.hubSessionId},select:{id:true}}))unauthorized();return{accountId:a.id,tenantId:a.tenantId,username:a.username,role:a.role,isTenantAdmin:a.isTenantAdmin,authVersion:a.authVersion};}
 async function transact(p,mutate,fn){if(typeof p.accountId!=='string'||!scope.allowedTenantIds.includes(p.tenantId)||!Number.isInteger(p.authVersion))unauthorized();try{return await transaction(async tx=>{if(mutate)await lockAuthorization(tx,p.tenantId);const user=await active(tx,p);if(p.hubSessionId&&p.exp<=Math.floor(now()/1000))unauthorized();return fn(tx,user);});}catch(e){if(e.status)throw e;throw sessionError(503,'认证服务暂时不可用，请保留输入并重试。');}}
 async function sign(user,id){const iat=Math.floor(now()/1000),exp=iat+SESSION_SECONDS;return{token:await jwt.signAsync({...user,sub:user.accountId,hubSessionId:id,hubDeployment:scope.deploymentId,iat},{algorithm:'HS256',expiresIn:SESSION_SECONDS}),expiresAt:exp*1000};}
 return Object.freeze({
  async issue(claims){return transact(claims,true,(_tx,user)=>sign(user,'rh-session-'+randomUUID()));},
  async authenticate(token){const p=await decode(token);return transact(p,false,(_tx,user)=>user);},
  async renew(token){const p=await decode(token);return transact(p,true,(_tx,user)=>sign(user,p.hubSessionId));},
  async logout(token){const p=await decode(token);return transact(p,true,async(tx,user)=>{await tx.auditLog.create({data:{tenantId:user.tenantId,accountId:user.accountId,action:'researchhub.session.logout',target:p.hubSessionId,meta:{deploymentId:scope.deploymentId,expiresAt:p.exp*1000}}});return{ok:true};});},
 });
}
