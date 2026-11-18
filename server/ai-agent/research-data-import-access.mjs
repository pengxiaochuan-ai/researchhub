const fail=(code='DATA_IMPORT_PERMISSION_CHANGED')=>{throw Object.assign(Error(code),{code,status:403});};
const sameRef=(a,b)=>a?.kind===b?.kind&&a?.id===b?.id&&a?.version===b?.version;
/** Caller holds the shared tenant authorization lock and sets the target GUC.
 * This supplements native current-account/feature/member checks; it never
 * changes a role or authorizes the ordinary form endpoints. */
export function createResearchDataImportAccess({authorizeRead,additionalObjects=()=>({subjectIds:[],visitIds:[]})}){
 if(typeof authorizeRead!=='function')throw Error('DATA_IMPORT_AUTHORITY_REQUIRED');
 return{async currentInTx(tx,user,target,source,{scopeKey,capability,permissionRef,subjectId,visitId}={}){
  if(!['profile.create','visit.import','result.read'].includes(capability)||!scopeKey||!source?.sessionId||!target?.studyId)fail();
  const actor=await authorizeRead(tx,user,target.studyGroupId,target.executionProjectId,'read');
  if(actor.tenantId!==user.tenantId||actor.accountId!==user.accountId||actor.authVersion!==user.authVersion)fail();
  const [binding]=await tx.$queryRawUnsafe(`SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 AND id=$2 AND study_group_id=$3 AND execution_project_id=$4`,user.tenantId,target.studyId,target.studyGroupId,target.executionProjectId);if(!binding)fail();
  const admin=actor.role==='tenant_admin'&&actor.isTenantAdmin===true;let grant=null,ref;
  if(admin)ref={kind:'native_admin',id:actor.accountId,version:actor.authVersion};
  else{
   const grants=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_import_access WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND study_group_id=$4 AND research_project_id=$5 AND source_session_id=$6 AND source_study_group_id=$7 AND source_research_project_id=$8 AND scope_key=$9 AND status='active' AND expires_at>statement_timestamp()`,user.tenantId,user.accountId,target.studyId,target.studyGroupId,target.executionProjectId,source.sessionId,source.studyGroupId,source.researchProjectId,scopeKey);
   if(grants.length!==1)fail();grant=grants[0];
   if(grant.account_id!==user.accountId||grant.status!=='active'||!(grant.expires_at instanceof Date)||grant.expires_at.getTime()<=Date.now()||!Array.isArray(grant.capabilities)||!grant.capabilities.includes(capability))fail();
   ref={kind:'study_grant',id:grant.id,version:grant.version};
  }
  if(permissionRef&&!sameRef(permissionRef,ref))fail();
  const receipts=await tx.$queryRawUnsafe(`SELECT receipt FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND scope_key=$4 AND session_id=$5 AND state='committed'`,user.tenantId,user.accountId,target.studyId,scopeKey,source.sessionId);
  const extra=admin?await additionalObjects(actor,target,source,scopeKey):grant.objects;
  const subjects=new Set(extra?.subjectIds??[]),visits=new Set(extra?.visitIds??[]);
  for(const {receipt}of receipts){for(const s of receipt?.subjects??[])if(typeof s.id==='string')subjects.add(s.id);for(const v of receipt?.visits??[])if(typeof v.id==='string')visits.add(v.id);}
  if(subjectId&&!subjects.has(subjectId)||visitId&&!visits.has(visitId))fail('DATA_IMPORT_OBJECT_FORBIDDEN');
  return{actor,permissionRef:ref,scopeKey,allowedSubjectIds:[...subjects],allowedVisitIds:[...visits]};
 }};
}
