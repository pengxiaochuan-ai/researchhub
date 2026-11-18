// Explicit local HTTP read/negative probe. It never registers an asset, valid upload, review or model task.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertAssetRegistrationOptions} from '../../src/research-assets-registration.js';
assert.equal(process.argv[2],'--read-check','EXPLICIT_READ_CHECK_REQUIRED');
const {env,ids}=loadCatalogTarget();await assertFixtureTarget(env);assert.equal((await executeCatalogSchema()).action,'verified');
const runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
const origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},headers={Accept:'application/json',Origin:origin,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const checks=[];
for(const actor of ['owner','admin']){
 const call=(path,init={})=>fetch(origin+'/api'+path,{redirect:'error',signal:AbortSignal.timeout(15000),...init,headers:{...headers,...init.headers}});
 const login=await call('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
 const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';'),user=await(await call('/auth/me',{headers:{Cookie:cookie}})).json();assert.equal(user.accountId,ids[actor]);assert(Number.isSafeInteger(user.authVersion));
 const intent={Cookie:cookie,'X-ResearchHub-Actor':user.accountId,'X-ResearchHub-Auth-Version':String(user.authVersion),'X-ResearchHub-Request':'asset-catalog-v1'},json={...intent,'Content-Type':'application/json'};
 const response=await call('/research-assets/registrable-sources',{headers:intent}),before=assertAssetRegistrationOptions(await response.json(),{scope,user});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(before.sources.length,2);
 for(const path of ['/research-assets/registrable-sources','/research-assets/catalog'])assert.equal((await call(path,{headers:{...intent,'X-ResearchHub-Actor':ids[actor==='owner'?'admin':'owner']}})).status,409);
 assert.equal((await call('/research-assets',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await call('/research-assets',{method:'POST',headers:json,body:'{"kind":"protocol","kind":"dataset"}'})).status,400);
 assert.equal((await call('/research-assets',{method:'POST',headers:json,body:'{"unknown":"input"}'})).status,400);
 assert.equal((await call('/research-assets',{method:'POST',headers:json,body:JSON.stringify({unknown:'x'.repeat(512*1024)})})).status,413);
 const form=new FormData();form.append('file',new File(['not a permitted asset format'],'rejected-synthetic.pdf',{type:'application/pdf'}));form.append('requestKey','asset-negative-file-'+actor);
 const invalidFile=await call('/research-assets/uploads',{method:'POST',headers:intent,body:form});assert.equal(invalidFile.status,422,JSON.stringify(await invalidFile.json()));
 const missing=await call('/research-assets/operations/asset-negative-never-submitted',{headers:intent});assert.equal(missing.status,200);assert.deepEqual(await missing.json(),{status:'not_found'});
 const after=assertAssetRegistrationOptions(await(await call('/research-assets/registrable-sources',{headers:intent})).json(),{scope,user});assert.deepEqual(after.ownAssets,before.ownAssets);assert.deepEqual(after.pendingUploads,before.pendingUploads);
 checks.push({actor,options200:true,actualSources:before.sources.length,wrongActor409:true,missingIntent403:true,duplicateKey400:true,unknownInput400:true,oversize413:true,invalidFile422:true,originalReceiptNotFound:true,noAssetsOrFilesCreated:true});
}
console.log(JSON.stringify({syntheticOnly:true,realHttp:true,checks,paidModelCalls:0},null,2));
