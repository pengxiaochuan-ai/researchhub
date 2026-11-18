// Existing native services only. Caller owns the guarded transaction strategy;
// this helper starts no worker, listener, provider or fixture.
import assert from 'node:assert/strict';import{createRequire}from'node:module';
import{createResearchStudiesService}from'../server/research-studies/commands.mjs';import{createLocalAnalysisFactory}from'./local-research-analysis.mjs';import{createLocalResearchPrisma}from'./research-creation-local-integration.mjs';
export async function nativeReportServices({root,env,ids,transaction}){
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name],prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction});
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('C2_STUDY_CREATION_FORBIDDEN');}});
 const factory=await createLocalAnalysisFactory({root,env,ids,load,prisma,qualityToken:'0'.repeat(64),storage:{available:false},deploymentScope:{product:'researchhub',allowedTenantIds:[ids.tenant],enabledWorkerKinds:[]}});assert(factory);return{studies,...factory(studies)};
}
