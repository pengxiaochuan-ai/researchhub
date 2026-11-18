import {authorizeBusinessAssetStudy} from './business-access.mjs';
import {assertBusinessLocalScope,createBusinessLocalBudget,createBusinessLocalEventBudget,projectBusinessLocalActions,businessLocalCapacity,BUSINESS_LOCAL_MEMBER} from './business-local.mjs';
import {createBusinessAssetRegistration} from './business-registration.mjs';
import {createAssetCatalogReader,loadCatalogRecords} from '../../scripts/local-research-assets-catalog-read.mjs';
import {createAssetViewReader,previewAssetView} from '../../scripts/research-assets-catalog-views.mjs';
import {createAssetDetailReader} from '../../scripts/research-assets-detail-read.mjs';
import {createAssetGovernance,validateAssetGovernance} from '../../scripts/local-research-assets-governance.mjs';
import {createAssetLifecycle} from '../../scripts/local-research-assets-lifecycle.mjs';
import {createAssetTargetPrisma} from '../../scripts/research-assets-reuse.mjs';
import {createAssetUsage} from '../../scripts/local-research-assets-access.mjs';
import {REPAIR_ASSET_ID} from './business-local-repair.mjs';
import {createReportContextPrisma} from '../../scripts/local-research-assets-report-context.mjs';
import {C2_REPORT,c2ReportPolicy,isC2Scope} from './report-source-local.mjs';
import {createReportSourceService} from './report-source-service.mjs';
import {readLocalReportAssetSourceInTransaction} from '../../scripts/local-research-analysis.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assertVerifiedReportSource} from './report-source.mjs';
import {REPORT_AI_LOCAL as REPORT_QA_LOCAL} from './report-ai-local.mjs';
import {createLocalReportAiService} from './report-ai-service.mjs';

export function createBusinessLocalTransaction({ids,prisma,withAuthorizationMutation}){
 const target=createAssetTargetPrisma({ids,prisma});
 const report=createReportContextPrisma({ids,prisma});
 return async(user,run)=>{
  assertBusinessLocalScope(ids,user);
  const client=user.researchProjectId===ids.project?prisma:user.researchProjectId===C2_REPORT.researchProjectId?report:target;
  return withAuthorizationMutation(client,user.tenantId,run,{studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,includeOfficial:true});
 };
}

// Local execution adapter only. Legacy objects keep their original service,
// source gate, upload handling, replay projection and protected fixture family.
export function createLocalBusinessAssetCatalog({ids,legacy,transaction}){
 const creationProjects=[ids.project,'rh-asset-detail-20261113-study-b'],projects=[...creationProjects,C2_REPORT.researchProjectId];
 const businessId=id=>typeof id==='string'&&id.startsWith('rhab-');
 const inScope=user=>projects.includes(user.researchProjectId);
 const withAccess=async(user,permission,run)=>{
  assertBusinessLocalScope(ids,user);
  return transaction(user,async tx=>{
   const p=await authorizeBusinessAssetStudy({tx,user,scope:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId},permission});
   return run(tx,{...p,catalogActors:{owner:ids.owner,admin:ids.admin}});
  });
 };
 const readSource=async(tx,p,ref)=>{
  if(!isC2Scope(p)||!p.isTenantAdmin||!ref||Object.keys(ref).sort().join(',')!=='reportId,studyId'||ref.reportId!==C2_REPORT.reportId||ref.studyId!==C2_REPORT.studyId)throw catalogError('FORBIDDEN',403,'当前报告不在可登记范围内。');
  let value;try{value=await readLocalReportAssetSourceInTransaction(tx,p,{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},ref.studyId,ref.reportId);}catch(e){const status=e.status??e.getStatus?.();if([403,404,409].includes(status))throw catalogError('REPORT_SOURCE_CHANGED',status,'原报告依据或当前权限已变化，请重新核对。');throw e;}
  if(value.source.id!==C2_REPORT.runId||value.basis.snapshotId!==C2_REPORT.snapshotId)throw catalogError('REPORT_SOURCE_CHANGED',409,'原报告依据已变化，请重新核对。');
  assertVerifiedReportSource(value,p,C2_REPORT);
  return{value,target:C2_REPORT};
 };
 const assertSources=async(tx,p,policy)=>{
  if(c2ReportPolicy(policy,p)){try{await readSource(tx,p,{reportId:C2_REPORT.reportId,studyId:C2_REPORT.studyId});return true;}catch(e){if([403,404,409].includes(e.status))return false;throw e;}}
  return legacy.assertSources(tx,p,policy);
 };
 const loadRecords=async(tx,p,sources)=>projectBusinessLocalActions([
  ...([ids.project,C2_REPORT.researchProjectId].includes(p.researchProjectId)&&p.accountId!==BUSINESS_LOCAL_MEMBER?await loadCatalogRecords(tx,p,sources,{skipInvisibleSourceReads:true}):[]),
  ...await loadCatalogRecords(tx,p,sources,{family:'business'})
 ],p);
 const readOptions={withAccess,assertSources,loadRecords};
 const reader=createAssetCatalogReader({...readOptions,previewProjection:previewAssetView});
 const views=createAssetViewReader(readOptions);
 const details=createAssetDetailReader({withAccess,assertSources,readFixed:(tx,p,id,v)=>createAssetCatalogReader({...readOptions,withAccess:(_user,_permission,run)=>run(tx,p)}).detail({},id,v)});
 const listRecipients=async(tx,p)=>{
  const candidates=[p.accountId];
  if(p.accountId===BUSINESS_LOCAL_MEMBER){const[r]=await tx.$queryRawUnsafe('SELECT rh_asset.business_recipients_valid($1,$2,$3,$4,$5::text[]) AS allowed',REPAIR_ASSET_ID,p.tenantId,p.studyGroupId,p.researchProjectId,[ids.owner]);if(r?.allowed===true)candidates.push(ids.owner);}
  const accounts=await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:candidates},status:'active'},select:{id:true,displayName:true}});
  return accounts.map(a=>({accountId:a.id,displayName:a.displayName,isSelf:a.id===p.accountId}));
 };
 const registration=createBusinessAssetRegistration({withAccess,listRecipients,beforeCommit:createBusinessLocalBudget(ids),syntheticOnly:true});
 const reportSource=createReportSourceService({withAccess,readSource,assertSources,beforeCommit:createBusinessLocalBudget(ids)});
 const eventBudget=createBusinessLocalEventBudget(ids);
 const governance=createAssetGovernance({ids,...readOptions,validate:input=>validateAssetGovernance(input,{ids,family:'business'}),permissionFor:value=>value.action==='submit'?'artifact.edit':value.action==='review'?'artifact.review':'artifact.release',beforeCommit:eventBudget,auditOptions:{syntheticOnly:true}});
 const lifecycle=createAssetLifecycle({...readOptions,family:'business',beforeCommit:eventBudget,auditOptions:{syntheticOnly:true}});
 const usage=createAssetUsage({ids,...readOptions,beforeCommit:eventBudget,auditOptions:{syntheticOnly:true}});
 const localUsage={...usage,async options(user,id,version){const o=await usage.options(user,id,version),target=id===REPAIR_ASSET_ID&&Number(version)===3;return{...o,canShare:false,canManage:target&&user.accountId===ids.admin&&o.expectedRevision===11&&o.canManage,canRequest:target&&user.accountId===ids.owner&&o.expectedRevision===10&&o.canRequest,canCite:target&&user.accountId===ids.owner&&o.expectedRevision===12&&o.canCite};}};
 const routed=(service,old)=>Object.fromEntries(Object.keys(old).map(name=>[name,(user,id,...args)=>businessId(id)?service[name](user,id,...args):old[name](user,id,...args)]));
 return{
  reader:{catalog:(user,query)=>inScope(user)?reader.catalog(user,query):legacy.reader.catalog(user,query),detail:async(user,id,v)=>{const result=await(businessId(id)?reader.detail(user,id,v):legacy.reader.detail(user,id,v));return id===REPORT_QA_LOCAL.assetId&&result.version===REPORT_QA_LOCAL.assetVersion&&user.accountId===REPORT_QA_LOCAL.accountId?{...result,reportQaEligible:true}:result;},preview:(user,id,v,tab)=>businessId(id)?reader.preview(user,id,v,tab):legacy.reader.preview(user,id,v,tab)},
  views:{read:(user,...args)=>inScope(user)?views.read(user,...args):legacy.views.read(user,...args)},
  details:routed(details,legacy.details),
  governance:routed(governance,legacy.governance),lifecycle:routed(lifecycle,legacy.lifecycle),
  usage:{...routed(localUsage,legacy.usage),collaborations:(user,query)=>inScope(user)?usage.collaborations(user,query):legacy.usage.collaborations(user,query)},
  registration:{
   async options(user,id){
    if(id&&!businessId(id)||!inScope(user))return legacy.registration.options(user);
    const value=await registration.options(user);
    return value.ownAssets.length<businessLocalCapacity(user)?value:{...value,admission:{canCreate:false,reason:'当前可新增数量已用完，请核对已有资产。'}};
   },
   register:(user,input)=>registration.register(user,input),
   revise:(user,id,input)=>businessId(id)?registration.revise(user,id,input):legacy.registration.revise(user,id,input),
   edit:(user,id,v)=>businessId(id)?registration.edit(user,id,v):legacy.registration.edit(user,id,v),
   async operation(user,key){if(inScope(user)){const receipt=await registration.operation(user,key);if(receipt.status!=='not_found'||!([ids.project,C2_REPORT.researchProjectId].includes(user.researchProjectId)))return receipt;}return legacy.registration.operation(user,key);}
  },
  reportSource,reportQa:createLocalReportAiService({withAccess,assertSources}),assertSources,projects,creationProjects,actors:[BUSINESS_LOCAL_MEMBER],projectRecords:projectBusinessLocalActions
 };
}
