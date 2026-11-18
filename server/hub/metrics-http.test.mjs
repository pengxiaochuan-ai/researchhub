import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
async function get(path,headers={}){const r=await fetch(base+path,{headers});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);return r.json();}
test('overview counts current public registration numbers, not five documents or staged rows',async()=>{
 const data=await get('/api/hubs/lingshu-xinyu/overview');
 const registries=await get('/api/hub-sources/clinical-registries');
 assert.equal(data.metrics.registrations.value,2);
 assert.deepEqual(registries.items.map(i=>i.externalKey).sort(),['ChiCTR2300073486','ChiCTR2300077209']);
 assert.equal(data.metrics.registrations.value,new Set(registries.items.map(i=>i.externalKey)).size);
 assert.equal(data.metrics.guides.value,3);
 assert.equal(data.metrics.publications.value,11);
 assert.equal(data.metrics.registrations.scope,'CURRENT_HUB_APPROVED_PUBLIC_INDEXED');
 assert.equal(data.reviewedSourceRecordCount,13);
 assert.equal(data.reviewedSources.length,6);
});
test('public scope metrics remain identical with owner/admin sessions and unknown Hub stays 404',async()=>{
 const baseline=(await get('/api/hubs/lingshu-xinyu/overview')).metrics;
 for(const actor of ['owner','admin']){
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password})});
  assert.equal(login.status,201);
  const Cookie=login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await get('/api/hubs/lingshu-xinyu/overview',{Cookie})).metrics,baseline);
 }
 assert.equal((await fetch(base+'/api/hubs/missing/overview')).status,404);
});
