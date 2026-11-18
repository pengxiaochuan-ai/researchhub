const empty=status=>({id:null,displayName:status==='checking'?'正在核验身份':status==='unavailable'?'身份暂不可用':'未登录',roleName:status==='checking'?"正在核对登录状态":status==='unavailable'?"请重试登录状态核验":'登录后访问',avatarText:'访',authenticated:false,mode:'real',status});
export function presentIdentity(user,scope={}){
 if(!user)return empty('anonymous');
 const group=user.studyGroups.find(g=>g.id===scope.studyGroupId),project=group?.researchProjects.find(p=>p.id===scope.researchProjectId);
 const scopedStatus={checking:'正在核对研究授权',forbidden:'当前研究不可访问',unavailable:'研究授权暂不可核对',invalid:'研究链接待核对'}[scope.scopeStatus];
 let role;
 if(scopedStatus)role=(user.isTenantAdmin?'租户管理员 · ':'已登录 · ')+scopedStatus;
 else if(project)role=(group.role?.name??'研究成员')+' · '+(project.roleKey==='project_manager'?'Study项目管理员':'Study研究成员');
 else if(scope.studyId)role=user.isTenantAdmin?'租户管理员 · 当前研究':scope.scopeStatus==='resolved'?'已登录 · 当前研究访问已核对':'已登录 · 研究授权待核对';
 else role=user.isTenantAdmin?'租户管理员 · 无当前Study角色':user.studyGroups.length?'已登录 · 请选择已授权Study':'尚未加入私有Study';
 return{id:user.accountId,...(Number.isSafeInteger(user.authVersion)&&user.authVersion>=0?{authVersion:user.authVersion}:{}),displayName:user.displayName||user.username,username:user.username,roleName:role,avatarText:(user.displayName||user.username).slice(0,1),authenticated:true,mode:'real',status:'authenticated'};
}
export function createPlatformAuth({client,setUser,readScope=()=>({}),resolveScope=null,onExpired=()=>{}}){
 let sequence=0,disposed=false,lastUser=null;
 const publish=value=>{if(!disposed)setUser(value);};publish(empty('checking'));
 const unavailable=()=>lastUser?{...presentIdentity(lastUser,readScope()),sessionHealth:'unavailable',roleName:'连接暂不可用，请检查网络后重试'}:empty('unavailable');
 return Object.freeze({
  async refresh(){const current=++sequence;if(!lastUser)publish(empty('checking'));try{
   const user=await client.me();if(disposed||current!==sequence)return;lastUser=user;
   const opened=readScope(),scopeKey=JSON.stringify(opened);
   if(user&&resolveScope&&(opened?.studyId||opened?.scopeStatus==='invalid')){
    publish(presentIdentity(user,{...opened,scopeStatus:opened.scopeStatus==='invalid'?'invalid':'checking'}));
    const resolved=await resolveScope(user,opened);
    if(disposed||current!==sequence||JSON.stringify(readScope())!==scopeKey||lastUser?.accountId!==user.accountId||lastUser?.authVersion!==user.authVersion)return;
    publish(presentIdentity(user,resolved));
   }else publish(presentIdentity(user,opened));
   if(!user)onExpired();
  }catch(e){if(!disposed&&current===sequence){if(e.code==='AUTH_INVALID_CREDENTIALS'){lastUser=null;publish(empty('anonymous'));onExpired();}else publish(unavailable());}}},
  async logout(){const current=++sequence;try{await client.logout();if(!disposed&&current===sequence){lastUser=null;publish(empty('anonymous'));onExpired();}}catch(e){if(!disposed&&current===sequence)publish(unavailable());throw e;}},
  dispose(){disposed=true;sequence++;},
 });
}
