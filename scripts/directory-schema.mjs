import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const sql=readFileSync(new URL('../server/directory/schema.sql',import.meta.url),'utf8'),hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const directorySchemaHash=hash(sql);const runId='rh-directory-schema-v1',expected=['assertion','decision','entity'];
export function evaluateDirectorySchema(state,sha){
 if(state.objects.length===0&&!state.receipt)return'new';
 if(JSON.stringify(state.objects)!==JSON.stringify(expected)||state.receipt?.version!==1||state.receipt.sha256!==sha||state.receipt.fingerprint!==state.fingerprint)throw Error('DIRECTORY_SCHEMA_CONFLICT');
 return'existing';
}
async function target(env){assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline','DIRECTORY_TARGET_REJECTED');}
async function catalog(tx){
 const objects=(await tx.$queryRaw`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_directory' AND c.relkind IN ('r','v','m','p') ORDER BY c.relname`).map(r=>r.relname);
 // The one approved additive extension has its own strict inspector and immutable receipt.
 const columns=await tx.$queryRaw`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='rh_directory' AND NOT(table_name='entity' AND column_name='team_draft') ORDER BY table_name,ordinal_position`;
 const constraints=await tx.$queryRaw`SELECT c.relname,x.conname,pg_get_constraintdef(x.oid) definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_directory' AND NOT(c.relname='entity' AND x.conname='directory_team_draft_check') ORDER BY c.relname,x.conname`;
 const policies=await tx.$queryRaw`SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='rh_directory' ORDER BY tablename,policyname`;
 const rls=await tx.$queryRaw`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_directory' AND relkind='r' ORDER BY relname`;
 const grants=await tx.$queryRaw`SELECT table_name,grantee,privilege_type,column_name FROM information_schema.column_privileges WHERE table_schema='rh_directory' AND NOT(table_name='entity' AND column_name='team_draft') ORDER BY table_name,grantee,privilege_type,column_name`;
 const triggers=await tx.$queryRaw`SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_directory' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
 const functions=await tx.$queryRaw`SELECT p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_directory' AND p.proname<>'hold_source_for_commit' ORDER BY p.proname`;
 const receipts=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runId}`;
 const schema=(await tx.$queryRaw`SELECT count(*)::int count FROM pg_namespace WHERE nspname='rh_directory'`)[0].count;
 if(schema&&objects.length===0&&!receipts.length)throw Error('DIRECTORY_SCHEMA_NAMESPACE_CONFLICT');
 return{objects,fingerprint:hash({columns,constraints,policies,rls,grants,triggers,functions}),receipt:receipts[0]?.manifest??null};
}
export async function inspectDirectorySchema(env){await target(env);return withFixtureTransaction(env,'direct',catalog,{readOnly:true});}
export async function applyDirectorySchema(env){
 await target(env);return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRaw`SELECT set_config('lock_timeout','3s',true),set_config('statement_timeout','15s',true)`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${runId},0))`;
  const state=await catalog(tx);if(evaluateDirectorySchema(state,directorySchemaHash)==='existing')return{created:false,sha256:directorySchemaHash};
  assert(!/\b(?:DROP|TRUNCATE|DELETE|REPLACE)\b/i.test(sql),'DIRECTORY_SCHEMA_SQL_REJECTED');
  for(const statement of sql.split('-- statement').map(x=>x.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  const after=await catalog(tx).catch(e=>{if(e.message==='DIRECTORY_SCHEMA_NAMESPACE_CONFLICT')throw Error('DIRECTORY_SCHEMA_INCOMPLETE');throw e;});
  assert.deepEqual(after.objects,expected);const manifest={purpose:'ResearchHub-directory-schema',syntheticOnly:true,version:1,sha256:directorySchemaHash,fingerprint:after.fingerprint};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(manifest)}::jsonb)`;
  evaluateDirectorySchema(await catalog(tx),directorySchemaHash);return{created:true,sha256:directorySchemaHash};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-identity-directory']);const root=fileURLToPath(new URL('../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');console.log(JSON.stringify({passed:true,...await applyDirectorySchema(env)}));}catch(e){console.error(JSON.stringify({passed:false,code:/^(?:DIRECTORY_|WP01_)/.test(e.message)?e.message:'DIRECTORY_SCHEMA_UNAVAILABLE'}));process.exitCode=1;}}
