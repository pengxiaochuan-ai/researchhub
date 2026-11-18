import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {REFERENCE_ROWS,DATASET_VERSION,SOURCE_SHA256,SOURCE_URL,referenceHash,readDivisionRows} from '../server/reference/divisions.mjs';
const runId='rh-reference-divisions-2024-v2',legacyRunId='rh-reference-divisions-2024-v1',sql=readFileSync(new URL('../server/reference/schema.sql',import.meta.url),'utf8');
export const referenceSchemaHash=referenceHash(sql),referenceSchemaFingerprint=referenceHash;
export function evaluateReferenceState(s){
 if(!s.present&&!s.receipt&&!s.legacy)return 'new';
 if(s.present&&s.readOnly&&!s.receipt&&s.legacy?.version===1&&s.legacy.schemaHash===referenceSchemaHash&&s.legacy.sourceSha===SOURCE_SHA256&&s.legacy.fingerprint===s.legacyFingerprint)return 'legacy';
 if(!s.present||!s.readOnly||s.receipt?.version!==2||s.receipt.schemaHash!==referenceSchemaHash||s.receipt.sourceSha!==SOURCE_SHA256||s.receipt.fingerprint!==s.fingerprint)throw Error('REFERENCE_SCHEMA_CONFLICT');return 'existing';
}
async function catalog(tx){
 const objects=await tx.$queryRaw`SELECT c.relname,c.relkind,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_reference' ORDER BY c.relname`;
 const columns=await tx.$queryRaw`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='rh_reference' ORDER BY table_name,ordinal_position`;
 const constraints=await tx.$queryRaw`SELECT conname,pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='rh_reference' ORDER BY conname`;
 const [acl]=await tx.$queryRaw`SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname='rh_reference'`;
 const [receipt]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runId}`;
 const [legacy]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${legacyRunId}`;
 const columnAcls=await tx.$queryRaw`SELECT a.attname AS name,a.attacl::text AS acl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_reference' AND c.relname='administrative_division' AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`;
 const columnRights=await tx.$queryRaw`SELECT a.attname AS name,has_column_privilege('aisci_app',c.oid,a.attnum,'SELECT') AS read,has_column_privilege('aisci_app',c.oid,a.attnum,'INSERT') AS insert,has_column_privilege('aisci_app',c.oid,a.attnum,'UPDATE') AS update,has_column_privilege('aisci_app',c.oid,a.attnum,'REFERENCES') AS references FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_reference' AND c.relname='administrative_division' AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`;
 const base={objects,columns,constraints,acl},readOnly=columnAcls.length===8&&columnAcls.every(x=>x.acl===null)&&columnRights.length===8&&columnRights.every(x=>x.read&&!x.insert&&!x.update&&!x.references);
 return {present:Boolean(acl),readOnly,receipt:receipt?.manifest??null,legacy:legacy?.manifest??null,legacyFingerprint:referenceHash(base),fingerprint:referenceSchemaFingerprint({...base,columnAcls,columnRights})};
}
export async function inspectReferenceSchema(env){
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 return withFixtureTransaction(env,'direct',async tx=>{const s=await catalog(tx),state=evaluateReferenceState(s);if(state!=='new')await readDivisionRows(tx);return state;},{readOnly:true});
}
export async function applyReferenceSchema(env){
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 if(await inspectReferenceSchema(env)==='existing')return{created:false};
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${runId},0)),set_config('lock_timeout','3s',true),set_config('statement_timeout','20s',true)`;
  const state=evaluateReferenceState(await catalog(tx));if(state==='existing'){await readDivisionRows(tx);return{created:false};}
  if(state==='new'){
   for(const statement of sql.split('-- statement').map(x=>x.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
   await tx.$executeRaw`INSERT INTO rh_reference.administrative_division(dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256) SELECT ${DATASET_VERSION},x.code,x.name,x."sourceName",x."parentCode",x.level,${SOURCE_URL},${SOURCE_SHA256} FROM jsonb_to_recordset(${JSON.stringify(REFERENCE_ROWS)}::jsonb) AS x(code text,name text,"sourceName" text,"parentCode" text,level smallint)`;
  }
  await readDivisionRows(tx);const after=await catalog(tx);if(!after.readOnly)throw Error('REFERENCE_SCHEMA_CONFLICT');const manifest={purpose:'ResearchHub-shared-readonly-administrative-division-full-column-acl',version:2,schemaHash:referenceSchemaHash,fingerprint:after.fingerprint,sourceSha:SOURCE_SHA256,datasetVersion:DATASET_VERSION,rowCount:REFERENCE_ROWS.length,syntheticOnly:true};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(manifest)}::jsonb)`;
  evaluateReferenceState(await catalog(tx));
  return {created:true,rowCount:REFERENCE_ROWS.length,version:DATASET_VERSION};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-reference-divisions']);const root=fileURLToPath(new URL('../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');console.log(JSON.stringify({passed:true,...await applyReferenceSchema(env)}));}catch(e){console.error(JSON.stringify({passed:false,code:e.message.startsWith('REFERENCE_')?e.message:'REFERENCE_SCHEMA_UNAVAILABLE'}));process.exitCode=1;}}
