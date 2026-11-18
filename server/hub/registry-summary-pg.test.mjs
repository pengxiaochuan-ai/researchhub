import test from 'node:test';
import assert from 'node:assert/strict';
import {withRollback,runtime,direct as readCurrent} from '../wp02/test-support.mjs';
import {importRegistryMetadata} from '../../scripts/hub-registry-metadata-import.mjs';
import {listVisibleClinicalRegistrySummaries,getVisibleClinicalRegistry,retrieveExternalForAi} from '../hub-sources/external-visible.mjs';
import {listObjectReviewQueue,submitObjectReview} from '../hub-sources/object-review.mjs';
import {randomUUID} from 'node:crypto';
import {listExternalReviewItems} from '../hub-sources/external-preview.mjs';
import {externalReviewFingerprint} from '../hub-sources/object-review.mjs';
import {registryDetailHash} from '../hub-sources/registry-detail-contract.mjs';
const tenantId=runtime.ids.tenant,hubKey='lingshu-xinyu';
const identities=await readCurrent(db=>db.account.findMany({where:{tenantId,id:{in:[runtime.ids.admin,runtime.ids.owner]}},select:{id:true,authVersion:true}}));
const principal={accountId:runtime.ids.admin,tenantId,authVersion:identities.find(x=>x.id===runtime.ids.admin).authVersion};
const scope={tenantId,hubKey,principal,reviewerAccountId:runtime.ids.admin};

test('real PG registration summaries require the new head approval and cannot turn registration status into research progress',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const old=await db.$queryRaw`SELECT id,payload_sha256 AS hash FROM rh_source.clinical_registry_extraction WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND extraction_version=1 ORDER BY id`;
 const imported=await importRegistryMetadata({transact:fn=>fn(db)});assert.equal(imported.items.length,2);
 const again=await importRegistryMetadata({transact:fn=>fn(db)});assert(again.items.every(x=>!x.inserted));
 for(const x of imported.items){
  await db.$executeRaw`INSERT INTO rh_source.clinical_registry_detail_review(tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id) VALUES(${tenantId},${hubKey},${x.extractionId},'revoke','https://example.org/registration-rollback-only',${principal.accountId})`;
 }
 let rows=await listVisibleClinicalRegistrySummaries({db,...scope});
 assert.equal(rows.length,2);assert(rows.every(x=>!x.registrationSummary&&x.registrationSummaryStatus==='pending_review'));
 const [item]=await listObjectReviewQueue({db,...scope}).then(xs=>xs.filter(x=>x.kind==='external'&&x.detail.externalKey==='ChiCTR2300073486'));
 await assert.rejects(()=>listObjectReviewQueue({db,...scope,principal:{...principal,authVersion:principal.authVersion-1}}),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
 await submitObjectReview({db,...scope,input:{kind:'external',documentId:item.detail.id,visibility:'public',expectedFingerprint:item.fingerprint,operationId:randomUUID()}});
 rows=await listVisibleClinicalRegistrySummaries({db,...scope});const one=rows.find(x=>x.externalKey==='ChiCTR2300073486');
 assert.equal(one.registrationSummaryStatus,'approved');assert.equal(one.registrationSummary.registeredOn.value,'2023-07-12');
 assert.equal(one.registrationSummary.leadInstitution.value,'中国中医科学院针灸研究所');assert.equal(one.registrationSummary.registrationStatus.value,'预注册');
 assert.equal(one.registrationSummary.researchStatus,'not_reported');assert.equal(one.registrationSummary.registeredOn.source.line,113);
 assert(!Object.hasOwn(one.registrationSummary,'design'));assert(!Object.hasOwn(one.registrationSummary,'outcomes'));
 const detail=await getVisibleClinicalRegistry({db,...scope,documentId:one.documentId});
 assert.equal(detail.structuredDetails.registration[0].value,one.registrationSummary.registeredOn.value);
 const owner={accountId:runtime.ids.owner,tenantId,authVersion:identities.find(x=>x.id===runtime.ids.owner).authVersion};
 assert.deepEqual(await retrieveExternalForAi({db,tenantId,hubKey,principal:owner,query:'2023-07-12'}),[]);
 await db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET expires_at='2000-01-01' WHERE tenant_id=${tenantId} AND extraction_id=${one.registrationSummary.extractionId}`;
 assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).find(x=>x.documentId===one.documentId).registrationSummary);
 await db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET expires_at=NULL WHERE tenant_id=${tenantId} AND extraction_id=${one.registrationSummary.extractionId}`;
 await db.$executeRaw`UPDATE rh_source.clinical_registry_extraction SET payload_sha256=${'f'.repeat(64)} WHERE id=${one.registrationSummary.extractionId}`;
 assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).find(x=>x.documentId===one.documentId).registrationSummary);
 const preserved=await db.$queryRaw`SELECT id,payload_sha256 AS hash FROM rh_source.clinical_registry_extraction WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND extraction_version=1 ORDER BY id`;
 assert.deepEqual(preserved,old);
})));

test('real PG public summary rejects tenant-only or revoked sources, unreviewed newer heads and source replacement',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 await importRegistryMetadata({transact:fn=>fn(db)});
 const current=async()=> (await listExternalReviewItems({db,...scope})).find(x=>x.externalKey==='ChiCTR2300077209');
 const review=async visibility=>{const x=await current();return submitObjectReview({db,...scope,input:{kind:'external',documentId:x.id,visibility,expectedFingerprint:externalReviewFingerprint(x),operationId:randomUUID()}});};
 await review('public');const item=await current();
 assert((await listVisibleClinicalRegistrySummaries({db,...scope})).find(x=>x.documentId===item.id).registrationSummary);
 await review('tenant');assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).some(x=>x.documentId===item.id));
 await review('withheld');assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).some(x=>x.documentId===item.id));
 await review('public');
 const newer=structuredClone(item.structuredExtraction.payload);newer.registration[1].value+='（合成回滚反例）';newer.registration[1].source.quote=newer.registration[1].value;
 await db.$executeRaw`INSERT INTO rh_source.clinical_registry_extraction(id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by) VALUES(${'rhce-rollback-registration-'+randomUUID()},${tenantId},${hubKey},${item.versionId},3,${item.sha256},'chictr-mhtml-v1',${JSON.stringify(newer)}::jsonb,${registryDetailHash(newer)},'rollback-only')`;
 const pending=(await listVisibleClinicalRegistrySummaries({db,...scope})).find(x=>x.documentId===item.id);
 assert.equal(pending.registrationSummaryStatus,'pending_review');assert(!pending.registrationSummary);
 await db.$executeRaw`INSERT INTO rh_source.external_document_version(id,tenant_id,hub_key,document_id,version_number,file_name,mime_type,content_sha256,source_url,metadata,imported_by) VALUES(${'rhev-rollback-registration-'+randomUUID()},${tenantId},${hubKey},${item.id},2,'rollback.mhtml','multipart/related',${'f'.repeat(64)},${item.sourceUrl},'{}'::jsonb,'rollback-only')`;
 assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).some(x=>x.documentId===item.id));
 await db.$executeRaw`SELECT set_config('app.tenant_id','wrong-tenant',true)`;
 await assert.rejects(()=>listVisibleClinicalRegistrySummaries({db,...scope}),/HUB_SOURCE_SCOPE_REJECTED/);
})));
