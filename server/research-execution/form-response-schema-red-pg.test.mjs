import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
test('formal response stores a current revision and draft CAS version',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await withFixtureTransaction(env,'direct',async tx=>{
  const cols=await tx.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='form_response'`;
  const names=new Set(cols.map(x=>x.column_name));assert(names.has('currentRevisionId'),'current revision pointer is required');assert(names.has('version'),'draft CAS version is required');
 });
});
test('formal response history and review are distinct immutable records',async()=>{
 await withFixtureTransaction(env,'direct',async tx=>{
  const tables=await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('form_response_revision','form_response_review_event')`;
  const names=new Set(tables.map(x=>x.table_name));assert(names.has('form_response_revision'),'immutable revision table is required');assert(names.has('form_response_review_event'),'revision-bound review and lock events are required');
 });
});
