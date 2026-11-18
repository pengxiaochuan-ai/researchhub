import test from'node:test';import assert from'node:assert/strict';
import{loadFixtureInput}from'../../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction}from'../../../app/server/scripts/wp01/fixture-guard.mjs';
import{inspectMediaIngestSchema,correctMediaIngestGuard,applyMediaIngestSchema,mediaIngestSqlHash}from'../../scripts/ai-session-media-ingest-schema.mjs';
const{env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname),rollback=Symbol('guard-revision-rollback');
test('explicit registration guard correction preserves data and rejects catalogue drift, entirely rolled back',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const counts=()=>tx.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM rh_ai.session_media_ingests) AS operations,(SELECT count(*)::int FROM rh_ai.session_media_ingest_access) AS grants`),before=await counts();
  await correctMediaIngestGuard(tx,env);assert.equal((await inspectMediaIngestSchema(tx)).receipt.sqlHash,mediaIngestSqlHash);assert.deepEqual(await counts(),before);
  assert.equal((await applyMediaIngestSchema(tx,env)).created,false);assert.equal((await correctMediaIngestGuard(tx,env)).corrected,false);
  await tx.$executeRawUnsafe('ALTER TABLE rh_ai.session_media_ingests DISABLE ROW LEVEL SECURITY');
  await assert.rejects(correctMediaIngestGuard(tx,env),/MEDIA_INGEST_SCHEMA_CONFLICT/);throw rollback;
 }),e=>e===rollback);
});
