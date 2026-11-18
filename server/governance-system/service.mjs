const labels={account:'账号登录',email:'账号邮件',parser:'文档解析',vector:'向量检索',ai:'科研 AI'};
const fail=(status,code,message)=>Object.assign(Error(message),{status,code});
export function projectServiceStates(state,now=new Date()){
 return Object.entries(labels).map(([key,label])=>{
  const source=state?.[key],configuration=source?.configured===true?'configured':source?.configured===false?'missing':'unknown';
  const at=typeof source?.check?.checkedAt==='string'?new Date(source.check.checkedAt):null;
  const valid=configuration==='configured'&&['passed','failed'].includes(source?.check?.status)&&at&&Number.isFinite(at.getTime())&&at<=now;
  return{key,label,configuration,check:valid?{status:source.check.status,checkedAt:at.toISOString()}:{status:'unknown',checkedAt:null}};
 });
}
export function createGovernanceSystem({tenantId,transact,readState,now=()=>new Date()}){
 async function current(tx,p){
  if(!p||p.tenantId!==tenantId||typeof p.accountId!=='string'||!Number.isInteger(p.authVersion)||p.role!=='tenant_admin')throw fail(403,'HUB_SYSTEM_FORBIDDEN','当前账号无权查看系统配置。');
  const a=await tx.account.findFirst({where:{id:p.accountId,tenantId,status:'active',tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true,authVersion:true,status:true,tenant:{select:{status:true}}}});
  if(!a||a.id!==p.accountId||a.role!=='tenant_admin'||!a.isTenantAdmin||a.authVersion!==p.authVersion||a.status!=='active'||a.tenant?.status!=='active')throw fail(403,'HUB_SYSTEM_FORBIDDEN','当前账号无权查看系统配置。');
 }
 return{async status(p,query={}){
  if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length)throw fail(400,'HUB_SYSTEM_QUERY_INVALID','查询条件无效。');
  return transact(async tx=>{
   await current(tx,p);let state,failed=false;
   try{state=await readState();}catch{failed=true;}
   await current(tx,p);
   if(failed)throw fail(503,'HUB_SYSTEM_UNAVAILABLE','服务状态暂时无法读取，请重试。');
   const at=now();return{schema:'hub-system-status.v1',observedAt:at.toISOString(),services:projectServiceStates(state,at)};
  });
 }};
}
