import{materialDigest}from'../server/ai-agent/session-material-contract.mjs';
import{mediaIngestFail as fail}from'../server/ai-agent/session-media-ingest-contract.mjs';
const writable=new Set(['planned','due_soon','overdue','in_progress','deviation']);
const scope=(u,c)=>({tenantId:u.tenantId,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId});
export function createMediaIngestNative({load,scopeKey,boundary=()=>null,allowNativeTargets=false}){
 const authorize=load('ingest/ingest-authorization','authorizeIngestInTransaction'),lockBinding=load('study-operations/protocol-migration-lock','lockCaptureBinding');
 const schedule=load('study-operations/formal-response-lock','assertVisitCaptureSchedule');
 async function currentInTx(tx,u,c,source,{capability,mediaId,subjectId,visitId,expectedRef}={}){
  const s=scope(u,c);let limit=await boundary(u,c,source,mediaId);
  let native=false;try{await authorize(tx,u,s.studyGroupId,s.researchProjectId);native=true;}catch(e){if((e.status??e.getStatus?.())!==403)throw e;}
  if(native&&allowNativeTargets)limit=null;
  if(limit&&(subjectId&&!limit.subjectIds.includes(subjectId)||visitId&&!limit.visitIds.includes(visitId)||limit.mediaIds&&!limit.mediaIds.includes(mediaId)))fail('MEDIA_INGEST_PERMISSION',403);
  let ref,subjects=null,visits=null;
  if(native)ref={kind:'native',id:u.accountId,version:u.authVersion};
  else{
   const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingest_access WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND study_group_id=$4 AND research_project_id=$5 AND source_study_group_id=$6 AND source_research_project_id=$7 AND session_id=$8 AND scope_key=$9 AND status='active' AND expires_at>statement_timestamp() AND $10=ANY(media_ids) AND $11=ANY(capabilities) FOR SHARE`,u.tenantId,u.accountId,c.studyId,s.studyGroupId,s.researchProjectId,source.studyGroupId,source.researchProjectId,source.sessionId,scopeKey,mediaId,capability);
   if(rows.length!==1)fail('MEDIA_INGEST_PERMISSION',403);const r=rows[0];ref={kind:'grant',id:r.id,version:r.version};subjects=r.subject_ids;visits=r.visit_ids;
   if(subjectId&&!subjects.includes(subjectId)||visitId&&!visits.includes(visitId))fail('MEDIA_INGEST_PERMISSION',403);
  }
  if(expectedRef&&materialDigest(expectedRef)!==materialDigest(ref))fail('MEDIA_INGEST_PERMISSION_CHANGED',403);
  const intersect=(a,b)=>a&&b?a.filter(x=>b.includes(x)):a??b;
  return{permissionRef:ref,subjectIds:intersect(subjects,limit?.subjectIds),visitIds:intersect(visits,limit?.visitIds),...(allowNativeTargets&&native?{nativeTargetAccess:true}:{})};
 }
 async function targetInTx(tx,u,c,subjectId,visitId,collectedAt,{write=false,permission}={}){
  const s=scope(u,c),subject=await tx.subject.findFirst({where:{...s,id:subjectId,...(allowNativeTargets&&permission?.nativeTargetAccess===true?{}:{createdBy:u.accountId}),deletedAt:null,acceptanceFixture:false},select:{id:true,subjectId:true}});
  if(!subject)fail('MEDIA_INGEST_NOT_FOUND',404);
  const enrollment=await tx.studyEnrollment.findFirst({where:{...s,subjectId,acceptanceFixture:false},select:{id:true,status:true,protocolVersionId:true,updatedAt:true}});
  let protocol=null,visit=null;
  if(enrollment){protocol=await tx.studyProtocolVersion.findFirst({where:{...s,id:enrollment.protocolVersionId,acceptanceFixture:false},select:{id:true,status:true,versionNumber:true,approvedPolicyVersionId:true,approvedPolicyHash:true}});if(!protocol)fail('MEDIA_INGEST_TARGET_CHANGED');}
  if(visitId){
   const row=await tx.subjectVisit.findFirst({where:{...s,id:visitId,subjectId,enrollmentId:enrollment?.id??'',protocolVersionId:protocol?.id??'',acceptanceFixture:false},include:{visitPlan:true}});
   if(!row||row.visitPlan.protocolVersionId!==row.protocolVersionId||row.visitPlan.studyGroupId!==s.studyGroupId||row.visitPlan.researchProjectId!==s.researchProjectId)fail('MEDIA_INGEST_NOT_FOUND',404);
   if(write&&(!writable.has(row.status)||row.scheduleState==='pending_anchor'))fail('MEDIA_INGEST_TARGET_NOT_READY');
   visit={id:row.id,name:row.visitPlan.name,status:row.status,version:row.version,scheduleState:row.scheduleState,visitPlanId:row.visitPlanId,protocolVersionId:row.protocolVersionId,enrollmentId:row.enrollmentId};
  }
  if(write){
   await lockBinding(tx,s,{subjectId,subjectVisitId:visitId,expectedEnrollment:enrollment,requireCurrentConsent:true});await schedule(tx,s,visitId);
   const current=await targetInTx(tx,u,c,subjectId,visitId,collectedAt,{permission});
   if(current.visit&&(!writable.has(current.visit.status)||current.visit.scheduleState==='pending_anchor'))fail('MEDIA_INGEST_TARGET_NOT_READY');
   return current;
  }
  const [intent]=await tx.$queryRawUnsafe('SELECT title FROM rh_research.project_intent WHERE tenant_id=$1 AND id=$2',u.tenantId,c.projectIntentId);
  return{studyId:c.studyId,studyName:intent?.title??'当前研究',studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId,subject,visit,enrollment:enrollment?{...enrollment,updatedAt:enrollment.updatedAt.toISOString()}:null,protocol,collectedAt};
 }
 async function candidatesInTx(tx,u,c,permission){
  const s=scope(u,c),subjects=await tx.subject.findMany({where:{...s,...(allowNativeTargets&&permission?.nativeTargetAccess===true?{}:{createdBy:u.accountId}),deletedAt:null,acceptanceFixture:false,...(permission.subjectIds?{id:{in:permission.subjectIds}}:{})},select:{id:true,subjectId:true},orderBy:{subjectId:'asc'},take:100});
  const items=[];
  const blocked=e=>['MEDIA_INGEST_TARGET_NOT_READY','PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','VISIT_ANCHOR_UNRESOLVED'].includes(e.code??e.getResponse?.()?.code);
  for(const subject of subjects){
   if(allowNativeTargets&&permission?.nativeTargetAccess===true){try{await targetInTx(tx,u,c,subject.id,null,null,{write:true,permission});}catch(e){if(blocked(e))continue;throw e;}}
   const visits=await tx.subjectVisit.findMany({where:{...s,subjectId:subject.id,acceptanceFixture:false,status:{in:[...writable]},scheduleState:{not:'pending_anchor'},...(permission.visitIds?{id:{in:permission.visitIds}}:{})},include:{visitPlan:true},orderBy:{createdAt:'asc'},take:100});const eligible=[];for(const v of visits){if(allowNativeTargets&&permission?.nativeTargetAccess===true){try{await targetInTx(tx,u,c,subject.id,v.id,null,{write:true,permission});}catch(e){if(blocked(e))continue;throw e;}}eligible.push({id:v.id,name:v.visitPlan.name});}items.push({...subject,visits:eligible});}

  const [intent]=await tx.$queryRawUnsafe('SELECT title FROM rh_research.project_intent WHERE tenant_id=$1 AND id=$2',u.tenantId,c.projectIntentId);
  return{id:c.studyId,name:intent?.title??'当前研究',subjects:items};
 }
 return{currentInTx,targetInTx,candidatesInTx};
}
