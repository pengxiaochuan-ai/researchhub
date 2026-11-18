import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {researchError} from '../server/research-studies/contract.mjs';

export const executionJobMigrationId='20261117154400_research_analysis_execution_job';
export const executionJobMigrationHash='d0f27995c5ad289c0db7757123ad3b21b7e59bb82112cc3a815ee857965c0530';
const migrationFile=new URL('../../app/server/prisma/migrations/'+executionJobMigrationId+'/migration.sql',import.meta.url);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const notReady=()=>{throw researchError(503,'ANALYSIS_JOB_SCHEMA_NOT_PREPARED','后台分析尚未准备完成，原数据记录仍保留。');};

// Deployment preflight only. Provisioning is an explicit, separate root action.
export function createLocalExecutionJobSchemaCheck({env,deploymentScope,tenantId,transaction=withFixtureTransaction,readMigration=()=>readFileSync(migrationFile)}={}){
 if(!env||!identifier(tenantId)||!identifier(deploymentScope?.deploymentId)||!Array.isArray(deploymentScope.allowedTenantIds)||deploymentScope.allowedTenantIds.length!==1||deploymentScope.allowedTenantIds[0]!==tenantId||typeof transaction!=='function'||typeof readMigration!=='function')notReady();
 if(createHash('sha256').update(readMigration()).digest('hex')!==executionJobMigrationHash)notReady();
 return async()=>{
  try{return await transaction(env,'direct',async tx=>{
   const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${executionJobMigrationId}`;
   const m=marker?.manifest;if(m?.syntheticOnly!==true||m.sha256!==executionJobMigrationHash||m.deploymentId!==deploymentScope.deploymentId||m.tenantId!==tenantId)notReady();
   const [table]=await tx.$queryRaw`SELECT c.relrowsecurity AS "rls",c.relforcerowsecurity AS "forceRls",pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_analysis' AND c.relname='execution_job' AND c.relkind='r'`;
   const [candidate]=await tx.$queryRaw`SELECT p.prosecdef AS definer,pg_get_userbyid(p.proowner) AS owner,p.proconfig AS configuration,r.rolcanlogin AS "canLogin",r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",r.rolinherit AS inherit,(SELECT count(*)::integer FROM pg_auth_members m WHERE m.roleid=p.proowner OR m.member=p.proowner) AS memberships,has_function_privilege('aisci_app',p.oid,'EXECUTE') AS executable FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure('rh_analysis.discover_execution_jobs(text,text,integer)')`;
   if(!table||table.rls!==true||table.forceRls!==true||table.owner!=='aisci_owner'||!candidate||candidate.definer!==true||candidate.owner!=='rh_analysis_job_candidate_reader'||candidate.canLogin!==false||candidate.superuser!==false||candidate.bypassRls!==false||candidate.inherit!==false||candidate.memberships!==0||candidate.executable!==true||!Array.isArray(candidate.configuration)||!candidate.configuration.includes('search_path=pg_catalog'))notReady();
   return{ready:true,migrationId:executionJobMigrationId,sha256:executionJobMigrationHash,deploymentId:deploymentScope.deploymentId,tenantId};
  },{readOnly:true});}catch{notReady();}
 };
}
