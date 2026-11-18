import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationHref } from '../src/hub-source-api.js';
import { realModeRouteState } from '../src/real-mode-route.js';

test('real E01 and E02 are available only with configured non-demo session', () => {
  assert.equal(realModeRouteState('e01', '', { configured: true }), 'live');
  assert.equal(realModeRouteState('e02', '?recordId=rhsr-1', { configured: true }), 'live');
  assert.equal(realModeRouteState('e01', '', { configured: true, explicitDemo: true }), 'demo');
});

test('publication route only accepts opaque ResearchHub record IDs', () => {
  assert.equal(publicationHref('rhsr-' + 'a'.repeat(40)), '/pages/e02/?recordId=rhsr-' + 'a'.repeat(40));
  assert.throws(() => publicationHref('../../other'), /HUB_SOURCE_RECORD_ID_REJECTED/);
  assert.throws(() => publicationHref('jama'), /HUB_SOURCE_RECORD_ID_REJECTED/);
});
