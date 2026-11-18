import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixtureClient } from '../../../app/server/scripts/wp01/fixture-guard.mjs';

const path = fileURLToPath(new URL('./pmc-schema.sql', import.meta.url));
const localConfigPath = fileURLToPath(new URL('../../.tmp/researchhub-pmc-local/collector.json', import.meta.url));

test('PMC extension is additive and contains six isolated tables', () => {
  const sql = readFileSync(path, 'utf8');
  const tables = [...sql.matchAll(/CREATE TABLE rh_source\.(pmc_[a-z_]+)\s*\(/g)].map(match => match[1]);
  assert.deepEqual(tables.sort(), [
    'pmc_asset', 'pmc_candidate', 'pmc_candidate_version',
    'pmc_collector_binding', 'pmc_review_decision', 'pmc_run',
  ]);
  for (const table of tables) {
    assert.match(sql, new RegExp(`ALTER TABLE rh_source\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE rh_source\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE)\b|\b(?:public|wp01_meta)\./i);
});

test('collector cannot directly edit ledger or review decisions', () => {
  const sql = readFileSync(path, 'utf8');
  assert.match(sql, /FUNCTION rh_source\.reserve_pmc_request\(/);
  assert.match(sql, /FUNCTION rh_source\.complete_pmc_request\(/);
  assert.match(sql, /FUNCTION rh_source\.set_pmc_query_translation\(/);
  assert.match(sql, /UNIQUE \(tenant_id, hub_key, version_id, component_ref\)/);
  assert.match(sql, /session_user/);
  assert.doesNotMatch(sql, /GRANT\s+(?:UPDATE|DELETE).*TO rh_pmc_collector_local/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE).*pmc_review_decision\s+TO rh_pmc_collector_local/i);
});

test('article-level decision extension is additive and collector-inaccessible', () => {
  const sql = readFileSync(fileURLToPath(new URL('./pmc-article-decision.sql', import.meta.url)), 'utf8');
  assert.match(sql, /CREATE TABLE rh_source\.pmc_article_decision/);
  assert.match(sql, /asset_snapshot JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT, INSERT ON rh_source\.pmc_article_decision TO aisci_app/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE)\b|TO rh_pmc_collector_local/i);
});

test('dedicated synthetic collector role cannot see reviews or mutate the ledger',
  { skip: !existsSync(localConfigPath) }, async () => {
    const local = JSON.parse(readFileSync(localConfigPath, 'utf8'));
    const client = fixtureClient(local.databaseUrl);
    try {
      const [identity] = await client.$queryRawUnsafe(`
        SELECT current_database() AS database, session_user AS role,
          (SELECT rolbypassrls FROM pg_roles WHERE rolname=session_user) AS bypass`);
      assert.equal(identity.database, 'wp01_test_full_baseline');
      assert.equal(identity.role, 'rh_pmc_collector_local');
      assert.equal(identity.bypass, false);
      const binding = await client.$queryRawUnsafe(`
        SELECT tenant_id, hub_key, campaign_key FROM rh_source.pmc_collector_binding`);
      assert.deepEqual(binding, [{ tenant_id: local.tenantId, hub_key: local.hubKey,
        campaign_key: local.campaign }]);
      await assert.rejects(client.$queryRawUnsafe('SELECT * FROM rh_source.pmc_review_decision LIMIT 1'),
        /permission denied/);
      await assert.rejects(client.$queryRawUnsafe('SELECT * FROM rh_source.pmc_article_decision LIMIT 1'),
        /permission denied/);
      await assert.rejects(client.$executeRawUnsafe(`UPDATE rh_source.pmc_run SET request_count=0 WHERE true`),
        /permission denied/);
      await assert.rejects(client.$queryRaw`
        SELECT rh_source.set_pmc_query_translation(${local.campaign},${'0'.repeat(64)},'fabricated')`,
        /PMC_DISCOVERY_FINALIZE_REJECTED/);
      await assert.rejects(client.$executeRawUnsafe(`INSERT INTO rh_source.pmc_run
        (id,tenant_id,hub_key,campaign_key,query_sha256,query_text,keyword_version)
        VALUES ('pmc-foreign-test','other-tenant','other-hub','pmc-first-2026-10-31',
          repeat('a',64),'synthetic','test')`), /row-level security/);
    } finally { await client.$disconnect(); }
  });

test('synthetic request reservations are scoped, sequential and transactionally visible',
  { skip: !existsSync(localConfigPath) }, async () => {
    const local = JSON.parse(readFileSync(localConfigPath, 'utf8'));
    const client = fixtureClient(local.databaseUrl);
    const rollback = new Error('TEST_ROLLBACK');
    try {
      await assert.rejects(client.$transaction(async tx => {
        const [candidate] = await tx.$queryRaw`
          SELECT c.pmcid, v.article_version AS version
          FROM rh_source.pmc_candidate c JOIN rh_source.pmc_candidate_version v
            ON v.candidate_id=c.id AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key
          WHERE c.tenant_id=${local.tenantId} AND c.hub_key=${local.hubKey}
            AND c.campaign_key=${local.campaign} ORDER BY c.selected_rank LIMIT 1`;
        assert.ok(candidate);
        const target = `https://pmc-oa-opendata.s3.amazonaws.com/?list-type=2&prefix=${candidate.version}/`;
        const [first] = await tx.$queryRaw`
          SELECT rh_source.reserve_pmc_request(${local.campaign},'GET',${target},
            'cloud_object_list',${candidate.pmcid},${candidate.version}) AS sequence`;
        const [second] = await tx.$queryRaw`
          SELECT rh_source.reserve_pmc_request(${local.campaign},'GET',${target},
            'cloud_object_list',${candidate.pmcid},${candidate.version}) AS sequence`;
        assert.equal(Number(second.sequence), Number(first.sequence) + 1);
        await tx.$queryRaw`
          SELECT rh_source.complete_pmc_request(${local.campaign},${first.sequence}::bigint,'200',${'b'.repeat(64)})::text AS completed`;
        const [run] = await tx.$queryRaw`
          SELECT request_count, request_ledger FROM rh_source.pmc_run WHERE campaign_key=${local.campaign}`;
        assert.equal(run.request_count, Number(second.sequence));
        assert.deepEqual(run.request_ledger.slice(-2).map(item => item.status), ['200','reserved']);
        throw rollback;
      }), error => error === rollback);
      const rows = await client.$queryRaw`
        SELECT request_ledger FROM rh_source.pmc_run WHERE campaign_key=${local.campaign}`;
      assert.equal(rows[0].request_ledger.some(item => item.kind === 'cloud_object_list'), false);
      await assert.rejects(client.$queryRaw`
        SELECT rh_source.reserve_pmc_request(${local.campaign},'GET',
          'https://evil.example/','oai','PMC12345',NULL)`, /PMC_CANDIDATE_REJECTED/);
    } finally { await client.$disconnect(); }
  });
