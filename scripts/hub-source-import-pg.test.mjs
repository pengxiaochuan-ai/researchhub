import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { importApprovedWorkbooks } from './hub-source-import.mjs';

test('two approved workbook snapshots stage 15,697 rows once and release nothing', async () => {
  const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
  await assertFixtureTarget(env);
  const before = await withFixtureTransaction(env, 'direct', async tx => ({
    chat: await tx.knowledgeChatJob.count(), imports: await tx.knowledgeImportTask.count(),
  }), { readOnly: true });
  const first = await importApprovedWorkbooks();
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(x => x.rowCount), [10537, 5160]);
  const replay = await importApprovedWorkbooks();
  assert.ok(replay.every(x => x.existing === true && x.inserted === 0));
  const state = await withFixtureTransaction(env, 'direct', async tx => ({
    chat: await tx.knowledgeChatJob.count(), imports: await tx.knowledgeImportTask.count(),
    batches: await tx.$queryRaw`SELECT count(*)::int AS count FROM rh_source.import_batch WHERE scope_key IN ('zh-acupuncture-affective','en-acupuncture-affective')`,
    rows: await tx.$queryRaw`SELECT count(*)::int AS count, count(*) FILTER (WHERE display_allowed)::int AS display, count(*) FILTER (WHERE ai_allowed)::int AS ai FROM rh_source.source_record WHERE batch_id IN (SELECT id FROM rh_source.import_batch WHERE scope_key IN ('zh-acupuncture-affective','en-acupuncture-affective'))`,
  }), { readOnly: true });
  assert.equal(state.batches[0].count, 2);
  assert.deepEqual(state.rows[0], { count: 15697, display: 0, ai: 0 });
  assert.deepEqual({ chat: state.chat, imports: state.imports }, before);
});
