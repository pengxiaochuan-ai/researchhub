import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {runtime,env,direct} from '../wp02/test-support.mjs';
import {inspectDirectorySchema,evaluateDirectorySchema,directorySchemaHash} from '../../scripts/directory-schema.mjs';
const sql=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
test('real PG directory DDL, actor/relationship guard, forced scopes and append-only grants roll back cleanly',async()=>{
 const rollback=Error('DIRECTORY_SCHEMA_TEST_ROLLBACK');let complete=false;
 try{await direct(async tx=>{
  const state=await inspectDirectorySchema(env);
  if(evaluateDirectorySchema(state,directorySchemaHash)==='new')for(const s of sql.split('-- statement').map(x=>x.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const t=runtime.ids.tenant,h='lingshu-xinyu',a=runtime.ids.admin,sha='a'.repeat(64);
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${t},true),set_config('app.hub_key',${h},true)`;
  for(const[id,kind,n]of [['rhd-schema-test-org','organization',1],['rhd-schema-test-team','team',2],['rhd-schema-test-person','researcher',3]])await tx.$executeRaw`INSERT INTO rh_directory.entity(tenant_id,id,kind,stable_key,created_by,creation_hub_key,request_key,request_hash) VALUES(${t},${id},${kind},${id},${a},${h},${'00000000-0000-4000-8000-'+String(n).padStart(12,'0')}::uuid,${sha})`;
  const insert=async(id,kind,entity,related)=>tx.$executeRaw`INSERT INTO rh_directory.assertion(tenant_id,hub_key,id,entity_id,assertion_key,revision,kind,related_entity_id,payload,provenance,content_sha256,request_key,request_hash,created_by) VALUES(${t},${h},${id},${entity},${id},1,${kind},${related},'{}'::jsonb,'[{}]'::jsonb,${sha},${'10000000-0000-4000-8000-000000000001'}::uuid,${sha},${a})`;
  await insert('rhd-schema-affiliation','affiliation','rhd-schema-test-team','rhd-schema-test-org');
  let sp=0;async function rejected(fn,code){const name='dir_schema_'+(++sp);await tx.$executeRawUnsafe('SAVEPOINT '+name);await assert.rejects(fn,e=>e.meta?.code===code);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+name);}
  await rejected(()=>insert('rhd-schema-wrong','team_member','rhd-schema-test-org','rhd-schema-test-team'),'23514');
  await rejected(()=>tx.$executeRaw`UPDATE rh_directory.assertion SET payload='{}'::jsonb WHERE tenant_id=${t}`,'42501');
  await rejected(()=>tx.$executeRaw`UPDATE rh_directory.entity SET stable_key='other' WHERE tenant_id=${t}`,'42501');
  assert.equal((await tx.$queryRaw`SELECT id FROM rh_directory.assertion WHERE id='rhd-schema-affiliation'`).length,1);
  await tx.$executeRaw`SELECT set_config('app.hub_key','other-hub',true)`;assert.equal((await tx.$queryRaw`SELECT id FROM rh_directory.assertion`).length,0);
  await tx.$executeRaw`SELECT set_config('app.tenant_id','other-tenant',true)`;assert.equal((await tx.$queryRaw`SELECT id FROM rh_directory.entity`).length,0);
  complete=true;throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 assert(complete);
});
