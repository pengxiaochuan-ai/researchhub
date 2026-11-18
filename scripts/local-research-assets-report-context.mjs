import {REPORT_CONTEXT as c,assertReportContextPrincipal,assertReportContextSource,buildReportContextRegistration,reportContextSourceError} from './research-assets-report-context.mjs';
import {readLocalReportAssetSourceInTransaction} from './local-research-analysis.mjs';
import {assetDigest,registrationRequestHash,validateAssetRegistration} from './research-assets-registration-contract.mjs';
import {writeAssetVersion,appendCatalogEvent,findCatalogOperation,createAssetRegistration} from './local-research-assets-registration.mjs';
import {catalogError} from './research-assets-catalog-contract.mjs';
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
export function createReportContextPrisma({ids,prisma}){
 return{async withTenantTransaction(tenant,group,project,run){
  if(tenant!==ids.tenant||group!==ids.group||project!==c.projectId)throw catalogError('REPORT_CONTEXT_FORBIDDEN',403,'报告资产范围无法核对。');
  return prisma.app.$transaction(async tx=>{for(const [k,v]of [['app.tenant_id',tenant],['app.study_group_id',group],['app.research_project_id',project]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',k,v);return run(tx);});
 }};
}
export async function readReportContextSource(tx,p){
 assertReportContextPrincipal(p);
 try{return assertReportContextSource(await readLocalReportAssetSourceInTransaction(tx,p,scope(p),c.studyId,c.reportId),p);}catch(e){throw reportContextSourceError(e);}
}
export async function assertReportContextPolicy(tx,p,policy){
 if(policy.sourceKind!=='artifact'||assetDigest(policy.sourceBindings)!==assetDigest([{kind:'artifact',id:c.reportId,version:c.version,contentHash:c.hash}]))return false;
 try{await readReportContextSource(tx,p);return true;}catch(e){if([403,404,409].includes(e.status??e.getStatus?.()))return false;throw e;}
}
export function createReportAssetContext({ids,withAccess,assertSources}){
 const where=p=>({id:c.assetId,...scope(p),ownerAccountId:p.accountId,idempotencyKey:c.key});
 async function existing(tx,p){
  const a=await tx.researchArtifact.findFirst({where:where(p),select:{id:true,currentVersionNo:true}});
  if(!a)return null;
  const [r]=await tx.$queryRawUnsafe('SELECT revision,working_state FROM rh_asset.asset_registry WHERE asset_id=$1 AND tenant_id=$2 AND research_project_id=$3',a.id,p.tenantId,c.projectId);
  if(!r)throw catalogError('CONTEXT_INVALID',409,'原登记结果暂不可核对。');
  const [policy]=await tx.$queryRawUnsafe('SELECT metadata,rights_evidence FROM rh_asset.version_policy WHERE asset_id=$1 AND version_no=$2',a.id,a.currentVersionNo);
  return{assetId:a.id,version:a.currentVersionNo,revision:r.revision,workingState:r.working_state,metadata:policy.metadata,rightsEvidence:policy.rights_evidence,operation:'existing',status:'committed'};
 }
 return{
  preview:user=>withAccess(user,'artifact.read',async(tx,p)=>{const src=await readReportContextSource(tx,p);return{studyId:c.studyId,reportId:c.reportId,reportVersion:1,reportTitle:src.artifact.title,contentHash:c.hash,author:p.displayName,existing:await existing(tx,p)};}),
  register:(user,input)=>withAccess(user,'artifact.create',async(tx,p)=>{
   const source=await readReportContextSource(tx,p),value=validateAssetRegistration(buildReportContextRegistration(input,source,p),{ids});
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text',p.tenantId+':'+c.key);
   const hash=registrationRequestHash(value,p),old=await findCatalogOperation(tx,p,value.requestKey,hash);if(old)return old;
   const prior=await existing(tx,p);if(prior)return prior;
   await readReportContextSource(tx,p);
   await tx.researchArtifact.create({data:{id:c.assetId,...scope(p),typeKey:'research_report',title:value.metadata.title,status:'draft',ownerAccountId:p.accountId,createdBy:p.accountId,idempotencyKey:c.key,creationRequestHash:hash}});
   await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind) VALUES($1,$2,$3,$4,$5,$6)',c.assetId,p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,'publication');
   const r={assetId:c.assetId,...scope(p),ownerAccountId:p.accountId,kind:'publication',revision:1,workingVersionNo:1};
   await writeAssetVersion(tx,p,r,value);
   const receipt={assetId:c.assetId,version:1,revision:1,operation:'created',status:'committed'};
   await appendCatalogEvent(tx,p,{registry:r,version:1,type:'created',requestKey:value.requestKey,requestHash:hash,payload:{reportId:c.reportId,reportVersion:1,reportVersionId:source.version.id,studyId:c.studyId,runId:c.runId},receipt});
   await readReportContextSource(tx,p);return receipt;
  }),
  revise:(user,input)=>withAccess(user,'artifact.edit',async(tx,p)=>{
   if(!input||Object.keys(input).sort().join(',')!=='baseVersion,expectedRevision,limitations,purpose,requestKey,rightsEvidence')throw catalogError('INPUT_INVALID',400,'修订输入无法核对。');
   const {baseVersion,expectedRevision,...notes}=input,source=await readReportContextSource(tx,p),value={...buildReportContextRegistration(notes,source,p),baseVersion,expectedRevision};
   return createAssetRegistration({ids,withAccess:(_u,_perm,run)=>run(tx,p),assertSources}).revise(user,c.assetId,value);
  })
 };
}
