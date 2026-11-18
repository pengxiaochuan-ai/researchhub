import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryLogin,directoryRequest,base} from '../../scripts/directory-runtime.mjs';
test('actual public overview delivers the same approved registration dates/unit and explicit unknown progress to all three identities',async()=>{
 let expected;
 for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role);
  const response=await fetch(base+'/api/hubs/lingshu-xinyu/overview',{headers:{Cookie:cookie}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const data=await response.json();assert.equal(data.clinicalRegistries?.length,2);
  assert.deepEqual(data.clinicalRegistries.map(x=>x.registrationSummary?.registeredOn.value),['2023-07-12','2023-11-01']);
  for(const x of data.clinicalRegistries){assert.equal(x.registrationSummaryStatus,'approved');assert.equal(x.registrationSummary.leadInstitution.value,'中国中医科学院针灸研究所');assert.equal(x.registrationSummary.registrationStatus.value,'预注册');assert.equal(x.registrationSummary.researchStatus,'not_reported');}
  assert.equal(data.reviewedSourceRecordCount,13);assert.equal(data.metrics.publications.value,11);
  if(expected)assert.deepEqual(data.clinicalRegistries,expected);else expected=data.clinicalRegistries;
 }
});
test('actual same-ID clinical details expose approved positions without expanding the original C01 list contract',async()=>{
 const overview=await directoryRequest('','/api/hubs/lingshu-xinyu/overview');
 const list=await directoryRequest('','/api/hub-sources/clinical-registries');assert.equal(list.items.length,2);
 for(const x of list.items)assert(!Object.hasOwn(x,'registrationSummary')&&!Object.hasOwn(x,'structuredDetails'));
 assert.equal(overview.clinicalRegistries?.length,2);
 for(const row of overview.clinicalRegistries){
  const {item}=await directoryRequest('','/api/hub-sources/clinical-registries/'+row.documentId);
  assert.equal(item.structuredDetailsStatus,'approved');assert.equal(item.structuredDetails.schemaVersion,2);
  assert.equal(item.structuredDetails.registration[0].source.line,113);assert.equal(item.structuredDetails.registration[1].source.line,538);assert.equal(item.structuredDetails.registration[2].source.line,119);
 }
 const missing=await fetch(base+'/api/hubs/missing/overview');assert.equal(missing.status,404);
});
