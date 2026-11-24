import {randomUUID} from 'node:crypto';
import {invalid,isTenantAdmin,only,researchError} from '../research-studies/contract.mjs';
import {canManageRelease} from './policy-input.mjs';

const fail=(status,code,message)=>{throw researchError(status,code,message);};
const denied=()=>fail(403,'CENTER_FORBIDDEN','当前账号没有该中心操作权限。');
const missing=()=>fail(404,'CENTER_NOT_FOUND','中心或记录不存在。');
const conflict=message=>fail(409,'CENTER_CONFLICT',message);
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))invalid();return value;};
const version=value=>{
 if(typeof value==='string'&&/^[1-9][0-9]{0,9}$/.test(value))value=Number(value);
 if(!Number.isInteger(value)||value<1||value>2147483647)invalid();return value;
};
const label=(value,max)=>{
 if(typeof value!=='string'||!value.trim()||value.trim().length>max||value.includes('\0'))invalid();
 return value.trim();
};
const ymd=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))invalid();
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)invalid();
 return value;
};
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const installed=async tx=>(await tx.$queryRaw`SELECT to_regclass('rh_center.attribution') IS NOT NULL AS ready`)[0]?.ready===true;
async function lockStudy(tx,ctx){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['rh_center',ctx.tenantId,ctx.studyId])},0))::text AS locked`;
}
async function findCenter(tx,ctx,centerId){
 const [row]=await tx.$queryRaw`SELECT id,code,name,active FROM rh_center.center
  WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND id=${centerId}`;
 if(!row)missing();return row;
}
async function audit(tx,user,ctx,action,target,meta){
 await tx.auditLog.createMany({data:{id:'rh-audit-'+randomUUID(),...scope(ctx),accountId:user.accountId,
  action:'researchhub.center.'+action,target,meta}});
}

export async function enrollmentCentersInTransaction(tx,user,ctx,{lock=false}={}){
 if(!await installed(tx))return {required:false,items:[]};
 if(lock)await lockStudy(tx,ctx);
 const admin=isTenantAdmin(user);
 const [state]=await tx.$queryRaw`SELECT count(*)::int AS count,
  COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name) ORDER BY c.code) FILTER(
   WHERE c.active AND (${admin} OR EXISTS(SELECT FROM rh_center.access a WHERE a.tenant_id=c.tenant_id
    AND a.study_id=c.study_id AND a.center_id=c.id AND a.actor_id=${user.accountId} AND a.active))), '[]'::jsonb) AS items
  FROM rh_center.center c WHERE c.tenant_id=${ctx.tenantId} AND c.study_id=${ctx.studyId}`;
 return {required:state.count>0,items:state.items};
}
export async function selectEnrollmentCenterInTransaction(tx,user,ctx,centerId){
 if(centerId!==undefined)id(centerId);
 const {required,items}=await enrollmentCentersInTransaction(tx,user,ctx,{lock:true});
 if(!required){if(centerId!==undefined)missing();return null;}
 if(!items.length)denied();
 const selected=centerId===undefined&&items.length===1?items[0]:items.find(item=>item.id===centerId);
 if(!selected){
  if(centerId!==undefined)denied();
  fail(400,'CENTER_SELECTION_REQUIRED','请选择此次入组的研究中心。');
 }
 return selected;
}
export async function bindEnrollmentCenterInTransaction(tx,user,ctx,enrollmentId,center){
 if(!center)return;
 await tx.$executeRaw`INSERT INTO rh_center.attribution(tenant_id,study_id,enrollment_id,version,center_id,reason,created_by,approved_by,approved_at)
  VALUES (${ctx.tenantId},${ctx.studyId},${id(enrollmentId)},1,${id(center.id)},'正式入组',${user.accountId},${user.accountId},now())`;
 await audit(tx,user,ctx,'enroll',enrollmentId,{centerId:center.id});
}
export async function enrollmentCenterInTransaction(tx,user,ctx,enrollmentId){
 if(!enrollmentId||!await installed(tx))return null;
 const {configure,approve}=await permissions(tx,user,ctx);
 const [row]=await tx.$queryRaw`WITH v AS (SELECT tenant_id,study_id,center_id FROM rh_center.attribution
   WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND enrollment_id=${id(enrollmentId)} AND approved_at IS NOT NULL
   ORDER BY version DESC LIMIT 1)
  SELECT c.id,c.code,c.name FROM v JOIN rh_center.center c
  ON (c.tenant_id,c.study_id,c.id)=(v.tenant_id,v.study_id,v.center_id)
  WHERE (${configure||approve} OR EXISTS(SELECT FROM rh_center.access a WHERE a.tenant_id=c.tenant_id
    AND a.study_id=c.study_id AND a.center_id=c.id AND a.actor_id=${user.accountId} AND a.active))`;
 return row??null;
}

export async function enrollmentCenterCorrectionsInTransaction(tx,user,ctx,enrollmentId){
 if(!enrollmentId||!await installed(tx))return null;
 const {configure,approve}=await permissions(tx,user,ctx);
 if(!configure&&!approve)return null;
 const options=await tx.$queryRaw`SELECT id,code,name FROM rh_center.center
  WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} ORDER BY code`;
 if(!options.length)return null;
 const items=await tx.$queryRaw`SELECT version,center_id AS "centerId",reason,
  CASE WHEN approved_at IS NULL THEN 'pending' ELSE 'approved' END AS status
  FROM rh_center.attribution WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId}
   AND enrollment_id=${id(enrollmentId)} ORDER BY version DESC`;
 return {canSubmit:configure,canApprove:approve,options,items};
}

async function permissions(tx,user,ctx){
 const [feature,account,projectMember,groupMember]=await Promise.all([
  tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ctx.tenantId,featureKey:'study_operations',enabled:true}}),
  tx.account.findFirst({where:{id:user.accountId,tenantId:ctx.tenantId,status:'active'},select:{tenantId:true,role:true,isTenantAdmin:true}}),
  tx.researchProjectMembership.findFirst({where:{...scope(ctx),accountId:user.accountId,status:'active'}}),
  tx.studyGroupMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}})
 ]);
 if(!feature)fail(403,'FEATURE_NOT_ENABLED','当前租户尚未开通研究执行。');
 if(!account)denied();
 const configure=canManageRelease({account,projectMember,groupMember});
 const role=groupMember?.role;
 const approve=isTenantAdmin(account)||(account.role==='researcher'&&account.isTenantAdmin===false&&
  projectMember?.roleKey==='project_manager'&&role?.status==='active'&&role.tenantId===ctx.tenantId&&
  role.menuPermissions?.includes('workbench')&&role.buttonPermissions?.includes('study.review'));
 return {configure,approve};
}
async function studyEnrollment(tx,ctx,enrollmentId){
 const row=await tx.studyEnrollment.findFirst({where:{...scope(ctx),id:enrollmentId,acceptanceFixture:false,
  enrolledAt:{not:null},subject:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId,
   deletedAt:null,acceptanceFixture:false}},select:{id:true}});
 if(!row)missing();
}

async function listMemberOptions(tx,ctx){
 const [projectMembers,groupMembers]=await Promise.all([
  tx.researchProjectMembership.findMany({where:{...scope(ctx),status:'active'},select:{accountId:true}}),
  tx.studyGroupMembership.findMany({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,status:'active',
   role:{tenantId:ctx.tenantId,status:'active',menuPermissions:{array_contains:['workbench']},buttonPermissions:{array_contains:['study.execute']}}},select:{accountId:true}})
 ]);
 const executing=new Set(groupMembers.map(member=>member.accountId));
 const ids=projectMembers.map(member=>member.accountId).filter(accountId=>executing.has(accountId));
 return tx.account.findMany({where:{tenantId:ctx.tenantId,status:'active',OR:[
  {role:'researcher',isTenantAdmin:false,id:{in:ids}},
  {role:'tenant_admin',isTenantAdmin:true}
 ]},select:{id:true,displayName:true},orderBy:[{displayName:'asc'},{id:'asc'}]});
}

const projectTarget=(tx,ctx)=>tx.enrollmentTarget.findFirst({
 where:scope(ctx),orderBy:{version:'desc'},select:{totalTarget:true,version:true,reason:true,
  protocolVersionId:true,armTargets:true,plannedPeriodStart:true,plannedPeriodEnd:true}
});
async function reservedTarget(tx,ctx,exceptCenter=null){
 const [row]=await tx.$queryRaw`SELECT COALESCE(SUM(target),0)::bigint AS reserved FROM (
  SELECT MAX(target) AS target FROM (
   SELECT DISTINCT ON(center_id,(approved_at IS NULL)) center_id,target
   FROM rh_center.plan WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId}
    AND (${exceptCenter}::text IS NULL OR center_id<>${exceptCenter})
   ORDER BY center_id,(approved_at IS NULL),version DESC
  ) revisions GROUP BY center_id
 ) maxima`;
 return BigInt(row.reserved);
}

async function ensurePlanBudget(tx,ctx,centerId,target){
 const current=await projectTarget(tx,ctx);
 if(!current)conflict('请先配置课题入组总目标。');
 if(BigInt(target)+await reservedTarget(tx,ctx,centerId)>BigInt(current.totalTarget))conflict('中心计划合计超过课题总目标。');
}

export function createCenterService({studies,authorizeParticipation}){
 const run=(user,studyId,write,action)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
  const grants=await permissions(tx,user,ctx);
  if(write&&!grants[write])denied();
  if(!await installed(tx)){
   if(write)fail(503,'CENTER_STORAGE_UNAVAILABLE','中心管理尚未启用。');
   return {items:[],permissions:{configure:false,approve:false},available:false};
  }
  if(write)await lockStudy(tx,ctx);
  return action(tx,ctx,grants);
 });
 return{
  list:(user,studyId)=>run(user,studyId,null,async(tx,ctx,grants)=>{
   if(!grants.configure&&!grants.approve)await authorizeParticipation(tx,user,ctx.studyGroupId,ctx.executionProjectId);
   const all=grants.configure||grants.approve;
   const items=await tx.$queryRaw`SELECT c.id,c.code,c.name,c.active,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('version',v.version,'target',v.target,'startDate',v.start_date::text,
     'endDate',v.end_date::text,'status',CASE WHEN v.approved_at IS NULL THEN 'pending' ELSE 'approved' END,
     'reason',CASE WHEN ${all} THEN v.reason ELSE NULL END) ORDER BY v.version DESC)
     FROM rh_center.plan v WHERE (v.tenant_id,v.study_id,v.center_id)=(c.tenant_id,c.study_id,c.id)
       AND (${all} OR v.approved_at IS NOT NULL)), '[]'::jsonb) AS plans
    , CASE WHEN ${grants.configure} THEN COALESCE((SELECT jsonb_agg(a.actor_id ORDER BY a.actor_id)
      FROM rh_center.access a WHERE (a.tenant_id,a.study_id,a.center_id)=(c.tenant_id,c.study_id,c.id) AND a.active), '[]'::jsonb) END AS "memberAccountIds"
    FROM rh_center.center c WHERE c.tenant_id=${ctx.tenantId} AND c.study_id=${ctx.studyId}
     AND (${all} OR EXISTS(SELECT FROM rh_center.access a WHERE (a.tenant_id,a.study_id,a.center_id)=(c.tenant_id,c.study_id,c.id)
       AND a.actor_id=${user.accountId} AND a.active)) ORDER BY c.code`;
   const memberOptions=grants.configure?await listMemberOptions(tx,ctx):[];
   const target=all?await projectTarget(tx,ctx):null;
   return {items,memberOptions,permissions:grants,available:true,
    projectTarget:target?{target:target.totalTarget,version:target.version,reason:target.reason}:null};
  }),
  setProjectTarget:(user,studyId,body)=>run(user,studyId,'approve',async(tx,ctx)=>{
   only(body,['target','reason','expectedVersion']);
   const target=version(body.target),reason=label(body.reason,500);
   const expected=body.expectedVersion===null?null:version(body.expectedVersion);
   const previous=await projectTarget(tx,ctx);
   if((previous?.version??null)!==expected)conflict('课题总目标已更新，请刷新核对。');
   if(BigInt(target)<await reservedTarget(tx,ctx))conflict('课题总目标不能低于已分配和待确认的中心人数。');
   const {armTargets,protocolVersionId,plannedPeriodStart,plannedPeriodEnd}=previous??{};
   const next=(previous?.version??0)+1;
   await tx.enrollmentTarget.create({data:{...scope(ctx),version:next,totalTarget:target,reason,createdBy:user.accountId,
    protocolVersionId,plannedPeriodStart,plannedPeriodEnd,...(armTargets!=null?{armTargets}:{})}});
   await audit(tx,user,ctx,'target.confirm',ctx.studyId,{version:next,target,reason,previousTarget:previous?.totalTarget??null});
   return {projectTarget:{target,version:next,reason}};
  }),
  create:(user,studyId,body)=>run(user,studyId,'configure',async(tx,ctx)=>{
   only(body,['code','name']);const code=label(body.code,32).toUpperCase(),name=label(body.name,120);
   if(!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(code))invalid();
   const centerId='rh-center-'+randomUUID();
   const [center]=await tx.$queryRaw`INSERT INTO rh_center.center(tenant_id,study_id,id,code,name)
    VALUES(${ctx.tenantId},${ctx.studyId},${centerId},${code},${name})
    ON CONFLICT(tenant_id,study_id,code) DO NOTHING RETURNING id,code,name,active`;
   if(!center)conflict('中心编号已存在。');
   await audit(tx,user,ctx,'create',centerId,{code,name});return {center};
  }),
  update:(user,studyId,centerId,body)=>run(user,studyId,'configure',async(tx,ctx)=>{
   only(body,['name','active']);if(!Object.keys(body).length||body.active!==undefined&&typeof body.active!=='boolean')invalid();
   const previous=await findCenter(tx,ctx,id(centerId)),name=body.name===undefined?previous.name:label(body.name,120),active=body.active??previous.active;
   const [center]=await tx.$queryRaw`UPDATE rh_center.center SET name=${name},active=${active}
    WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND id=${centerId} RETURNING id,code,name,active`;
   await audit(tx,user,ctx,'update',centerId,{previous,center});return {center};
  }),
  setAccess:(user,studyId,centerId,body)=>run(user,studyId,'configure',async(tx,ctx)=>{
   only(body,['accountId','active']);const accountId=id(body.accountId);if(typeof body.active!=='boolean')invalid();
   await findCenter(tx,ctx,id(centerId));
   const account=await tx.account.findFirst({where:{tenantId:ctx.tenantId,id:accountId,...(body.active?{status:'active'}:{})},select:{authVersion:true}});
   if(!account)missing();
   if(body.active){
    await authorizeParticipation(tx,{tenantId:ctx.tenantId,accountId,authVersion:account.authVersion},ctx.studyGroupId,ctx.executionProjectId);
   }
   await tx.$executeRaw`INSERT INTO rh_center.access(tenant_id,study_id,center_id,actor_id,active)
    VALUES(${ctx.tenantId},${ctx.studyId},${centerId},${accountId},${body.active})
    ON CONFLICT(tenant_id,study_id,center_id,actor_id) DO UPDATE SET active=EXCLUDED.active`;
   await audit(tx,user,ctx,'access',centerId,{accountId,active:body.active});return {centerId,accountId,active:body.active};
  }),
  submitPlan:(user,studyId,centerId,body)=>run(user,studyId,'configure',async(tx,ctx)=>{
   only(body,['target','startDate','endDate','reason']);
   const target=version(body.target),startDate=ymd(body.startDate),endDate=body.endDate===null||body.endDate===undefined?null:ymd(body.endDate);
   const reason=label(body.reason,500);if(endDate&&endDate<startDate)invalid();
   if(!(await findCenter(tx,ctx,id(centerId))).active)conflict('中心已停用。');
   const [current]=await tx.$queryRaw`SELECT version,approved_at FROM rh_center.plan
    WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND center_id=${centerId} ORDER BY version DESC LIMIT 1`;
   if(current&&!current.approved_at)conflict('该中心已有待审核计划。');
   await ensurePlanBudget(tx,ctx,centerId,target);
   const next=(current?.version??0)+1;
   await tx.$executeRaw`INSERT INTO rh_center.plan(tenant_id,study_id,center_id,version,target,start_date,end_date,reason,created_by)
    VALUES(${ctx.tenantId},${ctx.studyId},${centerId},${next},${target},${startDate}::date,${endDate}::date,${reason},${user.accountId})`;
   await audit(tx,user,ctx,'plan.submit',centerId,{version:next,target,startDate,endDate,reason});
   return {plan:{version:next,target,startDate,endDate,reason,status:'pending'}};
  }),
  approvePlan:(user,studyId,centerId,planVersion)=>run(user,studyId,'approve',async(tx,ctx)=>{
   await findCenter(tx,ctx,id(centerId));const next=version(planVersion);
   const [proposal]=await tx.$queryRaw`SELECT target,approved_at FROM rh_center.plan
    WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND center_id=${centerId} AND version=${next}`;
   if(!proposal)missing();
   if(proposal.approved_at)return {centerId,version:next,status:'approved'};
   await ensurePlanBudget(tx,ctx,centerId,proposal.target);
   await tx.$executeRaw`UPDATE rh_center.plan SET approved_by=${user.accountId},approved_at=now()
    WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND center_id=${centerId} AND version=${next} AND approved_at IS NULL`;
   await audit(tx,user,ctx,'plan.approve',centerId,{version:next});return {centerId,version:next,status:'approved'};
  }),
  submitCorrection:(user,studyId,enrollmentId,body)=>run(user,studyId,'configure',async(tx,ctx)=>{
   only(body,['centerId','reason']);const centerId=id(body.centerId),reason=label(body.reason,500);
   await studyEnrollment(tx,ctx,id(enrollmentId));await findCenter(tx,ctx,centerId);
   const [current]=await tx.$queryRaw`SELECT version,center_id,approved_at FROM rh_center.attribution
    WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND enrollment_id=${enrollmentId} ORDER BY version DESC LIMIT 1`;
   if(current&&!current.approved_at)conflict('已有待审核的归属更正。');
   if(current?.center_id===centerId)conflict('当前入组已归属该中心。');
   const next=(current?.version??0)+1;
   await tx.$executeRaw`INSERT INTO rh_center.attribution(tenant_id,study_id,enrollment_id,version,center_id,reason,created_by)
    VALUES(${ctx.tenantId},${ctx.studyId},${enrollmentId},${next},${centerId},${reason},${user.accountId})`;
   await audit(tx,user,ctx,'correction.submit',enrollmentId,{version:next,originalCenterId:current?.center_id??null,centerId,reason});
   return {enrollmentId,centerId,version:next,status:'pending'};
  }),
  approveCorrection:(user,studyId,enrollmentId,revision)=>run(user,studyId,'approve',async(tx,ctx)=>{
   await studyEnrollment(tx,ctx,id(enrollmentId));const next=version(revision);
   const [row]=await tx.$queryRaw`SELECT center_id,approved_at FROM rh_center.attribution WHERE tenant_id=${ctx.tenantId}
    AND study_id=${ctx.studyId} AND enrollment_id=${enrollmentId} AND version=${next}`;
   if(!row)missing();
   if(!row.approved_at){
    await tx.$executeRaw`UPDATE rh_center.attribution SET approved_by=${user.accountId},approved_at=now()
     WHERE tenant_id=${ctx.tenantId} AND study_id=${ctx.studyId} AND enrollment_id=${enrollmentId} AND version=${next} AND approved_at IS NULL`;
    await audit(tx,user,ctx,'correction.approve',enrollmentId,{version:next,centerId:row.center_id});
   }
   return {enrollmentId,centerId:row.center_id,version:next,status:'approved'};
  })
 };
}

export async function readCenterEnrollment(tx,{tenantId,account,accountId,projects},asOf){
 if(!projects.length||!await installed(tx))return new Map();
 const admin=isTenantAdmin(account);
 const scope=JSON.stringify(projects.map(p=>({group_id:p.studyGroupId,project_id:p.id,
  may_manage:p.permissions?.menus?.includes('workbench')===true&&
    p.permissions?.buttons?.some(permission=>['study.configure','study.review'].includes(permission))===true})));
 const twoWeeks=14*86400000;
 const recent=new Date(asOf.getTime()-twoWeeks),prior=new Date(asOf.getTime()-2*twoWeeks);
 const rows=await tx.$queryRaw`
  WITH scope AS (
   SELECT p.group_id,p.project_id,b.id AS study_id,(${admin} OR (p.may_manage AND EXISTS(
     SELECT FROM public.research_project_membership m WHERE m."tenantId"=b.tenant_id AND m."studyGroupId"=p.group_id
     AND m."researchProjectId"=p.project_id AND m."accountId"=${accountId} AND m.status='active' AND m."roleKey"='project_manager'
   ))) AS full_access
   FROM jsonb_to_recordset(${scope}::jsonb) AS p(group_id text,project_id text,may_manage boolean)
   JOIN rh_research.study_binding b ON b.tenant_id=${tenantId} AND b.study_group_id=p.group_id AND b.execution_project_id=p.project_id
   WHERE EXISTS(SELECT FROM rh_center.center c WHERE c.tenant_id=b.tenant_id AND c.study_id=b.id)
  ), centers AS (
   SELECT c.study_id,c.id,c.code,c.name,c.active
   FROM rh_center.center c JOIN scope p ON p.study_id=c.study_id
   WHERE c.tenant_id=${tenantId} AND (p.full_access OR EXISTS(
     SELECT FROM rh_center.access a WHERE (a.tenant_id,a.study_id,a.center_id)=(c.tenant_id,c.study_id,c.id)
      AND a.actor_id=${accountId} AND a.active
   ))
  ), counts AS (
   SELECT p.study_id,v.center_id,COUNT(*)::int AS actual,
    (COUNT(*) FILTER(WHERE e.status IN ('enrolled','grouped','in_progress') AND e."withdrawnAt" IS NULL))::int AS active,
    (COUNT(*) FILTER(WHERE e."enrolledAt">${recent}))::int AS "last14",
    (COUNT(*) FILTER(WHERE e."enrolledAt">${prior} AND e."enrolledAt"<=${recent}))::int AS "previous14"
   FROM scope p JOIN public.study_enrollment e ON e."tenantId"=${tenantId} AND e."studyGroupId"=p.group_id AND e."researchProjectId"=p.project_id
   JOIN public.subject s ON s.id=e."subjectId" AND s."tenantId"=e."tenantId"
    AND s."studyGroupId"=e."studyGroupId" AND s."researchProjectId"=e."researchProjectId"
   LEFT JOIN LATERAL (
    SELECT v.center_id FROM rh_center.attribution v WHERE v.tenant_id=e."tenantId" AND v.study_id=p.study_id
     AND v.enrollment_id=e.id AND v.approved_at<=${asOf}
    ORDER BY v.version DESC LIMIT 1
   ) v ON TRUE
   WHERE NOT e."acceptanceFixture" AND NOT s."acceptanceFixture" AND s."deletedAt" IS NULL
    AND e."enrolledAt" IS NOT NULL AND e."enrolledAt"<=${asOf} AND e.status IN ('enrolled','grouped','in_progress','completed','withdrawn')
    AND (p.full_access OR EXISTS(SELECT FROM centers c WHERE c.study_id=p.study_id AND c.id=v.center_id))
   GROUP BY p.study_id,v.center_id
  )
  SELECT s.group_id AS "studyGroupId",s.project_id AS "researchProjectId",s.study_id AS "studyId",NOT s.full_access AS restricted,
   c.id,c.code,c.name,c.active,COALESCE(a.actual,0) AS actual,COALESCE(a.active,0) AS "activeCount",
   COALESCE(a."last14",0) AS "last14",COALESCE(a."previous14",0) AS "previous14",
   plan.version AS "planVersion",plan.target,
   (plan.start_date::timestamp AT TIME ZONE 'Asia/Shanghai') AS "planStart",
   ((plan.end_date+1)::timestamp AT TIME ZONE 'Asia/Shanghai') AS "planEnd",
   CASE WHEN s.full_access THEN jsonb_build_object('actual',COALESCE(unknown.actual,0),'active',COALESCE(unknown.active,0),
    'last14',COALESCE(unknown."last14",0),'previous14',COALESCE(unknown."previous14",0)) END AS unassigned
  FROM scope s LEFT JOIN centers c ON c.study_id=s.study_id
  LEFT JOIN counts a ON a.study_id=s.study_id AND a.center_id=c.id
  LEFT JOIN counts unknown ON unknown.study_id=s.study_id AND unknown.center_id IS NULL AND s.full_access
  LEFT JOIN LATERAL (
   SELECT v.version,v.target,v.start_date,v.end_date FROM rh_center.plan v
   WHERE v.tenant_id=${tenantId} AND v.study_id=c.study_id AND v.center_id=c.id AND v.approved_at<=${asOf}
   ORDER BY v.version DESC LIMIT 1
  ) plan ON TRUE ORDER BY s.group_id,s.project_id,c.code
 `;
 const result=new Map();
 for(const row of rows){
  const {studyGroupId,researchProjectId,studyId,restricted,unassigned,...center}=row;
  const key=studyGroupId+'\0'+researchProjectId;
  if(!result.has(key))result.set(key,{studyId,centers:[],unassigned,restricted});
  if(center.id!==null)result.get(key).centers.push(center);
 }
 return result;
}
