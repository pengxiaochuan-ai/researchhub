import{catalogError,assertAssetCatalogInput}from'./research-assets-catalog-contract.mjs';
import{authorizeCatalogScope}from'./research-assets-catalog-access.mjs';
import{loadCatalogRecords,presentAssetCatalog,visibleCatalogAsset}from'./local-research-assets-catalog-read.mjs';
import{presentAssetViews,sourceNames}from'./research-assets-catalog-views.mjs';
import{readAssetCollaborations}from'./local-research-assets-access.mjs';
import{REPORT_CONTEXT,assertReportContextPrincipal}from'./research-assets-report-context.mjs';
import{presentAssetOverview}from'./research-assets-overview.mjs';
import{assetVersionInRange}from'./research-assets-business-identity.mjs';
import{authorizeBusinessAssetStudy}from'../server/research-assets/business-access.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=(code,status=400)=>{throw catalogError(code,status,'资产总览范围无法完整核对，请重新读取。');};
export function parseAssetOverviewQuery(input={}){
 const entries=input instanceof URLSearchParams?[...input]:Object.entries(input),extra=['tab','collaborationView','studyGroupId','researchProjectId','selectedAssetId','selectedVersion','cursor'];
 if(new Set(entries.map(([k])=>k)).size!==entries.length||entries.some(([,v])=>typeof v!=='string'))fail('INPUT_INVALID');
 const ui=Object.fromEntries(entries.filter(([k])=>extra.includes(k))),query=assertAssetCatalogInput(new URLSearchParams(entries.filter(([k])=>!extra.includes(k))));
 if(!['list','graph','contributions','collaborations','trash'].includes(ui.tab??'list')||!['all','sent','received','requested','pending'].includes(ui.collaborationView??'all'))fail('INPUT_INVALID');
 if((ui.studyGroupId||ui.researchProjectId)&&(!id(ui.studyGroupId)||!id(ui.researchProjectId)))fail('INPUT_INVALID');
 if((ui.selectedAssetId||ui.selectedVersion)&&(!id(ui.selectedAssetId)||!/^[1-9]\d*$/.test(ui.selectedVersion??'')||!assetVersionInRange(ui.selectedAssetId,Number(ui.selectedVersion))))fail('INPUT_INVALID');
 return{query:Object.fromEntries(Object.entries(query).map(([k,v])=>[k,String(v)])),tab:ui.tab??'list',collaborationView:ui.collaborationView??'all',studyFilter:ui.studyGroupId?{studyGroupId:ui.studyGroupId,researchProjectId:ui.researchProjectId}:null,selection:ui.selectedAssetId?{id:ui.selectedAssetId,version:Number(ui.selectedVersion)}:null,cursor:ui.cursor??null};
}
export function createAssetOverview({ids,transaction,assertSources,now=()=>Date.now(),businessProjects=[],businessCreationProjects=businessProjects,businessActors=[],projectRecords=records=>records}){
 return{async read(user,input){
  const parsed=parseAssetOverviewQuery(input);
  if(user?.tenantId!==ids.tenant||![ids.owner,ids.admin,...businessActors].includes(user.accountId)||!Number.isSafeInteger(user.authVersion))fail('AUTHORIZATION_REVOKED',403);
  return transaction(user,async tx=>{
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId:ids.tenant},include:{tenant:true}});
   if(!account||account.status!=='active'||account.tenant?.status!=='active'||account.authVersion!==user.authVersion||account.role!==user.role)fail('AUTHORIZATION_REVOKED',401);
   const registered=await tx.$queryRawUnsafe("SELECT DISTINCT study_group_id,research_project_id FROM rh_asset.asset_registry WHERE tenant_id=$1 AND asset_id NOT LIKE 'rhab-%'",ids.tenant);
   if(registered.some(r=>r.study_group_id!==ids.group||![ids.project,REPORT_CONTEXT.projectId].includes(r.research_project_id)))fail('OVERVIEW_SCOPE_UNAVAILABLE',409);
   const projects=[...new Set([ids.project,...registered.map(r=>r.research_project_id),...businessProjects])],parts=[],clock=now();let selectedAsset=null;
   for(const project of projects){
    const businessOnly=businessActors.includes(user.accountId)&&![ids.owner,ids.admin].includes(user.accountId);
    let p;try{p=businessOnly?await authorizeBusinessAssetStudy({tx,user,scope:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:project},permission:'artifact.read'}):await authorizeCatalogScope({ids:{...ids,project},tx,user:{...user,studyGroupId:ids.group,researchProjectId:project},permission:'artifact.read'});if(project===REPORT_CONTEXT.projectId)assertReportContextPrincipal(p);}
    catch(e){if(e.status===403&&['ASSET_CATALOG_AUTHORIZATION_REVOKED','ASSET_CATALOG_REPORT_CONTEXT_FORBIDDEN'].includes(e.code))continue;throw e;}
    const legacy=!businessOnly&&(project===ids.project||project===REPORT_CONTEXT.projectId)?await loadCatalogRecords(tx,p,assertSources,{skipInvisibleSourceReads:businessProjects.includes(project)}):[];
    const business=businessProjects.includes(project)?await loadCatalogRecords(tx,p,assertSources,{family:'business'}):[];
    const records=projectRecords([...legacy,...business],p),query={...parsed.query,page:'1',pageSize:'50'},catalog=presentAssetCatalog({records,principal:p,query,now:clock,allItems:true}),contextRows=presentAssetCatalog({records,principal:p,query:{page:'1',pageSize:'50'},now:clock,allItems:true}).items;
    if(parsed.selection){const record=records.find(r=>r.registry.assetId===parsed.selection.id);if(record)selectedAsset=visibleCatalogAsset(record,p,clock,parsed.selection.version,records)?.row??null;}
    const policies=records.flatMap(r=>r.policies.filter(v=>contextRows.some(row=>row.id===r.registry.assetId&&row.version===v.version)));
    const view=parsed.tab==='list'?null:parsed.tab==='collaborations'?await readAssetCollaborations({tx,p,records,query:{...query,collaborationView:parsed.collaborationView},ids,now:()=>clock,allItems:true}):presentAssetViews({type:parsed.tab,records,principal:p,query,knowledgeDocuments:await sourceNames(tx,p,policies),now:clock,allItems:true});
    parts.push({scope:{studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},identityRevision:p.identityRevision,label:p.projectName,canCreate:(project===ids.project||businessCreationProjects.includes(project))&&(p.isTenantAdmin||p.permissions.includes('artifact.create')),catalog,contextRows,view,trend:presentAssetViews({type:'usage',records,principal:p,query,now:clock})});
   }
   return presentAssetOverview({parts,user,...parsed,selectedAsset,now:clock});
  });
 }};
}
