import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withRollback,runtime} from '../wp02/test-support.mjs';
import {readPublicationIndex} from './publication-index.mjs';
const t=runtime.ids.tenant,h='lingshu-xinyu';
const setup=tx=>tx.$executeRaw`SELECT set_config('app.tenant_id',${t},true),set_config('app.hub_key',${h},true)`;
test('real PG current public evidence gives eleven included, no pending and two excluded with distinct typed provenance',async()=>withRollback(async({direct})=>direct(async tx=>{
 await setup(tx);const m=await readPublicationIndex({db:tx,tenantId:t,hubKey:h});
 assert.equal(m.value,11);assert.equal(m.pendingVisibleCount,0);assert.equal(m.excludedVisibleCount,2);
 assert.equal(m.byType.human_clinical,1);assert.equal(m.byType.animal_mechanism,2);assert.equal(m.byType.bibliometric,1);
 assert.equal(m.byType.review,3);assert.equal(m.byType.systematic_review,1);assert.equal(m.byType.case_report,2);assert.equal(m.byType.protocol,1);
 assert.equal(new Set(m.included.map(x=>x.paperKey)).size,11);
 for(const id of ['pmc-PMC13550960','pmc-PMC13637160'])assert(m.included.some(p=>p.sources.some(s=>s.recordId===id&&s.evidence.some(e=>e.field==='abstract'))));
 await assert.rejects(()=>readPublicationIndex({db:tx,tenantId:'other',hubKey:h}),/HUB_SCOPE_REJECTED/);
})));
test('real PG public withdrawal/private/new version or changed content immediately stops supporting inclusion; all changes roll back',async()=>withRollback(async({direct})=>direct(async tx=>{
 await setup(tx);
 const [v]=await tx.$queryRaw`SELECT v.id FROM rh_source.pmc_candidate_version v JOIN rh_source.pmc_candidate c ON c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key AND c.id=v.candidate_id WHERE c.tenant_id=${t} AND c.hub_key=${h} AND c.pmcid='PMC13691533' ORDER BY v.staged_at DESC,v.id DESC LIMIT 1`;
 const read=()=>readPublicationIndex({db:tx,tenantId:t,hubKey:h});assert.equal((await read()).value,11);
 for(const visibility of ['tenant','withheld','public']){
  await tx.$executeRaw`INSERT INTO rh_source.pmc_article_decision(tenant_id,hub_key,version_id,visibility,reviewer_id) VALUES(${t},${h},${v.id},${visibility},${runtime.ids.admin})`;
  const m=await read();assert.equal(m.value,visibility==='public'?11:10);
  assert.equal(m.included.some(p=>p.sources.some(s=>s.recordId==='pmc-PMC13691533')),visibility==='public');
 }
 await tx.$executeRaw`UPDATE rh_source.pmc_candidate_version SET raw_sha256=${'e'.repeat(64)} WHERE tenant_id=${t} AND id=${v.id}`;
 assert.equal((await read()).value,10);assert.equal((await read()).pendingVisibleCount,1);
 await tx.$executeRaw`UPDATE rh_source.pmc_candidate_version SET raw_sha256='48556afca3235223e18adf8f82b03b46223d34b3af29be13a0b0e01a80944967',article_version='PMC13691533.2' WHERE tenant_id=${t} AND id=${v.id}`;
 assert.equal((await read()).value,10);
 await tx.$executeRaw`UPDATE rh_source.pmc_candidate_version SET article_version='PMC13691533.1',abstract_text=NULL WHERE tenant_id=${t} AND id=${v.id}`;
 assert.equal((await read()).value,10);assert.equal((await read()).pendingVisibleCount,1);
})));
test('real PG secondary-outcome inclusion still requires each current abstract and version; rollback only',async()=>withRollback(async({direct})=>direct(async tx=>{
 await setup(tx);
 for(const id of ['PMC13550960','PMC13637160']){
  await tx.$executeRaw`SAVEPOINT secondary_evidence`;
  await tx.$executeRaw`UPDATE rh_source.pmc_candidate_version v SET abstract_text=NULL FROM rh_source.pmc_candidate c WHERE c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key AND c.id=v.candidate_id AND c.tenant_id=${t} AND c.hub_key=${h} AND c.pmcid=${id}`;
  const changed=await readPublicationIndex({db:tx,tenantId:t,hubKey:h});assert.equal(changed.value,10);assert.equal(changed.pendingVisibleCount,1);
  await tx.$executeRaw`ROLLBACK TO SAVEPOINT secondary_evidence`;
  await tx.$executeRaw`UPDATE rh_source.pmc_candidate_version v SET article_version=${id+'.2'} FROM rh_source.pmc_candidate c WHERE c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key AND c.id=v.candidate_id AND c.tenant_id=${t} AND c.hub_key=${h} AND c.pmcid=${id}`;
  const versioned=await readPublicationIndex({db:tx,tenantId:t,hubKey:h});assert.equal(versioned.value,10);assert.equal(versioned.pendingVisibleCount,1);
  await tx.$executeRaw`ROLLBACK TO SAVEPOINT secondary_evidence`;
  await tx.$executeRaw`RELEASE SAVEPOINT secondary_evidence`;
 }
})));
test('real PG a duplicate PMC identifier beyond the current pilot projection fails closed instead of silently truncating',async()=>withRollback(async({direct})=>direct(async tx=>{
 await setup(tx);
 // Fresh rollback-only run: simulate a second run's candidate incorrectly
 // appearing in the first pilot. Same-run uniqueness remains enforced.
 const run='h01-paper-test-'+randomUUID();
 await tx.$executeRaw`INSERT INTO rh_source.pmc_run(id,tenant_id,hub_key,campaign_key,query_sha256,query_text,keyword_version) VALUES(${run},${t},${h},'pmc-first-2099-12-31',${'0'.repeat(64)},'synthetic only; no requests','h01-test')`;
 await tx.$executeRaw`INSERT INTO rh_source.pmc_candidate(id,tenant_id,hub_key,run_id,campaign_key,pmcid,selected_rank) VALUES(${'h01-paper-candidate-'+randomUUID()},${t},${h},${run},'pmc-first-2026-10-31','PMC13691533',1)`;
 const m=await readPublicationIndex({db:tx,tenantId:t,hubKey:h});assert.equal(m.value,null);assert.equal(m.basis,'INCOMPLETE_PILOT_INDEX');
})));
