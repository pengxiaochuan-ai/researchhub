import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadMigrationBundle,makeMigrationPlan,assertMigrationApproval,migrationTransaction,catalogFingerprintSql} from './migration-plan.mjs';
import {rehearsalSql,validateRehearsalState} from './rehearsal.mjs';

export function rehearsalDriver(state){
 validateRehearsalState(state);
 const run=sql=>rehearsalSql(state,sql);
 run.endpointFingerprint=createHash('sha256').update(state.runId+':'+state.container+':'+state.database).digest('hex');return run;
}
function configuredDriver(configFile,command,approved){
 if((statSync(configFile).mode&0o077)!==0)throw new Error('MIGRATION_CONFIG_PERMISSIONS_REJECTED');
 const config=JSON.parse(readFileSync(configFile));
 if(config.tier==='rehearsal')return{run:rehearsalDriver(config.state)};
 if(config.tier!=='production'||config.executeProduction!==true||!/^[a-z][a-z0-9-]{2,100}$/.test(config.deploymentId??'')||!/^[a-f0-9]{64}$/.test(config.expectedMarkerDigest??'')||config.expectedMarkerDigest===createHash('sha256').update('').digest('hex')||command==='apply'&&!/^[a-f0-9]{64}$/.test(approved??''))throw new Error('MIGRATION_PRODUCTION_NOT_APPROVED');
 if(typeof config.connectionFile!=='string'||(statSync(config.connectionFile).mode&0o077)!==0)throw new Error('MIGRATION_CONFIG_PERMISSIONS_REJECTED');
 const values=JSON.parse(readFileSync(config.connectionFile));
 const allowed=['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT'];
 if(Object.keys(values).some(k=>!allowed.includes(k)))throw new Error('MIGRATION_CONNECTION_REJECTED');
 for(const key of ['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE'])if(typeof values[key]!=='string'||!values[key]||/[\r\n\0]/.test(values[key]))throw new Error('MIGRATION_CONNECTION_REJECTED');
 if(!['verify-full','verify-ca'].includes(values.PGSSLMODE))throw new Error('MIGRATION_TLS_REQUIRED');
 if(values.PGDATABASE!==config.expectedDatabase||values.PGUSER!==config.expectedRole)throw new Error('MIGRATION_TARGET_MISMATCH');
 const run=sql=>execFileSync(config.psql??'psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',env:{PATH:process.env.PATH,PGCONNECT_TIMEOUT:'5',...values},stdio:['pipe','pipe','pipe'],timeout:65000,maxBuffer:20*1024*1024});
 run.expectedIdentity={database:config.expectedDatabase,role:config.expectedRole,markerDigest:config.expectedMarkerDigest};
 run.endpointFingerprint=createHash('sha256').update(JSON.stringify({deployment:config.deploymentId,host:values.PGHOST,port:values.PGPORT,database:values.PGDATABASE,role:values.PGUSER,tls:values.PGSSLMODE,rootCert:values.PGSSLROOTCERT??null})).digest('hex');return{run};
}
export function readMigrationState(bundle,run){
 const fingerprint=catalogFingerprintSql(bundle.manifest.managedSchemas);
 const raw=run(`BEGIN READ ONLY; SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='10s'; SELECT json_build_object('database',current_database(),'role',session_user,'markerDigest',encode(sha256(convert_to(coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database'),''),'UTF8')),'hex'),'fingerprint',(${fingerprint}),'ledger',to_regclass('rh_deploy.migration') IS NOT NULL); ROLLBACK;`);
 const state=JSON.parse(raw.trim());
 if(run.expectedIdentity&&Object.entries(run.expectedIdentity).some(([k,v])=>state[k]!==v))throw new Error('MIGRATION_TARGET_MISMATCH');
 state.endpointFingerprint=run.endpointFingerprint;
 state.applied=state.ledger?JSON.parse(run(`BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; SELECT coalesce(json_agg(row_to_json(x)),'[]'::json) FROM (SELECT id,sha256 FROM rh_deploy.migration WHERE bundle='${bundle.manifest.id}' ORDER BY applied_at,id) x; ROLLBACK;`).trim()):[];
 return state;
}
export function migrationPlan(bundle,run){return makeMigrationPlan(bundle,readMigrationState(bundle,run));}
export function applyMigrations(bundle,run,approved){
 const plan=migrationPlan(bundle,run);assertMigrationApproval(plan,approved);
 for(const step of bundle.manifest.steps.slice(plan.applied.length))run(migrationTransaction(bundle,step,plan.target));
 const verified=migrationPlan(bundle,run);if(verified.pending.length)throw new Error('MIGRATION_VERIFY_FAILED');
 return{...verified,appliedNow:plan.pending.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command,directory,configFile,approved]=process.argv.slice(2);if(!['plan','check','apply','verify'].includes(command)||!directory||!configFile)throw new Error('MIGRATION_ARGUMENTS_REJECTED');
  const bundle=loadMigrationBundle(directory),{run}=configuredDriver(configFile,command,approved);
  const result=command==='apply'?applyMigrations(bundle,run,approved):migrationPlan(bundle,run);
  if(command==='verify'&&result.pending.length)throw new Error('MIGRATION_NOT_APPLIED');
  console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(error.message?.startsWith('MIGRATION_')?error.message:'MIGRATION_OPERATION_FAILED');process.exitCode=1;}
}
