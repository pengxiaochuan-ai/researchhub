import {createHash} from 'node:crypto';
import {setContext} from '../research-studies/repository.mjs';
import {changeAccountStatus} from './account-status.mjs';
import {readAccountReceipt} from './account-receipt.mjs';
import {inspectAccountBlockers} from './account-blockers.mjs';
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code});};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const admin=a=>a?.role==='tenant_admin'&&a.isTenantAdmin===true;
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(x);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const columns={id:true,displayName:true,username:true,status:true,role:true,isTenantAdmin:true,updatedAt:true,authVersion:true};
export function createGovernanceUsers({transact,legacyUpdate,legacyChangeMember,assertMutationScope=()=>{},canMutate=()=>true}){
 async function current(tx,p,requireAdmin=false){
  await setContext(tx,p);
  const a=await tx.account.findFirst({where:{id:p.accountId,tenantId:p.tenantId,status:'active',authVersion:p.authVersion,tenant:{status:'active'}},select:columns});
  if(!a||requireAdmin&&!admin(a))fail(403,'HUB_USERS_FORBIDDEN','当前账号无权执行此操作。');return a;
 }
 async function boundary(tx,p,gid,pid){
  const a=await current(tx,p);if(!id(gid)||!id(pid))fail(400,'HUB_USERS_SCOPE_INVALID','请选择有效研究。');await setContext(tx,p,gid,pid);
  const [g,project,gm,pm]=await Promise.all([
   tx.studyGroup.findFirst({where:{id:gid,tenantId:p.tenantId,status:'active'},select:{id:true,name:true}}),
   tx.researchProject.findFirst({where:{id:pid,tenantId:p.tenantId,studyGroupId:gid,status:'active'},select:{id:true,name:true}}),
   tx.studyGroupMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:gid,accountId:p.accountId,status:'active',role:{status:'active'}},include:{role:true}}),
   tx.researchProjectMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:gid,researchProjectId:pid,accountId:p.accountId,status:'active'}}),
  ]);
  if(!g||!project||!admin(a)&&!(pm?.roleKey==='project_manager'&&gm?.role?.menuPermissions?.includes('group_admin')&&gm?.role?.buttonPermissions?.includes('member.manage')))
   fail(403,'HUB_MEMBERS_FORBIDDEN','当前账号没有此研究的成员管理权限。');
  return{actor:a,group:g,project};
 }
 function present(a,actor){return{id:a.id,displayName:a.displayName,email:a.username,status:a.status,isTenantAdmin:a.isTenantAdmin,version:a.updatedAt.toISOString(),canChangeStatus:canMutate('account',a.id)&&a.id!==actor.id&&a.role!=='platform_admin'};}
 async function identities(tx,p,rows){
  const levels=await tx.$queryRawUnsafe('SELECT id, CASE WHEN "researchProfileEstablishedAt" IS NOT NULL THEN \'L1\' ELSE \'L0\' END AS level FROM public.account WHERE "tenantId"=$1 AND id IN(SELECT jsonb_array_elements_text($2::jsonb))',p.tenantId,JSON.stringify(rows.map(a=>a.id)));
  const byId=new Map(levels.map(x=>[x.id,x.level]));return rows.map(a=>({...a,identityLevel:byId.get(a.id)??null}));
 }
 return{
  accounts:(p,q={})=>transact(p,async tx=>{
   const actor=await current(tx,p,true);if(Object.keys(q).some(k=>!['q','page','status'].includes(k))||q.q!==undefined&&(typeof q.q!=='string'||q.q.length>200)||q.status&&!['active','disabled'].includes(q.status))fail(400,'HUB_USERS_QUERY_INVALID','查询条件无效。');
   const page=Number(q.page??1);if(!Number.isSafeInteger(page)||page<1||page>100000)fail(400,'HUB_USERS_QUERY_INVALID','页码无效。');
   const where={tenantId:p.tenantId,...(q.status?{status:q.status}:{}),...(q.q?{OR:[{displayName:{contains:q.q,mode:'insensitive'}},{username:{contains:q.q,mode:'insensitive'}}]}:{})};
   const [items,total]=await Promise.all([tx.account.findMany({where,select:columns,orderBy:[{displayName:'asc'},{id:'asc'}],skip:(page-1)*20,take:20}),tx.account.count({where})]);
   return{items:await identities(tx,p,items.map(a=>present(a,actor))),page,total};
  }),
  detail:(p,accountId)=>transact(p,async tx=>{const actor=await current(tx,p,true);if(!id(accountId))fail(400,'HUB_USERS_INPUT_INVALID','账号标识无效。');const a=await tx.account.findFirst({where:{id:accountId,tenantId:p.tenantId},select:columns});if(!a)fail(404,'HUB_ACCOUNT_NOT_FOUND','账号不存在。');const view=(await identities(tx,p,[present(a,actor)]))[0];return{...view,disableBlockers:view.canChangeStatus&&a.status==='active'?await inspectAccountBlockers(tx,p,a):[]};}),
  status:(p,input)=>transact(p,async tx=>{await assertMutationScope('account',input.targetAccountId);return changeAccountStatus({db:tx,principal:p,input,legacyUpdate,inspectBlockers:inspectAccountBlockers});}),
  receipt:(p,requestKey)=>transact(p,async tx=>{await current(tx,p,true);const result=await readAccountReceipt({db:tx,principal:p,requestKey});if(!result)fail(404,'HUB_ACCOUNT_RECEIPT_NOT_FOUND','未查到原操作结果，请核对后重试原操作。');return result;}),
  studies:p=>transact(p,async tx=>{
   await current(tx,p);const groups=await tx.studyGroup.findMany({where:{tenantId:p.tenantId,status:'active'},select:{id:true},take:1001});if(groups.length>1000)throw Error('HUB_USERS_SCOPE_LIMIT');const items=[];
   for(const g of groups){await setContext(tx,p,g.id);const projects=await tx.researchProject.findMany({where:{tenantId:p.tenantId,studyGroupId:g.id,status:'active'},select:{id:true},take:1001});if(projects.length>1000)throw Error('HUB_USERS_SCOPE_LIMIT');for(const project of projects){try{const b=await boundary(tx,p,g.id,project.id);items.push({studyGroupId:g.id,researchProjectId:project.id,name:b.project.name,groupName:b.group.name});}catch(e){if(e.code!=='HUB_MEMBERS_FORBIDDEN')throw e;}}}
   return{items};
  }),
  members:(p,gid,pid)=>transact(p,async tx=>{
   const b=await boundary(tx,p,gid,pid);
   const groups=await tx.studyGroupMembership.findMany({where:{tenantId:p.tenantId,studyGroupId:gid,status:'active',account:{status:'active'},role:{status:'active'}},select:{accountId:true,account:{select:{displayName:true,username:true}}},take:1001});if(groups.length>1000)throw Error('HUB_USERS_SCOPE_LIMIT');
   const rows=await tx.researchProjectMembership.findMany({where:{tenantId:p.tenantId,studyGroupId:gid,researchProjectId:pid},take:1001});if(rows.length>1000)throw Error('HUB_USERS_SCOPE_LIMIT');const byId=new Map(rows.map(r=>[r.accountId,r]));
   return{group:b.group,project:b.project,canMaintain:canMutate('member',pid),items:groups.map(g=>{const m=byId.get(g.accountId);return{accountId:g.accountId,displayName:g.account.displayName,email:g.account.username,roleKey:m?.roleKey??'researcher',status:m?.status??'not_assigned',version:m?.updatedAt.toISOString()??null};}),roleOptions:['project_manager','researcher','data_manager']};
  }),
  memberReceipt:(p,gid,pid,requestKey)=>transact(p,async tx=>{
   await boundary(tx,p,gid,pid);if(!key(requestKey))fail(400,'HUB_MEMBERS_INPUT_INVALID','操作标识无效。');
   const rows=await tx.auditLog.findMany({where:{tenantId:p.tenantId,researchProjectId:pid,accountId:p.accountId,action:'pi_project_member_change',meta:{path:['hubRequestKey'],equals:requestKey}},select:{meta:true},take:2});
   if(rows.length!==1||!rows[0].meta?.hubResult)fail(rows.length?503:404,'HUB_MEMBERS_RECEIPT_NOT_FOUND','未查到可确认的原操作结果，请重新核对。');return rows[0].meta.hubResult;
  }),
  changeMember:(p,gid,pid,accountId,input)=>transact(p,async tx=>{
   await assertMutationScope('member',pid);await boundary(tx,p,gid,pid);
   if(!id(accountId)||!input||Object.keys(input).sort().join(',')!=='expectedVersion,reason,requestKey,roleKey,status'||!key(input.requestKey)||!['project_manager','researcher','data_manager'].includes(input.roleKey)||!['active','disabled'].includes(input.status)||typeof input.reason!=='string'||input.reason.trim().length<1||input.reason.length>500)fail(400,'HUB_MEMBERS_INPUT_INVALID','请核对成员角色及变更说明。');
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${p.tenantId+':'+pid},0))`;
   const hash=digest([gid,pid,accountId,input.expectedVersion,input.roleKey,input.status,input.reason.trim()]);
   const prior=await tx.auditLog.findMany({where:{tenantId:p.tenantId,researchProjectId:pid,accountId:p.accountId,action:'pi_project_member_change',meta:{path:['hubRequestKey'],equals:input.requestKey}},select:{meta:true},take:2});
   if(prior.length){if(prior.length!==1||prior[0].meta.hubRequestHash!==hash)fail(409,'HUB_MEMBERS_REQUEST_CONFLICT','原操作内容已变化，请重新核对。');return prior[0].meta.hubResult;}
   const existing=await tx.researchProjectMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:gid,researchProjectId:pid,accountId}});
   if((existing?.updatedAt.toISOString()??null)!==input.expectedVersion)fail(409,'HUB_MEMBERS_VERSION_CONFLICT','成员资料已变化，请刷新核对后重试。');
   if(existing?.roleKey==='project_manager'&&existing.status==='active'&&(input.roleKey!=='project_manager'||input.status!=='active')){
    const count=await tx.researchProjectMembership.count({where:{tenantId:p.tenantId,studyGroupId:gid,researchProjectId:pid,status:'active',roleKey:'project_manager',accountId:{not:accountId},account:{status:'active',studyGroupMemberships:{some:{tenantId:p.tenantId,studyGroupId:gid,status:'active',role:{status:'active'}}}}}});
    if(!count)fail(409,'HUB_MEMBERS_LAST_MANAGER','请保留至少一位有效研究负责人。');
   }
   const bound=new Proxy(tx,{get(t,k){if(k!=='auditLog')return t[k];return new Proxy(t.auditLog,{get(model,method){if(method!=='create')return model[method];return async args=>{const result=await tx.researchProjectMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:gid,researchProjectId:pid,accountId},select:{accountId:true,roleKey:true,status:true,updatedAt:true}});return model.create({...args,data:{...args.data,researchProjectId:pid,meta:{...args.data.meta,hubRequestKey:input.requestKey,hubRequestHash:hash,hubResult:{...result,updatedAt:result.updatedAt.toISOString()}}}});};}});}});
   await legacyChangeMember(bound,{...p,studyGroupId:gid,researchProjectId:pid},accountId,{roleKey:input.roleKey,status:input.status,reason:input.reason.trim()});
   const saved=await tx.auditLog.findFirst({where:{tenantId:p.tenantId,researchProjectId:pid,accountId:p.accountId,action:'pi_project_member_change',meta:{path:['hubRequestKey'],equals:input.requestKey}},select:{meta:true}});if(!saved)throw Error('HUB_MEMBERS_RECEIPT_NOT_WRITTEN');return saved.meta.hubResult;
  }),
 };
}
