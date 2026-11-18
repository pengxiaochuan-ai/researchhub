import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedGuidanceCatalog, assertGuidanceCatalog } from './guidance-clause-schema-contract.mjs';
test('guidance import rejects widened tenant policies or missing composite FK/unique constraints', () => {
  assert.doesNotThrow(() => assertGuidanceCatalog(expectedGuidanceCatalog));
  for (const mutate of [x => { x.policies[0].qual = 'true'; }, x => { x.policies[1].withCheck = 'true'; },
    x => { x.policies.push({ ...x.policies[0], policyName: 'or_all' }); }, x => { x.constraints.pop(); },
    x => { x.constraints.shift(); }]) {
    const value = structuredClone(expectedGuidanceCatalog); mutate(value);
    assert.throws(() => assertGuidanceCatalog(value), /HUB_GUIDANCE_SCHEMA_DRIFT/);
  }
});
