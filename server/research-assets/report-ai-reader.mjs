import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assertReportAiAccess,reportAiBinding} from './report-ai-access.mjs';
import {fragmentReport,searchReportFragments} from './report-ai-search.mjs';
const fail=(code='REPORT_AI_EVIDENCE_CHANGED',status=409)=>{throw catalogError(code,status,'报告、来源或AI用途已变化，请重新核对。');};
// Do NOT filter grant/active/expiry before LIMIT 1: a newer revoke must win.
export async function readLatestReportAiConsent(tx,p,a){
 let rows;try{rows=await tx.$queryRawUnsafe("SELECT * FROM rh_asset.ai_use_consent_event WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND asset_id=$4 AND version_no=$5 AND account_id=$6 AND provider_scope=$7 AND purpose=$8 ORDER BY consent_revision DESC LIMIT 1",p.tenantId,p.studyGroupId,p.researchProjectId,a.id,a.version,p.accountId,'deepseek','research_report_qa');}catch(e){if(e.code==='42P01'||e.meta?.code==='42P01')throw catalogError('REPORT_AI_UNAVAILABLE',503,'报告AI用途许可尚未启用，请联系管理员。');throw e;}
 const c=rows[0];if(!c)return null;
 return{id:c.id,tenantId:c.tenant_id,studyGroupId:c.study_group_id,researchProjectId:c.research_project_id,studyId:c.study_id,assetId:c.asset_id,assetVersion:c.version_no,accountId:c.account_id,providerScope:c.provider_scope,purpose:c.purpose,contentHash:c.content_hash,policyHash:c.policy_hash,sourceReportId:c.source_report_id,sourceReportVersion:c.source_report_version,materialUseAllowed:c.material_ai_allowed,basisReference:c.material_basis_ref,materialBasisHash:c.material_basis_hash,revision:c.consent_revision,state:c.event_kind==='grant'?'active':'revoked',startsAt:new Date(c.starts_at).toISOString(),expiresAt:new Date(c.expires_at).toISOString()};
}
export function createReportAiReader({withAccess,loadMetadata,readConsent=readLatestReportAiConsent,readBody,now=Date.now}){
 if(![withAccess,loadMetadata,readConsent,readBody].every(x=>typeof x==='function'))throw TypeError('Current report/consent readers required');
 async function current(tx,p,id,version){
  const a=await loadMetadata(tx,p,id,version);if(!a||a.id!==id||a.version!==version)fail();
  const c=await readConsent(tx,p,a);assertReportAiAccess(p,a,c,{now:now(),providerScope:'deepseek'});return{a,binding:reportAiBinding(p,a,c)};
 }
 async function body(tx,p,a){const md=await readBody(tx,p,a);return fragmentReport(md,a.contentHash);}
 return{
  fragment(user,input){return withAccess(user,'artifact.read',async(tx,p)=>{
   if(!input||Object.keys(input).sort().join(',')!=='assetId,endLine,fragmentId,quoteHash,startLine,version')fail('INPUT_INVALID',400);
   const{a,binding}=await current(tx,p,input.assetId,input.version),parts=await body(tx,p,a),f=parts.find(x=>x.id===input.fragmentId&&x.quoteHash===input.quoteHash&&x.startLine===input.startLine&&x.endLine===input.endLine);if(!f)fail();
   const again=await current(tx,p,a.id,a.version);if(assetDigest(binding)!==assetDigest(again.binding))fail();return f;
  });},
  search(user,input){
   if(!input||Object.keys(input).sort().join(',')!=='assetId,question,version'||typeof input.assetId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(input.assetId)||!Number.isSafeInteger(input.version)||input.version<1)fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const{a,binding}=await current(tx,p,input.assetId,input.version),parts=await body(tx,p,a),selected=searchReportFragments(input.question,parts,{seedAsset:true}),again=await current(tx,p,input.assetId,input.version);if(assetDigest(again.binding)!==assetDigest(binding))fail();
    const pack={schema:'rh-report-ai-evidence.v1',binding,...selected};return{...pack,packHash:assetDigest(pack)};
   });
  },
  revalidate(user,pack){return withAccess(user,'artifact.read',async(tx,p)=>{
   if(!pack||pack.schema!=='rh-report-ai-evidence.v1')fail();const{packHash,...saved}=pack;if(assetDigest(saved)!==packHash)fail();
   const{a,binding}=await current(tx,p,pack.binding.assetId,pack.binding.assetVersion);if(assetDigest(binding)!==assetDigest(pack.binding))fail();
   const selected=searchReportFragments(pack.query,await body(tx,p,a),{seedAsset:true});if(assetDigest(selected)!==assetDigest({status:pack.status,toolName:pack.toolName,query:pack.query,plan:pack.plan,evidence:pack.evidence}))fail();
   const again=await current(tx,p,a.id,a.version);if(assetDigest(again.binding)!==assetDigest(binding))fail();return true;
  });}
 };
}
