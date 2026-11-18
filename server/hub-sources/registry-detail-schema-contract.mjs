const tables = ['clinical_registry_extraction', 'clinical_registry_detail_review'];
const tenantPolicy = "(tenant_id = current_setting('app.tenant_id'::text, true))";
export const expectedRegistryCatalog = {
  policies: tables.map(tableName => ({ tableName, policyName: 'tenant_rows', command: 'ALL',
    permissive: 'PERMISSIVE', roles: ['public'], qual: tenantPolicy, withCheck: tenantPolicy })),
  constraints: [
    ['clinical_registry_extraction', 'UNIQUE (tenant_id, hub_key, id)'],
    ['clinical_registry_extraction', 'UNIQUE (tenant_id, hub_key, version_id, extraction_version)'],
    ['clinical_registry_extraction', 'UNIQUE (tenant_id, hub_key, version_id, payload_sha256)'],
    ['clinical_registry_extraction', 'FOREIGN KEY (tenant_id, hub_key, version_id) REFERENCES rh_source.external_document_version(tenant_id, hub_key, id)'],
    ['clinical_registry_detail_review', 'FOREIGN KEY (tenant_id, hub_key, extraction_id) REFERENCES rh_source.clinical_registry_extraction(tenant_id, hub_key, id)'],
  ].map(([tableName, definition]) => ({ tableName, definition })),
};
export function assertRegistryCatalog(actual) {
  for (const key of ['policies', 'constraints']) {
    const expected = expectedRegistryCatalog[key].map(row => JSON.stringify(row)).sort();
    const observed = actual[key]?.map(row => JSON.stringify(row)).sort();
    if (!observed || expected.length !== observed.length || expected.some((row, index) => row !== observed[index]))
      throw new Error('HUB_REGISTRY_SCHEMA_DRIFT:' + key);
  }
}
