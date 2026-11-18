import {fault,tokenHash} from './policy.mjs';

// Local WP02 adapter: every target keeps the original service and its authorization checks.
export function createInvitationRouter({tenantId,db,targets,makeService,resolveTarget,resolveInvitationTarget}){
  const key=(groupId,projectId)=>groupId+'|'+projectId;
  const services=new Map();
  for(const target of targets){
    if(target.tenantId!==tenantId||!target.groupId||!target.projectId||services.has(key(target.groupId,target.projectId)))throw new Error('WP02_INVITATION_TARGET_REJECTED');
    services.set(key(target.groupId,target.projectId),makeService(target));
  }
  const scoped=ctx=>{
    let service=services.get(key(ctx?.groupId,ctx?.projectId));
    if(!service&&resolveTarget)return Promise.resolve(resolveTarget(ctx?.groupId,ctx?.projectId)).then(target=>{if(target?.tenantId!==tenantId||target.groupId!==ctx?.groupId||target.projectId!==ctx?.projectId)throw fault('WP02_INVITATION_FORBIDDEN','当前账号没有此Study的成员邀请权限。',403);return makeService(target);});
    if(!service)throw fault('WP02_INVITATION_FORBIDDEN','当前账号没有此Study的成员邀请权限。',403);
    return service;
  };
  const byToken=async token=>{
    const hash=tokenHash(token);
    const rows=await db.transaction(tx=>tx.$queryRawUnsafe(
      'SELECT "studyGroupId","researchProjectId","targetRoleId",email FROM research_member_invitation WHERE "tenantId"=$1 AND "tokenHash"=$2',tenantId,hash,
    ));
    let service=null;
    if(rows.length===1){try{
      const row=rows[0],target=resolveInvitationTarget?await resolveInvitationTarget(row):null;
      if(target){if(target.tenantId!==tenantId||target.groupId!==row.studyGroupId||target.projectId!==row.researchProjectId||target.readerRoleId!==row.targetRoleId)throw fault('WP02_INVITATION_FORBIDDEN','邀请范围无法核对。',403);service=makeService(target);}
      else service=await scoped({groupId:row.studyGroupId,projectId:row.researchProjectId});
    }catch(e){if(e.status!==403)throw e;}}
    if(!service)throw fault('WP02_INVITATION_UNAVAILABLE','邀请不可用，请核对登录邮箱或联系邀请人。',404);
    return service;
  };
  const invoke=(ctx,method,...args)=>{const service=scoped(ctx);return service?.then?service.then(s=>s[method](ctx,...args)):service[method](ctx,...args);};
  return {
    context:ctx=>invoke(ctx,'context'),
    list:(ctx,input)=>invoke(ctx,'list',input),
    issue:(ctx,input)=>invoke(ctx,'issue',input),
    revoke:(ctx,id,input)=>invoke(ctx,'revoke',id,input),
    resend:(ctx,id,input)=>invoke(ctx,'resend',id,input),
    preview:async(ctx,input)=>(await byToken(input?.token)).preview(ctx,input),
    accept:async(ctx,input)=>(await byToken(input?.token)).accept(ctx,input),
  };
}
