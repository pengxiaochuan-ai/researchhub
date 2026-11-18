import {createExecutionJobConsumer} from '../server/research-analysis/execution-job-consumer.mjs';
import {createOrdinaryJobBridge} from '../server/research-analysis/ordinary-job-bridge.mjs';
import {createExecutionJobAuthority,guardJobAdmission} from '../server/research-analysis/job-authority.mjs';
import {createExecutionJobPresenter} from '../server/research-analysis/execution-job-view.mjs';
import {createExecutionJobs} from '../server/research-analysis/execution-jobs.mjs';
import {setContext} from '../server/research-studies/repository.mjs';
import {researchError} from '../server/research-studies/contract.mjs';

const unavailable=()=>researchError(503,'ANALYSIS_JOB_CONSUMER_UNAVAILABLE','后台分析暂不可用，原任务记录仍保留。');
const changed=()=>researchError(409,'ANALYSIS_JOB_BINDING_CHANGED','当前研究与原分析范围不一致，请保留任务记录。');

// Trusted local assembly only. Import and construction never query or start work.
export function composeLocalAnalysisJobs({studies,prisma,deploymentScope,createServices,load,assertSchemaReady,timers}={}){
 if(typeof studies?.resolveResearchStudyInTransaction!=='function'||typeof createServices!=='function'||typeof load!=='function'||typeof assertSchemaReady!=='function')throw unavailable();
 const hash=load('research-methods/data-quality-release-policy','canonicalManifestHash');
 const issue=load('research-methods/descriptive-job-contract','createDescriptiveJobCapabilityIssuer');
 const withAuthorizationMutation=load('common/worker-publication','withAuthorizationMutation');
 if(![hash,issue,withAuthorizationMutation].every(v=>typeof v==='function'))throw unavailable();
 const issuer=issue();let services,support;
 const consumer=createExecutionJobConsumer({prisma,withAuthorizationMutation,issuer,canonicalHash:hash,deployment:deploymentScope,...(timers?{timers}:{}),
  createBranches({adapter}){
   if(services)throw unavailable();
   const guarded=guardJobAdmission(adapter);
   services=createServices(studies,{jobAdapter:guarded});
   const descriptor=Object.getOwnPropertyDescriptor(services??{},'jobSupport');
   if(!descriptor||descriptor.enumerable||!descriptor.value?.ordinary||!descriptor.value?.full)throw unavailable();
   support=descriptor.value;
   const ordinary=createOrdinaryJobBridge({methods:support.ordinary.methods,hash,
    transaction:(ctx,fn)=>withAuthorizationMutation(prisma,ctx.scope.tenantId,fn,{studyGroupId:ctx.scope.studyGroupId,researchProjectId:ctx.scope.researchProjectId,includeOfficial:true}),
    async assertCurrent(tx,ctx){
     const current=await studies.resolveResearchStudyInTransaction(tx,ctx.actor,ctx.job.studyId,'read');
     if(current?.studyId!==ctx.job.studyId||current.tenantId!==ctx.scope.tenantId||current.studyGroupId!==ctx.scope.studyGroupId||current.executionProjectId!==ctx.scope.researchProjectId)throw changed();
     await setContext(tx,ctx.actor,ctx.scope.studyGroupId,ctx.scope.researchProjectId);
     return support.ordinary.analysis.assertCurrent(tx,ctx.actor,ctx.scope,ctx.job.studyId,ctx.job.snapshotId,'snapshot');
    },
   });
   return{ordinary,full:support.full.jobBranch};
  },
 });
 const authority=createExecutionJobAuthority({ordinary:support.ordinary,full:support.full,hash});
 const presentInTransaction=createExecutionJobPresenter({hash,availability:()=>consumer.availability().available,authorizeCancellationInTransaction:authority.authorizeCancellationInTransaction});
 const jobs=createExecutionJobs({studies,authority,deployment:deploymentScope,presentInTransaction,assertAdmissionReady(){if(!consumer.availability().available)throw unavailable();}});
 let starting=null,stopping=null;
 const jobLifecycle=Object.freeze({
  start(){
   if(stopping)return Promise.reject(researchError(503,'ANALYSIS_JOB_CONSUMER_STOPPING','后台分析正在停止，请稍后重新核对。'));
   if(starting)return starting;
   starting=(async()=>{await assertSchemaReady();if(stopping)return{status:'stopped'};return consumer.start();})().finally(()=>{starting=null;});
   return starting;
  },
  stop(){
   if(stopping)return stopping;
   // Attach both awaits before yielding, including a schema check still in flight.
   stopping=(async()=>{const results=await Promise.allSettled([consumer.stop(),starting]);const failed=results.find(v=>v.status==='rejected');if(failed)throw failed.reason;return results[0].value;})().finally(()=>{stopping=null;});
   return stopping;
  },
 });
 return{analysis:services.analysis,runs:services.runs,reports:services.reports,jobs,jobLifecycle};
}
