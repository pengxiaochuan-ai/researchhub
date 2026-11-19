const denied=()=>{throw Object.assign(Error('当前身份已变化，请重新登录。'),{status:401,code:'AUTH_SESSION_EXPIRED'});};
// Presentation of the existing tenant-admin default authority, not a membership
// or role grant. The backend still rechecks the true parent and current account.
export function runtimeProfileProjection({prisma,scope,lockAuthorization}){
 return async(profile,principal)=>{
  if(!profile||profile.accountId!==principal.accountId||profile.tenantId!==principal.tenantId||!scope.allowedTenantIds.includes(principal.tenantId))denied();
  if(profile.role!=='tenant_admin'||profile.isTenantAdmin!==true)return profile;
  return prisma.elevated.$transaction(async tx=>{
   await lockAuthorization(tx,principal.tenantId,{includeOfficial:true});
   const account=await tx.account.findFirst({where:{id:principal.accountId,tenantId:principal.tenantId,status:'active',authVersion:principal.authVersion,role:'tenant_admin',isTenantAdmin:true,tenant:{status:'active'}},select:{id:true}});if(!account)denied();
   const groups=await tx.studyGroup.findMany({where:{tenantId:principal.tenantId,status:'active'},select:{id:true,name:true,slug:true,tenantId:true},orderBy:[{createdAt:'asc'},{id:'asc'}]});
   const projects=await tx.researchProject.findMany({where:{tenantId:principal.tenantId,status:'active',studyGroup:{tenantId:principal.tenantId,status:'active'}},select:{id:true,code:true,name:true,description:true,studyGroupId:true,tenantId:true},orderBy:[{createdAt:'asc'},{id:'asc'}]});
   if(groups.some(g=>g.tenantId!==principal.tenantId)||projects.some(p=>p.tenantId!==principal.tenantId||!groups.some(g=>g.id===p.studyGroupId)))denied();
   return{...profile,studyGroups:groups.map((g,index)=>({id:g.id,name:g.name,slug:g.slug,isDefault:index===0,role:{key:'tenant_admin',name:'租户管理员',menuPermissions:['*'],buttonPermissions:['*'],dataScope:'tenant'},researchProjects:projects.filter(p=>p.studyGroupId===g.id).map((p,i)=>({id:p.id,code:p.code,name:p.name,description:p.description,roleKey:'project_manager',isDefault:i===0}))}))};
  },{maxWait:5000,timeout:10000});
 };
}
