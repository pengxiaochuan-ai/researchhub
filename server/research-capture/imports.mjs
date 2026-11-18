import {createHash,randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {parseCaptureCsv} from './import-csv.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),sha=x=>createHash('sha256').update(x).digest('hex');
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const failure=(code,message)=>researchError(409,code,message);
export function createCaptureImportService({studies,core,receipts=repository}){
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>fn(tx,scope(ctx)));
 function input(body,commit=false){only(body,commit?['requestKey','formVersionId','csv','previewHash']:['formVersionId','csv']);if(!id(body.formVersionId)||typeof body.csv!=='string')invalid();if(commit){validateMutation(body);if(typeof body.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(body.previewHash))invalid();}}
 async function plan(tx,user,s,studyId,body,typed){
  await core.authorize(tx,user,s.studyGroupId,s.researchProjectId,'form.fill');
  const form=await tx.formVersion.findFirst({where:{...s,id:body.formVersionId,status:{in:['published','locked']}},select:{id:true,schema:true,scoring:true}});
  if(!form)throw failure('FORM_VERSION_UNAVAILABLE','所选已发布表单当前不可用。');
  const fields=core.normalizeSchema(form.schema).fields,parsed=typed?{rows:typed.rows,errors:[]}:parseCaptureCsv(body.csv,fields),rows=parsed.rows.map(r=>({...r,target:null})),errors=[...parsed.errors],bindings=[];
  for(const row of rows)for(const field of fields){
   if(errors.some(e=>e.rowNumber===row.rowNumber&&e.fieldKey===field.key))continue;
   const value=row.answers[field.key],missing=value===null||value===undefined||value==='';
   if(field.required&&missing)errors.push({rowNumber:row.rowNumber,fieldKey:field.key,code:'IMPORT_FIELD_REQUIRED'});
   else if(!missing&&['number','integer'].includes(field.type)&&(field.min!==undefined&&value<field.min||field.max!==undefined&&value>field.max))errors.push({rowNumber:row.rowNumber,fieldKey:field.key,code:'IMPORT_FIELD_OUT_OF_RANGE'});
  }
  for(const row of rows){
   const subject=await tx.subject.findFirst({where:{...s,subjectId:row.subjectCode,acceptanceFixture:false,deletedAt:null},select:{id:true}});
   if(!subject){errors.push({rowNumber:row.rowNumber,code:'IMPORT_SUBJECT_NOT_FOUND'});continue;}
   const enrollments=await tx.studyEnrollment.findMany({where:{...s,subjectId:subject.id,acceptanceFixture:false},select:{id:true,subjectId:true,protocolVersionId:true,status:true},take:2});
   if(enrollments.length!==1){errors.push({rowNumber:row.rowNumber,code:'IMPORT_ENROLLMENT_UNAVAILABLE'});continue;}
   const enrollment=enrollments[0],visits=await tx.subjectVisit.findMany({where:{...s,subjectId:subject.id,enrollmentId:enrollment.id,protocolVersionId:enrollment.protocolVersionId,acceptanceFixture:false,visitPlan:{is:{...s,protocolVersionId:enrollment.protocolVersionId,code:row.visitCode}}},select:{id:true},take:2});
   if(visits.length!==1){errors.push({rowNumber:row.rowNumber,code:'IMPORT_VISIT_UNAVAILABLE'});continue;}
   bindings.push({row,subjectId:subject.id,enrollmentId:enrollment.id,subjectVisitId:visits[0].id,expectedEnrollment:enrollment,requireCurrentConsent:true});
  }
  await core.lockScope(tx,s,bindings.map(b=>b.expectedEnrollment.protocolVersionId));
  const subjectIds=[...new Set(bindings.map(b=>b.subjectId))];
  if(subjectIds.length)await tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${subjectIds}::text[]) ORDER BY id FOR UPDATE`;
  const ordered=[...bindings].sort((a,b)=>a.subjectId.localeCompare(b.subjectId)||a.subjectVisitId.localeCompare(b.subjectVisitId));
  for(const binding of ordered){
   const {row}=binding;
   try{
    await core.lockBinding(tx,s,binding);
    const visit=await core.readVisit(tx,user,s,binding.subjectVisitId),requirement=visit.visitPlan.requirements.find(r=>r.kind==='form_response'&&r.config?.formVersionId===form.id);
    if(!requirement)throw failure('IMPORT_MODE_UNAVAILABLE','此访视没有要求此固定表单。');
    await core.assertMode(tx,s,binding.subjectVisitId,form.id,'researcher');
    const assignments=await tx.formAssignment.findMany({where:{...s,subjectVisitId:binding.subjectVisitId,formVersionId:form.id,acceptanceFixture:false},select:{id:true,mode:true,response:{select:{id:true,status:true,answers:true}}},take:2});
    if(assignments.length>1)throw failure('IMPORT_ASSIGNMENT_CONFLICT','此访视存在重复表单来源。');
    let assignmentId=null,responseVersion=0;
    if(assignments.length){
     const assignment=assignments[0],capture=await core.readResponse(tx,user,s,assignment.id);
     if(assignment.mode!=='researcher'||assignment.response?.status!=='draft'||!capture.capabilities.canSubmit||Object.keys(assignment.response?.answers??{}).length)throw failure('IMPORT_EXISTING_DATA','已有录入内容，不能以导入覆盖；请核对或按更正处理。');
     assignmentId=assignment.id;responseVersion=capture.response.version;
    }else if(!visit.capabilities.canAssign)throw failure('IMPORT_VISIT_UNAVAILABLE','当前访视不能新增表单。');
    if(errors.some(e=>e.rowNumber===row.rowNumber&&e.fieldKey))continue;
    let answers,scored;
    try{answers=core.normalizeAnswers(form.schema,row.answers);scored=core.score(form.schema,form.scoring,answers);}catch{throw failure('IMPORT_ANSWERS_INVALID','该行的字段类型、选项或范围不符合固定表单。');}
    if(!scored.complete)throw failure('FORM_REQUIRED_MISSING','该行有必填项未填写。');
    row.answers=answers;row.target={subjectId:binding.subjectId,enrollmentId:binding.enrollmentId,protocolVersionId:binding.expectedEnrollment.protocolVersionId,visitId:binding.subjectVisitId,visitVersion:visit.version,assignmentId,responseVersion};
   }catch(error){const status=error.status??error.getStatus?.();if(!status||status===401||status===403||status>=500)throw error;errors.push({rowNumber:row.rowNumber,code:error.code??error.getResponse?.()?.code??'IMPORT_ROW_INVALID'});}
  }
  const manifest={studyId,...s,actor:user.accountId,authVersion:user.authVersion,formVersionId:form.id,formHash:requestHash({schema:form.schema,scoring:form.scoring}),csvSha256:typed?typed.sourceHash:sha(body.csv),rows};
  return {rows,errors,previewHash:errors.length?null:requestHash(manifest),csvSha256:manifest.csvSha256,formVersionId:form.id};
 }
 async function replay(tx,user,s,studyId,key,saved){
  await core.authorize(tx,user,s.studyGroupId,s.researchProjectId,'form.fill');
  const value=saved?.result;
  if(!saved||saved.action!=='form.import'||saved.target_id!==studyId||value?.studyId!==studyId||value.receipt?.requestKey!==key||value.receipt?.action!=='form.import'||value.receipt?.targetId!==studyId||!Array.isArray(value.rows)||!value.rows.length)throw researchError(404,'IMPORT_RECEIPT_NOT_FOUND','暂未查到上次导入结果，请保留核对记录。');
  // Re-lock all parent scopes before per-row historical reads, independent of CSV order.
  const assignments=await tx.formAssignment.findMany({where:{...s,id:{in:value.rows.map(r=>r.assignmentId)},acceptanceFixture:false},select:{id:true,subjectId:true,enrollment:{select:{protocolVersionId:true}}}});
  if(assignments.length!==value.rows.length)throw failure('IMPORT_SOURCE_CHANGED','导入来源已变化，请重新核对。');
  await core.lockScope(tx,s,assignments.map(a=>a.enrollment?.protocolVersionId).filter(Boolean));
  const ids=[...new Set(assignments.map(a=>a.subjectId))];await tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
  for(const row of value.rows)await core.readRevision(tx,user,s,row.assignmentId,row.ref);
  return value;
 }
 return {
  // Internal typed-row adapter. Public CSV input continues through input().
  // Caller owns the same native transaction, current resource authority and
  // original file hash; XLSX booleans/zero never pass through CSV coercion.
  prepareRowsInTransaction:(tx,user,s,studyId,body)=>{
   if(!body||!id(body.formVersionId)||!/^[a-f0-9]{64}$/.test(body.sourceHash??'')||!Array.isArray(body.rows)||!body.rows.length||body.rows.length>100||Buffer.byteLength(JSON.stringify(body))>256*1024)invalid();
   for(const row of body.rows){only(row,['rowNumber','subjectCode','visitCode','answers']);if(!Number.isSafeInteger(row.rowNumber)||row.rowNumber<1||!id(row.subjectCode)||!id(row.visitCode)||!row.answers||Array.isArray(row.answers))invalid();}
   if(new Set(body.rows.map(r=>JSON.stringify([r.subjectCode,r.visitCode]))).size!==body.rows.length)invalid();
   return plan(tx,user,s,studyId,body,body);
  },
  preview:(user,studyId,body)=>{input(body);return run(user,studyId,async(tx,s)=>({studyId,...await plan(tx,user,s,studyId,body)}));},
  receipt:(user,studyId,key)=>{validateMutation({requestKey:key});return run(user,studyId,async(tx,s)=>replay(tx,user,s,studyId,key,await receipts.getReceipt(tx,user,key)));},
  commit:(user,studyId,body)=>{input(body,true);return run(user,studyId,async(tx,s)=>{
   await core.authorize(tx,user,s.studyGroupId,s.researchProjectId,'form.fill');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const saved=await receipts.getReceipt(tx,user,body.requestKey);
   if(saved){if(saved.request_hash!==requestHash(body))throw failure('RESEARCH_REQUEST_KEY_CONFLICT','原请求键已用于不同内容。');return replay(tx,user,s,studyId,body.requestKey,saved);}
   const preview=await plan(tx,user,s,studyId,body);
   if(preview.errors.length)throw failure('IMPORT_PREVIEW_ERRORS','预检存在错误，整批未导入，请先修正。');
   if(preview.previewHash!==body.previewHash)throw failure('IMPORT_PREVIEW_CHANGED','预检后来源或内容已有变化，整批未导入，请重新预检。');
   const rows=[];
   for(const row of preview.rows){
    const assignmentId=row.target.assignmentId??(await core.assign(tx,user,s,row.target.visitId,body.formVersionId)).id;
    const written=await core.write(tx,user,s,assignmentId,{requestKey:'csv-'+requestHash({key:body.requestKey,row:row.rowNumber}).slice(0,48),expectedVersion:row.target.responseVersion,kind:'submit',answers:row.answers});
    rows.push({rowNumber:row.rowNumber,subjectCode:row.subjectCode,visitCode:row.visitCode,subjectId:row.target.subjectId,visitId:row.target.visitId,assignmentId,ref:written.ref});
   }
   const auditId='rh-audit-'+randomUUID(),result={studyId,formVersionId:body.formVersionId,source:{kind:'csv_import',csvSha256:preview.csvSha256},rows,receipt:{requestKey:body.requestKey,action:'form.import',targetId:studyId}};
   await tx.auditLog.createMany({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.form.import',target:studyId,meta:{requestKey:body.requestKey,csvSha256:preview.csvSha256,rows}}});
   await receipts.saveReceipt(tx,user,{id:'rh-op-'+randomUUID(),key:body.requestKey,hash:requestHash(body),action:'form.import',target:studyId,result,auditId});return result;
  });},
 };
}
