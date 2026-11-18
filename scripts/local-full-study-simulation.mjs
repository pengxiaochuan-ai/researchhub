// Trusted local composition for registered synthetic studies. No fixture imports in product modules.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createSimulationAdmission} from '../server/research-simulation/admission.mjs';
import {createSimulationProtocolAdapter} from '../server/research-simulation/protocol-core-adapter.mjs';
import {createSimulationCaptureAdapter} from '../server/research-simulation/capture-core-adapter.mjs';
import {createResearchSimulation} from '../server/research-simulation/execution.mjs';
import {createSimulationStudyMailer} from '../server/research-simulation/delivery.mjs';
import {createSimulationVisitProjection} from '../server/research-simulation/visit-projection.mjs';
import {createFullStudyAnalysis} from '../server/research-analysis/full-study-analysis.mjs';
import {createFullStudyCore} from '../server/research-analysis/full-study-core.mjs';
import {createFullStudySourcePairReader} from '../server/research-analysis/full-study-source-pair.mjs';
import {createFullStudyRuns} from '../server/research-analysis/full-study-runs.mjs';
import {createFullStudyReports} from '../server/research-reports/full-study-adapter.mjs';
import {extendLocalMethodPrisma} from './local-research-analysis.mjs';
import {createLocalMethodFetch} from './local-method-fetch.mjs';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';

export function dispatchStudyService({admission,primary,legacy,ordinaryConfiguration}){
 return new Proxy({}, {get(_target,key){
  if(key==='then')return undefined;
  return (...args)=>{
   const service=admission.isTarget(args[1])?primary:legacy;
   if(key==='configuration'&&typeof service?.[key]!=='function'&&typeof ordinaryConfiguration==='function')return ordinaryConfiguration(...args);
   if(typeof service?.[key]!=='function')throw Object.assign(Error('当前课题的该项服务尚不可用。'),{status:503,code:'RESEARCH_SERVICE_UNAVAILABLE'});
   return service[key](...args);
  };
 }});
}

export async function createLocalFullStudySimulation({root,env,ids,load,require,studyMailer,captureReceipt}){
 const dir=root+'.tmp/real-study-full-simulation-2026-11-13/',file=dir+'targets.json';
 if(!existsSync(file))return null;
 await assertFixtureTarget(env);
 const targets=JSON.parse(readFileSync(file,'utf8')),admission=createSimulationAdmission({targets});
 for(const target of targets){
  assert.equal(target.scope.tenantId,ids.tenant,'LOCAL_SIMULATION_TENANT_REJECTED');
  await withFixtureTransaction(env,'direct',async tx=>{
   const rows=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'studyId'=${target.studyId} AND manifest->>'tenantId'=${ids.tenant}`;
   assert.equal(rows.length,1,'LOCAL_SIMULATION_FIXTURE_NOT_UNIQUE');
   const m=rows[0].manifest;
   assert(m.syntheticOnly===true&&m.caseId===target.caseId&&m.studyGroupId===target.scope.studyGroupId&&m.scope.researchProjectId===target.scope.researchProjectId&&m.registrationAuditId===target.registrationAuditId&&m.registrationActorId===target.registrationActorId,'LOCAL_SIMULATION_FIXTURE_REJECTED');
  },{readOnly:true});
 }
 let fullAnalysis;
 const simulation=createResearchSimulation({resolveCase:admission.resolveCase,resolveApprovedPlan:(...args)=>fullAnalysis.approvedPlan(...args),
  lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),
  completionIntegrity:load('study-operations/formal-visit-evidence','visitCompletionIntegrity'),
  authorizeAdvance:async(tx,user,s)=>{
   const current=await load('study-operations/formal-response-authority','authorizeFormalResponse')(tx,user,s.studyGroupId,s.researchProjectId,'read');
   if(current.role!=='tenant_admin'||current.isTenantAdmin!==true)throw Object.assign(Error('模拟访视推进由当前租户管理员执行。'),{status:403,code:'SIMULATION_ADMIN_REQUIRED'});
  }});
 const forms=createSimulationCaptureAdapter({require,load,simulation});
 const protocol=createSimulationProtocolAdapter({require,load:forms.load,resolveCase:admission.resolveCase});
 const mailer=createSimulationStudyMailer({targets,original:studyMailer,receipt:captureReceipt});
 return{load:protocol.load,formAdapter:forms,simulation,createSimulation:()=>simulation,studyMailer:mailer,
  createVisitProjection:operations=>{
   const read=createSimulationVisitProjection({operations,readVisit:load('study-operations/formal-response-visits','readFormalVisitInTransaction'),resolveCase:admission.resolveCase});
   return(tx,user,s,visit)=>targets.some(t=>['tenantId','studyGroupId','researchProjectId'].every(k=>t.scope[k]===s[k]))?read(tx,user,s,visit.id):visit;
  },
  createAnalysisFactory({prisma,legacyFactory,qualityToken,storage,deploymentScope}){
   assert(typeof qualityToken==='string'&&qualityToken.length>=32,'LOCAL_SIMULATION_WORKER_REQUIRED');
   const methodPrisma=extendLocalMethodPrisma(prisma,ids.tenant),features=new(load('tenants/tenant-features.service','TenantFeaturesService'))(methodPrisma);
   const worker=new(load('research-methods/research-method-worker.client','ResearchMethodWorkerClient'))({url:'http://127.0.0.1:19505',token:qualityToken,fetchImpl:createLocalMethodFetch({file:dir+'method-worker-http.jsonl'})});
   const remediation=new(load('remediation/remediation.service','RemediationCasesService'))(methodPrisma);
   const quality=new(load('research-methods/data-quality-release.service','DataQualityReleaseService'))(methodPrisma,remediation);
   return (studies,{jobAdapter}={})=>{
    const previous=legacyFactory?.(studies,{jobAdapter});
    const responsePairs=createFullStudySourcePairReader({require,load:protocol.load});
    const fullCore=createFullStudyCore({load:protocol.load,resolveCase:admission.resolveCase,readResponsePair:responsePairs.readPair});
    const analysis=fullAnalysis=createFullStudyAnalysis({studies,load:protocol.load,resolveCase:admission.resolveCase,responsePairs,core:fullCore});
    const methods=new(load('research-methods/research-methods.service','ResearchMethodsService'))(methodPrisma,features,worker,quality,{assertCurrent:analysis.assertCurrent},jobAdapter);
    const runs=createFullStudyRuns({studies,analysis,jobAdapter,methods:createFullStudyMethodsFacade(methods,{withBatchResolver:analysis.withBatchResolver,buildDescriptiveInput:load('research-methods/descriptive-analysis-policy','buildDescriptiveInput'),descriptiveReference:load('research-methods/descriptive-analysis-policy','descriptiveReference'),canonicalManifestHash:load('research-methods/data-quality-release-policy','canonicalManifestHash'),exceptions:require('@nestjs/common')}),authorizeCancelInTransaction:(tx,actor,run)=>methods.descriptiveRuns().live(tx,actor,run,'snapshot',false)});
    const reports=createFullStudyReports({studies,analysis,runs,storage,load:protocol.load,require,deploymentScope:{...deploymentScope,allowedTenantIds:[ids.tenant],enabledWorkerKinds:[...(deploymentScope?.enabledWorkerKinds??[]),'research-artifact-export']}});
    const ordinaryConfiguration=(user,studyId)=>studies.withResearchStudyTransaction(user,studyId,'read',async()=>({studyId,schemaVersion:'t15-synthetic-plan-v1'}));
    const services=Object.fromEntries(Object.entries({analysis,runs,reports}).map(([key,primary])=>[key,dispatchStudyService({admission,primary,legacy:previous?.[key],...(key==='analysis'?{ordinaryConfiguration}:{})})]));
    Object.defineProperty(services,'jobSupport',{value:{ordinary:previous?.jobSupport?.ordinary,full:{analysis,core:fullCore,methods,jobBranch:runs.jobBranch,isTarget:studyId=>admission.isTarget(studyId)}},enumerable:false});
    return services;
   };
  }};
}
