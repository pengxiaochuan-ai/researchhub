import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readOverviewMetrics} from './metrics.mjs';
import {createDirectoryService} from '../directory/commands.mjs';
import {directoryRollback} from '../directory/test-support.mjs';
import {withRollback,runtime} from '../wp02/test-support.mjs';
const t=runtime.ids.tenant,h='lingshu-xinyu';
async function read(tx){await tx.$executeRaw`SELECT set_config('app.tenant_id',${t},true),set_config('app.hub_key',${h},true),set_config('app.account_id','',true),set_config('app.auth_version','',true)`;return readOverviewMetrics({db:tx,tenantId:t,hubKey:h});}

test('real PG directory counts only public current valid profiles; rollback preserves all existing records',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct,rowId,sourceId})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),before=await direct(read);
 const entities=[];
 for(const kind of ['organization','researcher']){
  const e=await s.createEntity(admin,{kind,stableKey:'h01-metrics-'+kind+'-'+suffix,requestKey:randomUUID()});
  const body={kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'H01合成统计-'+kind,directions:[]},provenance,requestKey:randomUUID()};
  const a=await s.appendAssertion(admin,e.id,body);entities.push({e,a,body});
 }
 assert.deepEqual(await direct(read),before);
 const approve=async(a,expectedDecisionVersion=0,audience='public')=>s.decide(admin,a.id,{expectedDecisionVersion,assertionHash:a.hash,decision:'approve',audience,reason:'H01新具名回滚夹具',requestKey:randomUUID()});
 const [org,person]=entities;
 await approve(org.a);await approve(person.a);
 let m=await direct(read);assert.equal(m.institutions.value,before.institutions.value+1);assert.equal(m.researchers.value,before.researchers.value+1);
 await approve(person.a,1,'tenant');m=await direct(read);assert.equal(m.researchers.value,before.researchers.value);
 await approve(person.a,2);
 await s.appendAssertion(admin,person.e.id,{...person.body,expectedRevision:1,payload:{name:'待审核新版本'},requestKey:randomUUID()});
 assert.equal((await direct(read)).researchers.value,before.researchers.value);
 await s.decide(admin,org.a.id,{expectedDecisionVersion:1,assertionHash:org.a.hash,decision:'revoke',audience:'none',reason:'H01回滚撤审',requestKey:randomUUID()});
 assert.equal((await direct(read)).institutions.value,before.institutions.value);
 await approve(org.a,2);
 // Expire only the freshly created synthetic decision; no persistent edit.
 await direct(tx=>tx.$executeRaw`UPDATE rh_directory.decision SET created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' WHERE tenant_id=${t} AND assertion_id=${org.a.id} AND decision_version=3`);
 assert.equal((await direct(read)).institutions.value,before.institutions.value);
 await approve(org.a,3);
 await direct(tx=>tx.$executeRaw`UPDATE rh_directory.entity SET archived_at=clock_timestamp() WHERE tenant_id=${t} AND id=${org.e.id}`);
 assert.equal((await direct(read)).institutions.value,before.institutions.value);
 await direct(tx=>tx.$executeRaw`UPDATE rh_directory.entity SET archived_at=NULL WHERE tenant_id=${t} AND id=${org.e.id}`);
 await direct(tx=>tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${t},${h},${sourceId},${rowId},'abstract','display','public','revoke','evidence://h01-metrics-rollback',${admin.user.accountId},1)`);
 assert.equal((await direct(read)).institutions.value,before.institutions.value);
}));

test('real PG initial registry count follows latest display decision, expiry and source version, never AI grant alone',async()=>withRollback(async({direct})=>{
 const before=await direct(read);assert.equal(before.registrations.value,2);assert.equal(before.guides.value,3);
 await direct(async tx=>{
  const [v]=await tx.$queryRaw`SELECT v.id FROM rh_source.external_document d JOIN rh_source.external_document_version v ON v.tenant_id=d.tenant_id AND v.hub_key=d.hub_key AND v.document_id=d.id WHERE d.tenant_id=${t} AND d.hub_key=${h} AND d.external_key='ChiCTR2300073486' ORDER BY v.version_number DESC LIMIT 1`;
  const decision=async(decision,audience='public',expiresAt=null)=>tx.$executeRaw`INSERT INTO rh_source.external_review_decision(tenant_id,hub_key,version_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,expires_at) VALUES(${t},${h},${v.id},'bibliographic','display',${audience},${decision},'evidence://h01-metrics-rollback',${runtime.ids.admin},${expiresAt}::timestamptz)`;
  await decision('revoke');assert.equal((await read(tx)).registrations.value,1);
  await decision('approve','tenant');assert.equal((await read(tx)).registrations.value,1);
  await decision('approve','public',new Date('2000-01-01'));assert.equal((await read(tx)).registrations.value,1);
  await decision('approve');assert.equal((await read(tx)).registrations.value,2);
  await tx.$executeRaw`INSERT INTO rh_source.external_document_version(id,tenant_id,hub_key,document_id,version_number,file_name,mime_type,content_sha256,source_url,metadata,imported_by) SELECT ${'h01-metrics-'+randomUUID()},tenant_id,hub_key,document_id,version_number+1,file_name,mime_type,${randomUUID().replaceAll('-','').repeat(2)},source_url,metadata,imported_by FROM rh_source.external_document_version WHERE tenant_id=${t} AND id=${v.id}`;
  assert.equal((await read(tx)).registrations.value,1);
 });
}));

test('real PG aggregate rejects mismatched scope; inactive tenant/Hub cannot expose metrics',async()=>withRollback(async({direct})=>{
 await direct(async tx=>{
  await read(tx);
  await assert.rejects(()=>readOverviewMetrics({db:tx,tenantId:'other-tenant',hubKey:h}),/HUB_SCOPE_REJECTED/);
  await assert.rejects(()=>readOverviewMetrics({db:tx,tenantId:t,hubKey:'another-hub'}),/HUB_SCOPE_REJECTED/);
  await tx.$executeRaw`UPDATE rh_hub.hub SET status='archived' WHERE tenant_id=${t} AND hub_key=${h}`;
  assert.equal(await read(tx),null);
  await tx.$executeRaw`UPDATE rh_hub.hub SET status='active' WHERE tenant_id=${t} AND hub_key=${h}`;
  await tx.$executeRaw`UPDATE public.tenant SET status='suspended' WHERE id=${t}`;
  assert.equal(await read(tx),null);
 });
}));
