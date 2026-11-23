import {recordFirstPublicFact} from './ledger.mjs';

export async function recordAcademicPublicVersion(tx, scope, contentId) {
  const [schema] = await tx.$queryRawUnsafe(
    "SELECT to_regclass('rh_hub_activity.first_public') IS NOT NULL AS installed"
  );
  // Publication versions already persist the event before the index is installed.
  if (!schema?.installed) return;

  const [first] = await tx.$queryRawUnsafe(
    `SELECT id, published_at AS "publishedAt"
     FROM rh_academic.version
     WHERE tenant_id=$1 AND hub_key=$2 AND content_id=$3
       AND payload->>'audience'='public'
     ORDER BY published_at, id LIMIT 1`,
    scope.tenantId, scope.hubKey, contentId
  );
  if (!first) throw Error('ACADEMIC_FIRST_PUBLIC_VERSION_MISSING');
  return recordFirstPublicFact(tx, scope, {
    category: 'platform_content',
    entityKey: contentId,
    firstPublicAt: first.publishedAt,
    timeStatus: 'verified',
    proofRefs: ['academic-public-version:' + first.id],
    ruleVersion: 'academic-public-version.v1',
  });
}
