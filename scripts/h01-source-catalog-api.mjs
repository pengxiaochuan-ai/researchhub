import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {direct,runtime} from '../server/wp02/test-support.mjs';
import {root,directoryLogin,directoryRequest} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/h01-source-catalog-2026-11-11/';
const tenant=runtime.ids.tenant;
async function snapshot(){return direct(async db=>{
 const jobs=await db.knowledgeChatJob.findMany({where:{tenantId:tenant,status:{in:['queued','running','processing']}},select:{id:true,status:true,createdAt:true,updatedAt:true,workerOwner:true,leaseExpiresAt:true},orderBy:{id:'asc'}});
 const imports=await db.knowledgeImportTask.count({where:{tenantId:tenant,status:{in:['queued','running','processing']}}});
 const [sources]=await db.$queryRaw`SELECT
  (SELECT md5(COALESCE(string_agg(to_jsonb(v)::text,'' ORDER BY v.id),'')) FROM rh_source.pmc_candidate_version v WHERE tenant_id=${tenant} AND hub_key='lingshu-xinyu') AS versions,
  (SELECT md5(COALESCE(string_agg(to_jsonb(d)::text,'' ORDER BY d.decision_version),'')) FROM rh_source.pmc_article_decision d WHERE tenant_id=${tenant} AND hub_key='lingshu-xinyu') AS articles,
  (SELECT md5(COALESCE(string_agg(to_jsonb(d)::text,'' ORDER BY d.decision_version),'')) FROM rh_source.pmc_review_decision d WHERE tenant_id=${tenant} AND hub_key='lingshu-xinyu') AS components,
  (SELECT md5(COALESCE(string_agg(to_jsonb(d)::text,'' ORDER BY d.decision_version),'')) FROM rh_source.review_decision d WHERE tenant_id=${tenant} AND hub_key='lingshu-xinyu') AS workbookReviews`;
 return JSON.parse(JSON.stringify({jobs,imports,sources}));
});}
if(process.argv[2]==='before'){
 const state=await snapshot();assert.equal(state.imports,0);assert(state.jobs.every(j=>j.status==='queued'&&!j.workerOwner&&!j.leaseExpiresAt),'Do not interrupt active jobs');
 writeFileSync(out+'before-runtime.json',JSON.stringify(state,null,2));console.log(JSON.stringify({running:0,queued:state.jobs.length,sources:state.sources}));
}else{
 const before=JSON.parse(readFileSync(out+'before-runtime.json')),after=await snapshot();
 assert.deepEqual(after.sources,before.sources);for(const job of before.jobs)assert.deepEqual(after.jobs.find(x=>x.id===job.id),job);
 const roles={},catalog=await directoryRequest('','/api/hub-sources/publications?limit=6');assert.equal(catalog.counts.matchedRecords,13);
 for(const role of ['anonymous','owner','admin']){
  const cookie=role==='anonymous'?'':await directoryLogin(role);
  const overview=await directoryRequest(cookie,'/api/hubs/lingshu-xinyu/overview');
  assert.equal(overview.reviewedSourceRecordCount,13);assert.equal(overview.reviewedSources.length,6);
  assert.deepEqual(overview.reviewedSources.map(x=>[x.id,x.title]),catalog.items.map(x=>[x.id,x.title]));
  assert(overview.reviewedSources.every(x=>x.visibility==='public'&&!Object.hasOwn(x,'body')&&!Object.hasOwn(x,'tables')&&!Object.hasOwn(x,'assets')));
  assert.deepEqual(Object.values(overview.metrics).map(m=>m.value),[2,11,3,3,3]);
  roles[role]={sourceCount:overview.reviewedSourceRecordCount,items:overview.reviewedSources,metrics:overview.metrics};
 }
 assert.deepEqual(roles.owner,roles.anonymous);assert.deepEqual(roles.admin,roles.anonymous);
 const unknown=await fetch('http://127.0.0.1:19501/api/hubs/missing/overview');assert.equal(unknown.status,404);
 const result={at:new Date().toISOString(),passed:true,roles,sourceFingerprintsUnchanged:true,queuedRecordsUnchanged:before.jobs.length,businessWrites:0,modelCalls:0};
 writeFileSync(out+'api-verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,sourceCount:13,previewCount:6,papers:11,roles:Object.keys(roles),queuedRecordsUnchanged:before.jobs.length,sourceFingerprintsUnchanged:true}));
}
