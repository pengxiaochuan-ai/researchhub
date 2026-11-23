import assert from 'node:assert/strict';
import test from 'node:test';
import {recordAcademicPublicVersion} from './academic-event.mjs';

const scope = {tenantId: 'tenant-a', hubKey: 'lingshu-xinyu'};

test('legacy database keeps using existing immutable version history', async () => {
  const tx = {$queryRawUnsafe: async sql => {
    assert.match(sql, /to_regclass/);
    return [{installed: false}];
  }};
  assert.equal(await recordAcademicPublicVersion(tx, scope, 'notice-a'), undefined);
});

test('republishing records the original public version and date in the scoped transaction', async () => {
  const publishedAt = new Date('2026-11-18T10:00:00Z');
  const evidence = [];
  const tx = {
    async $queryRawUnsafe(sql, ...args) {
      if (sql.includes('to_regclass')) return [{installed: true}];
      if (sql.includes('rh_academic.version')) {
        assert.deepEqual(args, ['tenant-a', 'lingshu-xinyu', 'notice-a']);
        assert.match(sql, /payload->>'audience'='public'[\s\S]*ORDER BY published_at, id LIMIT 1/);
        return [{id: 'original-public-version', publishedAt}];
      }
      if (sql.includes('current_setting')) return [{tenant: 'tenant-a', hub: 'lingshu-xinyu'}];
      assert.match(sql, /INSERT INTO rh_hub_activity.first_public/);
      assert.deepEqual(args, evidence[0]);
      return [{}];
    },
    async $executeRawUnsafe(sql, ...args) {
      assert.match(sql, /INSERT INTO rh_hub_activity.evidence/);
      evidence.push(args);
    },
  };
  assert.equal((await recordAcademicPublicVersion(tx, scope, 'notice-a')).changed, true);
  assert.deepEqual(evidence[0].slice(0, 4), ['tenant-a', 'lingshu-xinyu', 'platform_content', 'notice-a']);
  assert.equal(evidence[0][6], publishedAt.toISOString());
  assert.deepEqual(JSON.parse(evidence[0][7]), ['academic-public-version:original-public-version']);
});
