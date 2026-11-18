import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicalRegistryHref } from '../src/hub-source-api.js';
import { realModeRouteState } from '../src/real-mode-route.js';

test('real C01/C03 only activate with configured non-demo session', () => {
  for (const page of ['c01', 'c03']) {
    assert.equal(realModeRouteState(page, '', { configured: true }), 'live');
    assert.equal(realModeRouteState(page, '', { configured: true, explicitDemo: true }), 'demo');
    assert.equal(realModeRouteState(page, '', { configured: false }), 'demo');
  }
});

test('clinical detail link only accepts immutable external document ID', () => {
  const id = 'rhed-' + 'a'.repeat(40);
  assert.equal(clinicalRegistryHref(id), `/pages/c03/?documentId=${id}`);
  for (const bad of ['ChiCTR2300077209', '../../admin', 'rhed-' + 'x'.repeat(40), null])
    assert.throws(() => clinicalRegistryHref(bad), /HUB_REGISTRY_DOCUMENT_ID_REJECTED/);
});
