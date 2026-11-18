import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {inspectDirectorySchema,evaluateDirectorySchema,directorySchemaHash} from './directory-schema.mjs';
const sql=readFileSync(new URL('../server/directory/team-draft.sql',import.meta.url),'utf8');
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const teamDraftSchemaHash=hash(sql);
const runId='rh-directory-team-draft-v2',legacyRunId='rh-directory-team-draft-v1';
export const draftSchemaFingerprint=content=>hash(content);
export function evaluateTeamDraftSchema(s,sha){
 if(!s.column&&!s.receipt)return 'new';
 if(s.column?.type!=='jsonb'||s.column.nullable!==true||s.column.default!==null||!s.check||!s.appUpdate||s.tableUpdate||!s.allowedAcl||JSON.stringify(s.otherUpdateColumns)!==JSON.stringify(['archived_at','team_draft','version'])||s.receipt?.version!==2||s.receipt.sha256!==sha||s.receipt.fingerprint!==s.fingerprint)throw Error('DIRECTORY_TEAM_DRAFT_SCHEMA_CONFLICT');
 return 'existing';
}
async function catalog(tx){
 const [column]=await tx.$queryRaw`SELECT data_type AS type,is_nullable='YES' AS nullable,column_default AS default FROM information_schema.columns WHERE table_schema='rh_directory' AND table_name='entity' AND column_name='team_draft'`;
 const [constraint]=await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='rh_directory.entity'::regclass AND conname='directory_team_draft_check'`;
 const [priv]=await tx.$queryRaw`SELECT has_column_privilege('aisci_app','rh_directory.entity','team_draft','UPDATE') AS "appUpdate",has_table_privilege('aisci_app','rh_directory.entity','UPDATE') AS "tableUpdate"`;
 const otherUpdateColumns=(await tx.$queryRaw`SELECT column_name FROM information_schema.column_privileges WHERE table_schema='rh_directory' AND table_name='entity' AND grantee='aisci_app' AND privilege_type='UPDATE' ORDER BY column_name`).map(x=>x.column_name);
 const [receipt]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runId}`;
 const [acl]=await tx.$queryRaw`SELECT c.relacl::text AS "tableAcl",a.attacl::text AS "columnAcl" FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='rh_directory' AND c.relname='entity' AND a.attname='team_draft'`;
 const entries=await tx.$queryRaw`SELECT r.rolname AS grantee,x.privilege_type AS privilege,x.is_grantable AS grantable FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE a.attrelid='rh_directory.entity'::regclass AND a.attname='team_draft' ORDER BY x.grantee,x.privilege_type`;
 const legacyContent={column:column??null,check:constraint?.definition??null,...priv,otherUpdateColumns};
 const content={...legacyContent,...acl},allowedAcl=entries.length===1&&entries[0].grantee==='aisci_app'&&entries[0].privilege==='UPDATE'&&!entries[0].grantable;
 return {...content,allowedAcl,legacyFingerprint:hash(legacyContent),fingerprint:draftSchemaFingerprint(content),receipt:receipt?.manifest??null};
}
export async function inspectTeamDraftSchema(env){
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 return withFixtureTransaction(env,'direct',async tx=>{
  const [present]=await tx.$queryRaw`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='rh_directory' AND table_name='entity' AND column_name='team_draft') AS yes`;
  if(!present.yes){const [r]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runId}`;return {column:null,receipt:r?.manifest??null};}return catalog(tx);
 },{readOnly:true});
}
export async function applyTeamDraftSchema(env){
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 evaluateDirectorySchema(await inspectDirectorySchema(env),directorySchemaHash);
 const initial=await inspectTeamDraftSchema(env);if(initial.receipt&&evaluateTeamDraftSchema(initial,teamDraftSchemaHash)==='existing')return {created:false};
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${runId},0)),set_config('lock_timeout','3s',true),set_config('statement_timeout','15s',true)`;
  // Concurrent starts cannot silently apply a second migration.
  const [present]=await tx.$queryRaw`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='rh_directory' AND table_name='entity' AND column_name='team_draft') AS yes`;
  if(present.yes){const state=await catalog(tx);if(state.receipt){evaluateTeamDraftSchema(state,teamDraftSchemaHash);return {created:false};}
   const [legacy]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${legacyRunId}`;
   if(!state.allowedAcl||legacy?.manifest?.version!==1||legacy.manifest.sha256!==teamDraftSchemaHash||legacy.manifest.fingerprint!==state.legacyFingerprint)throw Error('DIRECTORY_TEAM_DRAFT_SCHEMA_CONFLICT');
  }else for(const statement of sql.split('-- statement').map(x=>x.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  const state=await catalog(tx),manifest={purpose:'ResearchHub-team-private-draft-full-acl',syntheticOnly:true,version:2,sha256:teamDraftSchemaHash,fingerprint:state.fingerprint};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(manifest)}::jsonb)`;
  evaluateTeamDraftSchema(await catalog(tx),teamDraftSchemaHash);return {created:true,sha256:teamDraftSchemaHash};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{
 assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-team-draft']);const root=fileURLToPath(new URL('../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 console.log(JSON.stringify({passed:true,...await applyTeamDraftSchema(env)}));
}catch(e){console.error(JSON.stringify({passed:false,code:e.message.startsWith('DIRECTORY_')?e.message:'DIRECTORY_TEAM_DRAFT_UNAVAILABLE'}));process.exitCode=1;}}
