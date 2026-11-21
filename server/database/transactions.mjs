import {createHash} from 'node:crypto';
import {catalogFingerprintSql} from '../../deploy/migration-plan.mjs';

const contexts=new WeakMap();
const verifiedSchemas=new WeakSet();
const fail=code=>{throw new Error(code);};
const identitySql=`SELECT current_database() AS database,current_user AS role,r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",encode(sha256(convert_to(coalesce(shobj_description(d.oid,'pg_database'),''),'UTF8')),'hex') AS "markerDigest" FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`;
const emptyMarker=createHash('sha256').update('').digest('hex');
export function validateRuntimeIdentity(expected,kind,observed){
 if(!['app','direct'].includes(kind))fail('RUNTIME_TRANSACTION_ROLE_REJECTED');
 if(!observed||observed.database!==expected.database||observed.role!==(kind==='app'?expected.appRole:expected.directRole)||observed.markerDigest!==expected.markerDigest||kind==='app'&&(observed.superuser!==false||observed.bypassRls!==false))fail('RUNTIME_DATABASE_IDENTITY_REJECTED');
}
const configurable=(prisma,expected)=>Boolean(prisma?.app&&prisma?.elevated&&expected&&['database','appRole','directRole','deploymentId','tenantId'].every(k=>typeof expected[k]==='string'&&expected[k].length>0&&expected[k].length<=160&&!/[\r\n\0]/.test(expected[k]))&&/^[a-f0-9]{64}$/.test(expected.markerDigest??'')&&expected.markerDigest!==emptyMarker);
export function bindRuntimeTransactions({prisma,expected}){
 if(!configurable(prisma,expected))fail('RUNTIME_DATABASE_CONFIG_REJECTED');
 const env=Object.freeze({runtimeDatabase:true});contexts.set(env,{prisma,expected:Object.freeze({...expected})});return env;
}
// Local development keeps the legacy fixture env (validated by the WP01 guard)
// while routing Hub transactions through the same bundled Prisma copy the Hub
// code builds Prisma.Sql fragments with. Two copies treat each other's Sql
// objects as jsonb parameters, which breaks parameterized raw queries.
export function bindRuntimeTransactionsInto(env,{prisma,expected}){
 if(!env||typeof env!=='object'||contexts.has(env)||!configurable(prisma,expected))fail('RUNTIME_DATABASE_CONFIG_REJECTED');
 contexts.set(env,{prisma,expected:Object.freeze({...expected})});return env;
}
export async function withFixtureTransaction(env,kind,operation,{readOnly=false,requireRuntime=false}={}){
 const bound=contexts.get(env);
 if(!bound){
  if(requireRuntime||process.env.NODE_ENV==='production')fail('RUNTIME_TRANSACTIONS_NOT_BOUND');
  // Existing local fixtures retain the original guard; no production environment
  // is ever passed to it and the old module is not a runtime dependency.
  const legacy=await import('../../../app/server/scripts/wp01/fixture-guard.mjs');
  return legacy.withFixtureTransaction(env,kind,operation,{readOnly});
 }
 if(!['app','direct'].includes(kind))fail('RUNTIME_TRANSACTION_ROLE_REJECTED');
 const {prisma,expected}=bound,client=kind==='app'?prisma.app:prisma.elevated;
 return client.$transaction(async tx=>{
  if(readOnly)await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s';");
  const [observed]=await tx.$queryRawUnsafe(identitySql);validateRuntimeIdentity(expected,kind,observed);
  await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id','',true),set_config('app.research_project_id','',true),set_config('app.account_id','',true),set_config('app.auth_version','',true),set_config('app.deployment_id',$2,true),set_config('app.deployment_product','researchhub',true)",expected.tenantId,expected.deploymentId);
  return operation(tx);
 },{maxWait:8000,timeout:20000});
}
export const withDeploymentTransaction=(env,kind,operation,options={})=>withFixtureTransaction(env,kind,operation,{...options,requireRuntime:true});
export async function verifyRuntimeSchema(env,{fingerprint,schemas}){
 if(!/^[a-f0-9]{32}$/.test(fingerprint??''))fail('RUNTIME_SCHEMA_CONFIG_REJECTED');
 const sql=catalogFingerprintSql(schemas);
 await withDeploymentTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe('SET LOCAL search_path=pg_catalog');
  const [row]=await tx.$queryRawUnsafe('SELECT ('+sql+') AS fingerprint');
  if(row?.fingerprint!==fingerprint)fail('RUNTIME_SCHEMA_MISMATCH');
 },{readOnly:true});
 verifiedSchemas.add(env);
}
export function assertVerifiedRuntimeSchema(env){if(!verifiedSchemas.has(env))fail('RUNTIME_SCHEMA_NOT_VERIFIED');}
export async function assertFixtureTarget(env){
 const bound=contexts.get(env);
 if(!bound){
  if(process.env.NODE_ENV==='production')fail('RUNTIME_TRANSACTIONS_NOT_BOUND');
  return(await import('../../../app/server/scripts/wp01/fixture-guard.mjs')).assertFixtureTarget(env);
 }
 for(const kind of ['app','direct'])await withDeploymentTransaction(env,kind,async()=>{}, {readOnly:true});
 return Object.freeze({databaseName:bound.expected.database,deploymentId:bound.expected.deploymentId});
}
