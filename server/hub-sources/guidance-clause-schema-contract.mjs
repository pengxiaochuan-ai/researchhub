import { expectedRegistryCatalog } from './registry-detail-schema-contract.mjs';

// Same proven local extraction/review shape; do not modify the clinical tables.
const rename = text => text.replaceAll('clinical_registry_extraction', 'guidance_clause_extraction')
  .replaceAll('clinical_registry_detail_review', 'guidance_clause_review');
export const expectedGuidanceCatalog = JSON.parse(rename(JSON.stringify(expectedRegistryCatalog)));
export function assertGuidanceCatalog(actual) {
  for (const key of ['policies', 'constraints']) {
    const expected = expectedGuidanceCatalog[key].map(row => JSON.stringify(row)).sort();
    const observed = actual[key]?.map(row => JSON.stringify(row)).sort();
    if (!observed || observed.length !== expected.length || expected.some((row, index) => row !== observed[index]))
      throw new Error('HUB_GUIDANCE_SCHEMA_DRIFT:' + key);
  }
}
