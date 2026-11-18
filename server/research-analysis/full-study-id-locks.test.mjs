import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {memoizeFullStudyIdLocks} from './full-study-id-locks.mjs';

const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
function fixture(){
 const calls=[];
 const tx={
  async $queryRaw(strings,...params){
   assert.equal(this,tx);const sql=strings.join('?');calls.push({method:'query',sql,params});
   if(sql.includes('FROM public.research_project'))return[{id:params[0]}];
   if(sql.includes('FROM public.study_protocol_version'))return params[3].map(id=>({id}));
   if(sql.includes('FROM public.subject '))return(sql.includes('id=ANY(')?params[3]:[params[0]]).map(id=>({id}));
   return[{id:'source',status:'active'}];
  },
  async $executeRaw(strings,...params){assert.equal(this,tx);calls.push({method:'execute',sql:strings.join('?'),params});return 1;},
  async $queryRawUnsafe(...params){assert.equal(this,tx);calls.push({method:'unsafe-query',params});return[];},
  async $executeRawUnsafe(...params){assert.equal(this,tx);calls.push({method:'unsafe-execute',params});return 1;},
  formResponse:{async findFirst(){assert.equal(this,tx.formResponse);calls.push({method:'model-read'});return{id:'response'};},async update(){assert.equal(this,tx.formResponse);calls.push({method:'model-write'});return{id:'response'};}},
 };
 return{tx,calls,view:memoizeFullStudyIdLocks(tx,scope)};
}
const project=(tx,s=scope)=>tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${s.researchProjectId} AND "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} FOR SHARE`;
const protocol=(tx,ids=['protocol'],s=scope)=>tx.$queryRaw`SELECT id FROM public.study_protocol_version WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
const subject=(tx,id='subject',s=scope)=>tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id} AND "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND "deletedAt" IS NULL FOR UPDATE`;
const subjects=(tx,ids=['subject','other'],s=scope)=>tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${ids}::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE`;
const tenantLock=tx=>tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:tenant'},0))`;

test('constructor requires an explicit complete scope and a transaction',()=>{
 for(const s of [undefined,{}, {...scope,tenantId:null},{...scope,researchProjectId:''}])assert.throws(()=>memoizeFullStudyIdLocks({},s),/FULL_STUDY_LOCK_SCOPE_REQUIRED/);
 assert.throws(()=>memoizeFullStudyIdLocks(null,scope),/FULL_STUDY_LOCK_SCOPE_REQUIRED/);
});
test('actual native lockCaptureScope retains first project/protocol locks and reuses only exact successful repeats',async()=>{
 const {load}=runtimeDependencies(),native=load('study-operations/protocol-migration-lock','lockCaptureScope'),f=fixture();
 await native(f.view,scope,['protocol']);await native(f.view,scope,['protocol']);
 assert.equal(f.calls.length,2);assert.deepEqual(f.calls.map(x=>x.params),[['project','tenant','group'],['tenant','group','project',['protocol']]]);
 await native(f.view,scope,['other']);assert.equal(f.calls.length,3);
 assert.equal(load('study-operations/protocol-migration-lock','lockCaptureScope'),native);
 await native(f.tx,scope,['protocol']);assert.equal(f.calls.length,5,'unwrapped native/global exports remain unchanged');
});
test('actual native tenant authorization lock executes first; official and other-tenant locks never memoize',async()=>{
 const {load}=runtimeDependencies(),native=load('common/worker-publication','lockAuthorizationMutation'),f=fixture();
 await native(f.view,'tenant');await native(f.view,'tenant');assert.equal(f.calls.length,1);
 await native(f.view,null,{official:true});await native(f.view,null,{official:true});assert.equal(f.calls.length,3);
 await native(f.view,'foreign');await native(f.view,'foreign');assert.equal(f.calls.length,5);
 assert.equal(load('common/worker-publication','lockAuthorizationMutation'),native);
 await native(f.tx,'tenant');assert.equal(f.calls.length,6);
});
test('subject scalar and batch remain distinct and parameter order/IDs are never inferred as subsets',async()=>{
 const f=fixture();await subjects(f.view);await subjects(f.view);await subject(f.view);await subject(f.view);
 assert.equal(f.calls.length,2);await subjects(f.view,['other','subject']);await subject(f.view,'other');assert.equal(f.calls.length,4);
 await protocol(f.view,['one','two']);await protocol(f.view,['two','one']);assert.equal(f.calls.length,6);
});
test('scope and SQL shape/mode must match the original allowlist exactly',async()=>{
 const f=fixture();for(let i=0;i<2;i++){
  await project(f.view,{...scope,researchProjectId:'foreign'});
  await protocol(f.view,['protocol'],{...scope,tenantId:'foreign'});
  await subject(f.view,'subject',{...scope,studyGroupId:'foreign'});
  await f.view.$queryRaw`SELECT id FROM public.research_project WHERE id=${'project'} AND "tenantId"=${'tenant'} AND "studyGroupId"=${'group'} FOR UPDATE`;
  await f.view.$queryRaw`SELECT id FROM public.subject WHERE id=${'subject'} AND "tenantId"=${'tenant'} AND "studyGroupId"=${'group'} AND "researchProjectId"=${'project'} FOR SHARE`;
 }
 assert.equal(f.calls.length,10);
});
test('only full ID-only results are reusable, with independent returned objects',async()=>{
 const f=fixture(),a=await project(f.view);a[0].id='tampered';a.push({id:'injected'});
 assert.deepEqual(await project(f.view),[{id:'project'}]);assert.equal(f.calls.length,1);
 let count=0;const tx={$queryRaw:async()=>{count++;return count===1?[]:count===2?[{id:'project',status:'active'}]:[{id:'project'}];}},v=memoizeFullStudyIdLocks(tx,scope);
 await project(v);await project(v);await project(v);await project(v);assert.equal(count,3);
 let partial=0;const t={$queryRaw:async()=>{partial++;return[{id:'one'}];}},w=memoizeFullStudyIdLocks(t,scope);
 await protocol(w,['one','two']);await protocol(w,['one','two']);assert.equal(partial,2);
});
test('lock errors are not cached',async()=>{
 const error=Error('native lock failure');let calls=0;const tx={$queryRaw:async()=>{calls++;if(calls===1)throw error;return[{id:'project'}];}},v=memoizeFullStudyIdLocks(tx,scope);
 await assert.rejects(project(v),e=>e===error);await project(v);await project(v);assert.equal(calls,2);
});
test('enrollment/visit source rows, arbitrary raw SELECT and all model reads remain fresh',async()=>{
 const f=fixture();await project(f.view);
 for(let i=0;i<2;i++){
  await f.view.$queryRaw`SELECT id,status FROM public.study_enrollment WHERE id=${'enrollment'} FOR UPDATE`;
  await f.view.$queryRaw`SELECT id,status FROM public.subject_visit WHERE id=${'visit'} FOR UPDATE`;
  await f.view.$queryRaw`SELECT answers,score FROM public.form_response WHERE id=${'response'}`;
  await f.view.formResponse.findFirst({where:{id:'response'}});
 }
 await project(f.view);assert.equal(f.calls.length,9);assert.equal(f.calls.filter(c=>c.method==='model-read').length,2);
});
test('any model mutation clears memo before and after success or error',async()=>{
 const f=fixture();await project(f.view);await f.view.formResponse.update({where:{id:'response'},data:{status:'submitted'}});await project(f.view);assert.equal(f.calls.length,3);
 f.tx.formResponse.delete=async()=>{throw Error('write failed');};await assert.rejects(f.view.formResponse.delete({}),/write failed/);await project(f.view);assert.equal(f.calls.length,4);
 for(const method of ['create','createMany','createManyAndReturn','updateMany','updateManyAndReturn','upsert','deleteMany']){
  f.tx.formResponse[method]=async()=>1;await f.view.formResponse[method]({});await project(f.view);
 }
 assert.equal(f.calls.filter(x=>x.method==='query').length,10);
});
test('raw writes, set_config, multi-statements, CTEs and unsafe APIs invalidate memo',async()=>{
 const f=fixture(),changes=[
  ()=>f.view.$queryRaw`UPDATE public.form_response SET status=${'submitted'} WHERE id=${'response'}`,
  ()=>f.view.$queryRaw`SELECT set_config(${'app.tenant_id'},${'tenant'},true)`,
  ()=>f.view.$queryRaw`WITH changed AS (DELETE FROM public.form_response RETURNING id) SELECT * FROM changed`,
  ()=>f.view.$queryRaw`SELECT 1; UPDATE public.form_response SET status='submitted'`,
  ()=>f.view.$executeRaw`SELECT set_config(${'app.tenant_id'},${'tenant'},true)`,
  ()=>f.view.$queryRawUnsafe('SELECT 1'),()=>f.view.$executeRawUnsafe('SET LOCAL role = app'),
 ];
 for(const change of changes){await project(f.view);const n=f.calls.filter(x=>x.sql?.startsWith('SELECT id FROM public.research_project')).length;await change();await project(f.view);assert.equal(f.calls.filter(x=>x.sql?.startsWith('SELECT id FROM public.research_project')).length,n+1);}
});
test('query/execute raw methods and non-native tag representations do not share lock identities',async()=>{
 const f=fixture();await tenantLock(f.view);await tenantLock(f.view);assert.equal(f.calls.length,1);
 await f.view.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:tenant'},0))`;
 await f.view.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:tenant'},0))`;assert.equal(f.calls.length,3);
 const strings=['SELECT id FROM public.research_project WHERE id=',' AND "tenantId"=',' AND "studyGroupId"=',' FOR SHARE'];
 await f.view.$queryRaw(strings,'project','tenant','group');await f.view.$queryRaw(strings,'project','tenant','group');assert.equal(f.calls.length,5);
});
test('no pending or cross-instance/transaction locks are reused',async()=>{
 let calls=0,resolve;const pending=new Promise(r=>resolve=r),tx={$queryRaw:async()=>{calls++;await pending;return[{id:'project'}];}},v=memoizeFullStudyIdLocks(tx,scope);
 const a=project(v),b=project(v);assert.equal(calls,2);resolve();await Promise.all([a,b]);await project(v);assert.equal(calls,2);
 await project(memoizeFullStudyIdLocks(tx,scope));assert.equal(calls,3);
 await project(memoizeFullStudyIdLocks({$queryRaw:async()=>{calls++;return[{id:'project'}];}},scope));assert.equal(calls,4);
});
test('a mutation invalidates in-flight acquisition so it cannot reseed stale memo',async()=>{
 let calls=0,release;const wait=new Promise(r=>release=r),tx={$queryRaw:async()=>{calls++;if(calls===1)await wait;return[{id:'project'}];},formResponse:{update:async()=>({})}},v=memoizeFullStudyIdLocks(tx,scope);
 const pending=project(v);await v.formResponse.update({});release();await pending;await project(v);assert.equal(calls,2);
});
test('constructor scope is copied and caller mutation cannot authorize foreign SQL for reuse',async()=>{
 const s={...scope},f=fixture(),v=memoizeFullStudyIdLocks(f.tx,s);await project(v);s.researchProjectId='foreign';await project(v);assert.equal(f.calls.length,1);
 await project(v,s);await project(v,s);assert.equal(f.calls.length,3);
});
test('unknown SELECT functions and comments invalidate rather than pretending they are read-only',async()=>{
 const f=fixture();await project(f.view);await f.view.$queryRaw`SELECT public.write_binding()`;await project(f.view);assert.equal(f.calls.length,3);
 await f.view.$queryRaw`SELECT "set_config"(${'app.tenant_id'},${'tenant'},true)`;await project(f.view);assert.equal(f.calls.length,5);
 await f.view.$queryRaw`SELECT 1 /* an unclassified raw statement */`;await project(f.view);assert.equal(f.calls.length,7);
});
test('raw write failure preserves its native error and still invalidates prior witnesses',async()=>{
 const f=fixture();await project(f.view);const error=Error('raw write failed');f.tx.$executeRaw=async()=>{throw error;};
 await assert.rejects(f.view.$executeRaw`UPDATE public.subject SET "deletedAt"=now() WHERE id=${'subject'}`,e=>e===error);
 await project(f.view);assert.equal(f.calls.length,2);
});
test('a successful acquisition during an active mutation is not reusable after that mutation',async()=>{
 const f=fixture();let release;const wait=new Promise(r=>release=r);f.tx.formResponse.update=async()=>wait;
 const writing=f.view.formResponse.update({});await project(f.view);release({});await writing;await project(f.view);
 assert.equal(f.calls.length,2);
});
test('SELECT INTO creates data and invalidates ID-lock witnesses conservatively',async()=>{
 const f=fixture();await project(f.view);
 await f.view.$queryRaw`SELECT id INTO TEMP duplicate_rows FROM public.subject WHERE id=${'subject'}`;
 await project(f.view);assert.equal(f.calls.length,3);
});
