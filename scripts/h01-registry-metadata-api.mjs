import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {direct,runtime} from '../server/wp02/test-support.mjs';
import {directoryLogin,directoryRequest} from './directory-runtime.mjs';
import {getCurrentExternalAiHit} from '../server/hub-sources/external-visible.mjs';
const out=new URL('../docs/testing/evidence/h01-registry-metadata-2026-11-11/',import.meta.url),t=runtime.ids.tenant;
const save=(name,value)=>writeFileSync(new URL(name,out),JSON.stringify(value,null,2));
async function snapshot(){return direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${t},true)`;
 const [hashes]=await db.$queryRaw`SELECT
  (SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY x.id),'')) FROM rh_source.external_document x WHERE tenant_id=${t}) AS documents,
  (SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY x.id),'')) FROM rh_source.external_document_version x WHERE tenant_id=${t}) AS sourceVersions,
  (SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY x.version_id),'')) FROM rh_source.external_document_payload x WHERE tenant_id=${t}) AS sourceBytes,
  (SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY x.id),'')) FROM rh_source.clinical_registry_extraction x WHERE tenant_id=${t} AND extraction_version=1) AS legacyExtractions,
  (SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY x.event_version),'')) FROM rh_source.review_grant_event x WHERE tenant_id=${t}) AS grants`;
 const reviews=await db.$queryRaw`SELECT decision_version::text AS id,version_id AS object,md5(to_jsonb(r)::text) AS hash FROM rh_source.external_review_decision r WHERE tenant_id=${t} ORDER BY decision_version`;
 const detailReviews=await db.$queryRaw`SELECT decision_version::text AS id,extraction_id AS object,md5(to_jsonb(r)::text) AS hash FROM rh_source.clinical_registry_detail_review r WHERE tenant_id=${t} ORDER BY decision_version`;
 const extractions=await db.$queryRaw`SELECT id,version_id AS "versionId",extraction_version AS version,payload_sha256 AS hash FROM rh_source.clinical_registry_extraction WHERE tenant_id=${t} ORDER BY id`;
 const jobs=await db.knowledgeChatJob.findMany({where:{tenantId:t,status:{in:['queued','running','processing']}},select:{id:true,status:true,createdAt:true,updatedAt:true,workerOwner:true,leaseExpiresAt:true},orderBy:{id:'asc'}});
 const imports=await db.knowledgeImportTask.count({where:{tenantId:t,status:{in:['queued','running','processing']}}});
 const account=await db.account.findFirst({where:{id:runtime.ids.owner,tenantId:t},select:{authVersion:true}});
 const principal={accountId:runtime.ids.owner,tenantId:t,authVersion:account.authVersion};
 const documents=await db.$queryRaw`SELECT id FROM rh_source.external_document WHERE tenant_id=${t} AND document_type='clinical_registry' ORDER BY external_key`;
 const ai=[];for(const d of documents){const hit=await getCurrentExternalAiHit({db,tenantId:t,hubKey:'lingshu-xinyu',principal,documentId:d.id});ai.push({id:d.id,snippet:hit?.snippet??null,snippetField:hit?.snippetField??null});}
 return JSON.parse(JSON.stringify({hashes,reviews,detailReviews,extractions,jobs,imports,ai}));
});}
if(['before','before-display'].includes(process.argv[2])){
 const state=await snapshot();assert.equal(state.imports,0);assert(state.jobs.every(j=>j.status==='queued'&&!j.workerOwner&&!j.leaseExpiresAt),'Active work: do not reload local runtime');
 save(process.argv[2]==='before'?'implementation-before-runtime.json':'display-before-runtime.json',state);
 console.log(JSON.stringify({readyForLocalReload:true,queued:state.jobs.length,active:0,oldExtractions:state.extractions.length}));
}else if(process.argv[2]==='verify'){
 const before=JSON.parse(readFileSync(new URL('implementation-before-runtime.json',out))),after=await snapshot();
 const displayBefore=JSON.parse(readFileSync(new URL('display-before-runtime.json',out)));
 assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.ai,before.ai);
 for(const key of ['reviews','detailReviews','extractions','jobs'])for(const row of before[key])assert.deepEqual(after[key].find(x=>x.id===row.id),row,key+' original row preserved');
 const appended=(key)=>after[key].filter(x=>!before[key].some(y=>y.id===x.id));
 assert.equal(appended('extractions').length,2);assert(appended('extractions').every(x=>x.version===2));
 assert.equal(appended('reviews').length,7);assert.equal(appended('detailReviews').length,4);
 for(const key of ['reviews','detailReviews','extractions','jobs'])for(const row of displayBefore[key])assert.deepEqual(after[key].find(x=>x.id===row.id),row,'display recovery preserves '+key);
 const recoveryReviews=after.reviews.filter(x=>!displayBefore.reviews.some(y=>y.id===x.id));
 const recoveryDetails=after.detailReviews.filter(x=>!displayBefore.detailReviews.some(y=>y.id===x.id));
 assert.equal(recoveryReviews.length,1);assert.equal(recoveryDetails.length,1);
 assert.deepEqual(after.extractions,displayBefore.extractions);assert.deepEqual(after.ai,displayBefore.ai);
 const [recovery]=await direct(db=>db.$queryRaw`SELECT field_kind,purpose,decision,audience,reviewer_id AS reviewer,evidence_ref FROM rh_source.external_review_decision WHERE tenant_id=${t} AND decision_version=${BigInt(recoveryReviews[0].id)}`);
 assert.equal(recovery.field_kind,'bibliographic');assert.equal(recovery.purpose,'display');assert.equal(recovery.decision,'approve');assert.equal(recovery.audience,'public');
 assert.equal(recovery.reviewer,runtime.ids.admin);assert.match(recovery.evidence_ref,/^evidence:\/\/hub-display\//);
 const roles={};
 for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role),data=await directoryRequest(cookie,'/api/hubs/lingshu-xinyu/overview');
  assert.equal(data.clinicalRegistries.length,2);assert.equal(data.metrics.registrations.value,2);assert.equal(data.metrics.publications.value,11);
  for(const [i,item] of data.clinicalRegistries.entries()){
   assert.equal(item.registrationSummaryStatus,'approved');const s=item.registrationSummary;
   assert.equal(s.registeredOn.value,i===0?'2023-07-12':'2023-11-01');assert.equal(s.leadInstitution.value,'中国中医科学院针灸研究所');
   assert.equal(s.registrationStatus.value,'预注册');assert.equal(s.researchStatus,'not_reported');assert.equal(s.registeredOn.source.line,113);
   const detail=(await directoryRequest(cookie,'/api/hub-sources/clinical-registries/'+item.documentId)).item;
   assert.equal(detail.structuredDetails.schemaVersion,2);assert.deepEqual(detail.structuredDetails.registration[0],s.registeredOn);
   const review=await direct(db=>db.$queryRaw`SELECT reviewer_id AS reviewer,decision FROM rh_source.clinical_registry_detail_review WHERE tenant_id=${t} AND extraction_id=${s.extractionId} ORDER BY decision_version DESC LIMIT 1`);
   assert.equal(review[0].reviewer,runtime.ids.admin);assert.equal(review[0].decision,'approve');
  }
  roles[role]=data.clinicalRegistries;
 }
 assert.deepEqual(roles.owner,roles.anonymous);assert.deepEqual(roles.admin,roles.anonymous);
 const result={at:new Date().toISOString(),passed:true,roles,oldSourcesAndV1AndGrantsPreserved:true,oldReviewsPreserved:true,oldAiTextUnchanged:true,queuedPreserved:before.jobs.length,
  recoveryReviews,recoveryDetails,newExtractions:appended('extractions'),newBibliographicDecisions:appended('reviews'),newDetailDecisions:appended('detailReviews'),modelCalls:0};
 save('api-verification.json',result);console.log(JSON.stringify({passed:true,roles:Object.keys(roles),newExtractions:2,newDecisions:11,recoveryDecisions:2,queuedPreserved:before.jobs.length,oldAiTextUnchanged:true,modelCalls:0}));
}else throw Error('Use before|before-display|verify; no source review writes are performed by this verifier');
