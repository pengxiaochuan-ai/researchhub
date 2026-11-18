import {createAssetReuse,assertAssetArtifactSources,createAssetTargetPrisma} from './research-assets-reuse.mjs';
import {createAssetDetailFiles} from './research-assets-detail-files.mjs';
import {createAssetComments} from './research-assets-comments.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';
import {createAssetRegistration} from './local-research-assets-registration.mjs';
import {createAssetGovernance} from './local-research-assets-governance.mjs';
import {createAssetUsage} from './local-research-assets-access.mjs';
import {createAssetUploadStore} from './research-assets-uploads.mjs';
import {createAssetUploadBinding} from './research-assets-upload-binding.mjs';
import {createAssetKnowledgeSources} from './research-assets-knowledge-sources.mjs';
import {createAssetCatalogController} from './local-research-assets-catalog-controller.mjs';
import {createAssetRegistrationController} from './local-research-assets-registration-controller.mjs';
import {createAssetResponseProbe} from './research-assets-response-probe.mjs';
import {createAssetGovernanceProbe} from './research-assets-governance-probe.mjs';
import {createAssetUsageProbe} from './research-assets-usage-probe.mjs';
import {createAssetViewReader,previewAssetView} from './research-assets-catalog-views.mjs';
import {createAssetLifecycle} from './local-research-assets-lifecycle.mjs';
import {createAssetAcceptanceProbes} from './research-assets-acceptance-probe.mjs';
import {createAssetDetailReader} from './research-assets-detail-read.mjs';
import {REPORT_CONTEXT,assertReportContextPrincipal} from './research-assets-report-context.mjs';
import {assertReportContextPolicy,createReportAssetContext,createReportContextPrisma} from './local-research-assets-report-context.mjs';
import {createAssetOverview} from './research-assets-overview-local.mjs';
import {createLocalBusinessAssetCatalog,createBusinessLocalTransaction} from '../server/research-assets/business-local-catalog.mjs';
import {assetHttpScopedUser} from '../server/research-assets/business-http-context.mjs';

export function composeAssetCatalog({ids,withAccess,knowledgeSources,uploads,storage,renderMarkdown,parseRange,withTargetAccess,artifacts}){
 const assertSources=(tx,p,policy)=>{
  if(p.researchProjectId===REPORT_CONTEXT.projectId)return assertReportContextPolicy(tx,p,policy);
  if(policy.sourceKind==='author')return Promise.resolve(Array.isArray(policy.sourceBindings)&&policy.sourceBindings.length===0);
  if(policy.sourceKind==='knowledge')return knowledgeSources.assertSources(tx,p,policy);
  if(policy.sourceKind==='upload')return uploads.assertSources(tx,p,policy);
  if(policy.sourceKind==='artifact')return assertAssetArtifactSources(tx,p,policy,ids);
  return Promise.resolve(false); // Reading an old artifact alone is not a proved reuse licence.
 };
 const reuse=createAssetReuse({ids,withAccess,withTargetAccess,assertSources,artifacts});
 return{assertSources,uploads,reuse,files:createAssetDetailFiles({ids,withAccess,assertSources,storage,renderMarkdown,parseRange}),comments:createAssetComments({ids,withAccess,assertSources}),details:createAssetDetailReader({withAccess,assertSources}),views:createAssetViewReader({withAccess,assertSources}),lifecycle:createAssetLifecycle({withAccess,assertSources}),reader:createAssetCatalogReader({withAccess,assertSources,previewProjection:async args=>{const value=await previewAssetView(args);if(!Object.hasOwn(value,'reuse'))return value;return{...value,reuse:await reuse.relations(args.tx,args.principal,args.id,args.version)};}}),governance:createAssetGovernance({ids,withAccess,assertSources}),usage:createAssetUsage({ids,withAccess,assertSources}),registration:createAssetRegistration({ids,withAccess,assertSources,listSources:(tx,p)=>knowledgeSources.sources(tx,p),uploads})};
}

/** Local synthetic assembly only; never mutates old code/config or prepares fixtures on startup. */
export function createLocalResearchAssetCatalog({root,dir,ids,prisma,knowledge,storage,require,ai}){
 const {withAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 const {withCurrentKnowledgeRead}=require(root+'app/server/src/knowledge/retrieval.service.ts');
 const {assertKnowledgeImportFile}=require(root+'app/server/src/knowledge/knowledge-file-policy.ts');
 const accessFor=(scopedIds,client=prisma)=>createCatalogAccess({ids:scopedIds,transaction:(user,run)=>withAuthorizationMutation(client,user.tenantId,run,{studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,includeOfficial:true})});
 const originalAccess=accessFor(ids),reportAccess=accessFor({...ids,project:REPORT_CONTEXT.projectId},createReportContextPrisma({ids,prisma}));
 const withAccess=(user,permission,run)=>user.researchProjectId===REPORT_CONTEXT.projectId?reportAccess(user,permission,(tx,p)=>{assertReportContextPrincipal(p);return run(tx,p);}):originalAccess(user,permission,run);
 const withTargetAccess=createCatalogAccess({ids:{...ids,project:'rh-asset-detail-20261113-study-b'},transaction:(user,run)=>withAuthorizationMutation(createAssetTargetPrisma({ids,prisma}),user.tenantId,run,{studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,includeOfficial:true})});
 const artifacts=tx=>new(require(root+'app/server/src/research-artifacts/research-artifacts.service.ts').ResearchArtifactsService)({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,run)=>run(tx)},storage,null,null);
 const directory=join(dir,'..','researchhub-assets-local');
 const knowledgeSources=createAssetKnowledgeSources({ids,manifest:()=>JSON.parse(readFileSync(join(directory,'source-manifest.json'),'utf8')),
  withKnowledgeRead:(tx,p,run)=>withCurrentKnowledgeRead({forTenant:()=>tx,withTenantTransaction:(_t,_g,_p,fn)=>fn(tx),elevated:tx},p,run,undefined,'knowledge'),
  readVisibleDoc:(tx,p,id)=>knowledge.requireVisibleDoc(p,id,tx)});
 const store=createAssetUploadStore({directory:join(directory,'uploads'),ids,storage,inspectFile:assertKnowledgeImportFile});
 const uploads=createAssetUploadBinding({ids,store,withAccess});
 const legacy=composeAssetCatalog({ids,withAccess,knowledgeSources,uploads,storage,withTargetAccess,artifacts,renderMarkdown:input=>require(root+'app/server/src/research-artifacts/research-artifact-export.ts').renderResearchArtifact('markdown',input),parseRange:(header,size)=>require(root+'app/server/src/knowledge/knowledge-source-content.ts').parseKnowledgeSourceRange(header,size)});
 const business=createLocalBusinessAssetCatalog({ids,legacy,transaction:createBusinessLocalTransaction({ids,prisma,withAuthorizationMutation})});
 const services={...legacy,reportQa:business.reportQa,assertSources:business.assertSources,reader:business.reader,registration:business.registration,views:business.views,details:business.details,governance:business.governance,lifecycle:business.lifecycle,usage:business.usage};
 const overview=createAssetOverview({ids,assertSources:services.assertSources,businessProjects:business.projects,businessCreationProjects:business.creationProjects,businessActors:business.actors,projectRecords:business.projectRecords,transaction:(_user,run)=>withAuthorizationMutation(prisma,ids.tenant,run,{elevated:true,includeOfficial:true})});
 const reportContext=createReportAssetContext({ids,withAccess,assertSources:services.assertSources});
 const probes=createAssetAcceptanceProbes({ids,directory}),probedReader=Object.fromEntries(Object.entries(services.reader).map(([name,run])=>[name,(user,...args)=>{probes.read(user,name);return run(user,...args);}])) ,probedViews={read:(user,type,query)=>{probes.read(user,type);return services.views.read(user,type,query);}};
 return{...services,overview,AssetCatalogController:createAssetCatalogController({root,require,scopedUser:assetHttpScopedUser,reader:probedReader,views:probedViews,details:services.details,comments:services.comments,files:services.files,reuse:services.reuse,ai,reportQa:services.reportQa,overview}),AssetRegistrationController:createAssetRegistrationController({root,require,scopedUser:assetHttpScopedUser,registration:services.registration,reportContext,reportSource:business.reportSource,governance:services.governance,usage:services.usage,lifecycle:services.lifecycle,uploads,afterLifecycleCommit:probes.afterLifecycle,afterUsageCommit:createAssetUsageProbe({ids,path:join(directory,'a01-usage-probe-20261113.json')}),afterGovernanceCommit:createAssetGovernanceProbe({ids,path:join(directory,'a01-governance-probe-20261113.json')}),afterCommit:createAssetResponseProbe({ids,path:join(directory,'a01-response-probe-20261113.json')})})};
}
