import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {consumeRate} from './repository.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
test('real PostgreSQL persistent limit rejects attempt after quota without granting extra slots',async()=>{
 const rollback=new Error('TEST_ROLLBACK');let checked=false;
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const keyHash='b'.repeat(64),now=new Date('2026-10-23T00:00:00.000Z');
  for(let i=0;i<3;i++)await consumeRate(tx,{tenantId:ids.tenant,purpose:'wp02-test-rollback',keyHash,limit:3,windowMs:3600000,now});
  await assert.rejects(consumeRate(tx,{tenantId:ids.tenant,purpose:'wp02-test-rollback',keyHash,limit:3,windowMs:3600000,now}),e=>e.status===429);
  const rows=await tx.$queryRawUnsafe('SELECT count FROM wp02_request_window WHERE "tenantId"=$1 AND purpose=$2 AND "keyHash"=$3',ids.tenant,'wp02-test-rollback',keyHash);assert.equal(rows[0].count,3);checked=true;throw rollback;
 }),e=>e===rollback);assert(checked);
});
