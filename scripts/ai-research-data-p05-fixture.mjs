// Explicit M05 synthetic preparation; never called by an import endpoint.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function prepareP05NamedVisitsInTransaction(tx,user,target,{load,scopeKey,subjectIds}){
 assert.equal(user.tenantId,'rh-kb-local-b0e2af9d-tenant');assert.equal(scopeKey,'p05-import-20261113');assert.equal(target.studyId,'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090');
 assert(Array.isArray(subjectIds)&&subjectIds.length>0&&subjectIds.length<=2&&new Set(subjectIds).size===subjectIds.length);
 const s={tenantId:user.tenantId,studyGroupId:target.studyGroupId,researchProjectId:target.executionProjectId},current={...user,...s};
 const saved=await tx.$queryRawUnsafe(`SELECT receipt FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND scope_key=$4 AND state='committed' AND snapshot->>'mode'='subjects'`,user.tenantId,user.accountId,target.studyId,scopeKey),allowed=new Set(saved.flatMap(p=>p.receipt.subjects.map(s=>s.id)));
 for(const id of subjectIds)assert(allowed.has(id),'P05_NOT_ROUND_PROFILE');
 const context=load('study-operations/participation-events','participationContext'),record=load('study-operations/participation-events','recordParticipationInTransaction'),Operations=load('study-operations/study-operations.service','StudyOperationsService'),operations=new Operations({},{}),visitIds=[],enrollmentIds=[];
 for(const id of [...subjectIds].sort()){
  const subject=await tx.subject.findFirst({where:{...s,id,createdBy:user.accountId,deletedAt:null,acceptanceFixture:false}});assert(subject&&/^P05-(OWNER|ADMIN)-[AB]$/.test(subject.subjectId),'P05_UNNAMED_SUBJECT');
  let before=await context(tx,current,s,id);assert.equal(before.protocol.id,'cmwcc7kgi000ylua60qjdm1lg');assert.equal(await tx.studyTaskTemplate.count({where:{...s,protocolVersionId:before.protocol.id}}),0,'P05_UNAPPROVED_TEMPLATE_TASKS');
  assert.equal(await tx.visitPlan.count({where:{...s,protocolVersionId:before.protocol.id}}),1,'P05_UNAPPROVED_EXTRA_VISITS');
  if(!before.enrollment){
   for(const [kind,key]of [['screening','screening'],['research_consent','researchConsent'],['data_use_consent','dataUse']]){
    assert.equal(before.policy.sections[key]?.status,'not_applicable','P05_POLICY_NOT_SYNTHETIC');
    if(!before.events.some(e=>e.kind===kind))await record(tx,current,s,id,{kind,decision:'not_applicable',effectiveAt:new Date().toISOString(),evidence:'P05 M05具名合成软件验证；无真实被试或临床同意。',reason:'沿当前已批准合成方案的不适用决定，只准备本轮新档案。'});
   }
   await operations.enrollInTransaction(current,{subjectId:id},tx,s.studyGroupId,s.researchProjectId);before=await context(tx,current,s,id);
  }
  const visits=await tx.subjectVisit.findMany({where:{...s,subjectId:id,enrollmentId:before.enrollment.id,protocolVersionId:before.protocol.id,visitPlanId:'cmwcc7kgi0010lua6lnh2kppe',acceptanceFixture:false},select:{id:true}});assert.equal(visits.length,1);visitIds.push(visits[0].id);enrollmentIds.push(before.enrollment.id);
 }
 await tx.auditLog.create({data:{id:'rh-audit-'+randomUUID(),...s,accountId:user.accountId,action:'researchhub.data.fixture.prepared',target:scopeKey,meta:{subjectIds,enrollmentIds,visitIds,syntheticOnly:true,separateFromImport:true}}});
 return{subjectIds,visitIds,enrollmentIds};
}
