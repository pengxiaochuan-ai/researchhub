import {listVisibleExternal} from '../hub-sources/external-visible.mjs';
import {registryActivityIdentity} from './identity.mjs';
import {recordFirstPublicFact} from './ledger.mjs';
import {readActiveActivityHub} from './scope.mjs';

export async function recordExternalPublicApproval(db, scope, event, {
  readHub = readActiveActivityHub, readPublic = listVisibleExternal, write = recordFirstPublicFact,
} = {}) {
  const [schema] = await db.$queryRaw`SELECT to_regclass('rh_hub_activity.first_public') IS NOT NULL AS installed`;
  if (!schema?.installed || !await readHub(db, scope)) return;
  const {tenantId, hubKey} = scope;
  const {documentId, decisionVersion, createdAt} = event;
  const visible = await readPublic({db, ...scope, audience:'public'});
  const row = visible.find(item => item.documentId === documentId && item.reviewVersion === String(decisionVersion));
  if (!row) return;
  const registration = row.documentType === 'clinical_registry';
  if (!registration && !['clinical_guideline', 'research_standard'].includes(row.documentType)) return;
  const entityKey = registration ? registryActivityIdentity(row.externalKey) : 'external:' + documentId;
  if (!entityKey) return;

  // Historical approval can predate reliable eligibility evidence.
  const [history] = await db.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM rh_source.external_review_decision d
      JOIN rh_source.external_document_version v
        ON (v.tenant_id,v.hub_key,v.id)=(d.tenant_id,d.hub_key,d.version_id)
      WHERE d.tenant_id=${tenantId} AND d.hub_key=${hubKey} AND v.document_id=${documentId}
        AND d.field_kind='bibliographic' AND d.purpose='display'
        AND d.audience='public' AND d.decision='approve'
        AND d.decision_version < ${BigInt(decisionVersion)}
    ) AS previously_approved`;
  if (history?.previously_approved) return;
  await db.$executeRaw`SELECT set_config('app.hub_key', ${hubKey}, true)`;
  return write(db, scope, {
    category: registration ? 'registration' : 'guidance',
    entityKey, firstPublicAt: createdAt, timeStatus: 'verified',
    proofRefs: ['external-display-review:' + decisionVersion],
    ruleVersion: 'external-public-approval.v1',
  });
}
