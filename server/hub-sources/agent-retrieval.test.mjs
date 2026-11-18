import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { runHubSourceSearch } from './agent-retrieval.mjs';
import { AGENT_QUESTION_MAX_CHARACTERS } from '../../src/agent-question.js';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };
const principal = async (id, db) => {
  const account=await db.account.findFirst({where:{id,tenantId:ids.tenant,status:'active'},select:{authVersion:true}});
  assert(account,'Existing synthetic account required');
  return {accountId:id,tenantId:ids.tenant,authVersion:account.authVersion};
};

test('old KbTools-compatible read-only search invents no hit for an absent query, no model call', async () => {
  await assertFixtureTarget(env);
  const result = await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return runHubSourceSearch({ db, ...scope, principal: await principal(ids.owner,db), query: 'absent-source-'+randomUUID() });
  });
  assert.equal(result.mutated, false);
  assert.equal(result.meta.toolName, 'hub_source_search');
  assert.deepEqual(result.meta.sources, []);
  assert.match(result.result, /没有已获准/);
});

test('uninvited account and invalid query cannot retrieve Hub sources', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assert.rejects(async () => runHubSourceSearch({ db, ...scope, principal: await principal(ids.uninvited,db), query: '针灸' }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(async () => runHubSourceSearch({ db, ...scope, principal: await principal(ids.owner,db), query: 'x'.repeat(AGENT_QUESTION_MAX_CHARACTERS+1) }), /HUB_SOURCE_SCOPE_REJECTED/);
  });
});
