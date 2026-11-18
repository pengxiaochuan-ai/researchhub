import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedRegistryCatalog, assertRegistryCatalog } from './registry-detail-schema-contract.mjs';

test('import admission rejects permissive tenant policy, extra OR policy, missing composite FK or uniqueness', () => {
  assert.doesNotThrow(() => assertRegistryCatalog(structuredClone(expectedRegistryCatalog)));
  for (const mutate of [
    catalog => { catalog.policies[0].qual = 'true'; },
    catalog => { catalog.policies[1].withCheck = 'true'; },
    catalog => { catalog.policies.push({ ...catalog.policies[0], policyName: 'extra_or_policy', qual: 'true' }); },
    catalog => { catalog.constraints = catalog.constraints.filter(row => !row.definition.includes('extraction_id')); },
    catalog => { catalog.constraints[3].definition = 'FOREIGN KEY (version_id) REFERENCES rh_source.external_document_version(id)'; },
    catalog => { catalog.constraints.shift(); },
  ]) {
    const catalog = structuredClone(expectedRegistryCatalog); mutate(catalog);
    assert.throws(() => assertRegistryCatalog(catalog), /HUB_REGISTRY_SCHEMA_DRIFT/);
  }
});
