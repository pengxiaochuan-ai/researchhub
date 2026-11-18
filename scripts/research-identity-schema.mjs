import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,validateFixtureConfig,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

const expected={researchProfile:'jsonb',researchProfileVersion:'integer',researchProfileEstablishedAt:'timestamp with time zone',researchProfileLastMutation:'jsonb'};
const original=['id','tenantId','username','passwordHash','displayName','role','isTenantAdmin','status','createdAt','updatedAt','authVersion','emailNormalized','emailVerifiedAt'].sort();
const runId='rh-research-identity-schema-v1';
const sql=readFileSync(new URL('../server/research-identity/schema.sql',import.meta.url),'utf8');
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sha256=digest(sql);
export const researchIdentitySchemaHash=sha256;
export function evaluateResearchIdentitySchema(state,hash){
  if(!state.originalColumnsValid)throw Error('IDENTITY_SCHEMA_BASELINE');
  if(!state.columns.length&&!state.receipt)return 'new';
  if(state.columns.length!==4||state.columns.some(c=>expected[c.name]!==c.type||c.nullable!==true||c.default!==null))throw Error('IDENTITY_SCHEMA_PARTIAL');
  if(state.receipt?.version!==1||state.receipt.sha256!==hash||state.receipt.catalogHash!==state.catalogHash)throw Error('IDENTITY_SCHEMA_VERSION_CONFLICT');
  return 'existing';
}
async function catalog(tx){
  const all=await tx.$queryRaw`SELECT column_name AS name,data_type AS type,is_nullable='YES' AS nullable,column_default AS default FROM information_schema.columns WHERE table_schema='public' AND table_name='account' ORDER BY column_name`;
  const constraints=await tx.$queryRaw`SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.account'::regclass AND conname LIKE 'rh_identity_%' ORDER BY conname`;
  const policies=await tx.$queryRaw`SELECT policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='account' ORDER BY policyname`;
  const receipt=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runId}`;
  const columns=all.filter(c=>Object.hasOwn(expected,c.name));
  const baseline=all.filter(c=>!Object.hasOwn(expected,c.name)).map(c=>c.name).sort();
  const originalColumnsValid=JSON.stringify(baseline)===JSON.stringify(original)&&policies.some(p=>p.policyname==='tenant_rows'&&p.qual.includes('app.tenant_id')&&p.with_check.includes('app.tenant_id'));
  return {columns,originalColumnsValid,receipt:receipt[0]?.manifest??null,catalogHash:digest({columns,constraints,policies})};
}
async function target(env){assert.equal(validateFixtureConfig(env).databaseName,'wp01_test_full_baseline','IDENTITY_TARGET_REJECTED');await assertFixtureTarget(env);}
export async function inspectResearchIdentitySchema(env){await target(env);return withFixtureTransaction(env,'direct',catalog,{readOnly:true});}
export async function applyResearchIdentitySchema(env){
  await target(env);
  return withFixtureTransaction(env,'direct',async tx=>{
    await tx.$executeRaw`SELECT set_config('lock_timeout','3s',true),set_config('statement_timeout','15s',true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${runId},0))`;
    const state=await catalog(tx),mode=evaluateResearchIdentitySchema(state,sha256);
    if(mode==='existing')return {created:false,sha256,columns:Object.keys(expected)};
    assert(!/\b(?:DROP|TRUNCATE|DELETE|UPDATE|DEFAULT)\b/i.test(sql),'IDENTITY_SCHEMA_SQL_REJECTED');
    await tx.$executeRawUnsafe(sql); // Fixed trusted file, never request text.
    const after=await catalog(tx),manifest={purpose:'ResearchHub-research-identity-schema',syntheticOnly:true,version:1,sha256,catalogHash:after.catalogHash};
    await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(manifest)}::jsonb)`;
    evaluateResearchIdentitySchema(await catalog(tx),sha256);
    return {created:true,sha256,columns:Object.keys(expected)};
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-identity-directory']);
    const root=fileURLToPath(new URL('../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
    console.log(JSON.stringify({passed:true,...await applyResearchIdentitySchema(env)}));
  }catch(error){console.error(JSON.stringify({passed:false,code:/^(?:IDENTITY_|WP01_)/.test(error.message)?error.message:'IDENTITY_SCHEMA_UNAVAILABLE'}));process.exitCode=1;}
}
