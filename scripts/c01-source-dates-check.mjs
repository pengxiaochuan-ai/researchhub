import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {clinicalSourceSnapshot} from './c01-reviewed-study-fields-check.mjs';
import {directoryLogin,directoryRequest} from './directory-runtime.mjs';
const dir=new URL('../docs/testing/evidence/c01-source-dates-2026-11-11/',import.meta.url);
const save=(file,value)=>writeFileSync(new URL(file,dir),JSON.stringify(value,null,2));
if(process.argv[2]==='before'){
 const before=await clinicalSourceSnapshot();
 assert.equal(before.imports,0);assert(before.jobs.every(x=>x.status==='queued'&&!x.workerOwner&&!x.leaseExpiresAt));
 save('before-api.json',before);console.log(JSON.stringify({saved:true,queued:before.jobs.length,active:0}));
}else if(process.argv[2]==='verify'){
 const before=JSON.parse(readFileSync(new URL('before-api.json',dir))),after=await clinicalSourceSnapshot();
 assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.ai,before.ai);
 for(const row of before.jobs)assert.deepEqual(after.jobs.find(x=>x.id===row.id),row);
 const roles={};
 for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role),{items}=await directoryRequest(cookie,'/api/hub-sources/clinical-registries');
  assert.equal(items.length,2);
  assert.deepEqual(items.map(x=>x.sourceUpdatedOn),['2023-09-10','2024-05-14']);
  assert.deepEqual(items.map(x=>x.studySummary.registeredOn.value),['2023-07-12','2023-11-01']);
  if(role!=='anonymous')assert.deepEqual((await directoryRequest(cookie,'/api/hub-sources/member/clinical-registries')).items,items);
  if(role==='admin'){
   const review=await directoryRequest(cookie,'/api/hub-sources/external-review-items');
   for(const item of items)assert.equal(review.items.find(x=>x.id===item.documentId).sourceUpdatedOn,item.sourceUpdatedOn);
  }
  for(const item of items){
   const {item:detail}=await directoryRequest(cookie,'/api/hub-sources/clinical-registries/'+item.documentId);
   assert.deepEqual(item.studySummary.registeredOn,detail.structuredDetails.registration.find(x=>x.key==='registeredOn'));
   assert.equal(item.studySummary.payloadSha256,detail.structuredDetails.payloadSha256);
  }
  roles[role]=items;
 }
 assert.deepEqual(roles.anonymous,roles.owner);assert.deepEqual(roles.owner,roles.admin);
 const result={at:new Date().toISOString(),passed:true,roles,sourceReviewAndGrantsUnchanged:true,aiUnchanged:true,queuedPreserved:before.jobs.length,modelCalls:0};
 save('api-verification.json',result);
 console.log(JSON.stringify({...result,roles:Object.keys(roles)}));
}else throw Error('Use before|verify. No source, extraction or review writes.');
