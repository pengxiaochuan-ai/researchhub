import test from 'node:test';
import assert from 'node:assert/strict';
import { latestReviewVersion, reviewPayload } from '../src/hub-source-api.js';
import { realModeRouteState } from '../src/real-mode-route.js';

test('real source workbench is available only in configured non-demo mode', () => {
  assert.equal(realModeRouteState('g02', '', { configured: true }), 'live');
  assert.equal(realModeRouteState('g02', '', { configured: true, explicitDemo: true }), 'demo');
});

test('review confirmation is exact and scope/version specific', () => {
  const history = [{ batchId: 'batch', sourceRecordId: null, fieldKind: 'bibliographic', purpose: 'display', version: '4' },
    { batchId: null, sourceRecordId: 'row', fieldKind: 'abstract', purpose: 'ai_retrieval', version: '7' }];
  assert.equal(latestReviewVersion(history, { batchId: 'batch', fieldKind: 'bibliographic', purpose: 'display' }), '4');
  assert.equal(latestReviewVersion(history, { batchId: 'batch', sourceRecordId: 'row', fieldKind: 'abstract', purpose: 'ai_retrieval' }), '7');
  assert.deepEqual(reviewPayload({ batchId: 'batch', sourceRegistryId: 'source', fieldKind: 'abstract', purpose: 'display',
    decision: 'approve', audience: 'public', evidenceRef: ' https://example.org/rights ',
    homogeneousRightsConfirmed: true, eligibleCount: 8, rowCount: 10, expectedVersion: '0' }),
  { batchId: 'batch', sourceRegistryId: 'source', sourceRecordId: null, fieldKind: 'abstract', purpose: 'display',
    decision: 'approve', audience: 'public', evidenceRef: 'https://example.org/rights',
    confirmedCount: 8, excludedCount: 2, homogeneousRightsConfirmed: true, expectedVersion: '0' });
});
