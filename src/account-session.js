const errors={
 HUB_MAIL_NOT_CONFIGURED:'邮件服务暂未启用，请联系管理员。',WP02_INVALID_EMAIL:'请填写此服务支持的有效邮箱。',WP02_NOT_CONFIGURED:'账号自助服务尚未配置。',WP02_INVALID_RESPONSE:'服务响应无法确认，请先核对会话或邮件，不要重复提交。',
 WP02_NETWORK:'连接中断或超时，操作结果未确认；请先核对邮件或会话，不会自动重发。',
 WP02_RATE_LIMITED:'请求过于频繁；重发至少间隔60秒，仍受邮箱和来源速率限制。',
 WP02_INVALID_TOKEN:'链接无效、已用或已失效，请重新从原邮件打开或重新申请。',
 WP02_UNAUTHENTICATED:'请先登录；登录后重新打开原邀请邮件。',WP02_PROFILE_CONFLICT:'个人资料已变化，请刷新后核对；当前输入仍保留。',
 WP02_SEATS_FULL:'当前租户席位已满，请联系管理员。',WP02_UNAVAILABLE:'账号服务暂时不可用，请稍后核对再重试。',
 WP02_INVITATION_FORBIDDEN:'当前账号没有所选Study的成员邀请权限。',WP02_INVITATION_UNAVAILABLE:'邀请不可用，请核对登录邮箱、重新打开原邮件或联系邀请人。',
 WP02_INVITATION_CHANGED:'邀请状态已变化，请刷新核对；不会覆盖或自动重发。',WP02_MEMBERSHIP_CONFLICT:'成员已有不同或停用配置，请联系负责人，系统不会覆盖或恢复。',
};
const failure=(code,status)=>Object.assign(new Error(errors[code]??errors.WP02_UNAVAILABLE),{code,status});
const invitationRoleName=value=>{if(value==='科研资产成员'||value==='该Study最小只读成员')return value;if(value===undefined)return '该Study最小只读成员';throw failure('WP02_INVALID_RESPONSE');};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export function createAccountAccessClient({enabled=false,fetchImpl=globalThis.fetch}={}){
 const scopeHeaders=scope=>{if(!exact(scope,['groupId','projectId'])||![scope.groupId,scope.projectId].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v)))throw failure('WP02_INVALID_RESPONSE');return{'X-Study-Group-Id':scope.groupId,'X-Research-Project-Id':scope.projectId};};
 async function request(path,method,body,scope,signal){if(!enabled)throw failure('WP02_NOT_CONFIGURED');const headers={Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{}),...(scope?scopeHeaders(scope):{})};let res;try{res=await fetchImpl('/api/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers,...(body?{body:JSON.stringify(body)}:{})});}catch{if(signal?.aborted)throw new DOMException('读取已取消','AbortError');throw failure('WP02_NETWORK');}
  let data;try{data=await res.json();}catch{throw failure('WP02_INVALID_RESPONSE');}
  if(!res.ok)throw failure(({401:'WP02_UNAUTHENTICATED',429:'WP02_RATE_LIMITED'})[res.status]??(Object.hasOwn(errors,data?.code)?data.code:res.status===409?'WP02_PROFILE_CONFLICT':'WP02_UNAVAILABLE'),res.status);
  return data;
 }
 const input=(value,keys)=>{if(!exact(value,keys))throw failure('WP02_INVALID_RESPONSE');return value;};
 const done=(value,key)=>{if(value?.[key]!==true)throw failure('WP02_INVALID_RESPONSE');return{[key]:true};};
 const profile=v=>{if(typeof v?.displayName!=='string'||typeof v.emailVerified!=='boolean'||(v.email!==null&&typeof v.email!=='string')||!Number.isFinite(Date.parse(v.baseVersion)))throw failure('WP02_INVALID_RESPONSE');return{displayName:v.displayName,email:v.email,emailVerified:v.emailVerified,baseVersion:v.baseVersion};};
 const publicRequest=async(value,path)=>{input(value,['email','requestKey']);return done(await request(path,'POST',{...value,email:value.email.trim().toLowerCase()}),'accepted');};
 const id=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9-]{8,100}$/.test(v))throw failure('WP02_INVALID_RESPONSE');return v;};
 const invitation=v=>{if(!v||typeof v.email!=='string'||!Number.isInteger(v.version)||v.version<1||!['pending','captured','failed','unknown'].includes(v.deliveryStatus)||!['pending','captured','failed','unknown','accepted','revoked','expired'].includes(v.status)||!Number.isFinite(Date.parse(v.expiresAt))||!Number.isFinite(Date.parse(v.createdAt)))throw failure('WP02_INVALID_RESPONSE');return{id:id(v.id),email:v.email,version:v.version,deliveryStatus:v.deliveryStatus,status:v.status,expiresAt:v.expiresAt,createdAt:v.createdAt,resendAfter:v.resendAfter??new Date(Date.parse(v.createdAt)+60000).toISOString()};};
 const named=v=>{if(typeof v?.id!=='string'||!v.id||typeof v.name!=='string')throw failure('WP02_INVALID_RESPONSE');return{id:v.id,name:v.name};};
 return Object.freeze({configured:enabled,
  requestRegistration:value=>publicRequest(value,'account-access/registrations'),requestReset:value=>publicRequest(value,'account-access/password-resets'),
  confirmRegistration:async value=>done(await request('account-access/registration-confirmations','POST',input(value,['token','displayName','password','requestKey'])),'created'),
  confirmReset:async value=>done(await request('account-access/password-reset-confirmations','POST',input(value,['token','password','requestKey'])),'reset'),
  readProfile:async()=>profile(await request('account-access/profile','GET')),
  updateProfile:async value=>profile(await request('account-access/profile','PATCH',input(value,['displayName','baseVersion','requestKey']))),
  invitationContext:async(scope,{signal}={})=>{const v=await request('member-invitations/context','GET',undefined,scope,signal);if(typeof v?.canInvite!=='boolean'||typeof v.roleName!=='string'||!(typeof v.projectRoleKey==='string'||v.projectRoleKey===null&&v.roleName==='租户管理员'&&v.canInvite===true)||v.studyGroup?.id!==scope.groupId||v.researchProject?.id!==scope.projectId)throw failure('WP02_INVALID_RESPONSE');return{studyGroup:named(v.studyGroup),researchProject:named(v.researchProject),canInvite:v.canInvite,roleName:v.roleName,projectRoleKey:v.projectRoleKey,targetRoleName:'该Study最小只读成员'};},
  listInvitations:async(scope,query={},{signal}={})=>{if(Object.keys(query).some(k=>!['cursor','limit'].includes(k)))throw failure('WP02_INVALID_RESPONSE');const params=new URLSearchParams(query),v=await request('member-invitations'+(params.size?'?'+params:''),'GET',undefined,scope,signal);if(!Array.isArray(v?.items)||v.items.length>50||(v.nextCursor!==null&&(typeof v.nextCursor!=='string'||!/^[A-Za-z0-9_-]{1,512}$/.test(v.nextCursor))))throw failure('WP02_INVALID_RESPONSE');return{items:v.items.map(invitation),nextCursor:v.nextCursor};},
  issueInvitation:async(scope,value)=>invitation(await request('member-invitations','POST',input(value,['email','requestKey']),scope)),
  revokeInvitation:async(scope,inviteId,value)=>invitation(await request('member-invitations/'+id(inviteId)+'/revocations','POST',input(value,['baseVersion','requestKey']),scope)),
  resendInvitation:async(scope,inviteId,value)=>invitation(await request('member-invitations/'+id(inviteId)+'/resends','POST',input(value,['baseVersion','requestKey']),scope)),
  previewInvitation:async value=>{const v=await request('member-invitation-previews','POST',input(value,['token']));if(typeof v?.alreadyAccepted!=='boolean'||!Number.isFinite(Date.parse(v.expiresAt)))throw failure('WP02_INVALID_RESPONSE');return{studyGroup:named(v.studyGroup),researchProject:named(v.researchProject),alreadyAccepted:v.alreadyAccepted,expiresAt:v.expiresAt,targetRoleName:invitationRoleName(v.targetRoleName)};},
  acceptInvitation:async value=>{const v=await request('member-invitation-acceptances','POST',input(value,['token','requestKey']));if(v?.accepted!==true||typeof v.studyGroupId!=='string'||typeof v.researchProjectId!=='string')throw failure('WP02_INVALID_RESPONSE');return{accepted:true,studyGroupId:v.studyGroupId,researchProjectId:v.researchProjectId};},
 });
}
export function safeAccountReturnTo(value){
 if(typeof value!=='string'||!/^\/pages\/[a-z0-9]+\/(?:[?#].*)?$/.test(value)||/[\\\r\n]/.test(value))return'/pages/p003/';
 const u=new URL(value,'http://127.0.0.1:19501'),params=new URLSearchParams();
 if(u.pathname==='/pages/p006/'&&u.searchParams.size===1&&u.searchParams.get('section')==='research-identity')return'/pages/p006/?section=research-identity';
 for(const key of ['studyGroupId','researchProjectId','members','assetDrafts','assetDraftId','researchPlanId','hubId','projectId','view']){const v=u.searchParams.get(key);if(v&&/^[A-Za-z0-9_-]{1,160}$/.test(v))params.set(key,v);}
 return u.pathname+(params.size?'?'+params.toString():'');
}
export function takeActionToken(purpose,{location=window.location,history=window.history}={}){
 const m=location.hash.match(new RegExp('^#'+purpose+'=([A-Za-z0-9_-]{43})$'));
 if(location.hash||location.search)history.replaceState(null,'',safeAccountReturnTo(location.pathname+location.search));
 return m?.[1]??'';
}
export function validateAccountForm(values,stage,{registration=false}={}){const errors={};
 if(stage==='request'){
  const email=values.email?.trim()??'';
  if(registration){
   if(email.length>254||!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email))errors.email='请填写有效邮箱。';
  }else if(!/^[^\s@]+@(example\.test|example\.org)$/i.test(email))errors.email='请填写有效的合成邮箱。';
 }
 if(stage==='verify'&&(!values.displayName?.trim()||[...values.displayName.trim()].length>40))errors.displayName='请填写1–40字符的展示名称。';
 if(stage!=='request'&&(typeof values.password!=='string'||[...values.password].length<12||[...values.password].length>64||new TextEncoder().encode(values.password).length>72))errors.password='密码须为12–64字符，UTF-8不超过72字节。';
 return errors;
}
