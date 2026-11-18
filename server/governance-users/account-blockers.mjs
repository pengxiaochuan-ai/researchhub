import {setContext} from '../research-studies/repository.mjs';
// Closed, deployment-specific inventory. Unknown status remains a blocker;
// completed historical rows and unrelated actors are never modified.
const executions=[
 ['knowledgeChatJob','accountId',['completed','failed','cancelled']],
 ['researchAgentRun','accountId',['completed','failed','cancelled']],
 ['researchEvidenceRun','accountId',['completed','failed','cancelled']],
 ['researchMethodRun','accountId',['completed','failed','cancelled']],
 ['researchArtifactExportJob','requestedBy',['ready','completed','failed','cancelled']],
 ['processingTask','createdBy',['complete','failed','cancelled']],
 ['remediationAttempt','createdBy',['succeeded','failed','cancelled','completed']],
 ['dataAnalysisQuery','accountId',['succeeded','completed','failed','cancelled','blocked']],
 ['knowledgeImportTask','createdBy',['complete','failed','cancelled']],
];
export async function inspectAccountBlockers(tx,principal,target){
 const messages=new Set();
 await setContext(tx,principal);
 if(await tx.tokenQuotaReservation.findFirst({where:{tenantId:principal.tenantId,accountId:target.id,status:{notIn:['settled','released','cancelled']}},select:{id:true}}))messages.add('仍有执行中或待对账用量，请先核对用量');
 // Include inactive groups/projects: disabled parents do not imply all child
 // executions have stopped. Tenant-level discovery precedes scoped RLS reads.
 const groups=await tx.studyGroup.findMany({where:{tenantId:principal.tenantId},select:{id:true,status:true},take:1001});
 if(groups.length>1000)throw Error('HUB_ACCOUNT_SCOPE_SCAN_LIMIT');
 for(const group of groups){
  await setContext(tx,principal,group.id);
  const projects=await tx.researchProject.findMany({where:{tenantId:principal.tenantId,studyGroupId:group.id},select:{id:true,status:true},take:1001});
  if(projects.length>1000)throw Error('HUB_ACCOUNT_SCOPE_SCAN_LIMIT');
  for(const project of projects){
   await setContext(tx,principal,group.id,project.id);
   const scope={tenantId:principal.tenantId,studyGroupId:group.id,researchProjectId:project.id};
   const member=await tx.researchProjectMembership.findFirst({where:{...scope,accountId:target.id,status:'active',roleKey:'project_manager'},select:{id:true}});
   if(member&&project.status==='active'&&group.status==='active'){
    const others=await tx.researchProjectMembership.count({where:{...scope,accountId:{not:target.id},status:'active',roleKey:'project_manager',account:{status:'active',studyGroupMemberships:{some:{tenantId:principal.tenantId,studyGroupId:group.id,status:'active',role:{status:'active'}}}}}});
    if(others===0)messages.add('仍是研究唯一有效负责人，请先完成负责人交接');
   }
   for(const[model,actor,terminal]of executions){
    const where=model==='knowledgeImportTask'?{tenantId:principal.tenantId,studyGroupId:group.id,[actor]:target.id,status:{notIn:terminal}}:{...scope,[actor]:target.id,status:{notIn:terminal}};
    if(await tx[model].findFirst({where,select:{id:true}}))messages.add('仍有待处理或执行中的任务，请先完成或取消任务');
   }
  }
 }
 await setContext(tx,principal);
 return [...messages];
}
