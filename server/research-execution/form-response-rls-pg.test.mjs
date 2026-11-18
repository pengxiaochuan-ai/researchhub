import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureEnvironment} from '../../scripts/research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const env=fixtureEnvironment(),tables=['form_response_revision','form_response_review_event','form_response_command_receipt'];
test('unscoped application reads expose no formal response evidence',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await withFixtureTransaction(env,'app',async tx=>{
  for(const table of tables){
   const [row]=await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM public.'+table);
   assert.equal(row.count,0);
  }
 },{readOnly:true});
});
for(const table of tables)test(`${table} refuses a non-bypass global emptiness check instead of silently hiding rows`,async()=>{
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$executeRawUnsafe('SET LOCAL row_security = off');
  await tx.$queryRawUnsafe('SELECT count(*)::int FROM public.'+table);
 },{readOnly:true}),error=>error?.meta?.code==='42501');
});
