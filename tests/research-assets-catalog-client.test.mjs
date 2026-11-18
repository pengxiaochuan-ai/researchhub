import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetCatalogClient} from '../src/research-assets-catalog-client.js';
const user={accountId:'owner',authVersion:2},scope={studyGroupId:'group',researchProjectId:'study'};
test('catalog client reuses existing JSON transport while pinning the actor snapshot and exact Study',async()=>{
 const calls=[],api=createAssetCatalogClient({user,scope,fetchImpl:async(url,init)=>{calls.push([url,init]);return new Response('{"total":0}',{headers:{'Content-Type':'application/json'}});}});
 assert.equal((await api.get('/research-assets/catalog?page=1')).total,0);const [url,init]=calls[0];assert.equal(url,'/api/research-assets/catalog?page=1');assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.headers['X-ResearchHub-Actor'],'owner');assert.equal(init.headers['X-ResearchHub-Auth-Version'],'2');assert.equal(init.headers['X-Study-Group-Id'],'group');assert(!init.headers['X-ResearchHub-Request']);
 await assert.rejects(api.get('/knowledge/kbs'));await assert.rejects(api.get('https://other.example/research-assets/catalog'));assert.equal(calls.length,1);
});
test('asset multipart keeps browser boundary and current actor intent; malformed or non-JSON success remains unknown',async()=>{
 const form=new FormData();form.append('requestKey','asset-upload-key');let seen;
 const api=createAssetCatalogClient({user,scope,fetchImpl:async(url,init)=>{seen={url,...init};return new Response('{"status":"pending"}',{headers:{'Content-Type':'application/json'}});}});
 assert.equal((await api.upload('/research-assets/uploads',form)).status,'pending');assert.equal(seen.body,form);assert.equal(seen.headers['X-ResearchHub-Request'],'asset-catalog-v1');assert(!('Content-Type' in seen.headers));assert.equal(seen.headers['X-Research-Project-Id'],'study');
 await assert.rejects(api.upload('/knowledge/imports',form));
 const invalid=createAssetCatalogClient({user,scope,fetchImpl:async()=>new Response('<html>not the API</html>',{headers:{'Content-Type':'text/html'}})});await assert.rejects(invalid.upload('/research-assets/uploads',form),e=>e.status===0);
 const denied=createAssetCatalogClient({user,scope,fetchImpl:async()=>new Response('{"code":"ASSET_CATALOG_IDENTITY_CHANGED","message":"身份变化"}',{status:409,headers:{'Content-Type':'application/json'}})});await assert.rejects(denied.upload('/research-assets/uploads',form),e=>e.status===409&&e.code==='ASSET_CATALOG_IDENTITY_CHANGED');
});
test('only approved asset draft and C04 resource operations enter the pinned transport',async()=>{
 const calls=[],api=createAssetCatalogClient({user,scope,fetchImpl:async(url,init)=>{calls.push([url,init]);return new Response('{"status":"committed"}',{headers:{'Content-Type':'application/json'}});}});
 await api.get('/research-assets/registrable-sources');await api.post('/research-assets',{requestKey:'asset-original-key'});await api.post('/research-assets/asset/versions',{baseVersion:1,expectedRevision:1,requestKey:'asset-revision-key'});
 assert.equal(calls.length,3);assert.equal(calls[1][1].headers['X-ResearchHub-Request'],'asset-catalog-v1');assert.equal(calls[1][1].headers['X-ResearchHub-Actor'],'owner');
 await api.post('/research-assets/asset/releases',{});assert.equal(calls[3][1].headers['X-ResearchHub-Request'],'asset-catalog-v1');
 await assert.rejects(api.post('/research-assets/asset/release',{}));await assert.rejects(api.post('/research-assets/asset/publish',{}));assert.equal(calls.length,4);
});
