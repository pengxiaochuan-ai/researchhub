import {edcDigest} from '../../scripts/synthetic-edc-contract.mjs';
import {taskError} from './authorization.mjs';
const rejected=()=>{throw taskError('STUDY_TASK_SOURCE_RESTRICTED',403,'关联来源当前不可读或已变化，请重新核对');};
const scope=(ctx)=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.researchProjectId});
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export function parseFormalRef(value){
 const fields=['kind','responseId','assignmentId','revisionNo','contentHash'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||value.kind!=='formal_response_ref'||!id(value.responseId)||!id(value.assignmentId)||!Number.isSafeInteger(value.revisionNo)||value.revisionNo<1||value.revisionNo>2147483647||typeof value.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash))throw taskError('STUDY_TASK_INPUT_INVALID',400,'请选择固定答卷版本');
 return Object.fromEntries(fields.map(k=>[k,value[k]]));
}
export function createFormalTaskSource({readVisit,readResponse,readRevision,lockCaptureBinding}){
 async function visit(tx,user,s,visitId){
  const initial=await tx.subjectVisit.findFirst({where:{...s,id:visitId,acceptanceFixture:false},select:{id:true,subjectId:true,enrollmentId:true,protocolVersionId:true,visitPlanId:true,status:true,version:true}});if(!initial)rejected();
  const enrollment=await tx.studyEnrollment.findFirst({where:{...s,id:initial.enrollmentId,subjectId:initial.subjectId,acceptanceFixture:false},select:{id:true,protocolVersionId:true,status:true}});if(!enrollment||enrollment.protocolVersionId!==initial.protocolVersionId)rejected();
  await lockCaptureBinding(tx,s,{subjectId:initial.subjectId,enrollmentId:initial.enrollmentId,subjectVisitId:initial.id,expectedEnrollment:enrollment,requireCurrentConsent:true});
  const [policy]=await tx.$queryRaw`SELECT ep.id FROM public.study_protocol_version p JOIN public.study_execution_policy_version ep ON ep.id=p."approvedPolicyVersionId" WHERE p.id=${enrollment.protocolVersionId} AND p."tenantId"=${s.tenantId} AND p."studyGroupId"=${s.studyGroupId} AND p."researchProjectId"=${s.researchProjectId} AND p.status IN ('executing','superseded') AND p."acceptanceFixture"=false AND ep."tenantId"=${s.tenantId} AND ep."studyGroupId"=${s.studyGroupId} AND ep."researchProjectId"=${s.researchProjectId} AND ep."protocolVersionId"=p.id AND ep.status='approved' AND ep."contentHash"=p."approvedPolicyHash"`;
  if(!policy)throw taskError('STUDY_TASK_SOURCE_CHANGED',409,'访视方案或政策当前不可使用');
  const detail=await readVisit(tx,user,s,visitId),fresh=await tx.subjectVisit.findFirst({where:{...s,id:visitId,acceptanceFixture:false},include:{visitPlan:true}});
  if(!fresh||fresh.subjectId!==initial.subjectId||fresh.enrollmentId!==initial.enrollmentId||fresh.protocolVersionId!==initial.protocolVersionId||fresh.visitPlanId!==initial.visitPlanId||fresh.version!==initial.version||fresh.status!==initial.status||fresh.visitPlan?.protocolVersionId!==enrollment.protocolVersionId||Object.entries(s).some(([k,v])=>fresh.visitPlan[k]!==v))rejected();
  const context={kind:'formal_visit',sourceId:fresh.id,parentId:fresh.enrollmentId,rootId:fresh.subjectId,sourceVersion:fresh.version};context.sourceHash=edcDigest({...context,protocolVersionId:fresh.protocolVersionId,visitPlanId:fresh.visitPlanId,status:fresh.status});
  return {context,subjectId:fresh.subjectId,visitId:fresh.id,label:detail.visitPlan.name,subjectCode:detail.subject.subjectId,visitName:detail.visitPlan.name};
 }
 async function response(tx,user,s,ref,requireCurrent=true){
  ref=parseFormalRef(ref);const current=await readResponse(tx,user,s,ref.assignmentId);if(!current.assignment.subjectVisitId)rejected();
  const target={responseId:ref.responseId,assignmentId:ref.assignmentId,revisionNo:ref.revisionNo,contentHash:ref.contentHash};const historical=await readRevision(tx,user,s,ref.assignmentId,target);
  const parent=await visit(tx,user,s,current.assignment.subjectVisitId),plan=await tx.subjectVisit.findFirst({where:{...s,id:parent.visitId,acceptanceFixture:false},select:{visitPlanId:true}});
  const requirements=await tx.visitRequirement.findMany({where:{...s,visitPlanId:plan.visitPlanId,kind:'form_response'},select:{config:true}});
  if(!requirements.some(r=>r.config&&typeof r.config==='object'&&!Array.isArray(r.config)&&r.config.formVersionId===historical.formVersionId))rejected();
  const form=await tx.formVersion.findFirst({where:{...s,id:historical.formVersionId,status:{in:['published','locked']}},select:{template:{select:{name:true,tenantId:true,studyGroupId:true,researchProjectId:true}}}});if(!form?.template||Object.entries(s).some(([k,v])=>form.template[k]!==v))rejected();
  const isCurrent=JSON.stringify(current.response.ref)===JSON.stringify(target);if(requireCurrent&&!isCurrent)throw taskError('STUDY_TASK_SOURCE_CHANGED',409,'答卷已有新修订，请重新核对');
  const context={kind:'formal_response_ref',sourceId:ref.responseId,parentId:ref.assignmentId,rootId:parent.visitId,sourceVersion:ref.revisionNo,sourceHash:ref.contentHash};
  return {context,subjectId:parent.subjectId,visitId:parent.visitId,assignmentId:ref.assignmentId,current:isCurrent,label:parent.label,subjectCode:parent.subjectCode,visitName:parent.visitName,formTitle:form.template.name,revisionNo:ref.revisionNo};
 }
 async function current(tx,user,s,assignmentId){const value=await readResponse(tx,user,s,assignmentId);if(!value.response.ref)rejected();return value.response.ref;}
 return {visit,response,current};
}
