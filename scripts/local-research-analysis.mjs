// Local synthetic assembly. Every method query still uses actual aisci_app/RLS.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createT15AnalysisCore} from '../server/research-analysis/t15-analysis-core.mjs';
import {createT15AnalysisService} from '../server/research-analysis/t15-analysis-service.mjs';
import {createT16Runs} from '../server/research-analysis/t16-runs.mjs';
import {createT17Reports} from '../server/research-analysis/t17-reports.mjs';
import {createLocalMethodFetch} from './local-method-fetch.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const methodModels=new Set(['agent','agentAccess','auditLog','researchMethodReview','researchMethodRun','session','skillAssignment','tenantFeatureEntitlement']);
export function extendLocalMethodPrisma(prisma,tenantId){
 return {...prisma,forTenant(tenant,group,project){
  assert(tenant===tenantId&&(group===undefined||identifier(group))&&(project===undefined||identifier(project)),'LOCAL_METHOD_SCOPE_REJECTED');
  const run=fn=>prisma.withTenantTransaction(tenant,group,project,fn);
  return new Proxy({}, {get(_target,model){
   if(model==='then')return undefined;
   assert(methodModels.has(model)&&((group&&project)||model==='tenantFeatureEntitlement'),'LOCAL_METHOD_MODEL_REJECTED');
   return new Proxy({}, {get(_m,method){assert(['findFirst','findUnique','findMany','create','count','update','updateMany'].includes(method),'LOCAL_METHOD_OPERATION_REJECTED');return (...args)=>run(tx=>tx[model][method](...args));}});
  }});
 }};
}
let reportAssetReader;
export function readLocalReportAssetSourceInTransaction(...args){
 if(!reportAssetReader)throw Object.assign(Error('报告来源服务尚未就绪，请稍后重新核对。'),{status:503,code:'ASSET_CATALOG_REPORT_SOURCE_UNAVAILABLE'});
 return reportAssetReader(...args);
}
export async function createLocalAnalysisFactory({root,env,ids,load,prisma,qualityToken,storage,deploymentScope}){
 const pointer=root+'.tmp/researchhub-workflow/benchmark-current.json';if(!existsSync(pointer))return undefined;
 const acceptedFile=JSON.parse(readFileSync(pointer)).acceptedFile;assert(typeof acceptedFile==='string'&&acceptedFile.startsWith(root+'researchhub/docs/testing/evidence/research-t12-2026-11-12/'),'LOCAL_ANALYSIS_BENCHMARK_REJECTED');
 const benchmark=JSON.parse(readFileSync(acceptedFile));assert(benchmark.syntheticOnly&&benchmark.scope.tenantId===ids.tenant);
 await withFixtureTransaction(env,'direct',async tx=>{const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${benchmark.runId}`;assert(marker?.manifest?.syntheticOnly&&marker.manifest.studyId===benchmark.study.id);for(const migration of ['20261112040000_analysis_basis','20261112050000_descriptive_method']){const [record]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;assert(record?.manifest?.syntheticOnly,'LOCAL_ANALYSIS_SCHEMA_NOT_PREPARED');}},{readOnly:true});
 assert(typeof qualityToken==='string'&&qualityToken.length>=32,'LOCAL_METHOD_WORKER_CONFIG_REQUIRED');
 const methodPrisma=extendLocalMethodPrisma(prisma,ids.tenant),features=new(load('tenants/tenant-features.service','TenantFeaturesService'))(methodPrisma);
 const worker=new(load('research-methods/research-method-worker.client','ResearchMethodWorkerClient'))({url:'http://127.0.0.1:19505',token:qualityToken,fetchImpl:createLocalMethodFetch({file:root+'.tmp/researchhub-workflow/method-worker-http.jsonl'})});
 const remediation=new(load('remediation/remediation.service','RemediationCasesService'))(methodPrisma);
 const quality=new(load('research-methods/data-quality-release.service','DataQualityReleaseService'))(methodPrisma,remediation);
 return (studies,{jobAdapter}={})=>{
  const core=createT15AnalysisCore({load,syntheticStudyIds:[benchmark.study.id]});
  const analysis=createT15AnalysisService({studies,core});
  const methods=new(load('research-methods/research-methods.service','ResearchMethodsService'))(methodPrisma,features,worker,quality,{assertCurrent:analysis.assertCurrent},jobAdapter);
  const reportScope={...deploymentScope,allowedTenantIds:[ids.tenant],enabledWorkerKinds:[...(deploymentScope?.enabledWorkerKinds??[]),'research-artifact-export']};
  const reports=createT17Reports({studies,analysis,storage,load,deploymentScope:reportScope});
  reportAssetReader=(...args)=>reports.readForAssetInTransaction(...args);
  const actualExport=reports.export;
  reports.export=(user,studyId,artifactId,body)=>{if(body?.format==='pdf')throw Object.assign(Error('当前报告请下载Word文件，PDF生成服务尚未启用。'),{status:503,code:'REPORT_PDF_UNAVAILABLE'});return actualExport(user,studyId,artifactId,body);};
  const services={analysis,runs:createT16Runs({studies,methods}),reports};
  Object.defineProperty(services,'jobSupport',{value:{ordinary:{analysis,core,methods}},enumerable:false});
  return services;
 };
}
