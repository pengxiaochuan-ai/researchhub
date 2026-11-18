import {randomBytes,randomUUID} from 'node:crypto';
import {strictInput,normalizeEmail,validatePassword,requestKey,tokenHash,displayName,digest,fault} from './policy.mjs';
import {consumeRate} from './repository.mjs';

export function createAccountAccess({config,db,mailer,bcrypt,secret,registerAdmissionInTransaction,now=()=>new Date()}) {
 if(typeof registerAdmissionInTransaction!=='function')throw Error('WP02_REGISTRATION_ADMISSION_REQUIRED');
 const tenantId=db.tenantId,accepted={accepted:true,message:'请求已受理。如该邮箱符合条件，请在本机私有收件箱查看邮件；本环境不向外部发送。'};
 const invalid=()=>fault('WP02_INVALID_TOKEN','链接无效、已用或已失效，请重新申请。',400);
 async function rate(tx,ctx,purpose,email){
  const date=now();
  await consumeRate(tx,{tenantId,purpose:'request-ip',keyHash:digest(secret,'ip',ctx.ip),limit:10,windowMs:900000,now:date});
  await consumeRate(tx,{tenantId,purpose:'request-tenant',keyHash:digest(secret,'tenant'),limit:100,windowMs:3600000,now:date});
  await consumeRate(tx,{tenantId,purpose:'request-'+purpose,keyHash:digest(secret,'email',email),limit:3,windowMs:3600000,now:date});
 }
 async function request(ctx,input,purpose){
  strictInput(input,['email','requestKey']);const email=normalizeEmail(input.email),key=requestKey(input.requestKey),requestHash=digest(secret,purpose,email),token=randomBytes(32).toString('base64url'),hash=tokenHash(token),id=randomUUID(),date=now(),expiresAt=new Date(date.getTime()+900000);
  const pending=await db.transaction(async tx=>{
   const prior=await tx.$queryRawUnsafe('SELECT "requestHash" FROM account_action_challenge WHERE "tenantId"=$1 AND purpose=$2 AND "requestKey"=$3',tenantId,purpose,key);
   if(prior.length){if(prior[0].requestHash!==requestHash)throw fault('WP02_REQUEST_CONFLICT','请求标识已用于不同内容。',409);return null;}
   await rate(tx,ctx,purpose,email);
   const old=await tx.$queryRawUnsafe('SELECT "createdAt" FROM account_action_challenge WHERE "tenantId"=$1 AND purpose=$2 AND email=$3 ORDER BY "createdAt" DESC LIMIT 1',tenantId,purpose,email);
   if(old[0]&&date.getTime()-old[0].createdAt.getTime()<60000)throw fault('WP02_RESEND_TOO_SOON','请至少等待60秒后再申请。',429);
   const accounts=await tx.$queryRawUnsafe('SELECT id,status,"authVersion","emailNormalized","emailVerifiedAt" FROM account WHERE "tenantId"=$1 AND (lower(username)=$2 OR "emailNormalized"=$2)',tenantId,email);
   const account=accounts.find(a=>a.emailNormalized===email&&a.emailVerifiedAt&&a.status==='active');
   const canSend=purpose==='register'?accounts.length===0:Boolean(account);
   await tx.$executeRawUnsafe('UPDATE account_action_challenge SET "revokedAt"=$4,"updatedAt"=$4,version=version+1 WHERE "tenantId"=$1 AND purpose=$2 AND email=$3 AND "consumedAt" IS NULL AND "revokedAt" IS NULL',tenantId,purpose,email,date);
   await tx.$executeRawUnsafe('INSERT INTO account_action_challenge (id,"tenantId",purpose,email,"accountId","accountAuthVersion","tokenHash","requestKey","requestHash","deliveryStatus","createdAt","updatedAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)',id,tenantId,purpose,email,purpose==='reset'?account?.id??null:null,purpose==='reset'?account?.authVersion??null:null,hash,key,requestHash,canSend?'pending':'failed',date,expiresAt);
   return canSend?{id,email,expiresAt}:null;
  });
  if(pending){
   const route=purpose==='register'?'p004/#verify=':'p005/#reset=';
   const delivery=await mailer.send({purpose,to:email,tokenUrl:config.baseUrl+'/pages/'+route+token,expiresAt});
   try{await db.transaction(tx=>tx.$executeRawUnsafe('UPDATE account_action_challenge SET "deliveryStatus"=$3,"messageId"=$4,"messageDigest"=$5,"updatedAt"=$6,version=version+1 WHERE id=$1 AND "tenantId"=$2 AND "deliveryStatus"=$7 AND "revokedAt" IS NULL AND "consumedAt" IS NULL',id,tenantId,delivery.status,delivery.messageId??null,delivery.digest??null,now(),'pending'));}
   catch {throw fault('WP02_DELIVERY_UNCONFIRMED','投递结果未能确认，请稍后显式重新申请；不会自动重发。',503);}
  }
  return {...accepted};
 }
 async function redeem(ctx,input,purpose){
  strictInput(input,purpose==='register'?['token','displayName','password','requestKey']:['token','password','requestKey']);
  const password=validatePassword(input.password),key=requestKey(input.requestKey),name=purpose==='register'?displayName(input.displayName):null,
    confirmationHash=digest(secret,purpose,input.token,password,name),passwordHash=await bcrypt.hash(password,10);
  const result=await db.transaction(async tx=>{
   let hash;try{hash=tokenHash(input.token);}catch{return bad(tx,ctx);}
   if(purpose==='register')await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','aisci-account-create:'+tenantId);
   const rows=await tx.$queryRawUnsafe('SELECT * FROM account_action_challenge WHERE "tenantId"=$1 AND "tokenHash"=$2 FOR UPDATE',tenantId,hash),c=rows[0],date=now();
   if(!c||c.purpose!==purpose||c.revokedAt||c.expiresAt<=date||c.deliveryStatus!=='captured')return bad(tx,ctx);
   if(c.consumedAt){if(c.confirmationKey===key&&c.confirmationHash===confirmationHash)return c.result;return bad(tx,ctx);}
   let accountId;
   if(purpose==='register'){
    const tenant=await tx.tenant.findUnique({where:{id:tenantId},select:{quotaSeats:true}}),used=await tx.account.count({where:{tenantId}});
    if(used>=tenant.quotaSeats)throw fault('WP02_SEATS_FULL','当前租户席位已满，请联系管理员。',409);
    const conflict=await tx.$queryRawUnsafe('SELECT id FROM account WHERE "tenantId"=$1 AND (lower(username)=$2 OR "emailNormalized"=$2)',tenantId,c.email);if(conflict.length)return bad(tx,ctx);
    accountId=randomUUID();
    await tx.$executeRawUnsafe('INSERT INTO account (id,"tenantId",username,"passwordHash","displayName",role,"isTenantAdmin","authVersion",status,"emailNormalized","emailVerifiedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,\'researcher\',false,0,\'active\',$3,$6,$6,$6)',accountId,tenantId,c.email,passwordHash,name,date);
    await registerAdmissionInTransaction(tx,{id:accountId,tenantId,displayName:name,emailNormalized:c.email,authVersion:0},key);
   }else{
    const account=await tx.account.findFirst({where:{id:c.accountId,tenantId,status:'active'},select:{id:true,authVersion:true}});
    if(!account||account.authVersion!==c.accountAuthVersion)return bad(tx,ctx);
    const changed=await tx.$queryRawUnsafe('UPDATE account SET "passwordHash"=$4,"authVersion"="authVersion"+1,"updatedAt"=$5 WHERE id=$1 AND "tenantId"=$2 AND "emailNormalized"=$3 AND "emailVerifiedAt" IS NOT NULL AND "authVersion"=$6 RETURNING id',account.id,tenantId,c.email,passwordHash,date,c.accountAuthVersion);if(!changed.length)return bad(tx,ctx);accountId=account.id;
    await tx.$executeRawUnsafe('UPDATE account_action_challenge SET "revokedAt"=$3,"updatedAt"=$3,version=version+1 WHERE "tenantId"=$1 AND "accountId"=$2 AND purpose=\'reset\' AND id<>$4 AND "consumedAt" IS NULL AND "revokedAt" IS NULL',tenantId,accountId,date,c.id);
   }
   const outcome=purpose==='register'?{created:true}:{reset:true};
   await tx.$executeRawUnsafe('UPDATE account_action_challenge SET "accountId"=$3,"confirmationKey"=$4,"confirmationHash"=$5,result=$6::jsonb,"consumedAt"=$7,"updatedAt"=$7,version=version+1 WHERE id=$1 AND "tenantId"=$2',c.id,tenantId,accountId,key,confirmationHash,JSON.stringify(outcome),date);
   await tx.auditLog.createMany({data:[{tenantId,accountId,action:purpose==='register'?'wp02_public_registration_confirmed':'wp02_self_password_reset',target:accountId,meta:{challengeId:c.id,requestKey:key,noAutoMembership:true}}]});
   return outcome;
  });if(result?.error)throw result.error;return result;
 }
 async function bad(tx,ctx){await consumeRate(tx,{tenantId,purpose:'invalid-redemption',keyHash:digest(secret,'ip',ctx.ip),limit:5,windowMs:900000,now:now()});return{error:invalid()};}
 async function currentAccount(tx,user){if(!user||user.tenantId!==tenantId)throw fault('WP02_UNAUTHENTICATED','请先登录。',401);const rows=await tx.$queryRawUnsafe('SELECT id,"displayName","emailNormalized","emailVerifiedAt","updatedAt","authVersion" FROM account WHERE id=$1 AND "tenantId"=$2 AND status=\'active\'',user.accountId,tenantId);const a=rows[0];if(!a||a.authVersion!==user.authVersion)throw fault('WP02_UNAUTHENTICATED','会话已失效，请重新登录。',401);return a;}
 const profile=a=>({displayName:a.displayName,email:a.emailVerifiedAt?a.emailNormalized:null,emailVerified:Boolean(a.emailVerifiedAt),baseVersion:a.updatedAt.toISOString()});
 async function updateProfile(ctx,input){
  strictInput(input,['displayName','baseVersion','requestKey']);const name=displayName(input.displayName),key=requestKey(input.requestKey),requestHash=digest(secret,'profile',name,input.baseVersion);
  return db.transaction(async tx=>{
   const a=await currentAccount(tx,ctx.user);
   const prior=await tx.auditLog.findFirst({where:{tenantId,accountId:a.id,action:'wp02_profile_display_name_updated',meta:{path:['requestKey'],equals:key}},select:{meta:true}});
   if(prior){if(prior.meta.requestHash!==requestHash)throw fault('WP02_REQUEST_CONFLICT','请求标识已用于不同内容。',409);return{...profile(a),displayName:prior.meta.displayName,baseVersion:prior.meta.baseVersion};}
   if(a.updatedAt.toISOString()!==input.baseVersion)throw fault('WP02_PROFILE_CONFLICT','个人资料已变化，请刷新后重试。',409);
   if(name!==a.displayName)await tx.account.update({where:{id:a.id},data:{displayName:name}});
   const result=profile(await currentAccount(tx,ctx.user));
   await tx.auditLog.createMany({data:[{tenantId,accountId:a.id,action:'wp02_profile_display_name_updated',target:a.id,meta:{requestKey:key,requestHash,displayName:result.displayName,baseVersion:result.baseVersion}}]});return result;
  });
 }
 return {
  requestRegistration:(ctx,input)=>request(ctx,input,'register'),requestReset:(ctx,input)=>request(ctx,input,'reset'),
  confirmRegistration:(ctx,input)=>redeem(ctx,input,'register'),confirmReset:(ctx,input)=>redeem(ctx,input,'reset'),
  readProfile:ctx=>db.transaction(async tx=>profile(await currentAccount(tx,ctx.user))),
  updateProfile,
 };
}
