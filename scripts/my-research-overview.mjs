// Read-only, local ResearchHub P01 projection over the existing shared schema.
import {draftWorkspace} from './my-research-draft-workspace.mjs';
import {FORMAL_REPORT_PREFIX} from '../server/research-analysis/t17-report-content.mjs';
import {RESEARCH_ASSET_PREFIX} from './research-assets-read-contract.mjs';
const openTaskStatuses=['open','in_progress','blocked'];
export function readOverviewPages(query={}){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>!['draftPage','taskPage'].includes(k)))throw new Error('OVERVIEW_QUERY_INVALID');
 const result={};for(const key of ['draftPage','taskPage']){const value=query[key]??'1';if(typeof value!=='string'||!/^[1-9][0-9]{0,5}$/.test(value)||Number(value)>100000)throw new Error('OVERVIEW_QUERY_INVALID');result[key]=Number(value);}return result;
}

export function visibleProjects(groups,memberships,tenantId){
 const groupById=new Map(groups.filter(g=>g.tenantId===tenantId&&g.status==='active'&&g.studyGroup?.status==='active'&&g.studyGroup.tenantId===tenantId&&g.role?.status==='active'&&g.role.tenantId===tenantId).map(g=>[g.studyGroupId,g]));
 const result=[...groupById.values()].map(g=>({id:g.studyGroupId,name:g.studyGroup.name,projects:[]}));
 const outById=new Map(result.map(g=>[g.id,g]));
 for(const member of memberships){
  const parent=groupById.get(member.studyGroupId),project=member.researchProject;
  if(!parent||member.tenantId!==tenantId||member.status!=='active'||!project||project.status!=='active'||project.tenantId!==tenantId||project.studyGroupId!==parent.studyGroupId)continue;
  outById.get(parent.studyGroupId).projects.push({id:project.id,name:project.name,description:project.description??null,status:project.status,studyGroupId:parent.studyGroupId,permissions:{menus:parent.role.menuPermissions,buttons:parent.role.buttonPermissions}});
 }
 return result;
}
export function projectPermits(project,menu,button){return project.permissions.menus.includes(menu)&&(!button||project.permissions.buttons.includes(button));}
export function canOpenDesignWorkspace(project,accountId,ids){return project.id===ids.project&&project.studyGroupId===ids.group&&[ids.owner,ids.admin].includes(accountId)&&['knowledge','workbench','artifacts'].every(menu=>projectPermits(project,menu))&&['chat.use','artifact.read'].every(button=>project.permissions.buttons.includes(button));}
export function canOpenPlanFlow(draft,accountId,designAllowed){return designAllowed&&draft.typeKey==='protocol_draft'&&draft.ownerAccountId===accountId&&draft.createdBy===accountId&&draft.idempotencyKey?.startsWith('rh-plan-20261022:'+accountId+':')===true;}

export function createMyResearchOverview({prisma,lockAuthorization,tenantId,ids,canOpenApplicability}){
 return async (user,query={})=>{
  const {draftPage,taskPage}=readOverviewPages(query),pageSize=5;
  if(user.tenantId!==tenantId)throw new Error('OVERVIEW_TENANT_REJECTED');
  return prisma.elevated.$transaction(async tx=>{
   await lockAuthorization(tx,tenantId);
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{displayName:true,tenant:{select:{name:true}}}});
   if(!account)throw new Error('OVERVIEW_SESSION_REJECTED');
   const [groupMemberships,projectMemberships]=await Promise.all([
    tx.studyGroupMembership.findMany({where:{tenantId,accountId:user.accountId,status:'active'},include:{studyGroup:{select:{id:true,name:true,status:true,tenantId:true}},role:{select:{status:true,tenantId:true,menuPermissions:true,buttonPermissions:true}}},orderBy:[{isDefault:'desc'},{createdAt:'asc'}]}),
    tx.researchProjectMembership.findMany({where:{tenantId,accountId:user.accountId,status:'active'},include:{researchProject:{select:{id:true,name:true,description:true,status:true,studyGroupId:true,tenantId:true}}},orderBy:[{isDefault:'desc'},{createdAt:'asc'}]})
   ]);
   const groups=visibleProjects(groupMemberships,projectMemberships,tenantId),projects=groups.flatMap(g=>g.projects);
   const scoped=items=>({tenantId,OR:items.map(p=>({studyGroupId:p.studyGroupId,researchProjectId:p.id}))});
   const draftProjects=projects.filter(p=>projectPermits(p,'artifacts','artifact.read'));
   const taskProjects=projects.filter(p=>projectPermits(p,'workbench'));
   // A01 registrations are not research-workflow drafts; the shared request key is non-nullable.
   const draftWhere=draftProjects.length?{...scoped(draftProjects),id:{not:{startsWith:FORMAL_REPORT_PREFIX}},idempotencyKey:{not:{startsWith:RESEARCH_ASSET_PREFIX}},ownerAccountId:user.accountId,status:'draft',deletedAt:null}:null;
   const taskWhere=taskProjects.length?{...scoped(taskProjects),assigneeAccountId:user.accountId,acceptanceFixture:false,status:{in:openTaskStatuses}}:null;
   const [ownDraftCount,drafts,myOpenTaskCount,tasks]=await Promise.all([
    draftWhere?tx.researchArtifact.count({where:draftWhere}):0,
    draftWhere?tx.researchArtifact.findMany({where:draftWhere,select:{id:true,studyGroupId:true,researchProjectId:true,typeKey:true,title:true,updatedAt:true,currentVersionNo:true,ownerAccountId:true,createdBy:true,idempotencyKey:true},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:pageSize,skip:(draftPage-1)*pageSize}):[],
    taskWhere?tx.studyTask.count({where:taskWhere}):0,
    taskWhere?tx.studyTask.findMany({where:taskWhere,select:{id:true,studyGroupId:true,researchProjectId:true,name:true,taskType:true,status:true,dueAt:true},orderBy:[{dueAt:'asc'},{createdAt:'desc'},{id:'desc'}],take:pageSize,skip:(taskPage-1)*pageSize}):[]
   ]);
   const versions=drafts.length?await tx.researchArtifactVersion.findMany({where:{tenantId,OR:drafts.map(d=>({artifactId:d.id,versionNo:d.currentVersionNo}))},select:{artifactId:true,versionNo:true,contentBlocks:true},take:pageSize}):[];
   const projectedDrafts=[];
   for(const d of drafts){
    const allowed=projects.some(p=>p.id===d.researchProjectId&&p.studyGroupId===d.studyGroupId&&canOpenDesignWorkspace(p,user.accountId,ids)),version=versions.find(v=>v.artifactId===d.id&&v.versionNo===d.currentVersionNo),workspace=draftWorkspace(d,version?.contentBlocks,user.accountId,allowed);
    const canOpenWorkspace=workspace?.kind==='applicability'?Boolean(canOpenApplicability&&await canOpenApplicability(tx,user,d,version.contentBlocks[0])):workspace!==null||canOpenPlanFlow(d,user.accountId,allowed);
    projectedDrafts.push({id:d.id,studyGroupId:d.studyGroupId,researchProjectId:d.researchProjectId,typeKey:d.typeKey,title:d.title,updatedAt:d.updatedAt.toISOString(),version:d.currentVersionNo,canOpenPlanFlow:canOpenPlanFlow(d,user.accountId,allowed),workspace,canOpenWorkspace});
   }
   return{
    profile:{displayName:account.displayName,tenantName:account.tenant.name},
    studyGroups:groups.map(g=>({id:g.id,name:g.name,projects:g.projects.map(({permissions,studyGroupId,...p})=>({...p,canReadDrafts:permissions.menus.includes('artifacts')&&permissions.buttons.includes('artifact.read'),canReadTasks:permissions.menus.includes('workbench'),canOpenDesignWorkspace:canOpenDesignWorkspace({...p,studyGroupId,permissions},user.accountId,ids)}))})),
    summary:{projectCount:projects.length,ownDraftCount,myOpenTaskCount},
    pagination:{drafts:{page:draftPage,pageSize,hasNext:draftPage*pageSize<ownDraftCount},tasks:{page:taskPage,pageSize,hasNext:taskPage*pageSize<myOpenTaskCount}},
    drafts:projectedDrafts,
    tasks:tasks.map(t=>({id:t.id,studyGroupId:t.studyGroupId,researchProjectId:t.researchProjectId,title:t.name||t.taskType,status:t.status,dueAt:t.dueAt?.toISOString()??null})),
    activity:drafts.map(d=>({id:d.id,title:d.title,updatedAt:d.updatedAt.toISOString(),researchProjectId:d.researchProjectId}))
   };
  },{maxWait:5000,timeout:10000});
 };
}

export function createMyResearchController({root,ids,prisma,load,require,canOpenApplicability}){
 const {Controller,Get,Req,Query,BadRequestException,UnauthorizedException}=require('@nestjs/common');
 const overview=createMyResearchOverview({prisma,tenantId:ids.tenant,ids,canOpenApplicability,lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')});
 class MyResearchController{async get(req,query){req.res?.setHeader('Cache-Control','no-store');try{return await overview(req.user,query);}catch(error){if(error.message==='OVERVIEW_QUERY_INVALID')throw new BadRequestException({code:'MY_RESEARCH_QUERY_INVALID',message:'列表页码无效，请返回第一页重试。'});if(['OVERVIEW_TENANT_REJECTED','OVERVIEW_SESSION_REJECTED'].includes(error.message))throw new UnauthorizedException('登录会话已失效');throw error;}}}
 Controller('my-research')(MyResearchController);
 Get('overview')(MyResearchController.prototype,'get',Object.getOwnPropertyDescriptor(MyResearchController.prototype,'get'));
 Req()(MyResearchController.prototype,'get',0);
 Query()(MyResearchController.prototype,'get',1);
 return MyResearchController;
}
