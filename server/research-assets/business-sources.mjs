import{loadCatalogRecords,visibleCatalogAsset,fixedReleaseState}from'../../scripts/local-research-assets-catalog-read.mjs';
import{assetDigest}from'../../scripts/research-assets-registration-contract.mjs';
import{assertVerifiedReportSource}from'./report-source.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export function createBusinessAssetSources({readReport,loadRecords=loadCatalogRecords,now=Date.now,otherSources=async()=>false}){
 async function verify(tx,p,policy,visited=new Set()){
  if(policy?.sourceKind==='upload')return otherSources(tx,p,policy);
  if(policy?.sourceKind==='author')return Array.isArray(policy.sourceBindings)&&policy.sourceBindings.length===0;
  if(policy?.sourceKind!=='artifact'||!Array.isArray(policy.sourceBindings)||policy.sourceBindings.length!==1)return false;
  const ref=policy.sourceBindings[0];if(ref?.kind!=='artifact'||!valid(ref.id)||!Number.isSafeInteger(ref.version)||ref.version<1||!/^[a-f0-9]{64}$/.test(ref.contentHash??''))return false;
  if(ref.id.startsWith('rhab-')){
   if(visited.size>=8||visited.has(ref.id)||ref.id===policy.assetId)return false;const next=new Set(visited);if(policy.assetId)next.add(policy.assetId);next.add(ref.id);
   try{
    const [record]=await loadRecords(tx,p,(tx,p,value)=>verify(tx,p,value,next),{family:'business',assetId:ref.id}),fixed=record&&visibleCatalogAsset(record,p,now(),ref.version);
    if(!fixed?.view.bodyAllowed||fixed.policy.sourceValid!==true||fixed.policy.contentHash!==ref.contentHash||record.registry.deletedAt||fixedReleaseState(record,ref.version,now())==='withdrawn')return false;
    const[rights]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,'read_body') AS allowed",ref.id,ref.version);if(rights?.allowed!==true)return false;
    const v=await tx.researchArtifactVersion.findFirst({where:{id:fixed.policy.artifactVersionId,artifactId:ref.id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,versionNo:ref.version},select:{contentMd:true}});return typeof v?.contentMd==='string'&&assetDigest(v.contentMd)===ref.contentHash;
   }catch(e){if([401,403,404,409].includes(e.status??e.getStatus?.()))return false;throw e;}
  }
  const[binding]=await tx.$queryRawUnsafe('SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 AND study_group_id=$2 AND execution_project_id=$3',p.tenantId,p.studyGroupId,p.researchProjectId);if(!binding||typeof readReport!=='function')return false;
  try{const value=await readReport(tx,p,{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},binding.id,ref.id);assertVerifiedReportSource(value,{...p,accountId:value.artifact.ownerAccountId},{studyId:binding.id,reportId:ref.id,version:ref.version,contentHash:ref.contentHash});return true;}catch(e){if([401,403,404,409].includes(e.status??e.getStatus?.()))return false;throw e;}
 }
 return(tx,p,policy)=>verify(tx,p,policy);
}
