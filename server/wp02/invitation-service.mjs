import {assertApprovedInTransaction} from '../admission/service.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {strictInput,normalizeEmail,requestKey,tokenHash,digest,fault} from './policy.mjs';
import {consumeRate} from './repository.mjs';

export function createMemberInvitations({db,mailer,secret,target,config,now=()=>new Date(),allowTenantAdmin=false,readerRoleAllowed=role=>Array.isArray(role.menuPermissions)&&!role.menuPermissions.length&&Array.isArray(role.buttonPermissions)&&!role.buttonPermissions.length,targetRoleName='该Study最小只读成员'}){
 const tenantId=db.tenantId,unavailable=()=>fault('WP02_INVITATION_UNAVAILABLE','邀请不可用，请核对登录邮箱或联系邀请人。',404);
 const forbidden=()=>fault('WP02_INVITATION_FORBIDDEN','当前账号没有此Study的成员邀请权限。',403);
 async function principal(tx,user){
  if(!user||user.tenantId!==tenantId)throw fault('WP02_UNAUTHENTICATED','请先登录。',401);
  const rows=await tx.$queryRawUnsafe('SELECT id,role,"authVersion","emailNormalized","emailVerifiedAt" FROM account WHERE id=$1 AND "tenantId"=$2 AND status=\'active\'',user.accountId,tenantId),a=rows[0];
  if(!a||a.authVersion!==user.authVersion||!['researcher','tenant_admin'].includes(a.role))throw fault('WP02_UNAUTHENTICATED','会话已失效。',401);return a;
 }
 async function membership(tx,accountId){
  const [group,project,gm,pm]=await Promise.all([
   tx.studyGroup.findFirst({where:{id:target.groupId,tenantId,status:'active'},select:{id:true,name:true}}),
   tx.researchProject.findFirst({where:{id:target.projectId,tenantId,studyGroupId:target.groupId,status:'active'},select:{id:true,name:true}}),
   tx.studyGroupMembership.findFirst({where:{tenantId,studyGroupId:target.groupId,accountId,status:'active',role:{status:'active'}},include:{role:true}}),
   tx.researchProjectMembership.findFirst({where:{tenantId,studyGroupId:target.groupId,researchProjectId:target.projectId,accountId,status:'active'}}),
  ]);
  if(!group||!project)throw forbidden();
  if(allowTenantAdmin){const a=await tx.account.findFirst({where:{id:accountId,tenantId,status:'active'},select:{role:true,isTenantAdmin:true}});if(a?.role==='tenant_admin'&&a.isTenantAdmin===true)return{group,project,groupRole:{name:'租户管理员'},projectRoleKey:null,canInvite:true};}
  if(!gm||!pm)throw forbidden();
  const canInvite=pm.roleKey==='project_manager'&&Array.isArray(gm.role.menuPermissions)&&gm.role.menuPermissions.includes('group_admin')&&Array.isArray(gm.role.buttonPermissions)&&gm.role.buttonPermissions.includes('member.manage');
  return{group,project,groupRole:gm.role,projectRoleKey:pm.roleKey,canInvite};
 }
 async function authorize(tx,ctx,manage=true){
  if(ctx.groupId!==target.groupId||ctx.projectId!==target.projectId)throw forbidden();
  await principal(tx,ctx.user);const m=await membership(tx,ctx.user.accountId);if(manage&&!m.canInvite)throw forbidden();
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',tenantId+':'+target.projectId);return m;
 }
 async function reader(tx){const role=await tx.permissionRole.findFirst({where:{id:target.readerRoleId,tenantId,status:'active'}});if(!role||role.dataScope!=='group'||!readerRoleAllowed(role))throw forbidden();return role;}
 function view(inv){return{id:inv.id,email:inv.email,version:inv.version,deliveryStatus:inv.deliveryStatus,status:inv.acceptedAt?'accepted':inv.revokedAt?'revoked':inv.expiresAt<=now()?'expired':inv.deliveryStatus,expiresAt:inv.expiresAt.toISOString(),createdAt:inv.createdAt.toISOString(),resendAfter:new Date(inv.updatedAt.getTime()+60000).toISOString()};}
 async function find(tx,id){const rows=await tx.$queryRawUnsafe('SELECT * FROM research_member_invitation WHERE id=$1 AND "tenantId"=$2 AND "studyGroupId"=$3 AND "researchProjectId"=$4 FOR UPDATE',id,tenantId,target.groupId,target.projectId);if(!rows[0])throw unavailable();return rows[0];}
 async function audit(tx,user,action,inv,key){await tx.auditLog.createMany({data:[{tenantId,studyGroupId:target.groupId,researchProjectId:target.projectId,accountId:user.accountId,action,target:inv.id,meta:{requestKey:key,scopeOnly:true,targetRoleId:target.readerRoleId}}]});}
 async function send(ctx,inv,token){
  const result=await mailer.send({purpose:'invite',to:inv.email,tokenUrl:config.baseUrl+'/pages/p010/#invite='+token,expiresAt:inv.expiresAt});
  return db.transaction(async tx=>{await authorize(tx,ctx);const current=await find(tx,inv.id);if(current.tokenHash!==inv.tokenHash||current.revokedAt||current.acceptedAt)throw fault('WP02_INVITATION_CHANGED','邀请状态已变化，请刷新核对。',409);
   await tx.$executeRawUnsafe('UPDATE research_member_invitation SET "deliveryStatus"=$3,"messageId"=$4,"messageDigest"=$5,"updatedAt"=$6,version=version+1 WHERE id=$1 AND "tenantId"=$2',inv.id,tenantId,result.status,result.messageId??null,result.digest??null,now());return view(await find(tx,inv.id));});
 }
 async function issue(ctx,input){
  strictInput(input,['email','requestKey']);const email=normalizeEmail(input.email),key=requestKey(input.requestKey),hash=digest(secret,'invite',target.projectId,email),token=randomBytes(32).toString('base64url');
  const result=await db.transaction(async tx=>{
   await authorize(tx,ctx);await reader(tx);
   const prior=await tx.$queryRawUnsafe('SELECT * FROM research_member_invitation WHERE "tenantId"=$1 AND "issuedBy"=$2 AND "requestKey"=$3',tenantId,ctx.user.accountId,key);if(prior[0]){if(prior[0].requestHash!==hash)throw fault('WP02_REQUEST_CONFLICT','请求标识已用于不同内容。',409);return{existing:view(prior[0])};}
   await consumeRate(tx,{tenantId,purpose:'invite-issuer',keyHash:digest(secret,ctx.user.accountId,target.projectId),limit:10,windowMs:3600000,now:now()});
   const priorMail=await tx.$queryRawUnsafe('SELECT "updatedAt" FROM research_member_invitation WHERE "tenantId"=$1 AND "researchProjectId"=$2 AND email=$3 ORDER BY "updatedAt" DESC LIMIT 1',tenantId,target.projectId,email);if(priorMail[0]&&now()-priorMail[0].updatedAt<60000)throw fault('WP02_RATE_LIMITED','请至少等待60秒后显式重发。',429);
   const issuer=await principal(tx,ctx.user),id=randomUUID(),date=now(),expiresAt=new Date(date.getTime()+72*3600000);
   await tx.$executeRawUnsafe('INSERT INTO research_member_invitation (id,"tenantId","studyGroupId","researchProjectId",email,"issuedBy","issuerAuthVersion","targetRoleId","targetProjectRoleKey","tokenHash","requestKey","requestHash","createdAt","updatedAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'researcher\',$9,$10,$11,$12,$12,$13)',id,tenantId,target.groupId,target.projectId,email,issuer.id,issuer.authVersion,target.readerRoleId,tokenHash(token),key,hash,date,expiresAt);
   const inv=await find(tx,id);await audit(tx,ctx.user,'wp02_member_invitation_issued',inv,key);return{inv};
  });return result.existing??send(ctx,result.inv,token);
 }
 async function mutate(ctx,id,input,operation){
  strictInput(input,['baseVersion','requestKey']);const key=requestKey(input.requestKey);if(!Number.isSafeInteger(input.baseVersion)||input.baseVersion<1)throw fault('WP02_INVALID_VERSION','版本无效。');const hash=digest(secret,operation,id,input.baseVersion),token=randomBytes(32).toString('base64url');
  const result=await db.transaction(async tx=>{await authorize(tx,ctx);await reader(tx);const inv=await find(tx,id);
   if(inv.lastRequestKey===key){if(inv.lastRequestHash!==hash)throw fault('WP02_REQUEST_CONFLICT','请求标识已用于不同内容。',409);return{existing:view(inv)};}
   if(inv.version!==input.baseVersion||inv.acceptedAt||inv.revokedAt)throw fault('WP02_INVITATION_CHANGED','邀请已变化、接受或撤销，请刷新核对。',409);
   const date=now();
   if(operation==='resend'){
    if(date-inv.updatedAt<60000)throw fault('WP02_RATE_LIMITED','请至少等待60秒后显式重发。',429);
    await consumeRate(tx,{tenantId,purpose:'invite-issuer',keyHash:digest(secret,ctx.user.accountId,target.projectId),limit:10,windowMs:3600000,now:date});
    await tx.$executeRawUnsafe('UPDATE research_member_invitation SET "tokenHash"=$3,"expiresAt"=$4,"deliveryStatus"=\'pending\',"messageId"=NULL,"messageDigest"=NULL,"lastRequestKey"=$5,"lastRequestHash"=$6,"updatedAt"=$7,version=version+1 WHERE id=$1 AND "tenantId"=$2',id,tenantId,tokenHash(token),new Date(date.getTime()+72*3600000),key,hash,date);
   }else await tx.$executeRawUnsafe('UPDATE research_member_invitation SET "revokedAt"=$3,"updatedAt"=$3,"lastRequestKey"=$4,"lastRequestHash"=$5,version=version+1 WHERE id=$1 AND "tenantId"=$2',id,tenantId,date,key,hash);
   const updated=await find(tx,id);await audit(tx,ctx.user,'wp02_member_invitation_'+operation,updated,key);return operation==='resend'?{inv:updated}:{existing:view(updated)};
  });return result.existing??send(ctx,result.inv,token);
 }
 async function validToken(tx,ctx,value){
  const a=await principal(tx,ctx.user);let hash;try{hash=tokenHash(value);}catch{throw unavailable();}
  const rows=await tx.$queryRawUnsafe('SELECT * FROM research_member_invitation WHERE "tenantId"=$1 AND "tokenHash"=$2 FOR UPDATE',tenantId,hash),inv=rows[0];
  if(!inv||inv.studyGroupId!==target.groupId||inv.researchProjectId!==target.projectId||inv.targetRoleId!==target.readerRoleId||inv.revokedAt||inv.expiresAt<=now()||inv.deliveryStatus!=='captured'||!a.emailVerifiedAt||a.emailNormalized!==inv.email)throw unavailable();
  if(inv.acceptedAt){const gm=await tx.studyGroupMembership.findFirst({where:{tenantId,studyGroupId:target.groupId,accountId:a.id,status:'active',roleId:target.readerRoleId}}),pm=await tx.researchProjectMembership.findFirst({where:{tenantId,studyGroupId:target.groupId,researchProjectId:target.projectId,accountId:a.id,status:'active',roleKey:'researcher'}});if(inv.acceptedBy!==a.id||!gm||!pm)throw unavailable();}
  try{await principal(tx,{accountId:inv.issuedBy,tenantId,authVersion:inv.issuerAuthVersion});const issuer=await membership(tx,inv.issuedBy);if(!issuer.canInvite)throw forbidden();await reader(tx);}catch{throw unavailable();}
  return{a,inv};
 }
 async function tokenOperation(ctx,callback){const result=await db.transaction(async tx=>{try{return await callback(tx);}catch(e){if(e.status!==404&&e.status!==400)throw e;await consumeRate(tx,{tenantId,purpose:'invite-token-invalid',keyHash:digest(secret,'ip',ctx.ip),limit:5,windowMs:900000,now:now()});return{error:e};}});if(result.error)throw result.error;return result;}
 return {
  context:ctx=>db.transaction(async tx=>{const m=await authorize(tx,ctx,false);return{studyGroup:m.group,researchProject:m.project,roleName:m.groupRole.name,projectRoleKey:m.projectRoleKey,canInvite:m.canInvite,targetRoleName};}),
  issue,revoke:(ctx,id,input)=>mutate(ctx,id,input,'revoke'),resend:(ctx,id,input)=>mutate(ctx,id,input,'resend'),
  list:(ctx,input)=>db.transaction(async tx=>{await authorize(tx,ctx);if(!input||Object.keys(input).some(k=>!['cursor','limit'].includes(k)))throw fault('WP02_INVALID_FIELDS','分页字段无效。');const limit=input.limit===undefined?20:Number(input.limit);if(!Number.isInteger(limit)||limit<1||limit>50)throw fault('WP02_INVALID_LIMIT','每页须为1–50条。');let cursor=null;if(input.cursor){try{cursor=JSON.parse(Buffer.from(input.cursor,'base64url'));if(!Array.isArray(cursor)||cursor.length!==2||!Number.isFinite(Date.parse(cursor[0]))||!/^[A-Za-z0-9-]{8,100}$/.test(cursor[1]))throw new Error();}catch{throw fault('WP02_INVALID_CURSOR','分页标识无效。');}}
   const rows=cursor?await tx.$queryRawUnsafe('SELECT * FROM research_member_invitation WHERE "tenantId"=$1 AND "studyGroupId"=$2 AND "researchProjectId"=$3 AND ("createdAt"<$4 OR ("createdAt"=$4 AND id<$5)) ORDER BY "createdAt" DESC,id DESC LIMIT $6',tenantId,target.groupId,target.projectId,new Date(cursor[0]),cursor[1],limit+1):await tx.$queryRawUnsafe('SELECT * FROM research_member_invitation WHERE "tenantId"=$1 AND "studyGroupId"=$2 AND "researchProjectId"=$3 ORDER BY "createdAt" DESC,id DESC LIMIT $4',tenantId,target.groupId,target.projectId,limit+1);
   const items=rows.slice(0,limit),last=items.at(-1);return{items:items.map(view),nextCursor:rows.length>limit?Buffer.from(JSON.stringify([last.createdAt.toISOString(),last.id])).toString('base64url'):null};}),
  preview:(ctx,input)=>{strictInput(input,['token']);return tokenOperation(ctx,async tx=>{const{inv}=await validToken(tx,ctx,input.token),m=await membership(tx,inv.issuedBy);return{studyGroup:m.group,researchProject:m.project,targetRoleName,expiresAt:inv.expiresAt.toISOString(),alreadyAccepted:Boolean(inv.acceptedAt)};});},
  accept:(ctx,input)=>{strictInput(input,['token','requestKey']);const key=requestKey(input.requestKey),hash=digest(secret,'accept',input.token,ctx.user?.accountId);return tokenOperation(ctx,async tx=>{
   const{a,inv}=await validToken(tx,ctx,input.token);await assertApprovedInTransaction(tx,ctx.user);await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',tenantId+':'+target.projectId);
   const gm=await tx.studyGroupMembership.findFirst({where:{tenantId,studyGroupId:target.groupId,accountId:a.id}}),pm=await tx.researchProjectMembership.findFirst({where:{tenantId,researchProjectId:target.projectId,accountId:a.id}});
   if((gm&&(gm.status!=='active'||gm.roleId!==target.readerRoleId))||(pm&&(pm.status!=='active'||pm.roleKey!=='researcher'))||(pm&&!gm))throw fault('WP02_MEMBERSHIP_CONFLICT','成员已有不同或停用配置，请联系负责人，系统不会覆盖或恢复。',409);
   const result={accepted:true,studyGroupId:target.groupId,researchProjectId:target.projectId};
   if(inv.acceptedAt){if(inv.acceptedBy===a.id&&inv.acceptanceKey===key&&inv.acceptanceHash===hash&&gm&&pm)return result;throw unavailable();}
   if(!gm)await tx.studyGroupMembership.create({data:{tenantId,studyGroupId:target.groupId,accountId:a.id,roleId:target.readerRoleId}});
   if(!pm)await tx.researchProjectMembership.create({data:{tenantId,studyGroupId:target.groupId,researchProjectId:target.projectId,accountId:a.id,roleKey:'researcher'}});
   await tx.$executeRawUnsafe('UPDATE research_member_invitation SET "acceptedBy"=$3,"acceptedAt"=$4,"updatedAt"=$4,"acceptanceKey"=$5,"acceptanceHash"=$6,version=version+1 WHERE id=$1 AND "tenantId"=$2',inv.id,tenantId,a.id,now(),key,hash);await audit(tx,ctx.user,'wp02_member_invitation_accepted',inv,key);return result;
  });},
 };
}
