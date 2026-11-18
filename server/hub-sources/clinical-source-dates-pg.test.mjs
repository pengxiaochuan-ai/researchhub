import test from 'node:test';
import assert from 'node:assert/strict';
import {withRollback,runtime} from '../wp02/test-support.mjs';
import {listVisibleClinicalRegistries,getVisibleClinicalRegistry} from './external-visible.mjs';
const tenantId=runtime.ids.tenant,scope={tenantId,hubKey:'lingshu-xinyu'};
test('C01 dates are independent reviewed DB values, registration provenance equals C03, and never snapshot dates',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const rows=await listVisibleClinicalRegistries({db,...scope});assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.sourceUpdatedOn),['2023-09-10','2024-05-14']);
 assert.deepEqual(rows.map(x=>x.studySummary.registeredOn.value),['2023-07-12','2023-11-01']);
 for(const row of rows){
  const {structuredDetails:d}=await getVisibleClinicalRegistry({db,...scope,documentId:row.documentId});
  assert.deepEqual(row.studySummary.registeredOn,d.registration.find(x=>x.key==='registeredOn'));
  assert.equal(row.studySummary.registeredOn.source.line,113);assert(!row.sourceUpdatedOn.startsWith('2026-'));
 }
})));
test('C01 update date cannot fall back to manifest/metadata/capture time and is gated separately from registration approval',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const row=(await listVisibleClinicalRegistries({db,...scope}))[0];
 const current=async()=> (await listVisibleClinicalRegistries({db,...scope})).find(x=>x.documentId===row.documentId);
 for(const date of [null,'2099-01-01']){
  await db.$executeRaw`SAVEPOINT date_fault`;
  await db.$executeRaw`UPDATE rh_source.external_document_version SET source_updated_on=${date}::date WHERE document_id=${row.documentId} AND tenant_id=${tenantId}`;
  const item=await current();assert(item);assert.equal(item.sourceUpdatedOn,null);assert.equal(item.studySummary.registeredOn.value,'2023-07-12');
  await db.$executeRaw`ROLLBACK TO SAVEPOINT date_fault`;await db.$executeRaw`RELEASE SAVEPOINT date_fault`;
 }
 assert.equal((await current()).sourceUpdatedOn,'2023-09-10');
 await db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET decision='revoke' WHERE decision_version=${BigInt(row.studySummary.reviewVersion)}`;
 const noDetail=await current();assert.equal(noDetail.sourceUpdatedOn,'2023-09-10');assert.equal(noDetail.studySummaryStatus,'pending_review');assert(!noDetail.studySummary);
 await db.$executeRaw`UPDATE rh_source.external_review_decision SET decision='revoke' WHERE decision_version=${BigInt(row.reviewVersion)}`;
 assert.equal(await current(),undefined);
})));
