import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtime,withRollback} from '../wp02/test-support.mjs';
import {createResearchIdentityService} from './service.mjs';

async function prepare({db,direct}){
  for(const id of [runtime.ids.owner,runtime.ids.admin])await direct(tx=>tx.$executeRaw`UPDATE public.account SET "researchProfile"=NULL,"researchProfileVersion"=NULL,"researchProfileEstablishedAt"=NULL,"researchProfileLastMutation"=NULL WHERE id=${id} AND "tenantId"=${runtime.ids.tenant}`);
  const who=async id=>({user:await direct(async tx=>{const a=await tx.account.findFirst({where:{id,tenantId:runtime.ids.tenant},select:{id:true,tenantId:true,authVersion:true}});return{accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion};})});
  return {service:createResearchIdentityService({db}),owner:await who(runtime.ids.owner),admin:await who(runtime.ids.admin)};
}
test('real own draft and explicit L1 preserve account identity and isolate another account',async()=>withRollback(async context=>{
  const {service:s,owner,admin}=await prepare(context),old=await context.direct(tx=>tx.account.findUnique({where:{id:owner.user.accountId}}));
  assert.equal((await s.read(owner)).level,'L0');
  const draft={expectedVersion:0,requestKey:randomUUID(),changes:{biography:'合成科研经历'}};
  assert.deepEqual(await s.save(owner,draft),await s.save(owner,draft));assert.equal((await s.read(owner)).level,'L0');
  await assert.rejects(s.establish(owner,{expectedVersion:1,requestKey:randomUUID()}),e=>e.status===422);
  await s.save(owner,{expectedVersion:1,requestKey:randomUUID(),changes:{researchName:'合成科研人员',researchDirections:['针灸']}});
  const result=await s.establish(owner,{expectedVersion:2,requestKey:randomUUID()});assert.equal(result.level,'L1');assert.equal(result.version,3);
  assert.equal((await s.read(admin)).profile.researchName,'');
  await assert.rejects(s.save(owner,{expectedVersion:3,requestKey:randomUUID(),changes:{researchDirections:[]}}),e=>e.status===422);
  const current=await context.direct(tx=>tx.account.findUnique({where:{id:owner.user.accountId}}));
  for(const key of ['updatedAt','authVersion','role','isTenantAdmin','displayName','passwordHash'])assert.deepEqual(current[key],old[key]);
  assert.deepEqual(await s.identity(owner),{level:'L1',profileEstablished:true,profileVersion:3,verificationStage:'NOT_OPEN',qualifications:[]});
}));
test('real CAS, latest-only receipts, different input and revoked-session replays are guarded',async()=>withRollback(async context=>{
  const {service:s,owner}=await prepare(context),first={expectedVersion:0,requestKey:randomUUID(),changes:{researchName:'甲'}};
  await s.save(owner,first);assert.equal((await s.receipt(owner,first.requestKey,0)).version,1);
  await assert.rejects(s.save(owner,{...first,changes:{researchName:'乙'}}),e=>e.status===409);
  await assert.rejects(s.save(owner,{...first,requestKey:randomUUID()}),e=>e.status===409);
  await s.save(owner,{expectedVersion:1,requestKey:randomUUID(),changes:{researchName:'新资料'}});
  await assert.rejects(s.receipt(owner,first.requestKey,0),e=>e.status===404);
  await assert.rejects(s.save(owner,first),e=>e.status===409);
  await assert.rejects(s.save({user:{...owner.user,authVersion:owner.user.authVersion+1}},first),e=>e.status===401);
  await assert.rejects(s.read({user:{...owner.user,tenantId:'different-tenant'}}),e=>e.status===401);
  await assert.rejects(s.read({}),e=>e.status===401);
}));
test('real update and receipt roll back together when audit fails, without widening Study audit access',async()=>withRollback(async context=>{
  const {service:s,owner}=await prepare(context);
  const failing=createResearchIdentityService({db:{...context.db,transaction:fn=>context.db.transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='auditLog')return{createMany:()=>{throw Error('IDENTITY_TEST_AUDIT_FAILURE');}};return t[k];}})))}});
  await assert.rejects(failing.save(owner,{expectedVersion:0,requestKey:randomUUID(),changes:{researchName:'不可保存'}}),/IDENTITY_TEST_AUDIT_FAILURE/);
  const result=await s.read(owner);assert.equal(result.version,0);assert.equal(result.profile.researchName,'');
}));
