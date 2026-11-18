// Local assembly only. The research module itself has no fixture dependency.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createResearchStudiesController} from '../server/research-studies/controller.mjs';
import {createLocalAnalysisFactory} from './local-research-analysis.mjs';
import {composeLocalAnalysisJobs} from './local-analysis-jobs.mjs';
import {createLocalExecutionJobSchemaCheck} from './local-analysis-job-schema.mjs';
import {canOpenDesignWorkspace} from './my-research-overview.mjs';
import {simulationIngestServiceClass} from '../server/research-simulation/ingest-core-adapter.mjs';

export const researchCreationBodyRoute=path=>/^\/api\/(?:research-projects|research-studies|research-hub-roles)(?:\/|$)/.test(path);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);

export function createLocalResearchPrisma({tenantId,transaction}){
 assert(identifier(tenantId)&&typeof transaction==='function');
 return{async withTenantTransaction(tenant,group,project,callback){
  assert(tenant===tenantId&&(group===undefined||identifier(group))&&(project===undefined||identifier(project))&&typeof callback==='function','LOCAL_RESEARCH_SCOPE_REJECTED');
  return transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.tenant_id',${tenant},true),set_config('app.study_group_id',${group??''},true),set_config('app.research_project_id',${project??''},true)`;
   return callback(tx);
  });
 }};
}

export async function createLocalResearchStudiesController({env,ids,load,require,scope,studyMailer,storage,qualityToken,limitedImportRead,limitedMediaRead,fullStudy}){
 await assertFixtureTarget(env);
 const hash=createHash('sha256').update(readFileSync(new URL('../server/research-studies/schema.sql',import.meta.url))).digest('hex');
 const prepared=await withFixtureTransaction(env,'direct',async tx=>{
  const [receipt]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id='rh-research-creation-schema-v1'`;
  const tables=await tx.$queryRaw`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_research' AND c.relkind='r' ORDER BY c.relname`;
  return receipt?.manifest?.sha256===hash&&tables.map(t=>t.relname).join(',')==='hub_role,operation,project_intent,study_binding'&&tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity);
 },{readOnly:true});
 assert(prepared,'LOCAL_RESEARCH_SCHEMA_NOT_PREPARED');
 const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:callback=>withFixtureTransaction(env,'app',callback)});
 const root=new URL('../../',import.meta.url).pathname;
 const legacyFactory=await createLocalAnalysisFactory({root,env,ids,load,prisma,qualityToken,storage,deploymentScope:scope});
 const createServices=fullStudy?fullStudy.createAnalysisFactory({prisma,legacyFactory,qualityToken,storage,deploymentScope:scope}):legacyFactory;
 const assertSchemaReady=createLocalExecutionJobSchemaCheck({env,deploymentScope:scope,tenantId:ids.tenant});
 const createAnalysisServices=createServices?studies=>composeLocalAnalysisJobs({studies,prisma,deploymentScope:scope,createServices,load:fullStudy?.load??load,assertSchemaReady}):undefined;
 const forbidden=()=>{throw Error('LOCAL_FORMAL_INGEST_DEPENDENCY_FORBIDDEN');};
 const LegacyIngest=load('ingest/ingest.service','IngestService'),Ingest=fullStudy?simulationIngestServiceClass({Service:LegacyIngest,simulation:fullStudy.simulation,HttpException:require('@nestjs/common').HttpException}):LegacyIngest;
 const ingestService=storage?new Ingest(prisma,storage,{kick:forbidden},{ensureUngrouped:forbidden}):undefined;
 return createResearchStudiesController({require,load:fullStudy?.load??load,prisma,scope,studyMailer:fullStudy?.studyMailer??studyMailer,storage,ingestService,createAnalysisServices,createSimulation:fullStudy?.createSimulation,createVisitProjection:fullStudy?.createVisitProjection,formAdapter:fullStudy?.formAdapter,limitedImportRead,limitedMediaRead,origin:'http://127.0.0.1:19501',legacyHints:({user,group,project,membership})=>({canOpenDesignWorkspace:canOpenDesignWorkspace({...project,studyGroupId:group.id,permissions:{menus:membership?.role?.menuPermissions??[],buttons:membership?.role?.buttonPermissions??[]}},user.accountId,ids)})});
}
