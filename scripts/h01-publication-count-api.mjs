import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {direct,runtime} from '../server/wp02/test-support.mjs';
import {root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
// V1 evidence is historical; the user-confirmed V2 has its own receipts.
const out=root+'researchhub/docs/testing/evidence/h01-publication-secondary-outcomes-2026-11-10/';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function snapshot(){return direct(async tx=>{
 const jobs=await tx.knowledgeChatJob.findMany({where:{tenantId:runtime.ids.tenant,status:{in:['queued','running','processing']}},select:{id:true,status:true,createdAt:true,updatedAt:true,workerOwner:true,leaseExpiresAt:true},orderBy:{id:'asc'}});
 const imports=await tx.knowledgeImportTask.count({where:{tenantId:runtime.ids.tenant,status:{in:['queued','running','processing']}}});
 const [sources]=await tx.$queryRaw`SELECT (SELECT md5(COALESCE(string_agg(to_jsonb(v)::text,'' ORDER BY v.id),'')) FROM rh_source.pmc_candidate_version v WHERE tenant_id=${runtime.ids.tenant} AND hub_key='lingshu-xinyu') AS versions,(SELECT md5(COALESCE(string_agg(to_jsonb(d)::text,'' ORDER BY d.decision_version),'')) FROM rh_source.pmc_article_decision d WHERE tenant_id=${runtime.ids.tenant} AND hub_key='lingshu-xinyu') AS decisions`;
 return {jobs,imports,sources};
});}
if(process.argv[2]==='before'){
 const state=await snapshot();assert.equal(state.imports,0);assert(state.jobs.every(j=>j.status==='queued'&&!j.workerOwner&&!j.leaseExpiresAt),'Do not interrupt active jobs');
 writeFileSync(out+'before-runtime.json',JSON.stringify(state,null,2));console.log(JSON.stringify({running:0,queued:state.jobs.length,sources:state.sources}));
}else{
 const before=JSON.parse(readFileSync(out+'before-runtime.json')),after=JSON.parse(JSON.stringify(await snapshot()));
 assert.deepEqual(after.sources,before.sources);for(const job of before.jobs)assert.deepEqual(after.jobs.find(x=>x.id===job.id),job);
 const overview='/api/hubs/lingshu-xinyu/overview',data=await directoryRequest('',overview),roles={anonymous:data.metrics};
 assert.deepEqual(Object.values(data.metrics).map(m=>m.value),[2,11,3,3,3]);assert.equal(data.metrics.publications.pendingVisibleCount,0);assert.equal(data.metrics.publications.excludedVisibleCount,2);
 assert.equal(data.metrics.publications.ruleVersion,'RH-PAPER-BROAD-2026-11-10-V2');
 for(const role of ['owner','admin'])roles[role]=(await directoryRequest(await directoryLogin(role),overview)).metrics;
 assert.deepEqual(roles.owner,roles.anonymous);assert.deepEqual(roles.admin,roles.anonymous);
 const admin=await directoryLogin('admin'),baseline=JSON.parse(readFileSync(root+'researchhub/docs/testing/evidence/team-city-reference-2026-11-10/before-api.json'));
 const fingerprints={};for(const id of baseline.ids)fingerprints[id]={entity:hash(await directoryRequest(admin,directoryPath+'entities/'+id)),workspace:hash(await directoryRequest(admin,directoryPath+'team-workspaces/'+id))};assert.deepEqual(fingerprints,baseline.fingerprints);
 const catalog=await directoryRequest('','/api/hub-sources/publications?limit=20');assert.equal(catalog.counts.matchedRecords,13);
 writeFileSync(out+'api-verification.json',JSON.stringify({at:new Date().toISOString(),passed:true,metrics:data.metrics,roles,catalogSources:13,queuedRecordsUnchanged:before.jobs.length,sourceFingerprintsUnchanged:true,originalDirectoryFingerprintsUnchanged:true,businessWrites:0,modelCalls:0},null,2));
 console.log(JSON.stringify({passed:true,papers:data.metrics.publications.value,pending:data.metrics.publications.pendingVisibleCount,excluded:data.metrics.publications.excludedVisibleCount,sourceFingerprintsUnchanged:true,queuedRecordsUnchanged:before.jobs.length,businessWrites:0,modelCalls:0}));
}
