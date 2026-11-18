import {randomUUID} from 'node:crypto';
import {HUB_KEY,POLICY_VERSION,fail,only,requestHash,transition,decisionInput,submissionInput,registrationMaterial} from './policy.mjs';

export async function bindAdmissionContext(tx,p,hubKey=HUB_KEY){
 for(const [key,value]of [['app.tenant_id',p.tenantId],['app.account_id',p.accountId],['app.auth_version',String(p.authVersion)],['app.hub_key',hubKey]])await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',key,value);
}
export async function assertApprovedInTransaction(tx,p,hubKey=HUB_KEY){
 if(!p?.accountId||!p.tenantId||!Number.isInteger(p.authVersion))fail(401,'AUTH_SESSION_EXPIRED','请先登录。');
 await bindAdmissionContext(tx,p,hubKey);
 const account=await tx.account.findFirst({where:{id:p.accountId,tenantId:p.tenantId,status:'active',authVersion:p.authVersion,tenant:{status:'active'}},select:{id:true}});
 if(!account)fail(401,'AUTH_SESSION_EXPIRED','登录身份已失效，请重新登录。');
 const rows=await tx.$queryRawUnsafe('SELECT status FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3',p.tenantId,hubKey,p.accountId);
 if(rows[0]?.status!=='approved')fail(403,'HUB_ADMISSION_REQUIRED','请先查看加入审核结果。');
}
const isAdmin=a=>a.role==='tenant_admin'&&a.isTenantAdmin===true;
export function createAdmissionService({transact,lockAuthorization,tenantId,hubKey=HUB_KEY}){
 if(typeof transact!=='function'||typeof lockAuthorization!=='function'||!tenantId||hubKey!==HUB_KEY)throw Error('HUB_ADMISSION_DEPENDENCIES_REQUIRED');
 async function current(tx,p,admin=false){
  if(p?.tenantId!==tenantId||!p.accountId||!Number.isInteger(p.authVersion))fail(401,'AUTH_SESSION_EXPIRED','登录身份已失效。');
  await bindAdmissionContext(tx,p,hubKey);
  const a=await tx.account.findFirst({where:{id:p.accountId,tenantId,status:'active',authVersion:p.authVersion,tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true,displayName:true,authVersion:true}});
  if(!a)fail(401,'AUTH_SESSION_EXPIRED','登录身份已失效。');
  if(admin&&!isAdmin(a))fail(403,'HUB_ADMISSION_FORBIDDEN','当前账号无权审核加入申请。');
  return a;
 }
 const run=(p,fn,{admin=false}={})=>transact(async tx=>{await lockAuthorization(tx,tenantId);const a=await current(tx,p,admin);if(admin)await assertApprovedInTransaction(tx,p,hubKey);return fn(tx,a);});
 const find=async(tx,id,lock=false)=>{const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND id=$3'+(lock?' FOR UPDATE':''),tenantId,hubKey,id);if(!rows[0])fail(404,'HUB_ADMISSION_NOT_FOUND','未找到当前有权查看的申请。');return rows[0];};
 async function present(tx,row){
  const events=await tx.$queryRawUnsafe('SELECT action,reason,revision,actor_id AS "actorId",created_at AS "createdAt" FROM rh_admission.event WHERE tenant_id=$1 AND application_id=$2 ORDER BY revision',tenantId,row.id);
  const last=events.at(-1);
  return{id:row.id,accountId:row.account_id,status:row.status,revision:row.revision,materialVersion:row.material_version,material:row.material,source:row.source,submittedAt:row.created_at,updatedAt:row.updated_at,reason:last?.reason??'',events,canSupplement:row.status==='needs_information',canResubmit:row.status==='rejected'&&row.allow_resubmit===true};
 }
 async function event(tx,p,row,{action,reason='',requestKey,hash}){
  const result={id:row.id,status:row.status,revision:row.revision,materialVersion:row.material_version,allowResubmit:row.allow_resubmit};
  await tx.$executeRawUnsafe('INSERT INTO rh_admission.event(id,application_id,tenant_id,actor_id,actor_auth_version,action,revision,material_version,material,reason,policy_version,request_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb)',randomUUID(),row.id,tenantId,p.accountId,p.authVersion,action,row.revision,row.material_version,JSON.stringify(row.material),reason,POLICY_VERSION,requestKey,hash,JSON.stringify(result));
  await tx.auditLog.create({data:{tenantId,accountId:p.accountId,action:'hub.admission.'+action,target:row.id,meta:{hubKey,revision:row.revision,materialVersion:row.material_version,requestKey,requestHash:hash,policyVersion:POLICY_VERSION}}});
  return result;
 }
 async function replay(tx,p,requestKey,hash){
  const rows=await tx.$queryRawUnsafe('SELECT request_hash,result FROM rh_admission.event WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3',tenantId,p.accountId,requestKey);
  if(!rows[0])return null;if(rows[0].request_hash!==hash)fail(409,'HUB_ADMISSION_REQUEST_CONFLICT','同一操作标识对应的内容已变化，请核对原结果。');return rows[0].result;
 }
 async function initial(tx,p,account,{source,requestKey}){
  if(account.tenantId!==tenantId)fail(403,'HUB_ADMISSION_SCOPE_INVALID','申请范围不符合当前平台。');
  await current(tx,p,source==='legacy_confirmed');
  if(source==='registration_review'&&p.accountId!==account.id)fail(403,'HUB_ADMISSION_FORBIDDEN','注册申请身份不匹配。');
  const id=randomUUID(),material={registration:registrationMaterial(account)};
  const rows=await tx.$queryRawUnsafe('INSERT INTO rh_admission.application(id,tenant_id,hub_key,account_id,source,status,material) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *',id,tenantId,hubKey,account.id,source,source==='legacy_confirmed'?'approved':'pending',JSON.stringify(material));
  return event(tx,p,rows[0],{action:source==='legacy_confirmed'?'legacy_confirmed':'register',requestKey,hash:requestHash({accountId:account.id,material,source,hubKey})});
 }
 return {
  hubKey,
  registerInTransaction:(tx,account,requestKey)=>initial(tx,{accountId:account.id,tenantId,authVersion:account.authVersion},account,{source:'registration_review',requestKey}),
  legacyInTransaction:(tx,p,account,requestKey)=>initial(tx,p,account,{source:'legacy_confirmed',requestKey}),
  assertApproved:p=>run(p,tx=>assertApprovedInTransaction(tx,p,hubKey)),
  self:p=>run(p,async tx=>{const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3',tenantId,hubKey,p.accountId);return rows[0]?present(tx,rows[0]):{accountId:p.accountId,status:'unregistered',revision:null,canSupplement:false,canResubmit:false,reason:'账号准入记录待核对，请联系管理员。'};}),
  list:(p,q={})=>run(p,async tx=>{
   only(q,['status','q','page']);const status=q.status??'pending',search=q.q??'',page=Number(q.page??1);
   if(!['pending','needs_information','approved','rejected','all'].includes(status)||typeof search!=='string'||search.length>200||!Number.isSafeInteger(page)||page<1||page>100000)fail(400,'HUB_ADMISSION_INPUT_INVALID','筛选条件无效。');
   const filter="tenant_id=$1 AND hub_key=$2 AND ($3='all' OR status=$3) AND (material->'registration'->>'displayName' ILIKE $4 OR material->'registration'->>'email' ILIKE $4)",args=[tenantId,hubKey,status,'%'+search+'%'];
   const count=await tx.$queryRawUnsafe('SELECT count(*) AS total FROM rh_admission.application WHERE '+filter,...args),total=Number(count[0].total),actualPage=Math.min(page,Math.max(1,Math.ceil(total/20)));
   const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_admission.application WHERE '+filter+' ORDER BY created_at,id LIMIT 20 OFFSET $5',...args,(actualPage-1)*20);
   return{items:rows.map(r=>({id:r.id,accountId:r.account_id,status:r.status,revision:r.revision,material:r.material,submittedAt:r.created_at})),page:actualPage,total};
  },{admin:true}),
  detail:(p,id)=>run(p,async tx=>present(tx,await find(tx,id)),{admin:true}),
  decide:(p,id,body)=>{const input=decisionInput(body),hash=requestHash({id,...input});return run(p,async(tx,a)=>{
   const row=await find(tx,id,true);if(row.account_id===a.id)fail(403,'HUB_ADMISSION_SELF_REVIEW','不能审核自己的加入申请。');
   const prior=await replay(tx,p,input.requestKey,hash);if(prior)return prior;
   if(row.revision!==input.baseRevision)fail(409,'HUB_ADMISSION_VERSION_CONFLICT','申请材料已变化，请核对最新材料。');
   const next=transition(row.status,input.action);
   const target=await tx.account.findFirst({where:{id:row.account_id,tenantId,status:'active'},select:{id:true,emailNormalized:true,emailVerifiedAt:true}});if(!target)fail(409,'HUB_ADMISSION_ACCOUNT_UNAVAILABLE','申请账号已停用，不能批准或处理。');
   if(!target.emailVerifiedAt||target.emailNormalized!==row.material.registration.email)fail(409,'HUB_ADMISSION_EMAIL_CHANGED','验证邮箱绑定已变化，请先核验身份；原材料保留。');
   const rows=await tx.$queryRawUnsafe('UPDATE rh_admission.application SET status=$1,revision=revision+1,allow_resubmit=$5,updated_at=now() WHERE id=$2 AND tenant_id=$3 AND revision=$4 RETURNING *',next,id,tenantId,input.baseRevision,input.allowResubmit);
   if(rows.length!==1)fail(409,'HUB_ADMISSION_VERSION_CONFLICT','申请已由其他管理员处理。');return event(tx,p,rows[0],{action:input.action,reason:input.reason,requestKey:input.requestKey,hash});
  },{admin:true});},
  submit:(p,body)=>{const input=submissionInput(body),hash=requestHash(input);return run(p,async tx=>{
   const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3 FOR UPDATE',tenantId,hubKey,p.accountId);const row=rows[0];if(!row)fail(404,'HUB_ADMISSION_NOT_FOUND','原申请尚未核对，不能重复创建。');
   const prior=await replay(tx,p,input.requestKey,hash);if(prior)return prior;
   if(row.revision!==input.baseRevision)fail(409,'HUB_ADMISSION_VERSION_CONFLICT','补充要求已变化，请重新核对。');
   if(input.action==='resubmit'&&row.status==='rejected'&&!row.allow_resubmit)fail(403,'HUB_ADMISSION_RESUBMISSION_NOT_ALLOWED','此申请尚未获准重申，请联系管理员。');
   const next=transition(row.status,input.action),material={registration:row.material.registration,supplement:input.text};
   const updated=await tx.$queryRawUnsafe('UPDATE rh_admission.application SET status=$1,revision=revision+1,allow_resubmit=false,material_version=material_version+1,material=$2::jsonb,updated_at=now() WHERE id=$3 AND tenant_id=$4 AND revision=$5 RETURNING *',next,JSON.stringify(material),row.id,tenantId,input.baseRevision);
   if(updated.length!==1)fail(409,'HUB_ADMISSION_VERSION_CONFLICT','申请已变化，请核对最新结果。');return event(tx,p,updated[0],{action:input.action,reason:input.text,requestKey:input.requestKey,hash});
  });},
  operation:(p,key,proof={})=>run(p,async(tx,actor)=>{
   if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))fail(400,'HUB_ADMISSION_INPUT_INVALID','操作标识无效。');
   only(proof,['applicationId','action','baseRevision','requestHash']);
   const hasProof=Object.keys(proof).length>0,revision=Number(proof.baseRevision);
   if(hasProof&&(!Number.isSafeInteger(revision)||revision<1||!/^[a-f0-9]{64}$/.test(proof.requestHash??'')||typeof proof.applicationId!=='string'))fail(400,'HUB_ADMISSION_INPUT_INVALID','无法核对原操作，请保留原输入。');
   const rows=await tx.$queryRawUnsafe('SELECT result,application_id,request_hash,action,revision FROM rh_admission.event WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3',tenantId,p.accountId,key);
   const row=rows[0]?await find(tx,rows[0].application_id):proof.applicationId?await find(tx,proof.applicationId,true):null;
   if(!row)fail(404,'HUB_ADMISSION_OPERATION_UNKNOWN','尚未查到可确认的原结果，请保留输入后继续核对。');
   if(row.account_id!==actor.id){if(!isAdmin(actor))fail(403,'HUB_ADMISSION_FORBIDDEN','当前账号不再具有该审核回执的查看权限。');await assertApprovedInTransaction(tx,p,hubKey);}
   const binding=hasProof?{applicationId:proof.applicationId,action:proof.action,baseRevision:revision,requestKey:key,requestHash:proof.requestHash}:{};
   if(rows[0]){
    if(hasProof&&(rows[0].application_id!==proof.applicationId||rows[0].action!==proof.action||rows[0].revision!==revision+1||rows[0].request_hash!==proof.requestHash))fail(409,'HUB_ADMISSION_REQUEST_CONFLICT','原回执与本次操作不一致，请保留输入后核对。');
    return{...binding,state:'committed',result:rows[0].result};
   }
   if(!Number.isSafeInteger(revision)||revision<1||!/^[a-f0-9]{64}$/.test(proof.requestHash??''))fail(400,'HUB_ADMISSION_INPUT_INVALID','无法核对原操作，请保留原输入。');
   if(row.account_id===actor.id&&!['supplement','resubmit'].includes(proof.action)||row.account_id!==actor.id&&!['approve','needs_information','reject'].includes(proof.action))fail(403,'HUB_ADMISSION_FORBIDDEN','原操作与当前身份不符。');
   if(row.revision!==revision)return{...binding,state:'superseded',revision:row.revision,status:row.status};
   transition(row.status,proof.action);
   if(proof.action==='resubmit'&&!row.allow_resubmit)fail(403,'HUB_ADMISSION_RESUBMISSION_NOT_ALLOWED','此申请尚未获准重申。');
   return{...binding,state:'unsubmitted',revision:row.revision};
  }),
 };
}
