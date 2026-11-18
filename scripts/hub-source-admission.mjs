export class HubSourceAdmissionError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const reject = code => { throw new HubSourceAdmissionError(code); };

// This gate is deliberately narrower than tenant administration. A tenant may
// contain more than one Hub, and Study membership never grants Hub review.
export function assertHubSourceAdmission({ target, tenant, admin, hubGrant }, expected) {
  if (!expected || target?.databaseName !== expected.databaseName ||
      target?.databaseName !== 'wp01_test_full_baseline' ||
      target.syntheticOnly !== true || !target.runId) reject('HUB_SOURCE_TARGET_REJECTED');
  if (tenant?.id !== expected.tenantId || tenant.status !== 'active' ||
      admin?.id !== expected.adminId || admin.tenantId !== expected.tenantId ||
      admin.status !== 'active') reject('HUB_SOURCE_SCOPE_REJECTED');
  if (hubGrant && (hubGrant.tenantId !== expected.tenantId ||
      hubGrant.hubKey !== expected.hubKey || hubGrant.accountId !== expected.adminId))
    reject('HUB_SOURCE_SCOPE_REJECTED');
  if (!hubGrant || hubGrant.capability !== 'source.review' || hubGrant.status !== 'active')
    reject('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  return Object.freeze({
    databaseName: target.databaseName,
    runId: target.runId,
    tenantId: expected.tenantId,
    hubKey: expected.hubKey,
    adminId: expected.adminId,
    allowed: true,
  });
}
