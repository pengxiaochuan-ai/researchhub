import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withRollback,runtime} from '../wp02/test-support.mjs';
import {listVisibleClinicalRegistries,getVisibleClinicalRegistry} from './external-visible.mjs';
import {registryDetailHash} from './registry-detail-contract.mjs';
const tenantId=runtime.ids.tenant,hubKey='lingshu-xinyu';
const scope={tenantId,hubKey};
test('C01 summary uses the same currently approved fields and provenance as C03, with no extra clinical fields',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const rows=await listVisibleClinicalRegistries({db,...scope});assert.equal(rows.length,2);
 for(const row of rows){
  assert.equal(row.studySummaryStatus,'approved');
  const detail=(await getVisibleClinicalRegistry({db,...scope,documentId:row.documentId})).structuredDetails;
  assert.deepEqual(row.studySummary.studyType,detail.design.find(x=>x.key==='studyType'));
  assert.deepEqual(row.studySummary.interventions,detail.arms.map(x=>({id:x.id,intervention:x.intervention})));
  assert.deepEqual(row.studySummary.leadInstitution,detail.registration.find(x=>x.key==='leadInstitution'));
  assert.deepEqual(Object.keys(row.studySummary).sort(),['studyType','interventions','leadInstitution','registeredOn','extractionId','extractionVersion','payloadSha256','reviewVersion'].sort());
  assert(!Object.hasOwn(row,'structuredDetails'));assert(!Object.hasOwn(row.studySummary,'outcomes'));
 }
})));
test('unreviewed, expired, mismatched, corrupt or replaced extraction never supplies C01 fields; nonpublic source disappears',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const row=(await listVisibleClinicalRegistries({db,...scope}))[0];
 const detail=(await getVisibleClinicalRegistry({db,...scope,documentId:row.documentId})).structuredDetails;
 const current=async()=> (await listVisibleClinicalRegistries({db,...scope})).find(x=>x.documentId===row.documentId);
 const fault=async(label,change,status)=>{
  assert.equal((await current()).studySummaryStatus,'approved',label+' approved precondition');
  await db.$executeRaw`SAVEPOINT c01_fault`;
  await change();const result=await current();
  assert.equal(result?.studySummaryStatus,status,label);assert(!result?.studySummary,label);
  await db.$executeRaw`ROLLBACK TO SAVEPOINT c01_fault`;
  await db.$executeRaw`RELEASE SAVEPOINT c01_fault`;
  assert.equal((await current()).studySummaryStatus,'approved',label+' restored');
 };
 await fault('revoke alone',()=>db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET decision='revoke' WHERE decision_version=${BigInt(detail.reviewVersion)}`,'pending_review');
 await fault('expiry alone',()=>db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET expires_at='2000-01-01' WHERE decision_version=${BigInt(detail.reviewVersion)}`,'pending_review');
 await fault('reference mismatch alone',()=>db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET evidence_ref='https://example.org/c01-rollback' WHERE decision_version=${BigInt(detail.reviewVersion)}`,'pending_review');
 await fault('bad hash alone',()=>db.$executeRaw`UPDATE rh_source.clinical_registry_extraction SET payload_sha256=${'f'.repeat(64)} WHERE id=${detail.extractionId}`,'unavailable');
 const [{payload}]=await db.$queryRaw`SELECT payload FROM rh_source.clinical_registry_extraction WHERE id=${detail.extractionId}`;
 payload.registration[1].value+='（回滚合成）';payload.registration[1].source.quote=payload.registration[1].value;
 await fault('unreviewed newer extraction alone',()=>db.$executeRaw`INSERT INTO rh_source.clinical_registry_extraction(id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by) SELECT ${'rhce-c01-rollback-'+randomUUID()},tenant_id,hub_key,version_id,3,source_sha256,extractor_version,${JSON.stringify(payload)}::jsonb,${registryDetailHash(payload)},'rollback-only' FROM rh_source.clinical_registry_extraction WHERE id=${detail.extractionId}`,'pending_review');
 await fault('nonpublic source alone',()=>db.$executeRaw`UPDATE rh_source.external_review_decision SET audience='tenant' WHERE decision_version=${BigInt(row.reviewVersion)}`,undefined);
 await fault('source replacement alone',()=>db.$executeRaw`INSERT INTO rh_source.external_document_version(id,tenant_id,hub_key,document_id,version_number,file_name,mime_type,content_sha256,source_url,metadata,imported_by) SELECT ${'rhev-c01-rollback-'+randomUUID()},tenant_id,hub_key,document_id,2,'rollback.mhtml',mime_type,${'e'.repeat(64)},source_url,'{}'::jsonb,'rollback-only' FROM rh_source.external_document_version WHERE id=(SELECT version_id FROM rh_source.clinical_registry_extraction WHERE id=${detail.extractionId})`,undefined);
})));
