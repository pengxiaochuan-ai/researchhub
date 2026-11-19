import{createT15AnalysisCore}from'../research-analysis/t15-analysis-core.mjs';
import{createT15AnalysisService}from'../research-analysis/t15-analysis-service.mjs';
import{createT16Runs}from'../research-analysis/t16-runs.mjs';
import{createT17Reports}from'../research-analysis/t17-reports.mjs';
export function runtimeAnalysisFactory({env,load,prisma,storage,scope}){
 const ids=(env.HUB_SYNTHETIC_STUDY_IDS??'').split(',').filter(Boolean);
 if(!ids.length)return null;
 if(ids.some(id=>!/^[A-Za-z0-9_-]{1,160}$/.test(id))||new Set(ids).size!==ids.length)throw Error('RESEARCH_RUNTIME_SYNTHETIC_SCOPE_REQUIRED');
 if(typeof env.RESEARCH_METHODS_WORKER_URL!=='string'||!env.RESEARCH_METHODS_WORKER_URL||typeof env.RESEARCH_METHODS_WORKER_TOKEN!=='string'||env.RESEARCH_METHODS_WORKER_TOKEN.length<32)throw Error('RESEARCH_RUNTIME_METHOD_WORKER_CONFIGURATION_REQUIRED');
 // This adapter deliberately preserves the existing synthetic-only method policy.
 // A real Study is never classified synthetic by a browser request or fallback.
 const features=new(load('tenants/tenant-features.service','TenantFeaturesService'))(prisma);
 const worker=new(load('research-methods/research-method-worker.client','ResearchMethodWorkerClient'))({url:env.RESEARCH_METHODS_WORKER_URL,token:env.RESEARCH_METHODS_WORKER_TOKEN});
 const remediation=new(load('remediation/remediation.service','RemediationCasesService'))(prisma);
 const quality=new(load('research-methods/data-quality-release.service','DataQualityReleaseService'))(prisma,remediation);
 let reports;
 return{
  create(studies){
   const core=createT15AnalysisCore({load,syntheticStudyIds:ids}),analysis=createT15AnalysisService({studies,core});
   const methods=new(load('research-methods/research-methods.service','ResearchMethodsService'))(prisma,features,worker,quality,{assertCurrent:analysis.assertCurrent});
   reports=createT17Reports({studies,analysis,storage,load,deploymentScope:scope});
   return{analysis,runs:createT16Runs({studies,methods}),reports};
  },
  readReport(...args){if(!reports)throw Error('RESEARCH_RUNTIME_REPORTS_NOT_READY');return reports.readForAssetInTransaction(...args);}
 };
}
