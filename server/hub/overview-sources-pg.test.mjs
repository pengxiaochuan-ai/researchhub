import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withRollback,runtime} from '../wp02/test-support.mjs';
import {readOverviewSources} from './overview-sources.mjs';
const tenantId=runtime.ids.tenant,hubKey='lingshu-xinyu';

test('real PG overview reads thirteen current public PMC records with six metadata-only previews',async()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const result=await readOverviewSources({db,tenantId,hubKey});
 assert.equal(result.recordCount,13);assert.equal(result.items.length,6);
 assert.deepEqual(result.items.map(x=>x.id),['PMC13522945','PMC13527223','PMC13539995','PMC13550960','PMC13557252','PMC13565737'].map(x=>'pmc-'+x));
 assert(result.items.every(x=>x.sourceName==='PubMed Central'&&x.reviewVersion.startsWith('article:')));
 assert(result.items.every(x=>!Object.hasOwn(x,'body')&&!Object.hasOwn(x,'tables')&&!Object.hasOwn(x,'assets')));
 await assert.rejects(()=>readOverviewSources({db,tenantId:'other',hubKey}),/HUB_SOURCE_SCOPE_REJECTED/);
 await assert.rejects(()=>readOverviewSources({db,tenantId,hubKey:'other'}),/HUB_SOURCE_SCOPE_REJECTED/);
})));

test('real PG private or withheld articles and unreviewed newer versions disappear from public preview and count; rollback only',async()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 const [version]=await db.$queryRaw`SELECT v.id FROM rh_source.pmc_candidate_version v JOIN rh_source.pmc_candidate c ON c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key AND c.id=v.candidate_id WHERE c.tenant_id=${tenantId} AND c.hub_key=${hubKey} AND c.pmcid='PMC13522945' ORDER BY v.staged_at DESC,v.id DESC LIMIT 1`;
 for(const visibility of ['tenant','withheld','public']){
  await db.$executeRaw`INSERT INTO rh_source.pmc_article_decision(tenant_id,hub_key,version_id,visibility,reviewer_id) VALUES(${tenantId},${hubKey},${version.id},${visibility},${runtime.ids.admin})`;
  const result=await readOverviewSources({db,tenantId,hubKey});
  assert.equal(result.recordCount,visibility==='public'?13:12);assert.equal(result.items.some(x=>x.id==='pmc-PMC13522945'),visibility==='public');
 }
 await db.$executeRaw`SAVEPOINT newer_source`;
 await db.$executeRaw`INSERT INTO rh_source.pmc_candidate_version SELECT (jsonb_populate_record(NULL::rh_source.pmc_candidate_version,to_jsonb(v)||jsonb_build_object('id',${randomUUID()}::text,'article_version','PMC13522945.2','staged_at',clock_timestamp()+interval '1 second'))).* FROM rh_source.pmc_candidate_version v WHERE v.id=${version.id} AND v.tenant_id=${tenantId}`;
 const newer=await readOverviewSources({db,tenantId,hubKey});assert.equal(newer.recordCount,12);assert(!newer.items.some(x=>x.id==='pmc-PMC13522945'));
 await db.$executeRaw`ROLLBACK TO SAVEPOINT newer_source`;
 await db.$executeRaw`RELEASE SAVEPOINT newer_source`;
 await db.$executeRaw`UPDATE rh_source.pmc_article_decision SET visibility='withheld' WHERE tenant_id=${tenantId} AND hub_key=${hubKey}`;
 const empty=await readOverviewSources({db,tenantId,hubKey});assert.equal(empty.recordCount,0);assert.deepEqual(empty.items,[]);
})));
