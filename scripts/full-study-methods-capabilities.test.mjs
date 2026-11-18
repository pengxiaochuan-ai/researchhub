import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {ResearchMethodsService}=require('./src/research-methods/research-methods.service.ts');
const {FormalDescriptiveRuns}=require('./src/research-methods/formal-descriptive-runs.ts');
const {ForbiddenException,ConflictException}=require('@nestjs/common');

function fixture(){
 const user={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'actor',authVersion:5,isTenantAdmin:true},log=[],hooks={};
 const rows=['one','two','three'].map(id=>({id,...user,skillKey:'descriptive-statistics',status:'needs_review',reviewStatus:'pending',skillVersion:1,updatedAt:new Date(100),createdAt:new Date(50)}));
 const expectedUser=structuredClone(user);
 const tx={researchMethodRun:{
  findFirst:async({where})=>{log.push('find:'+where.id);return structuredClone(rows.find(r=>r.id===where.id&&r.studyGroupId===where.studyGroupId&&r.researchProjectId===where.researchProjectId)??null);},
  findUnique:async({where})=>{await hooks.beforeFresh?.(where.id);log.push('fresh:'+where.id);return structuredClone(rows.find(r=>r.id===where.id)??null);}
 },$queryRaw:async(_sql,id)=>{log.push('lock:'+id);return[{id}];}};
 let forTenant=0,physical=0;
 const methods=Object.create(ResearchMethodsService.prototype);
 methods.prisma={forTenant(){forTenant++;return tx;}};
 methods.descriptiveRuns=()=>{
  const native=new FormalDescriptiveRuns({prisma:{},worker:{},resolver:{},grant:async()=>({})});
  native.transaction=async(actual,fn)=>{assert.deepEqual(actual,expectedUser);physical++;log.push('begin');try{const value=await fn(tx);log.push('commit');return value;}catch(e){log.push('rollback');throw e;}};
  native.authority=async(actual,u,row)=>{assert.equal(actual,tx);assert.deepEqual(u,expectedUser);log.push('authority:'+row.id);await hooks.authority?.(row,u);return{user:u};};
  native.reviewRole=async(actual,u)=>{assert.equal(actual,tx);assert.deepEqual(u,expectedUser);log.push('role');await hooks.role?.();return 'tenant_admin';};
  return native;
 };
 const facade=createFullStudyMethodsFacade(methods,{withBatchResolver:async()=>{throw Error('not used');}});
 return{user,log,hooks,rows,methods,facade,get physical(){return physical;},get forTenant(){return forTenant;}};
}
test('capability callback reuses one physical transaction while original scoped lookup, native live CAS/row locks and role run per item',async()=>{
 const f=fixture();const values=await f.facade.withDescriptiveCapabilities(f.user,['one','two','three'],async get=>{
  const values=[];for(const id of ['one','two','three'])values.push(await get(id));return values;
 });
 assert.equal(f.physical,1);assert.equal(f.forTenant,0);assert.equal(values.length,3);assert(values.every(x=>x.capabilities.canReview&&x.capabilities.canCancel));
 for(const id of ['one','two','three'])assert.deepEqual(f.log.filter(x=>x.endsWith(':'+id)),['find:'+id,'authority:'+id,'lock:'+id,'fresh:'+id]);
 assert.equal(f.log.filter(x=>x==='role').length,3);assert.equal(f.log.at(-1),'commit');
 // The public original instance retains its own tenant accessor and transaction.
 await f.methods.getDescriptiveCapabilities(f.user,'one');assert.equal(f.forTenant,1);assert.equal(f.physical,2);
});
test('original AND short circuit never reads an unneeded tail member or its possible error',async()=>{
 const f=fixture();f.hooks.role=async()=>{throw new ForbiddenException({code:'METHOD_REVIEW_FORBIDDEN'});};
 const result=await f.facade.withDescriptiveCapabilities(f.user,['one','missing'],async get=>{for(const id of ['one','missing'])if(!(await get(id)).capabilities.canReview)return false;return true;});
 assert.equal(result,false);assert(!f.log.includes('find:missing'));assert.equal(f.physical,1);
});
test('native authority, row conflicts, foreign scope and non-descriptive items reject without partial returned flags',async()=>{
 for(const kind of ['authority','changed','scope','skill','missing']){
  const f=fixture(),error=new ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED'});
  if(kind==='authority')f.hooks.authority=async row=>{if(row.id==='two')throw error;};
  if(kind==='changed')f.hooks.beforeFresh=async id=>{if(id==='two')f.rows[1].updatedAt=new Date(200);};
  if(kind==='scope')f.rows[1].researchProjectId='foreign';if(kind==='skill')f.rows[1].skillKey='other';if(kind==='missing')f.rows.splice(1,1);
  await assert.rejects(f.facade.withDescriptiveCapabilities(f.user,['one','two'],async get=>[await get('one'),await get('two')]),e=>kind==='authority'?e===error:kind==='changed'?e instanceof ConflictException:e.getStatus()===404);
  assert.equal(f.log.at(-1),'rollback');assert.equal(f.physical,1);assert.equal(f.forTenant,0);
 }
});
test('callback get is restricted to frozen unique members and expires after commit or rollback',async()=>{
 const f=fixture();let saved;
 await f.facade.withDescriptiveCapabilities(f.user,['one'],async get=>{saved=get;await get('one');});const count=f.log.length;
 await assert.rejects(saved('one'));assert.equal(f.log.length,count);
 await assert.rejects(f.facade.withDescriptiveCapabilities(f.user,['one'],get=>get('two')));assert(!f.log.includes('find:two'));
 const marker=Error('callback failed');await assert.rejects(f.facade.withDescriptiveCapabilities(f.user,['one'],async get=>{saved=get;throw marker;}),e=>e===marker);
 const after=f.log.length;await assert.rejects(saved('one'));assert.equal(f.log.length,after);
 await assert.rejects(f.facade.withDescriptiveCapabilities(f.user,['one','one'],async()=>{}));
});
test('membership/actor mutation cannot redirect an accepted capability callback',async()=>{
 const f=fixture();const ids=['one'];let read;
 await assert.rejects(f.facade.withDescriptiveCapabilities(f.user,ids,async get=>{read=get;ids.push('two');await get('two');}));assert(!f.log.includes('find:two'));
 await assert.rejects(read('one'));
});
test('transient caller principal mutation during an awaited check cannot alter the native reader identity',async()=>{
 const f=fixture();let observed;
 f.hooks.authority=async(_row,reader)=>{f.user.accountId='intermediate';await Promise.resolve();observed=reader.accountId;f.user.accountId='actor';};
 await f.facade.withDescriptiveCapabilities(f.user,['one'],get=>get('one'));
 assert.equal(observed,'actor');
});
