import {loadCatalogRecords} from '../../scripts/local-research-assets-catalog-read.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {createReportAiReader} from './report-ai-reader.mjs';
import {createReportAiConsent} from './report-ai-consent.mjs';
import {REPORT_AI_LOCAL as L} from './report-ai-local.mjs';

// Hub-owned, exact local admission. Does not open a session/job or call a model.
export function createLocalReportAiService({withAccess,assertSources}){
 const loadMetadata=async(tx,p,id,version)=>{
  if(p.accountId!==L.accountId||['tenantId','studyGroupId','researchProjectId'].some(k=>p[k]!==L[k])||id!==L.assetId||version!==L.assetVersion)throw catalogError('REPORT_AI_FORBIDDEN',403,'当前报告不在你的AI问答范围内。');
  const [record]=await loadCatalogRecords(tx,p,assertSources,{family:'business',assetId:id}),r=record?.registry,v=record?.policies.find(x=>x.version===version);
  if(!r||!v)throw catalogError('NOT_FOUND',404,'未找到当前报告固定版。');
  const binding=v.sourceBindings?.length===1?v.sourceBindings[0]:null;
  return{...Object.fromEntries(['tenantId','studyGroupId','researchProjectId'].map(k=>[k,p[k]])),id,version,studyId:L.studyId,ownerAccountId:r.ownerAccountId,kind:r.kind,state:r.approvedVersionNo===version&&r.workingVersionNo===version&&r.workingState==='approved'?'approved':r.workingState,deletedAt:r.deletedAt,bodyAllowed:r.ownerAccountId===p.accountId&&!r.deletedAt,sourceValid:v.sourceValid===true,artifactVersionId:v.artifactVersionId,contentHash:v.contentHash,policyHash:v.policyHash,sourceReportId:binding?.kind==='artifact'?binding.id:null,sourceReportVersion:binding?.version,title:v.metadata.title};
 };
 const readBody=async(tx,p,a)=>{const v=await tx.researchArtifactVersion.findFirst({where:{id:a.artifactVersionId,artifactId:a.id,versionNo:a.version,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},select:{contentMd:true}});if(!v)throw catalogError('REPORT_AI_EVIDENCE_CHANGED',409,'报告固定版已变化。');return v.contentMd;};
 const reader=createReportAiReader({withAccess,loadMetadata,readBody}),consent=createReportAiConsent({withAccess,loadMetadata});
 return{status:consent.status,consent:consent.execute,reader,
  fragment:(user,id,version,input)=>{if(!input||Object.keys(input).sort().join(',')!=='endLine,fragmentId,quoteHash,startLine')throw catalogError('INPUT_INVALID',400,'报告引用位置参数无效。');return reader.fragment(user,{...input,assetId:id,version:Number(version)});},
  async search(user,id,version,input){
   if(!input||Object.keys(input).join(',')!=='question')throw catalogError('INPUT_INVALID',400,'请仅提交需要核对的问题。');
   const pack=await reader.search(user,{assetId:id,version:Number(version),question:input.question});await reader.revalidate(user,pack);
   return{schema:'rh-report-qa-search.v1',status:pack.status,query:pack.query,assetId:id,version:Number(version),studyId:L.studyId,providerStatus:'not_enabled',generated:false,evidence:pack.evidence};
  }
 };
}
