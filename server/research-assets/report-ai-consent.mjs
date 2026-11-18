import {randomUUID} from 'node:crypto';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assertReportAiAccess} from './report-ai-access.mjs';
import {REPORT_AI_LOCAL as L,assertReportAiLocalTarget,assertReportAiLocalEvent} from './report-ai-local.mjs';
import {readLatestReportAiConsent} from './report-ai-reader.mjs';
const fail=(code='REPORT_AI_CONSENT_CONFLICT',status=409,message='AI用途状态已变化，请重新读取后操作。')=>{throw catalogError(code,status,message);};
const target=(p,a)=>{assertReportAiLocalTarget({...a,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,assetId:a.id,assetVersion:a.version,accountId:p.accountId,providerScope:L.providerScope,purpose:L.purpose,basisReference:L.basisReference,materialBasisHash:L.materialBasisHash});};
const receipt=c=>({id:c.id,assetId:c.assetId,version:c.assetVersion,revision:c.revision,state:c.state,startsAt:c.startsAt,expiresAt:c.expiresAt});
export async function lockReportAiConsent(tx,p,a){await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('rh-report-ai',$1::text,$2::text,$3::integer,$4::text,$5::text,$6::text)::text,0))::text",p.tenantId,a.id,a.version,p.accountId,L.providerScope,L.purpose);}
async function findRequest(tx,p,key){const [r]=await tx.$queryRawUnsafe('SELECT request_hash, id, consent_revision, event_kind, starts_at, expires_at FROM rh_asset.ai_use_consent_event WHERE tenant_id=$1 AND account_id=$2 AND request_key=$3',p.tenantId,p.accountId,key);return r?{id:r.id,assetId:L.assetId,assetVersion:L.assetVersion,revision:r.consent_revision,state:r.event_kind==='grant'?'active':'revoked',startsAt:new Date(r.starts_at).toISOString(),expiresAt:new Date(r.expires_at).toISOString(),requestHash:r.request_hash}:null;}
async function append(tx,p,c,{requestKey,requestHash}){
 const audit=await tx.auditLog.create({data:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,accountId:p.accountId,action:'researchhub.asset_ai_consent_'+c.eventKind,target:c.assetId,meta:{consentEventId:c.id,requestKey,requestHash,version:c.assetVersion,consentRevision:c.revision,syntheticOnly:true}}});
 await tx.$executeRawUnsafe(`INSERT INTO rh_asset.ai_use_consent_event(id,tenant_id,study_group_id,research_project_id,study_id,asset_id,version_no,account_id,actor_account_id,provider_scope,purpose,consent_revision,event_kind,content_hash,policy_hash,source_report_id,source_report_version,material_basis_ref,material_basis_hash,material_ai_allowed,starts_at,expires_at,request_key,request_hash,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19::timestamptz,$20::timestamptz,$21,$22,$23)`,c.id,p.tenantId,p.studyGroupId,p.researchProjectId,c.studyId,c.assetId,c.assetVersion,p.accountId,c.providerScope,c.purpose,c.revision,c.eventKind,c.contentHash,c.policyHash,c.sourceReportId,c.sourceReportVersion,c.basisReference,c.materialBasisHash,c.startsAt,c.expiresAt,requestKey,requestHash,audit.id);
 return c;
}
export function createReportAiConsent({withAccess,loadMetadata,readConsent=readLatestReportAiConsent,lock=lockReportAiConsent,findRequest:find=findRequest,append:write=append,now=Date.now}){
 async function current(tx,p,id,version){if(id!==L.assetId||String(version)!==String(L.assetVersion))fail('REPORT_AI_FORBIDDEN',403);const a=await loadMetadata(tx,p,id,Number(version));if(!a||a.id!==id||a.version!==Number(version))fail();target(p,a);return a;}
 return{
  status:(user,id,version)=>withAccess(user,'artifact.read',async(tx,p)=>{
   const a=await current(tx,p,id,version),c=await readConsent(tx,p,a);let canSearch=false;try{assertReportAiAccess(p,a,c,{now:now(),providerScope:L.providerScope});canSearch=true;}catch(e){if(e.status!==403)throw e;}
   return{schema:'rh-report-ai-status.v1',assetId:a.id,version:a.version,studyId:a.studyId,title:a.title,state:c?c.state==='revoked'?'revoked':Date.parse(c.expiresAt)<=now()?'expired':'active':'not_granted',consentRevision:c?.revision??0,expiresAt:c?.expiresAt??null,canGrant:!canSearch&&a.sourceValid&&(!c||c.revision===2&&Date.parse(c.expiresAt)>now()),canRevoke:!!c&&c.state==='active'&&c.revision===1,canSearch,canGenerate:false,providerStatus:'not_enabled'};
  }),
  execute:(user,id,version,input)=>{
   if(!input||Object.keys(input).sort().join(',')!=='action,expectedConsentRevision,requestKey'||!['grant','revoke'].includes(input.action)||!Number.isSafeInteger(input.expectedConsentRevision)||input.expectedConsentRevision<0||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))fail('INPUT_INVALID',400,'AI用途操作无效。');
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const a=await current(tx,p,id,version);await lock(tx,p,a);
    const requestHash=assetDigest({input,tenantId:p.tenantId,accountId:p.accountId,assetId:a.id,version:a.version}),old=await find(tx,p,input.requestKey);
    if(old){if(old.requestHash!==requestHash)fail('REQUEST_KEY_CONFLICT',409,'请求标识已用于另一项操作，请重新读取。');return receipt(old);}
    const prior=await readConsent(tx,p,a);if((prior?.revision??0)!==input.expectedConsentRevision)fail();
    const instant=now(),c={...L,id:'rhaic-'+randomUUID(),revision:(prior?.revision??0)+1,eventKind:input.action,state:input.action==='grant'?'active':'revoked',materialUseAllowed:true,startsAt:prior?.startsAt??new Date(instant).toISOString(),expiresAt:prior?.expiresAt??new Date(instant+7*86400000).toISOString()};
    assertReportAiLocalEvent(c,prior?{...prior,artifactVersionId:L.artifactVersionId,eventKind:prior.state==='active'?'grant':'revoke'}:null);
    if(input.action==='grant')assertReportAiAccess(p,a,c,{now:now(),providerScope:L.providerScope});
    const result=await write(tx,p,c,{requestKey:input.requestKey,requestHash});return receipt(result);
   });
  }
 };
}
