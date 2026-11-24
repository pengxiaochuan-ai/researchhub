import {readCenterEnrollment} from '../server/research-execution/centers.mjs';
const windowDays=14;
const windowMs=windowDays*86400000;
const toDate=value=>{
 const parsed=value instanceof Date?value:typeof value==='string'?new Date(value):null;
 return parsed&&Number.isFinite(parsed.getTime())?parsed:null;
};

export function presentEnrollment(project,row,asOf){
 const actual=row?.actual??0,active=row?.active??0;
 const target=Number.isSafeInteger(row?.target)&&row.target>0?row.target:null;
 const start=toDate(row?.planStart),end=toDate(row?.planEnd);
 const hasWindow=target!==null&&start&&end&&end>start;
 const elapsed=hasWindow?Math.max(0,asOf-start):0;
 const pace=hasWindow?target*Math.min(1,elapsed/(end-start)):null;
 const expected=pace===null?null:Math.floor(pace);
 const alert=hasWindow&&asOf>=end&&actual<target?'target_overdue'
  :hasWindow&&elapsed>=windowMs&&actual<expected*0.8?'behind_plan':null;
 return{studyGroupId:project.studyGroupId,researchProjectId:project.id,title:project.name,
  actual,active,target,planStart:start?.toISOString()??null,planEnd:end?.toISOString()??null,
  previous14:row?.previous14??0,last14:row?.last14??0,expected,alert};
}

export async function readMyResearchEnrollment(tx,{tenantId,account,accountId,projects},asOf=new Date()){
 // The overview already rechecked current account, tenant, active group and project membership
 // within its authorization lock. Follow the existing all-subject scope, not limited individual grants.
 const admin=account.role==='tenant_admin'&&account.isTenantAdmin===true;
 const researcher=account.role==='researcher'&&account.isTenantAdmin===false;
 const visible=projects.filter(project=>admin||researcher&&Array.isArray(project.permissions.menus)&&project.permissions.menus.includes('subjects'));
 const result={asOf:asOf.toISOString(),windowDays,projects:[],centerPlans:'not_available'};
 if(!visible.length)return {...result,status:'restricted'};
 const feature=await tx.tenantFeatureEntitlement.findFirst({where:{tenantId,featureKey:'study_operations',enabled:true},select:{id:true}});
 if(!feature)return {...result,status:'restricted'};
 const recent=new Date(asOf.getTime()-windowMs),prior=new Date(asOf.getTime()-2*windowMs);
 const keys=JSON.stringify(visible.map(p=>({group_id:p.studyGroupId,project_id:p.id})));
 const rows=await tx.$queryRaw`
   WITH scope AS (
    SELECT DISTINCT group_id,project_id FROM jsonb_to_recordset(${keys}::jsonb) AS p(group_id text, project_id text)
   ), actuals AS (
    SELECT e."studyGroupId", e."researchProjectId", COUNT(*)::int AS actual,
     (COUNT(*) FILTER (WHERE e.status IN ('enrolled','grouped','in_progress') AND e."withdrawnAt" IS NULL))::int AS active,
     (COUNT(*) FILTER (WHERE e."enrolledAt" > ${recent}))::int AS "last14",
     (COUNT(*) FILTER (WHERE e."enrolledAt" > ${prior} AND e."enrolledAt" <= ${recent}))::int AS "previous14"
    FROM study_enrollment e
    INNER JOIN scope p ON p.group_id=e."studyGroupId" AND p.project_id=e."researchProjectId"
    INNER JOIN subject s ON s.id=e."subjectId" AND s."tenantId"=e."tenantId"
      AND s."studyGroupId"=e."studyGroupId" AND s."researchProjectId"=e."researchProjectId"
    WHERE e."tenantId"=${tenantId} AND NOT e."acceptanceFixture" AND NOT s."acceptanceFixture" AND s."deletedAt" IS NULL
      AND e."enrolledAt" IS NOT NULL AND e."enrolledAt" <= ${asOf}
      AND e.status IN ('enrolled','grouped','in_progress','completed','withdrawn')
    GROUP BY e."studyGroupId",e."researchProjectId"
   )
   SELECT p.group_id AS "studyGroupId",p.project_id AS "researchProjectId",a.actual,a.active,a."last14",a."previous14",
    t."totalTarget" AS target,t."plannedPeriodStart" AS "planStart",t."plannedPeriodEnd" AS "planEnd"
   FROM scope p
   LEFT JOIN actuals a ON a."studyGroupId"=p.group_id AND a."researchProjectId"=p.project_id
   LEFT JOIN LATERAL (
    SELECT "totalTarget","plannedPeriodStart","plannedPeriodEnd" FROM enrollment_target
    WHERE "tenantId"=${tenantId} AND "studyGroupId"=p.group_id AND "researchProjectId"=p.project_id AND "createdAt"<=${asOf}
    ORDER BY version DESC LIMIT 1
   ) t ON TRUE
 `;
 const projectKey=(group,project)=>group+'\0'+project;
 const byProject=new Map(rows.map(row=>[projectKey(row.studyGroupId,row.researchProjectId),row]));
 const centerStats=await readCenterEnrollment(tx,{tenantId,account,accountId,projects:visible},asOf);
 const enrolledProjects=visible.flatMap(project=>{
  const key=projectKey(project.studyGroupId,project.id);
  const centerData=centerStats.get(key);
  if(!centerData)return [presentEnrollment(project,byProject.get(key),asOf)];
  const centers=centerData.centers.map(center=>{
   const counts=presentEnrollment(project,{...center,active:center.activeCount},asOf);
   return {...counts,id:center.id,code:center.code,name:center.name,enabled:center.active,planVersion:center.planVersion??null};
  });
  if(centerData.restricted&&!centers.length)return [];
  const totals=centerData.restricted?Object.fromEntries(['actual','active','last14','previous14'].map(field=>[
   field,centers.reduce((n,c)=>n+c[field],0)
  ])):byProject.get(key);
  const summary=presentEnrollment(project,totals,asOf);
  const remainingTarget=summary.target===null?null:summary.target-centers.reduce((total,center)=>total+(center.target??0),0);
  return [{...summary,centers,studyId:centerData.studyId,remainingTarget,
   unassigned:centerData.restricted?null:centerData.unassigned,centersRestricted:centerData.restricted}];
 });
 return {...result,status:enrolledProjects.length?'ready':'restricted',
  centerPlans:centerStats.size?'available':'not_available',projects:enrolledProjects};
}
