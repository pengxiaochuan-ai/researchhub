import {isHubSession} from '../../scripts/hub-agent-contract.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status,publicMessage:message,code:'HUB_HISTORY_ACTION_INVALID'});};
export function historyActionInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('会话操作无效');
 const keys=Object.keys(body);
 if(body.action==='rename'&&keys.length===2&&keys.includes('title')&&typeof body.title==='string'){
  const title=body.title.trim();if(!title||[...title].length>100||/[\u0000-\u001f\u007f]/u.test(title))fail('请输入1–100字的会话名称');return{title};
 }
 if(body.action==='pin'&&keys.length===2&&typeof body.pinned==='boolean')return{pinned:body.pinned};
 if(body.action==='delete'&&keys.length===1)return{deletedAt:new Date()};
 fail('会话操作参数无效');
}
export function createHistoryActions({transaction,authorize,agentId}){return async(user,sid,body)=>{
 const data=historyActionInput(body);if(!/^[A-Za-z0-9_-]{1,160}$/.test(sid??''))fail('会话不存在',404);
 return transaction(async tx=>{
  await authorize(tx,user,sid);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sid},0))`;
  const where={id:sid,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId,channel:'knowledge',deletedAt:null};
  const session=await tx.session.findFirst({where});if(!session||!isHubSession(session))fail('会话不存在或无权操作',404);
  const changed=await tx.session.updateMany({where,data});if(changed.count!==1)fail('会话已变化，请刷新后核对',409);
  await tx.auditLog.create({data:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,action:'hub_session_'+body.action,target:sid}});
  return{id:sid,...(body.action==='delete'?{deleted:true}:data)};
 },user);
};}
