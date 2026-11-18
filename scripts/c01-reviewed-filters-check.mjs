import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {clinicalSourceSnapshot} from './c01-reviewed-study-fields-check.mjs';
import {directoryLogin,directoryRequest} from './directory-runtime.mjs';
import {clinicalRegistryOptions,filterClinicalRegistries} from '../src/clinical-registry-filters.js';
const dir=new URL('../docs/testing/evidence/c01-reviewed-filters-2026-11-11/',import.meta.url);
if(process.argv[2]==='before'){
 const before=await clinicalSourceSnapshot();writeFileSync(new URL('before-api.json',dir),JSON.stringify(before,null,2));
 console.log(JSON.stringify({snapshotSaved:true,queued:before.jobs.length,restartRequired:false}));
}else if(process.argv[2]==='verify'){
 const before=JSON.parse(readFileSync(new URL('before-api.json',dir))),after=await clinicalSourceSnapshot();
 assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.ai,before.ai);
 for(const row of before.jobs)assert.deepEqual(after.jobs.find(x=>x.id===row.id),row);
 const roles={};for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role);
  const {items}=await directoryRequest(cookie,'/api/hub-sources/clinical-registries');
  assert.equal(items.length,2);const options=clinicalRegistryOptions(items);
  assert.deepEqual(options.studyType,['干预性研究']);assert.deepEqual(options.disease,['抑郁症','轻度认知障碍']);assert.equal(options.intervention.length,6);
  assert.equal(filterClinicalRegistries(items,{studyType:options.studyType[0]}).length,2);
  assert.equal(filterClinicalRegistries(items,{disease:options.disease[0],intervention:options.intervention[0]}).length,1);
  assert.equal(filterClinicalRegistries(items,{disease:options.disease[1],intervention:options.intervention[0]}).length,0);
  roles[role]={items,options};
 }assert.deepEqual(roles.owner,roles.anonymous);assert.deepEqual(roles.owner,roles.admin);
 const result={at:new Date().toISOString(),passed:true,roles,sourceAndReviewUnchanged:true,aiUnchanged:true,queuedPreserved:before.jobs.length,modelCalls:0};
 writeFileSync(new URL('api-verification.json',dir),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,roles:Object.keys(roles),queuedPreserved:before.jobs.length,sourceAndReviewUnchanged:true,aiUnchanged:true,modelCalls:0}));
}else throw Error('Use before|verify; no data or review writes');
