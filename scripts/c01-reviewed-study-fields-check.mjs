import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {direct,runtime} from '../server/wp02/test-support.mjs';
import {getCurrentExternalAiHit} from '../server/hub-sources/external-visible.mjs';
import {directoryLogin,directoryRequest} from './directory-runtime.mjs';
const dir=new URL('../docs/testing/evidence/c01-reviewed-study-fields-2026-11-11/',import.meta.url),tenantId=runtime.ids.tenant,hubKey='lingshu-xinyu';
const save=(name,data)=>writeFileSync(new URL(name,dir),JSON.stringify(data,null,2));
export async function clinicalSourceSnapshot(){return direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const [hashes]=await db.$queryRaw`SELECT
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM rh_source.external_document x WHERE tenant_id=${tenantId}) AS documents,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM rh_source.external_document_version x WHERE tenant_id=${tenantId}) AS versions,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM rh_source.clinical_registry_extraction x WHERE tenant_id=${tenantId}) AS extractions,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY decision_version)) FROM rh_source.external_review_decision x WHERE tenant_id=${tenantId}) AS reviews,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY decision_version)) FROM rh_source.clinical_registry_detail_review x WHERE tenant_id=${tenantId}) AS detailReviews,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY event_version)) FROM rh_source.review_grant_event x WHERE tenant_id=${tenantId}) AS grants`;
 const jobs=await db.knowledgeChatJob.findMany({where:{tenantId,status:{in:['queued','running','processing']}},select:{id:true,status:true,updatedAt:true,workerOwner:true,leaseExpiresAt:true},orderBy:{id:'asc'}});
 const imports=await db.knowledgeImportTask.count({where:{tenantId,status:{in:['queued','running','processing']}}});
 const account=await db.account.findFirst({where:{id:runtime.ids.owner,tenantId},select:{authVersion:true}});
 const documents=await db.$queryRaw`SELECT id FROM rh_source.external_document WHERE tenant_id=${tenantId} AND document_type='clinical_registry' ORDER BY external_key`;
 const ai=[];for(const doc of documents){const x=await getCurrentExternalAiHit({db,tenantId,hubKey,principal:{tenantId,accountId:runtime.ids.owner,authVersion:account.authVersion},documentId:doc.id});ai.push({id:doc.id,snippet:x?.snippet??null,snippetField:x?.snippetField??null});}
 return JSON.parse(JSON.stringify({hashes,jobs,imports,ai}));
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){
if(process.argv[2]==='before'){
 const value=await clinicalSourceSnapshot();assert.equal(value.imports,0);assert(value.jobs.every(x=>x.status==='queued'&&!x.workerOwner&&!x.leaseExpiresAt));
 save('before-api.json',value);console.log(JSON.stringify({safeOwnedReload:true,queued:value.jobs.length,active:0}));
}else if(process.argv[2]==='verify'){
 const before=JSON.parse(readFileSync(new URL('before-api.json',dir))),after=await clinicalSourceSnapshot();
 assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.ai,before.ai);
 for(const job of before.jobs)assert.deepEqual(after.jobs.find(x=>x.id===job.id),job);
 const roles={};for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role),list=await directoryRequest(cookie,'/api/hub-sources/clinical-registries');
  assert.equal(list.items.length,2);
  for(const [i,x]of list.items.entries()){
   assert.equal(x.studySummaryStatus,'approved');assert.equal(x.studySummary.studyType.value,'干预性研究');
   assert.equal(x.studySummary.leadInstitution.value,'中国中医科学院针灸研究所');assert.equal(x.studySummary.interventions.length,i===0?4:2);
   const detail=(await directoryRequest(cookie,'/api/hub-sources/clinical-registries/'+x.documentId)).item.structuredDetails;
   assert.deepEqual(x.studySummary.studyType,detail.design[0]);assert.deepEqual(x.studySummary.interventions,detail.arms.map(x=>({id:x.id,intervention:x.intervention})));
   assert.equal(x.studySummary.payloadSha256,detail.payloadSha256);assert.equal(x.studySummary.reviewVersion,detail.reviewVersion);
  }roles[role]=list.items;
 }assert.deepEqual(roles.anonymous,roles.owner);assert.deepEqual(roles.owner,roles.admin);
 save('api-verification.json',{at:new Date().toISOString(),passed:true,sourceAndReviewHashesUnchanged:true,aiUnchanged:true,queuedPreserved:before.jobs.length,roles,modelCalls:0});
 console.log(JSON.stringify({passed:true,roles:Object.keys(roles),sourceAndReviewHashesUnchanged:true,aiUnchanged:true,queuedPreserved:before.jobs.length,modelCalls:0}));
}else throw Error('Use before|verify; this script never writes source data or review decisions');
}
