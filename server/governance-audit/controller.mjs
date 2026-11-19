import {withFixtureTransaction} from '../database/transactions.mjs';
import {createGovernanceAudit} from './service.mjs';
export function createGovernanceAuditController({env,ids,require,load}){
 const {Controller,Get,Req,Res,Param,Query,HttpException}=require('@nestjs/common');
 const service=createGovernanceAudit({normalize:load('audit/sensitive-audit-policy','normalizeAuditEvidence'),transact:(p,cb)=>{
  if(p?.tenantId!==ids.tenant)throw Object.assign(Error('当前账号无权查看租户审计日志。'),{status:403,code:'HUB_AUDIT_FORBIDDEN'});
  // Mirrors the legacy audit's fixed-tenant elevated minimum read; never grants app audit SELECT.
  return withFixtureTransaction(env,'direct',tx=>cb(tx),{readOnly:true});
 }});
 class GovernanceAuditController{}
 Controller('governance-audit')(GovernanceAuditController);
 for(const[name,path]of [['list',''],['detail',':id']]){
  GovernanceAuditController.prototype[name]=async(req,res,params,query)=>{res.setHeader('Cache-Control','private, no-store');try{return await(name==='list'?service.list(req.user,query):service.detail(req.user,params.id));}catch(e){if(e instanceof HttpException)throw e;throw new HttpException({code:e.status?e.code:'HUB_AUDIT_UNAVAILABLE',message:e.status?e.message:'审计记录暂时无法读取，请重试。'},e.status??503);}};
  const p=GovernanceAuditController.prototype;Get(path)(p,name,Object.getOwnPropertyDescriptor(p,name));[Req(),Res({passthrough:true}),Param(),Query()].forEach((f,i)=>f(p,name,i));
 }
 return GovernanceAuditController;
}
