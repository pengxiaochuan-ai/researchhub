import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assertNamedReviewer} from './pmc-review-service.mjs';
import {assertCurrentReviewer} from './review-service.mjs';
import {parsePmcReading} from './pmc-reading.mjs';

const root=fileURLToPath(new URL('../../.tmp/researchhub-pmc-local/',import.meta.url));
const fail=code=>{throw new Error(code);};
export async function getPmcReviewArticle({db,principal,tenantId,hubKey,reviewerAccountId,versionId,readObject=readFile}) {
  assertNamedReviewer(principal,tenantId,reviewerAccountId);
  await assertCurrentReviewer({db,principal,tenantId,hubKey});
  if(typeof versionId!=='string'||!/^[A-Za-z0-9_-]{4,100}$/.test(versionId))fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const current=()=>db.$queryRaw`
    SELECT c.id AS "candidateId",c.pmcid,v.id AS "versionId",v.raw_sha256 AS "rawSha256",v.article_version AS "articleVersion"
    FROM rh_source.pmc_candidate c JOIN LATERAL (
      SELECT * FROM rh_source.pmc_candidate_version v WHERE v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key AND v.candidate_id=c.id
      ORDER BY v.staged_at DESC,v.id DESC LIMIT 1
    ) v ON true WHERE c.tenant_id=${tenantId} AND c.hub_key=${hubKey} AND c.campaign_key='pmc-first-2026-10-31' AND v.id=${versionId}`;
  const [version]=await current();if(!version)fail('HUB_SOURCE_SCOPE_REJECTED');
  const [asset]=await db.$queryRaw`
    SELECT local_object_key AS "objectKey",object_sha256 AS sha256,byte_count AS "byteCount" FROM rh_source.pmc_asset
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${versionId}
      AND asset_kind='jats' AND object_sha256=${version.rawSha256}
    ORDER BY (component_ref='jats') DESC,component_ref LIMIT 1`;
  if(!asset||!/^objects\/[a-f0-9]{64}$/.test(asset.objectKey)||asset.objectKey!=='objects/'+asset.sha256||
    Number(asset.byteCount)<1||Number(asset.byteCount)>8*1024*1024)fail('HUB_SOURCE_PMC_READING_UNAVAILABLE');
  let bytes;try{bytes=await readObject(root+asset.objectKey);}catch{fail('HUB_SOURCE_PMC_READING_UNAVAILABLE');}
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(asset.byteCount)||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
    fail('HUB_SOURCE_PMC_READING_INVALID');
  const reading=parsePmcReading(bytes.toString('utf8'),version.pmcid);
  // File I/O must not deliver a former identity or source head after it has changed.
  assertNamedReviewer(principal,tenantId,reviewerAccountId);await assertCurrentReviewer({db,principal,tenantId,hubKey});
  if(!(await current()).length)fail('HUB_SOURCE_VERSION_CONFLICT');
  return {...version,...reading};
}
