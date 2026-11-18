import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';import {createCaptureImportService} from '../server/research-capture/imports.mjs';
import {buildResearchDataAnalysis} from '../server/ai-agent/research-data-analysis.mjs';
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
const scope=(u,t)=>({tenantId:u.tenantId,studyGroupId:t.studyGroupId,researchProjectId:t.executionProjectId});
const writable=new Set(['planned','due_soon','overdue','in_progress','deviation']);
export function createResearchDataImportNative({load,authority}){
 const native=(name,key)=>load('study-operations/'+name,key),authorizeRead=native('formal-response-authority','authorizeFormalResponse');
 const lockBinding=native('protocol-migration-lock','lockCaptureBinding'),assertSchedule=native('formal-response-lock','assertVisitCaptureSchedule'),assertMode=native('formal-outreach-policy','assertCaptureMode');
 async function targetInTx(tx,user,target){
  const s=scope(user,target);await authorizeRead(tx,user,s.studyGroupId,s.researchProjectId,'read');
  const protocols=await tx.studyProtocolVersion.findMany({where:{...s,status:'executing',acceptanceFixture:false},select:{id:true,status:true,versionNumber:true,approvedPolicyVersionId:true,approvedPolicyHash:true},take:2});if(protocols.length!==1)fail('DATA_IMPORT_PROTOCOL_UNAVAILABLE');
  const protocol=protocols[0],policy=await tx.studyExecutionPolicyVersion.findFirst({where:{...s,id:protocol.approvedPolicyVersionId??'',protocolVersionId:protocol.id,status:'approved',contentHash:protocol.approvedPolicyHash??''},select:{id:true,contentHash:true}});if(!policy)fail('DATA_IMPORT_POLICY_CHANGED');
  const plans=await tx.visitPlan.findMany({where:{...s,protocolVersionId:protocol.id},include:{requirements:true}}),formIds=[...new Set(plans.flatMap(p=>p.requirements.filter(r=>r.kind==='form_response').map(r=>r.config?.formVersionId)).filter(x=>typeof x==='string'))];
  if(formIds.length!==1)fail('DATA_IMPORT_FORM_SELECTION_REQUIRED');
  const form=await tx.formVersion.findFirst({where:{...s,id:formIds[0],status:{in:['published','locked']}},select:{id:true,status:true,schema:true,scoring:true,versionNumber:true}});if(!form)fail('DATA_IMPORT_FORM_CHANGED');
  return{protocol,policy,form,formHash:materialDigest({schema:form.schema,scoring:form.scoring}),fields:native('study-forms-policy','normalizeFormSchema')(form.schema).fields,plans};
 }
 async function resourceInTx(tx,user,target,source,options,resource){
  if(!['assign','submit'].includes(resource?.kind))fail('DATA_IMPORT_ACTION_FORBIDDEN',403);
  const s=scope(user,target);let visitId=resource.visitId,assignment;
  if(resource.kind==='submit'){
   assignment=await tx.formAssignment.findFirst({where:{...s,id:resource.assignmentId,createdBy:user.accountId,acceptanceFixture:false},select:{subjectVisitId:true,formVersionId:true,mode:true}});
   if(!assignment?.subjectVisitId||assignment.mode!=='researcher'||assignment.formVersionId!==options.info.form.id)fail('DATA_IMPORT_OBJECT_FORBIDDEN',403);visitId=assignment.subjectVisitId;
  }else if(resource.formVersionId!==options.info.form.id)fail('DATA_IMPORT_FORM_CHANGED');
  const visit=await tx.subjectVisit.findFirst({where:{...s,id:visitId,acceptanceFixture:false},include:{subject:true,enrollment:true,visitPlan:true}});
  if(!visit||visit.subject.createdBy!==user.accountId||visit.subject.deletedAt||visit.subject.acceptanceFixture||visit.enrollment.acceptanceFixture||visit.subjectId!==visit.enrollment.subjectId||visit.enrollmentId!==visit.enrollment.id||visit.enrollment.protocolVersionId!==options.info.protocol.id||visit.protocolVersionId!==options.info.protocol.id||visit.visitPlan.protocolVersionId!==options.info.protocol.id)fail('DATA_IMPORT_OBJECT_FORBIDDEN',403);
  const current=await authority.currentInTx(tx,user,target,source,{...options,capability:'visit.import',subjectId:visit.subjectId,visitId:visit.id});
  return current.actor;
 }
 async function prepareInTx(tx,user,target,source,options,mapped){
  const s=scope(user,target),info=options.info,manifest=[];
  const current=await authority.currentInTx(tx,user,target,source,{...options,capability:mapped.mode==='subjects'?'profile.create':'visit.import'});
  for(const row of mapped.rows){
   const subject=await tx.subject.findFirst({where:{...s,subjectId:row.subjectCode},select:{id:true,subjectId:true,createdBy:true,createdAt:true,deletedAt:true,acceptanceFixture:true,group:true,syndrome:true,sex:true,age:true,clinicalLabelSource:true,consentScope:true}});
   if(subject&&(subject.createdBy!==user.accountId||subject.deletedAt||subject.acceptanceFixture||!current.allowedSubjectIds.includes(subject.id)))fail('DATA_IMPORT_OBJECT_FORBIDDEN',403);
   if(mapped.mode==='subjects')manifest.push({source:row.source,subjectCode:row.subjectCode,subject:subject?{...subject,createdAt:subject.createdAt.toISOString(),deletedAt:null}:null});
  }
  if(mapped.mode==='subjects')return{manifest,rows:mapped.rows,current};
  const authorizeResource=(connection,principal,_s,resource)=>resourceInTx(connection,principal,target,source,options,resource);
  const core={
   authorize:()=>authority.currentInTx(tx,user,target,source,{...options,capability:'visit.import'}),
   lockScope:native('protocol-migration-lock','lockCaptureScope'),lockBinding,
   async readVisit(connection,principal,s,visitId){
    await authorizeResource(connection,principal,s,{kind:'assign',visitId,formVersionId:info.form.id});
    const value=await native('formal-response-visits','readFormalVisitInTransaction')(connection,principal,s,visitId);
    await assertSchedule(connection,s,visitId);await assertMode(connection,s,visitId,info.form.id,'researcher');
    return{...value,capabilities:{...value.capabilities,canAssign:writable.has(value.status)&&value.scheduleState!=='pending_anchor'}};
   },
   async readResponse(connection,principal,s,assignmentId){
    await authorizeResource(connection,principal,s,{kind:'submit',assignmentId});const value=await native('formal-response-query','readFormalResponseInTransaction')(connection,principal,s,assignmentId);
    await assertSchedule(connection,s,value.assignment.subjectVisitId);await assertMode(connection,s,value.assignment.subjectVisitId,info.form.id,'researcher');
    return{...value,capabilities:{...value.capabilities,canSubmit:value.assignment.mode==='researcher'&&value.response.status==='draft'&&!value.response.ref&&!value.response.locked}};
   },
   assertMode,normalizeSchema:native('study-forms-policy','normalizeFormSchema'),normalizeAnswers:native('study-forms-policy','normalizeAndValidateAnswers'),score:native('study-forms-policy','scorePublishedFormResponse'),
  };
  const prepared=await createCaptureImportService({studies:{},core}).prepareRowsInTransaction(tx,user,s,target.studyId,{formVersionId:info.form.id,sourceHash:options.sourceHash,rows:mapped.rows.map(({source,...row})=>row)});
  if(prepared.errors.length)fail('DATA_IMPORT_INVALID_ROWS');
  for(let i=0;i<prepared.rows.length;i++){
   const row=prepared.rows[i],enrollment=await tx.studyEnrollment.findFirst({where:{...s,id:row.target.enrollmentId},select:{id:true,status:true,protocolVersionId:true,updatedAt:true}}),visit=await tx.subjectVisit.findFirst({where:{...s,id:row.target.visitId},select:{id:true,status:true,version:true,visitPlanId:true,scheduleState:true,updatedAt:true}});
   if(!enrollment||enrollment.protocolVersionId!==info.protocol.id||!visit)fail('DATA_IMPORT_TARGET_CHANGED');
   manifest.push({source:mapped.rows[i].source,subjectCode:row.subjectCode,visitCode:row.visitCode,...row.target,enrollment:{...enrollment,updatedAt:enrollment.updatedAt.toISOString()},visit:{...visit,updatedAt:visit.updatedAt.toISOString()},formHash:info.formHash,policyHash:info.policy.contentHash});
  }
  return{manifest,rows:prepared.rows,current};
 }
 async function commitInTx(tx,user,target,source,options,mapped,prepared,requestKey){
  const s=scope(user,target),subjects=[],visits=[];
  if(mapped.mode==='subjects'){
   const Subjects=load('subjects/subjects.service','SubjectsService'),service=new Subjects({},{});
   for(let i=0;i<mapped.rows.length;i++){
    const expected=prepared.manifest[i].subject;let item;
    if(expected)item=await tx.subject.findFirst({where:{...s,id:expected.id,createdBy:user.accountId,deletedAt:null,acceptanceFixture:false}});
    else item=await service.createInTransaction(tx,{...user,...s},{subjectId:mapped.rows[i].subjectCode});
    if(!item)fail('DATA_IMPORT_TARGET_CHANGED');subjects.push({id:item.id,subjectCode:item.subjectId,created:!expected});
   }
  }else{
   const auth=(connection,principal,_scope,resource)=>resourceInTx(connection,principal,target,source,options,resource);
   for(const row of prepared.rows){
    const assignmentId=row.target.assignmentId??(await native('formal-response-assignment','assignVisitFormInTransaction')(tx,user,s,row.target.visitId,options.info.form.id,auth)).id;
    const written=await native('formal-response-commands','writeAnswersInTransaction')(tx,user,s,assignmentId,{requestKey:'p05-'+materialDigest({requestKey,row:row.rowNumber}).slice(0,48),expectedVersion:row.target.responseVersion,kind:'submit',answers:row.answers},auth);
    subjects.push({id:row.target.subjectId,subjectCode:row.subjectCode,created:false});visits.push({id:row.target.visitId,subjectId:row.target.subjectId,visitCode:row.visitCode,assignmentId,ref:written.ref});
   }
  }
  return{subjects:[...new Map(subjects.map(s=>[s.id,s])).values()],visits};
 }
 async function analysisInTx(tx,user,target,source,row,item,loaded){
  const current=await authority.currentInTx(tx,user,target,source,{scopeKey:row.scope_key,capability:'result.read'}),s=scope(user,target),info=await targetInTx(tx,user,target),rows=[];
  if(row.snapshot.mode==='visit_form'&&(row.snapshot.target.protocolVersionId!==info.protocol.id||row.snapshot.target.formVersionId!==info.form.id||row.snapshot.target.formHash!==info.formHash||row.snapshot.target.policyHash!==info.policy.contentHash))fail('DATA_ANALYSIS_SOURCE_CHANGED');
  for(const ref of row.receipt.visits){
   // The old reader owns actual parent, protocol and current revision checks.
   // Its row locks are not business mutations; reuse the caller's connection.
   const response=await native('formal-response-query','readFormalResponseInTransaction')(tx,user,s,ref.assignmentId),r=response.response,a=response.assignment;
   const visit=await tx.subjectVisit.findFirst({where:{...s,id:ref.id,subjectId:ref.subjectId,enrollmentId:a.enrollmentId,acceptanceFixture:false},select:{id:true,status:true,version:true,protocolVersionId:true,visitPlanId:true}});
   if(!visit||visit.protocolVersionId!==info.protocol.id||a.subjectId!==ref.subjectId||a.subjectVisitId!==ref.id||a.formVersion.id!==info.form.id||r.status!=='submitted'||!r.ref||r.ref.responseId!==ref.ref.responseId||r.ref.revisionNo!==ref.ref.revisionNo||r.ref.contentHash!==ref.ref.contentHash)fail('DATA_ANALYSIS_SOURCE_CHANGED');
   const manifest=row.target_manifest.find(m=>m.visitId===ref.id);if(!manifest?.source||manifest.enrollmentId!==a.enrollmentId||manifest.visit?.visitPlanId!==visit.visitPlanId)fail('DATA_ANALYSIS_SOURCE_CHANGED');
   rows.push({subjectId:ref.subjectId,visitId:ref.id,visitCode:ref.visitCode,visitStatus:visit.status,visitVersion:visit.version,enrollmentId:a.enrollmentId,visitPlanId:visit.visitPlanId,assignmentId:ref.assignmentId,responseId:r.id,responseVersion:r.version,ref:r.ref,answers:r.answers,source:manifest.source});
  }
  return buildResearchDataAnalysis({binding:{tenantId:user.tenantId,accountId:user.accountId,sessionId:source.sessionId,studyId:target.studyId,studyGroupId:target.studyGroupId,executionProjectId:target.executionProjectId,sourceProjectId:source.researchProjectId,permissionRef:current.permissionRef},import:{id:row.id,version:row.version,hash:row.confirmation_hash,preflight:{id:row.source_preflight_id,version:row.source_preflight_version}},study:item.study,files:loaded.row.source_refs,form:rows.length?{id:info.form.id,hash:info.formHash,schema:info.form.schema}:null,subjects:row.receipt.subjects,rows},{normalizeSchema:native('study-forms-policy','normalizeFormSchema'),validateAnswers:native('study-forms-policy','normalizeAndValidateAnswers')});
 }
 return{targetInTx,resourceInTx,prepareInTx,commitInTx,analysisInTx};
}
