// Shared Hub rule: current tenant administrators do not need duplicate Study
// memberships. Each business service still rechecks its real objects and state.
export function createHubStudyScopeGuard({native,reflector,prisma,load,allowedTenantIds}){
 const groupHeader=load('common/study-group-context','requireStudyGroupHeader');
 const projectHeader=load('common/research-project-context','requireResearchProjectHeader');
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 return{async canActivate(ctx){
  const targets=[ctx.getHandler(),ctx.getClass()];
  const required=reflector.getAllAndOverride('requireStudyGroup',targets);
  const request=ctx.switchToHttp().getRequest(),user=request.user;
  if(!required||user?.role!=='tenant_admin')return native.canActivate(ctx);
  if(!allowedTenantIds.includes(user.tenantId)||!Number.isSafeInteger(user.authVersion))return false;
  const groupId=groupHeader(request.headers['x-study-group-id']);
  const requiresProject=reflector.getAllAndOverride('requireResearchProject',targets)===true;
  const projectId=requiresProject||request.headers['x-research-project-id']!==undefined?projectHeader(request.headers['x-research-project-id']):undefined;
  const authorized=await prisma.elevated.$transaction(async tx=>{
   await lock(tx,user.tenantId,{includeOfficial:true});
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId,authVersion:user.authVersion,status:'active',role:'tenant_admin',isTenantAdmin:true,tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true}});
   if(account?.role!=='tenant_admin'||account.isTenantAdmin!==true)return false;
   const group=await tx.studyGroup.findFirst({where:{id:groupId,tenantId:user.tenantId,status:'active'},select:{id:true}});
   if(!group)return false;
   if(projectId&&!await tx.researchProject.findFirst({where:{id:projectId,tenantId:user.tenantId,studyGroupId:groupId,status:'active'},select:{id:true}}))return false;
   return true;
  },{maxWait:5000,timeout:10000});
  if(!authorized)return false;
  user.studyGroupId=groupId;user.studyGroupRoleKey='tenant_admin';
  if(projectId){user.researchProjectId=projectId;user.researchProjectRoleKey='project_manager';}
  else{delete user.researchProjectId;delete user.researchProjectRoleKey;}
  return true;
 }};
}
