import {isTenantAdmin,researchError} from './contract.mjs';
import {setContext} from './repository.mjs';
const order='updatedAt-desc-key-desc-v1';
const invalid=()=>{throw researchError(400,'RESEARCH_DIRECTORY_QUERY_INVALID','列表条件已变化或链接无效，请重新读取第一页。');};
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const timestamp=value=>{const raw=value instanceof Date?value.toISOString():String(value),base=new Date(raw).toISOString(),fraction=raw.match(/\.(\d{1,6})/)?.[1]??'';return base.slice(0,19)+'.'+fraction.padEnd(6,'0')+'Z';};
const cursorBinding=(user,q)=>({tenant:user.tenantId,actor:user.accountId,version:user.authVersion,q,order});
export function encodeDirectoryCursor(user,query,last){return Buffer.from(JSON.stringify({...cursorBinding(user,query.q??''),last:{key:last.key,time:timestamp(last.updated_at)}})).toString('base64url');}
export function readDirectoryQuery(input={},user){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['limit','q','cursor'].includes(k)))invalid();
 const rawLimit=input.limit??'20';if(typeof rawLimit!=='string'||!/^[1-9]\d{0,2}$/.test(rawLimit))invalid();const limit=Number(rawLimit);if(limit<1||limit>100)invalid();
 if(input.q!==undefined&&(typeof input.q!=='string'||input.q.length>200||input.q.includes('\0')))invalid();const q=(input.q??'').trim();let last=null;
 if(input.cursor!==undefined){
  if(typeof input.cursor!=='string'||input.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(input.cursor))invalid();let value;
  try{value=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{invalid();}
  if(!value||Object.keys(value).sort().join(',')!=='actor,last,order,q,tenant,version'||Object.entries(cursorBinding(user,q)).some(([k,v])=>value[k]!==v)||!value.last||Object.keys(value.last).sort().join(',')!=='key,time'||typeof value.last.key!=='string'||!/^(?:execution|intent):[A-Za-z0-9_-]{1,160}$/.test(value.last.key)||typeof value.last.time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.last.time)||!Number.isFinite(Date.parse(value.last.time))||timestamp(value.last.time)!==value.last.time)invalid();last={key:value.last.key,time:value.last.time};
 }
 return{limit,q,last};
}
export function legacyProjectPermitted(user,group,membership,project,member){
 if(!group||!project||group.tenantId!==user.tenantId||group.status!=='active'||project.tenantId!==user.tenantId||project.studyGroupId!==group.id||project.status!=='active')return false;
 if(isTenantAdmin(user))return true;
 return Boolean(membership?.tenantId===user.tenantId&&membership.studyGroupId===group.id&&membership.status==='active'&&membership.role?.tenantId===user.tenantId&&membership.role.status==='active'&&member?.tenantId===user.tenantId&&member.studyGroupId===group.id&&member.researchProjectId===project.id&&member.status==='active');
}
export function presentDirectoryItem(row){
 const hasIntent=row.intent_read===true,studyRead=hasIntent&&row.study_read===true,legacyRead=row.legacy_read===true;
 const intentUrl=hasIntent?'/pages/q01/?'+new URLSearchParams({researchCreation:'1',projectIntentId:row.intent_id}):null;
 const overview=studyRead?'/pages/s01/?'+new URLSearchParams({researchStudy:'1',studyId:row.study_id}):legacyRead?'/pages/s01/?'+new URLSearchParams({studyGroupId:row.group_id,researchProjectId:row.execution_id}):null;
 const canEdit=hasIntent&&row.can_edit===true;
 const fullSummary=Array.from(row.summary??''),summary=fullSummary.length>160?fullSummary.slice(0,159).join('')+'…':fullSummary.join('');
 return{key:row.key,kind:hasIntent?'intent':'execution',id:hasIntent?row.intent_id:row.execution_id,title:row.title,summary,status:row.status,updatedAt:new Date(row.updated_at).toISOString(),...(row.group_id?{studyGroupId:row.group_id,studyGroupName:row.group_name}:{}),...(row.execution_id?{executionProjectId:row.execution_id}:{}),...(hasIntent?{intentId:row.intent_id}:{}),...(studyRead?{studyId:row.study_id}:{}),links:{primary:overview??intentUrl,...(overview?{overview}:{}),...(canEdit?{edit:intentUrl}:{})},capabilities:{canEdit,canOpenStudy:Boolean(overview)}};
}
export function mergeDirectoryPages(pages,user,query,{reviewCursors=false}={}){
 const rows=pages.flatMap(p=>p.items).sort((a,b)=>timestamp(a.updated_at)<timestamp(b.updated_at)?1:timestamp(a.updated_at)>timestamp(b.updated_at)?-1:(a.key<b.key?1:a.key>b.key?-1:0));
 const total=pages.reduce((sum,p)=>sum+p.total,0),selected=rows.slice(0,query.limit);
 const nextCursor=rows.length>query.limit?encodeDirectoryCursor(user,query,selected.at(-1)):null;
 return{items:selected.map((row,index)=>({...presentDirectoryItem(row),...(reviewCursors?{reviewCursor:index===selected.length-1?nextCursor:encodeDirectoryCursor(user,query,row)}:{})})),total,capabilities:{canCreateProject:true},nextCursor};
}
async function readUnbound(tx,user,query){
 const [page]=await tx.$queryRaw`WITH allowed AS (
  SELECT 'intent:'||i.id AS key,i.id AS intent_id,NULL::text AS execution_id,NULL::text AS study_id,NULL::text AS group_id,NULL::text AS group_name,i.title,i.question AS summary,i.status,i.updated_at,true AS intent_read,false AS study_read,false AS legacy_read,true AS can_edit
  FROM rh_research.project_intent i WHERE i.tenant_id=${user.tenantId}
  AND NOT EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.tenant_id=i.tenant_id AND b.project_intent_id=i.id AND b.is_default)
  AND (i.owner_id=${user.accountId} OR ${isTenantAdmin(user)} OR EXISTS(SELECT 1 FROM rh_research.hub_role r JOIN public.study_group g ON g.id=r.study_group_id AND g."tenantId"=r.tenant_id JOIN rh_hub.hub h ON h.tenant_id=r.tenant_id AND h.hub_key=r.hub_key WHERE r.tenant_id=i.tenant_id AND r.hub_key=i.hub_key AND r.account_id=${user.accountId} AND r.role='owner' AND r.status='active' AND g.status='active' AND h.status='active'))
 ),filtered AS(SELECT * FROM allowed WHERE strpos(lower(title||' '||summary),lower(${query.q}))>0),page AS(
  SELECT * FROM filtered WHERE ${query.last===null} OR updated_at<${query.last?.time??null}::timestamptz OR (updated_at=${query.last?.time??null}::timestamptz AND key COLLATE "C"<${query.last?.key??null} COLLATE "C") ORDER BY updated_at DESC,key COLLATE "C" DESC LIMIT ${query.limit+1}
 )SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY updated_at DESC,key COLLATE "C" DESC) FROM page),'[]'::jsonb) AS items`;
 return page;
}
async function readGroup(tx,user,groupId,query){
 await setContext(tx,user,groupId);
 const [page]=await tx.$queryRaw`WITH g AS(SELECT * FROM public.study_group WHERE "tenantId"=${user.tenantId} AND id=${groupId}),
 gm AS(SELECT m.id,r."menuPermissions",r."dataScope" FROM public.study_group_membership m JOIN public.permission_role r ON r.id=m."roleId" AND r."tenantId"=m."tenantId" WHERE m."tenantId"=${user.tenantId} AND m."studyGroupId"=${groupId} AND m."accountId"=${user.accountId} AND m.status='active' AND r.status='active'),
 bound AS(SELECT b.id AS study_id,b.execution_project_id,b.study_group_id,b.hub_key,i.id AS intent_id,i.owner_id,i.title,i.question,i.status AS intent_status,i.updated_at FROM rh_research.study_binding b JOIN rh_research.project_intent i ON i.id=b.project_intent_id AND i.tenant_id=b.tenant_id WHERE b.tenant_id=${user.tenantId} AND b.study_group_id=${groupId} AND b.is_default),
 roots AS(SELECT p.id AS execution_id,p.name,p.description,p.status AS execution_status,p."updatedAt" AT TIME ZONE 'UTC' AS execution_updated_at,b.*,g.name AS group_name,g.status AS group_status,
  EXISTS(SELECT 1 FROM gm) AS group_member,
  EXISTS(SELECT 1 FROM gm WHERE jsonb_typeof("menuPermissions")='array' AND "menuPermissions" ? 'workbench') AS workbench,
  EXISTS(SELECT 1 FROM gm WHERE "dataScope"='group' AND jsonb_typeof("menuPermissions")='array' AND "menuPermissions" ? 'workbench') AS group_read,
  EXISTS(SELECT 1 FROM public.research_project_membership m WHERE m."tenantId"=${user.tenantId} AND m."studyGroupId"=${groupId} AND m."researchProjectId"=p.id AND m."accountId"=${user.accountId} AND m.status='active') AS project_member,
  EXISTS(SELECT 1 FROM rh_research.hub_role r JOIN rh_hub.hub h ON h.tenant_id=r.tenant_id AND h.hub_key=r.hub_key WHERE r.tenant_id=${user.tenantId} AND r.hub_key=b.hub_key AND r.study_group_id=${groupId} AND r.account_id=${user.accountId} AND r.role='owner' AND r.status='active' AND h.status='active' AND g.status='active') AS hub_owner
  FROM (SELECT * FROM public.research_project WHERE "tenantId"=${user.tenantId} AND "studyGroupId"=${groupId}) p FULL JOIN bound b ON b.execution_project_id=p.id CROSS JOIN g
 ),rights AS(SELECT *,
  (group_status='active' AND execution_status='active' AND (${isTenantAdmin(user)} OR(group_member AND project_member))) AS legacy_read,
  (intent_id IS NOT NULL AND group_status='active' AND execution_status='active' AND (${isTenantAdmin(user)} OR hub_owner OR group_read OR(workbench AND project_member))) AS study_read,
  (intent_id IS NOT NULL AND (owner_id=${user.accountId} OR ${isTenantAdmin(user)} OR hub_owner)) AS manage_intent
  FROM roots),allowed AS(SELECT *, (manage_intent OR study_read) AS intent_read FROM rights),projected AS(
  SELECT 'execution:'||COALESCE(execution_id,execution_project_id) AS key,CASE WHEN intent_read THEN intent_id END AS intent_id,COALESCE(execution_id,execution_project_id) AS execution_id,CASE WHEN intent_read AND study_read THEN study_id END AS study_id,${groupId}::text AS group_id,group_name,
  CASE WHEN intent_read THEN title ELSE name END AS title,CASE WHEN intent_read THEN question ELSE COALESCE(description,'') END AS summary,CASE WHEN intent_read THEN intent_status ELSE execution_status END AS status,CASE WHEN intent_read THEN updated_at ELSE execution_updated_at END AS updated_at,
  intent_read,study_read,legacy_read,(manage_intent AND study_read) AS can_edit FROM allowed WHERE intent_read OR legacy_read
 ),filtered AS(SELECT * FROM projected WHERE strpos(lower(title||' '||summary),lower(${query.q}))>0),page AS(
  SELECT * FROM filtered WHERE ${query.last===null} OR updated_at<${query.last?.time??null}::timestamptz OR(updated_at=${query.last?.time??null}::timestamptz AND key COLLATE "C"<${query.last?.key??null} COLLATE "C") ORDER BY updated_at DESC,key COLLATE "C" DESC LIMIT ${query.limit+1}
 )SELECT(SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY updated_at DESC,key COLLATE "C" DESC) FROM page),'[]'::jsonb) AS items`;
 return page;
}
export function createResearchDirectory({transact,legacyHints=()=>({canOpenDesignWorkspace:false})}){
 const list=(principal,input,reviewCursors=false)=>transact(principal,async(tx,user)=>{
  const query=readDirectoryQuery(input,user),groups=await tx.studyGroup.findMany({where:{tenantId:user.tenantId},select:{id:true},orderBy:{id:'asc'}}),pages=[await readUnbound(tx,user,query)];
  for(const group of groups)pages.push(await readGroup(tx,user,group.id,query));return mergeDirectoryPages(pages,user,query,{reviewCursors});
 });
 return{
  list:(principal,input)=>list(principal,input),
  // Request-local prefetch only; public list DTO and current authorization stay unchanged.
  listForReview:(principal,input)=>list(principal,input,true),
  execution:(principal,id,input={})=>transact(principal,async(tx,user)=>{
   if(!identifier(id)||!input||Object.keys(input).length!==1||!identifier(input.studyGroupId))invalid();await setContext(tx,user,input.studyGroupId,id);
   const [group,project,membership,member,account]=await Promise.all([
    tx.studyGroup.findFirst({where:{id:input.studyGroupId,tenantId:user.tenantId}}),tx.researchProject.findFirst({where:{id,tenantId:user.tenantId,studyGroupId:input.studyGroupId}}),tx.studyGroupMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:input.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}}),tx.researchProjectMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:input.studyGroupId,researchProjectId:id,accountId:user.accountId,status:'active'}}),tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId},select:{displayName:true,tenant:{select:{name:true}}}})
   ]);
   if(!legacyProjectPermitted(user,group,membership,project,member))throw researchError(404,'RESEARCH_EXECUTION_NOT_FOUND','研究不存在或当前账号无权查看。');
   const menus=Array.isArray(membership?.role?.menuPermissions)?membership.role.menuPermissions:[],buttons=Array.isArray(membership?.role?.buttonPermissions)?membership.role.buttonPermissions:[],hints=await legacyHints({user,group,project,membership,member});
   return{profile:{displayName:account.displayName,tenantName:account.tenant.name},group:{id:group.id,name:group.name},project:{id:project.id,name:project.name,description:project.description??null,status:project.status,studyGroupId:group.id,canReadDrafts:isTenantAdmin(user)||menus.includes('artifacts')&&buttons.includes('artifact.read'),canReadTasks:isTenantAdmin(user)||menus.includes('workbench'),canOpenDesignWorkspace:hints?.canOpenDesignWorkspace===true},capabilities:{canOpenStudy:true,canEdit:false}};
  })
 };
}
