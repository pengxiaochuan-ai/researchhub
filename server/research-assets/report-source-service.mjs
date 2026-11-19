import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {loadCatalogRecords} from '../../scripts/local-research-assets-catalog-read.mjs';
import {createBusinessAssetRegistration,businessRegistrationRequestHash} from './business-registration.mjs';
import {findCatalogOperation} from '../../scripts/local-research-assets-registration.mjs';
import {isBusinessAssetId} from '../../scripts/research-assets-business-identity.mjs';
import {assertVerifiedReportSource,buildReportSourceRegistration} from './report-source.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
const fail=(code,status=409)=>{throw catalogError(code,status,'报告来源或已登记资产无法核对，请从原报告重新读取。');};
export async function assertCurrentReportAsset(tx,p,id,r,policy,target){
 const bindings=policy?.sourceBindings,ref=bindings?.[0];
 if(!r||!policy?.sourceValid||r.ownerAccountId!==p.accountId||r.deletedAt||policy.sourceKind!=='artifact'||!Array.isArray(bindings)||bindings.length!==1||!ref||ref.kind!=='artifact'||ref.id!==target.reportId||ref.version!==target.version||ref.contentHash!==target.contentHash||policy.contentHash!==target.contentHash)fail('REPORT_SOURCE_ASSET_CHANGED');
 const fixed=await tx.researchArtifactVersion.findFirst({where:{id:policy.artifactVersionId,artifactId:id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,versionNo:r.workingVersionNo},select:{contentMd:true,contentHash:true}});
 if(!fixed||typeof fixed.contentMd!=='string'||fixed.contentHash!==target.contentHash||assetDigest(fixed.contentMd)!==target.contentHash)fail('REPORT_SOURCE_ASSET_CHANGED');
}
// readSource is the authoritative current native reader, not a browser DTO.
export function createReportSourceService({withAccess,readSource,assertSources,beforeCommit,syntheticOnly=true}){
 async function source(tx,p,ref){const result=await readSource(tx,p,ref);assertVerifiedReportSource(result.value,p,result.target);return result;}
 async function existing(tx,p,{target}){
  const rows=await tx.$queryRawUnsafe('SELECT DISTINCT r.asset_id FROM rh_asset.asset_registry r JOIN rh_asset.version_policy v ON v.asset_id=r.asset_id WHERE r.tenant_id=$1 AND r.study_group_id=$2 AND r.research_project_id=$3 AND r.owner_account_id=$4 AND v.source_bindings @> $5::jsonb',p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,JSON.stringify([{kind:'artifact',id:target.reportId,version:target.version}]));
  if(rows.length>1)fail('REPORT_SOURCE_AMBIGUOUS');if(!rows.length)return null;
  const id=rows[0].asset_id;if(!isBusinessAssetId(id))fail('REPORT_SOURCE_ALREADY_REGISTERED');
  const record=(await loadCatalogRecords(tx,p,assertSources,{family:'business',assetId:id}))[0],r=record?.registry,policy=record?.policies.find(v=>v.version===r.workingVersionNo);
  await assertCurrentReportAsset(tx,p,id,r,policy,target);
  return{assetId:id,version:r.workingVersionNo,revision:r.revision,workingState:r.workingState,metadata:policy.metadata,rightsEvidence:policy.rightsEvidence,operation:'existing',status:'committed'};
 }
 const registration=(tx,p)=>createBusinessAssetRegistration({withAccess:(_u,_permission,run)=>run(tx,p),assertSources,beforeCommit,syntheticOnly});
 return{
  preview:(user,ref)=>withAccess(user,'artifact.read',async(tx,p)=>{const s=await source(tx,p,ref);return{studyId:s.target.studyId,reportId:s.target.reportId,reportVersion:s.target.version,reportTitle:s.value.artifact.title,contentHash:s.target.contentHash,author:p.displayName,existing:await existing(tx,p,s)};}),
  register:(user,ref,input)=>withAccess(user,'artifact.create',async(tx,p)=>{
   const s=await source(tx,p,ref),value=buildReportSourceRegistration(input,s.value,p,s.target);
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text',JSON.stringify(['report-asset',p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,s.target.reportId,s.target.version]));
   const prior=await findCatalogOperation(tx,p,value.requestKey,businessRegistrationRequestHash(value,p));
   const current=await existing(tx,p,s);if(prior){if(!current||prior.assetId!==current.assetId)fail('REPORT_SOURCE_RECEIPT_CHANGED');return prior;}if(current)return current;
   await source(tx,p,ref);return registration(tx,p).register(user,value);
  }),
  revise:(user,ref,input)=>withAccess(user,'artifact.edit',async(tx,p)=>{
   if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='baseVersion,expectedRevision,limitations,purpose,requestKey,rightsEvidence')fail('INPUT_INVALID',400);
   const{baseVersion,expectedRevision,...notes}=input,s=await source(tx,p,ref),value={...buildReportSourceRegistration(notes,s.value,p,s.target),baseVersion,expectedRevision},current=await existing(tx,p,s);if(!current)fail('NOT_FOUND',404);
   return registration(tx,p).revise(user,current.assetId,value);
  })
 };
}
