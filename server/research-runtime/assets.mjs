import{withDeploymentTransaction}from'../database/transactions.mjs';
import{readAssetOverviewScopes}from'../research-assets/overview-scopes.mjs';
import{authorizeBusinessAssetStudy}from'../research-assets/business-access.mjs';
import{createBusinessAssetRegistration}from'../research-assets/business-registration.mjs';
import{createReportSourceService}from'../research-assets/report-source-service.mjs';
import{createMaterialAiBasisService}from'../research-assets/material-ai-basis.mjs';
import{createBusinessReportAiService}from'../research-assets/report-ai-business.mjs';
import{createBusinessAssetSources}from'../research-assets/business-sources.mjs';
import{createBusinessAssetReuse}from'../research-assets/business-reuse.mjs';
import{createBusinessAssetUploads}from'../research-assets/business-uploads.mjs';
import{createAssetDetailFiles}from'../../scripts/research-assets-detail-files.mjs';
import{assertVerifiedReportSource}from'../research-assets/report-source.mjs';
import{createAssetCatalogReader,loadCatalogRecords,presentAssetCatalog,visibleCatalogAsset}from'../../scripts/local-research-assets-catalog-read.mjs';
import{createAssetViewReader,previewAssetView,presentAssetViews,sourceNames}from'../../scripts/research-assets-catalog-views.mjs';
import{createAssetDetailReader}from'../../scripts/research-assets-detail-read.mjs';
import{createAssetGovernance,validateAssetGovernance}from'../../scripts/local-research-assets-governance.mjs';
import{createAssetLifecycle}from'../../scripts/local-research-assets-lifecycle.mjs';
import{createAssetUsage,readAssetCollaborations}from'../../scripts/local-research-assets-access.mjs';
import{createAssetComments}from'../../scripts/research-assets-comments.mjs';
import{parseAssetOverviewQuery}from'../../scripts/research-assets-overview-local.mjs';
import{presentAssetOverview}from'../../scripts/research-assets-overview.mjs';
import{createAssetRegistrationController}from'../../scripts/local-research-assets-registration-controller.mjs';
import{createAssetCatalogController}from'../../scripts/local-research-assets-catalog-controller.mjs';
import{catalogError}from'../../scripts/research-assets-catalog-contract.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=(code='CONTEXT_INVALID',status=403,message='当前资产或研究范围无法核对，请重新打开。')=>{throw catalogError(code,status,message);};
const unavailable=()=>fail('SERVICE_UNAVAILABLE',503,'此操作尚未配置，请保留当前内容并联系管理员。');
const blocked=new Proxy({},{get:()=>unavailable});
export async function originalAssetInputOnly(tx,p,value,context={},{allowUpload=false}={}){
 if(!(value.sourceKind==='author'||allowUpload&&value.sourceKind==='upload')||value.sourceBindings.length)fail('SOURCE_ROUTE_REQUIRED',422,'报告请从原报告登记，以保留固定正文和来源；此入口仅接受本人原创资料。');
 if(context.assetId){
  const history=await tx.$queryRawUnsafe('SELECT v.source_kind,v.source_bindings FROM rh_asset.version_policy v JOIN rh_asset.asset_registry r ON r.asset_id=v.asset_id WHERE r.tenant_id=$1 AND r.study_group_id=$2 AND r.research_project_id=$3 AND r.asset_id=$4 ORDER BY v.version_no',p.tenantId,p.studyGroupId,p.researchProjectId,context.assetId);
  if(!history.length||history.some(v=>!Array.isArray(v.source_bindings)||!(v.source_kind==='author'&&v.source_bindings.length===0||allowUpload&&value.sourceKind==='upload'&&v.source_kind==='upload'&&v.source_bindings.length===1&&v.source_bindings[0].kind==='upload')))fail('SOURCE_ROUTE_REQUIRED',422,'派生资产请从原来源修订，以保留固定正文和来源。');
 }
 return value;
}
export function createRuntimeAssets({config,foundation,load,require,readReport}){
 const env=foundation.transactionEnv,lock=load('common/worker-publication','lockAuthorizationMutation');
 const transaction=(user,fn)=>{
  if(user?.tenantId!==config.scope.defaultTenantId||!valid(user.accountId)||!Number.isSafeInteger(user.authVersion))fail();
  return withDeploymentTransaction(env,'app',async tx=>{await lock(tx,user.tenantId,{includeOfficial:true});await tx.$executeRawUnsafe("SELECT set_config('app.account_id',$1,true),set_config('app.auth_version',$2,true)",user.accountId,String(user.authVersion));return fn(tx);});
 };
 async function context(tx,s){if(!['studyGroupId','researchProjectId'].every(k=>valid(s[k])))fail();await tx.$executeRawUnsafe("SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true)",s.studyGroupId,s.researchProjectId);}
 const withAccess=(user,permission,run)=>transaction(user,async tx=>{await context(tx,user);const p=await authorizeBusinessAssetStudy({tx,user,scope:user,permission});return run(tx,p);});
 // Only scope IDs are resolved on the owner connection; no content is returned
 // until the app-role transaction independently validates current authority.
 async function scopedUser(req){
  const u=req.user,h=req.headers??{};if(!u||u.tenantId!==config.scope.defaultTenantId)fail();
  let scope;const asset=req.params?.id?.startsWith('rhab-')?req.params.id:req.query?.assetId;
  const study=req.query?.studyId;
  if(asset!==undefined||study!==undefined){
   if(asset!==undefined&&!valid(asset)||study!==undefined&&!valid(study))fail('INPUT_INVALID',400);
   scope=await withDeploymentTransaction(env,'direct',async tx=>{
    const rows=asset!==undefined?await tx.$queryRawUnsafe('SELECT tenant_id AS "tenantId",study_group_id AS "studyGroupId",research_project_id AS "researchProjectId" FROM rh_asset.asset_registry WHERE tenant_id=$1 AND asset_id=$2',u.tenantId,asset):await tx.$queryRawUnsafe('SELECT tenant_id AS "tenantId",study_group_id AS "studyGroupId",execution_project_id AS "researchProjectId" FROM rh_research.study_binding WHERE tenant_id=$1 AND id=$2',u.tenantId,study);
    if(rows.length!==1)fail('NOT_FOUND',404);return rows[0];
   },{readOnly:true});
  }else scope={tenantId:u.tenantId,studyGroupId:h['x-study-group-id'],researchProjectId:h['x-research-project-id']};
  if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||h['x-study-group-id']!==undefined&&h['x-study-group-id']!==scope.studyGroupId||h['x-research-project-id']!==undefined&&h['x-research-project-id']!==scope.researchProjectId)fail();
  return{...u,...scope};
 }
 const listRecipients=async(tx,p)=>{
  const rows=await tx.$queryRawUnsafe(`SELECT a.id,a."displayName" FROM public.account a WHERE a."tenantId"=$1 AND a.status='active' AND (a.id=$4 OR a.role='tenant_admin' AND a."isTenantAdmin"=true OR EXISTS(SELECT 1 FROM public.study_group_membership g JOIN public.permission_role r ON r.id=g."roleId" AND r."tenantId"=g."tenantId" AND r.status='active' JOIN public.research_project_membership m ON m."tenantId"=g."tenantId" AND m."studyGroupId"=g."studyGroupId" AND m."accountId"=g."accountId" WHERE g."tenantId"=a."tenantId" AND g."accountId"=a.id AND g."studyGroupId"=$2 AND m."researchProjectId"=$3 AND g.status='active' AND m.status='active')) ORDER BY a.id LIMIT 101`,p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId);
  if(rows.length>100)fail('RECIPIENT_SCOPE_TOO_LARGE',409);return rows.map(a=>({accountId:a.id,displayName:a.displayName,isSelf:a.id===p.accountId}));
 };
 const readSource=async(tx,p,ref)=>{
  if(!ref||Object.keys(ref).sort().join(',')!=='reportId,studyId'||!valid(ref.reportId)||!valid(ref.studyId)||typeof readReport!=='function')fail('REPORT_SOURCE_UNAVAILABLE',409);
  const value=await readReport(tx,p,{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},ref.studyId,ref.reportId),target={studyId:ref.studyId,reportId:ref.reportId,version:value.version.versionNo,contentHash:value.version.contentHash};
  assertVerifiedReportSource(value,p,target);return{value,target};
 };
 const uploads=createBusinessAssetUploads({withAccess,storage:foundation.storage,inspectFile:load('knowledge/knowledge-file-policy','assertKnowledgeImportFile')});
 const assetSources=createBusinessAssetSources({readReport,otherSources:(tx,p,policy)=>uploads.assertSources(tx,p,policy)}),assertSources=(tx,p,policy)=>policy.sourceKind==='upload'?uploads.assertSources(tx,p,policy):assetSources(tx,p,policy);
 const loadRecords=async(tx,p,sources)=>{
  const records=await loadCatalogRecords(tx,p,sources,{family:'business'});
  for(const record of records){record.aiAvailability='unavailable';const policy=record.policies.find(v=>v.version===record.registry.workingVersionNo),ref=policy?.sourceKind==='artifact'&&policy.sourceBindings[0];if(ref&&ref.id.startsWith('rh-formal-report-')){const[b]=await tx.$queryRawUnsafe('SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 AND study_group_id=$2 AND execution_project_id=$3',p.tenantId,p.studyGroupId,p.researchProjectId);if(b)record.sourceOrigin={studyId:b.id,reportId:ref.id,reportVersion:ref.version};}}
  return records;
 };
 const artifacts=(tx,p)=>{
  const same=(t,g,r)=>{if(t!==p.tenantId||g!==undefined&&g!==p.studyGroupId||r!==undefined&&r!==p.researchProjectId)fail();};
  const facade={forTenant:(t,g,r)=>{same(t,g,r);return tx;},withTenantTransaction:(t,g,r,run)=>{same(t,g,r);return run(tx);}};
  const remediation=new(load('remediation/remediation.service','RemediationCasesService'))(facade),features=new(load('tenants/tenant-features.service','TenantFeaturesService'))(facade);
  return new(load('research-artifacts/research-artifacts.service','ResearchArtifactsService'))(facade,foundation.storage,remediation,features,config.scope);
 };
 const reuse=createBusinessAssetReuse({withAccess,assertSources,loadRecords,artifacts});
 const readOptions={withAccess,assertSources,loadRecords},baseReader=createAssetCatalogReader({...readOptions,previewProjection:previewAssetView}),views=createAssetViewReader(readOptions);
 const reader={...baseReader,async detail(user,id,v){const result=await baseReader.detail(user,id,v);return result.ownerAccountId===user.accountId&&result.kind==='publication'&&result.state==='approved'&&result.sourceOrigin?{...result,reportQaEligible:true}:result;}};
 const materialBasis=createMaterialAiBasisService({withAccess,readNativeReport:async(tx,p,ref)=>{const s=await readSource(tx,p,{studyId:ref.studyId,reportId:ref.reportId});if(s.target.version!==ref.version)fail('REPORT_SOURCE_CHANGED',409);return s.value;}});
 const reportQa=createBusinessReportAiService({withAccess,assertSources,readSource});
 const registration=createBusinessAssetRegistration({withAccess,assertSources,listRecipients,uploads,resolveSource:(tx,p,v,c)=>originalAssetInputOnly(tx,p,v,c,{allowUpload:true})}),reportSource=createReportSourceService({withAccess,assertSources,readSource,syntheticOnly:false});
 const governance=createAssetGovernance({...readOptions,validate:v=>validateAssetGovernance(v,{family:'business',runtimeBusiness:true}),permissionFor:v=>v.action==='submit'?'artifact.edit':v.action==='review'?'artifact.review':'artifact.release'});
 const usage=createAssetUsage({...readOptions,runtimeBusiness:true}),lifecycle=createAssetLifecycle({...readOptions,family:'business'}),comments=createAssetComments({...readOptions,runtimeBusiness:true});
 const files=createAssetDetailFiles({...readOptions,storage:foundation.storage,runtimeBusiness:true,exportEnabled:config.assetMarkdownExportEnabled===true,renderMarkdown:input=>load('research-artifacts/research-artifact-export','renderResearchArtifact')('markdown',input),parseRange:load('knowledge/knowledge-source-content','parseKnowledgeSourceRange')});
 const details=createAssetDetailReader({...readOptions,readFixed:(tx,p,id,v)=>createAssetCatalogReader({...readOptions,withAccess:(_user,_permission,run)=>run(tx,p)}).detail({},id,v)});
 const overview={async read(user,input){
  const parsed=parseAssetOverviewQuery(input),projects=await withDeploymentTransaction(env,'direct',tx=>readAssetOverviewScopes(tx,user.tenantId),{readOnly:true});
  return transaction(user,async tx=>{
   const a=await tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId},include:{tenant:true}});if(!a||a.status!=='active'||a.tenant.status!=='active'||a.authVersion!==user.authVersion||a.role!==user.role||a.isTenantAdmin!==(a.role==='tenant_admin'))fail('AUTHORIZATION_REVOKED',401);
   const parts=[],clock=Date.now();let selectedAsset;
   for(const candidate of projects){const s=candidate.scope;await context(tx,s);let p;try{p=await authorizeBusinessAssetStudy({tx,user,scope:{tenantId:user.tenantId,...s},permission:'artifact.read'});}catch(e){if(e.status===403)continue;throw e;}
    const records=await loadRecords(tx,p,assertSources),query={...parsed.query,page:'1',pageSize:'50'},catalog=presentAssetCatalog({records,principal:p,query,now:clock,allItems:true}),contextRows=presentAssetCatalog({records,principal:p,query:{page:'1',pageSize:'50'},now:clock,allItems:true}).items;
    if(parsed.selection){const r=records.find(r=>r.registry.assetId===parsed.selection.id);if(r)selectedAsset=visibleCatalogAsset(r,p,clock,parsed.selection.version,records)?.row;}
    const view=parsed.tab==='list'?null:parsed.tab==='collaborations'?await readAssetCollaborations({tx,p,records,query:{...query,collaborationView:parsed.collaborationView},now:()=>clock,allItems:true,runtimeBusiness:true}):presentAssetViews({type:parsed.tab,records,principal:p,query,now:clock,allItems:true,knowledgeDocuments:await sourceNames(tx,p,records.flatMap(r=>r.policies))});
    parts.push({scope:s,identityRevision:p.identityRevision,label:p.projectName,canCreate:candidate.canCreate&&p.permissions.includes('artifact.create'),catalog,contextRows,view,trend:presentAssetViews({type:'usage',records,principal:p,query,now:clock})});
   }return presentAssetOverview({parts,user,...parsed,selectedAsset,now:clock});
  });
 }};
 const common={require,load,runtimePolicy:foundation.runtimePolicy,origin:config.origin,scopedUser};
 const Registration=createAssetRegistrationController({...common,registration,reportSource,materialBasis,reportContext:blocked,governance,usage,lifecycle,uploads});
 const Catalog=createAssetCatalogController({...common,reader,views,details,overview,comments,files,reuse,ai:blocked,reportQa});
 return{Controllers:[Registration,Catalog],withAccess,readSource,assertSources,loadRecords,registration,reportSource,materialBasis,reportQa,reuse,uploads,files,governance,reader,overview};
}
