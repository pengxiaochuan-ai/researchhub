// Explicit local read probe. Never prints credentials, mutates assets or starts a model.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const {env,ids}=loadCatalogTarget();await assertFixtureTarget(env);
assert.equal((await executeCatalogSchema()).action,'verified');
const runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
const origin='http://127.0.0.1:19501',scope={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const call=(path,init={})=>fetch(origin+'/api'+path,{redirect:'error',signal:AbortSignal.timeout(15000),...init,headers:{Accept:'application/json',Origin:origin,...scope,...init.headers}});
const checks=[];
for(const actor of ['owner','admin']){
 const login=await call('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
 const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');assert(cookie);
 const response=await call('/research-assets/catalog',{headers:{Cookie:cookie}}),value=await response.json();
 assert.equal(response.status,200,JSON.stringify(value));assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(value.schemaVersion,'rh-research-asset-catalog.v1');assert.equal(value.stats.all,Object.values(value.stats).slice(1).reduce((a,b)=>a+b,0));assert.equal(value.page,1);
 for(const q of ['page=1&page=2','scope=public','q='+encodeURIComponent('x'.repeat(121))])assert.equal((await call('/research-assets/catalog?'+q,{headers:{Cookie:cookie}})).status,400);
 assert.equal((await call('/research-assets/catalog',{headers:{Cookie:cookie,'X-Research-Project-Id':'foreign-study'}})).status,403);
 assert.equal((await call('/research-assets/catalog/unknown-asset',{headers:{Cookie:cookie}})).status,404);
 assert.equal((await call('/research-assets/unknown-asset/preview?version=1&tab=basic',{headers:{Cookie:cookie}})).status,404);
 checks.push({actor,status:response.status,total:value.total,stats:value.stats,invalidInputsDenied:3,foreignStudyDenied:true,unknownDetailDenied:true,unknownPreviewDenied:true});
}
assert.equal((await call('/research-assets/catalog')).status,401);
console.log(JSON.stringify({realHttp:true,syntheticOnly:true,checks,anonymousDenied:true,assetWrites:0,modelsCalled:0},null,2));
