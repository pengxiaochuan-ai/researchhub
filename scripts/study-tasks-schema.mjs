import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig} from '../../app/server/scripts/wp01/fixture-guard.mjs';

export function evaluateStudyTaskSchema(state,sha256){
  const tables=[...state.tables].sort();
  if(tables.length===0&&!state.receipt)return 'new';
  if(tables.join(',')!=='context,operation')throw new Error('S08_SCHEMA_PARTIAL');
  if(state.receipt?.version!==2||state.receipt.sha256!==sha256)throw new Error('S08_SCHEMA_VERSION_CONFLICT');
  if(state.secured!==true)throw new Error('S08_SCHEMA_GUARDS_MISSING');
  return 'existing';
}
const root=fileURLToPath(new URL('../../',import.meta.url));
const sql=readFileSync(new URL('../server/study-tasks/schema.sql',import.meta.url),'utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
const runId='rh-s08-schema-v2',previousRunId='rh-s08-schema-v1';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function catalog(db){
  const tables=await db.$queryRaw`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
    (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) policies,
    (SELECT count(*)::int FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgenabled='O') triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_study_tasks' AND c.relkind='r' ORDER BY c.relname`;
  const rows=await db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=ANY(${[previousRunId,runId]}::text[]) ORDER BY run_id DESC`;
  const security=await db.$queryRaw`SELECT c.relname,
    (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid) policies,
    (SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) constraints,
    (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=c.oid) indexes,
    (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_study_tasks' AND c.relkind='r' ORDER BY c.relname`;
  const functions=await db.$queryRaw`SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_study_tasks' ORDER BY p.proname`;
  const catalogHash=digest({tables,security,functions});
  let secured=tables.length===2&&tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity&&t.policies===1&&t.triggers===1)&&rows[0]?.manifest?.catalogHash===catalogHash;
  if(secured){
    const [priv]=await db.$queryRaw`SELECT has_table_privilege('aisci_app','rh_study_tasks.operation','SELECT')
      AND has_table_privilege('aisci_app','rh_study_tasks.operation','INSERT')
      AND NOT has_table_privilege('aisci_app','rh_study_tasks.operation','UPDATE')
      AND NOT has_table_privilege('aisci_app','rh_study_tasks.operation','DELETE') AS ok`;
    secured=priv?.ok===true;
  }
  return {tables:tables.map(t=>t.relname),receipt:rows[0]?.manifest??null,secured,catalogHash};
}

export async function applyStudyTaskSchema(env){
  if(validateFixtureConfig(env).databaseName!=='wp01_test_full_baseline')throw new Error('S08_TARGET_REJECTED');
  await assertFixtureTarget(env);
  return withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${previousRunId}))`;
    const before=await catalog(db);
    // Known v1 only: add one same-scope constraint, keep the v1 receipt immutable.
    if(before.secured&&before.receipt?.version===1&&before.receipt.sha256==='64c542a814751e3764cbac77126e921485b4a557a6eb783f03a2e3dde1d43fd7'){
      await db.$executeRawUnsafe("ALTER TABLE rh_study_tasks.context ADD CONSTRAINT context_source_hash_required CHECK (kind='none' OR source_hash IS NOT NULL)");
      const receipt={purpose:'ResearchHub-S08-schema',syntheticOnly:true,version:2,sha256,catalogHash:(await catalog(db)).catalogHash,previous:{runId:previousRunId,sha256:before.receipt.sha256,catalogHash:before.catalogHash}};
      await db.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(receipt)}::jsonb)`;
      evaluateStudyTaskSchema(await catalog(db),sha256);
      return {created:false,upgraded:true,sha256,tables:['context','operation']};
    }
    const status=evaluateStudyTaskSchema(before,sha256);
    if(status==='existing')return {created:false,sha256,tables:before.tables};
    const statements=sql.split(/^-- @statement\s*$/m).slice(1).map(s=>s.trim()).filter(Boolean);
    assert(statements.length===19&&!/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i.test(sql),'S08_SCHEMA_REJECTED');
    for(const statement of statements)await db.$executeRawUnsafe(statement); // Trusted file, never request text.
    const receipt={purpose:'ResearchHub-S08-schema',syntheticOnly:true,version:2,sha256,catalogHash:(await catalog(db)).catalogHash};
    await db.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(receipt)}::jsonb)`;
    evaluateStudyTaskSchema(await catalog(db),sha256);
    return {created:true,sha256,tables:['context','operation']};
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-s08']);
    const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
    console.log(JSON.stringify({passed:true,...await applyStudyTaskSchema(env)}));
  }catch(error){console.error(JSON.stringify({passed:false,code:/^(?:S08_|WP01_)/.test(error.message)?error.message:'S08_SCHEMA_UNAVAILABLE'}));process.exitCode=1;}
}
