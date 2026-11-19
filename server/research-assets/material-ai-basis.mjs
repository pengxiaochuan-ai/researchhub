import{randomUUID,createHash}from'node:crypto';
import{assetDigest}from'../../scripts/research-assets-registration-contract.mjs';
import{catalogError}from'../../scripts/research-assets-catalog-contract.mjs';
const fail=(code='MATERIAL_AI_CHANGED',status=409)=>{throw catalogError(code,status,'材料、用途依据或审核权限已变化，请重新核对。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const receipt=e=>({id:e.id,revision:e.revision,decision:e.decision,basisReference:e.id,materialBasisHash:e.basis_hash,expiresAt:new Date(e.expires_at).toISOString()});
export function deriveMaterialBasis(p,ref,value){
 const a=value?.artifact,v=value?.version;
 if(!['tenantId','studyGroupId','researchProjectId'].every(k=>id(p?.[k])&&a?.[k]===p[k])||!id(ref?.studyId)||!id(ref?.reportId)||!Number.isSafeInteger(ref.version)||ref.version<1||a.id!==ref.reportId||a.typeKey!=='analysis_report'||a.status!=='released'||a.deletedAt||v?.versionNo!==ref.version||!id(v.id)||!hash(v.contentHash)||typeof v.contentMd!=='string'||assetDigest(v.contentMd)!==v.contentHash||value.basis?.studyId!==ref.studyId||!id(value.basis.snapshotId)||!id(value.source?.id))fail('MATERIAL_AI_SOURCE_INVALID');
 const materialManifestHash=assetDigest({basis:value.basis,source:value.source}),fields=[p.tenantId,p.studyGroupId,p.researchProjectId,ref.studyId,ref.reportId,String(ref.version),v.contentHash,materialManifestHash];
 return{basisKey:'rhmab-'+createHash('sha256').update(fields.join('\x1f')).digest('hex'),materialManifestHash,contentHash:v.contentHash};
}
export async function lockMaterialBasis(tx,basisKey){
 if(!/^rhmab-[a-f0-9]{64}$/.test(basisKey??''))fail('INPUT_INVALID',400);
 await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text','rh-material-ai:'+basisKey);
}
// Must be composed with the native same-transaction T17 reader and the existing
// official-before-tenant authorization transaction. Never accepts a browser
// material_ai_allowed, body, source hash or material manifest as proof.
export function createMaterialAiBasisService({withAccess,readNativeReport,now=Date.now}){
 if(typeof withAccess!=='function'||typeof readNativeReport!=='function')throw Error('MATERIAL_AI_NATIVE_SERVICES_REQUIRED');
 async function saved(tx,p,requestKey,requestHash){
  const [e]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.material_ai_basis_event WHERE tenant_id=$1 AND actor_account_id=$2 AND request_key=$3',p.tenantId,p.accountId,requestKey);
  if(e&&e.request_hash!==requestHash)fail('REQUEST_KEY_CONFLICT');return e?receipt(e):null;
 }
 async function append(tx,p,e,input,requestHash){
  const eventId='rhmabe-'+randomUUID(),auditId='rhmab-audit-'+randomUUID();
  await tx.auditLog.createMany({data:[{id:auditId,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,accountId:p.accountId,action:'researchhub.material_ai_'+input.action,target:e.source_report_id,meta:{basisEventId:eventId,requestKey:input.requestKey,requestHash}}]});
  await tx.$executeRawUnsafe(`INSERT INTO rh_asset.material_ai_basis_event(id,basis_key,revision,decision,previous_event_id,tenant_id,study_group_id,research_project_id,study_id,source_report_id,source_report_version,content_hash,material_manifest_hash,rights_evidence,evidence_ref,basis_hash,actor_account_id,actor_auth_version,review_reason,request_key,request_hash,audit_id,starts_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23::timestamptz,$24::timestamptz)`,eventId,e.basis_key,e.revision,input.action,e.previous_event_id,p.tenantId,p.studyGroupId,p.researchProjectId,e.study_id,e.source_report_id,e.source_report_version,e.content_hash,e.material_manifest_hash,JSON.stringify(e.rights_evidence),e.evidence_ref,e.basis_hash,p.accountId,p.authVersion,input.reason.trim(),input.requestKey,requestHash,auditId,e.starts_at,e.expires_at);
  return receipt({...e,id:eventId,decision:input.action});
 }
 function validate(input,approve){
  const fields=approve?'evidenceRef,expectedRevision,reason,requestKey,rightsEvidence':'expectedRevision,reason,requestKey';
  if(!input||Object.keys(input).sort().join(',')!==fields||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!key(input.requestKey)||!text(input.reason,2000)||approve&&(!text(input.rightsEvidence,4000)||!text(input.evidenceRef,160)))fail('INPUT_INVALID',400);
 }
 return{
  approve:(user,ref,input)=>{
   validate(input,true);if(!ref||Object.keys(ref).sort().join(',')!=='reportId,studyId,version')fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.review',async(tx,p)=>{
    const value=await readNativeReport(tx,p,ref),binding=deriveMaterialBasis(p,ref,value);await lockMaterialBasis(tx,binding.basisKey);
    // Re-read after lock waits; the native reader owns run/basis validity checks.
    if(assetDigest(deriveMaterialBasis(p,ref,await readNativeReport(tx,p,ref)))!==assetDigest(binding))fail();
    const requestHash=assetDigest({ref,input,binding,actor:p.accountId}),old=await saved(tx,p,input.requestKey,requestHash);if(old)return old;
    const [prior]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.material_ai_basis_event WHERE tenant_id=$1 AND basis_key=$2 ORDER BY revision DESC LIMIT 1',p.tenantId,binding.basisKey);
    if((prior?.revision??0)!==input.expectedRevision)fail();
    const evidence={summary:input.rightsEvidence.trim()},instant=now(),starts=prior?.starts_at??new Date(instant).toISOString(),expires=prior?.expires_at??new Date(instant+7*86400000).toISOString();
    const [digest]=await tx.$queryRawUnsafe("SELECT encode(sha256(convert_to(jsonb_build_array($1::text,$2::jsonb,$3::text)::text,'UTF8')),'hex') AS hash",binding.basisKey,JSON.stringify(evidence),input.evidenceRef.trim());
    return append(tx,p,{basis_key:binding.basisKey,revision:(prior?.revision??0)+1,previous_event_id:prior?.id??null,study_id:ref.studyId,source_report_id:ref.reportId,source_report_version:ref.version,content_hash:binding.contentHash,material_manifest_hash:binding.materialManifestHash,rights_evidence:evidence,evidence_ref:input.evidenceRef.trim(),basis_hash:digest.hash,starts_at:starts,expires_at:expires},{...input,action:'approve'},requestHash);
   });
  },
  revoke:(user,eventId,input)=>{
   validate(input,false);if(!id(eventId))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.review',async(tx,p)=>{
    const [selected]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.material_ai_basis_event WHERE id=$1 AND tenant_id=$2 AND study_group_id=$3 AND research_project_id=$4',eventId,p.tenantId,p.studyGroupId,p.researchProjectId);if(!selected)fail('NOT_FOUND',404);
    await lockMaterialBasis(tx,selected.basis_key);const requestHash=assetDigest({eventId,input,actor:p.accountId}),old=await saved(tx,p,input.requestKey,requestHash);if(old)return old;
    const [prior]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.material_ai_basis_event WHERE tenant_id=$1 AND basis_key=$2 ORDER BY revision DESC LIMIT 1',p.tenantId,selected.basis_key);
    if(prior?.id!==eventId||prior.revision!==input.expectedRevision||prior.decision!=='approve')fail();
    return append(tx,p,{...prior,revision:prior.revision+1,previous_event_id:prior.id},{...input,action:'revoke'},requestHash);
   });
  }
 };
}
export async function revalidateMaterialBasis(tx,p,a,c){
 if(!c?.basisReference?.startsWith('rhmabe-'))fail('MATERIAL_AI_BASIS_REQUIRED',403);
 const [basis]=await tx.$queryRawUnsafe('SELECT basis_key FROM rh_asset.material_ai_basis_event WHERE id=$1 AND tenant_id=$2 AND study_group_id=$3 AND research_project_id=$4',c.basisReference,p.tenantId,p.studyGroupId,p.researchProjectId);if(!basis)fail('MATERIAL_AI_BASIS_REQUIRED',403);
 await lockMaterialBasis(tx,basis.basis_key);
 const [row]=await tx.$queryRawUnsafe('SELECT rh_asset.material_basis_matches($1,$2,$3,$4,$5,$6::integer,$7,$8,$9) AS allowed',p.tenantId,p.studyGroupId,p.researchProjectId,a.studyId,a.sourceReportId,a.sourceReportVersion,a.contentHash,c.basisReference,c.materialBasisHash);
 if(row?.allowed!==true)fail('MATERIAL_AI_BASIS_REQUIRED',403);return true;
}
