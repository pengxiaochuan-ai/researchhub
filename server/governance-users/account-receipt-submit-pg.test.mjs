import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {submitWithAccountReceipt,readAccountReceipt} from './account-receipt.mjs';

const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {AccountsService}=require('./src/accounts/accounts.service.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const rollback=new Error('P2_SUBMIT_RECEIPT_ALL_ROLLBACK');
test('real application connection stamps the existing audit, replays once and recovers the original result after a newer state',async()=>{
 await assert.rejects(withFixtureTransaction(env,'app',async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true),set_config('app.research_project_id','',true),set_config('app.study_group_id','',true)`;
  const admin=await db.account.findUnique({where:{id:ids.admin},select:{authVersion:true}});
  const principal={tenantId:ids.tenant,accountId:ids.admin,authVersion:admin.authVersion,role:'tenant_admin',isTenantAdmin:true};
  await db.$executeRaw`SELECT set_config('app.account_id',${ids.admin},true),set_config('app.auth_version',${String(admin.authVersion)},true)`;
  const [identity]=await db.$queryRaw`SELECT current_user AS role`;
  assert.equal(identity.role,'aisci_app');
  const id='rh-p2-submit-'+randomUUID().slice(0,8),account=await db.account.create({data:{id,tenantId:ids.tenant,username:id+'@example.test',displayName:'P2原提交临时对照',passwordHash:'not-a-login-hash'}});
  await db.tokenQuotaGrant.create({data:{tenantId:ids.tenant,accountId:id,scopeKey:id,deltaTokens:25n,idempotencyKey:id+'-fixture'}});
  let calls=0;
  const submit=input=>async stamped=>{
   calls++;
   const service=new AccountsService({withTenantTransaction:(tenant,group,project,fn)=>{assert.equal(tenant,ids.tenant);assert.equal(group,undefined);assert.equal(project,undefined);return fn(stamped);}});
   return service.update(principal,id,{status:input.status});
  };
  const input={targetAccountId:id,status:'disabled',expectedVersion:account.updatedAt.toISOString(),requestKey:randomUUID()};
  const run=(value=input,tx=db)=>submitWithAccountReceipt({db:tx,principal,input:value},submit(value));
  const first=await run();assert.equal(first.status,'disabled');assert.equal(first.refundedTokens,'25');
  assert.deepEqual(await run(),first);assert.equal(calls,1);
  assert.equal(await db.tokenQuotaGrant.count({where:{accountId:id}}),2);
  await assert.rejects(run({...input,status:'active'}),e=>e.code==='HUB_ACCOUNT_REQUEST_CONFLICT'&&e.status===409);
  await assert.rejects(run({...input,requestKey:randomUUID()}),e=>e.code==='HUB_ACCOUNT_VERSION_CONFLICT'&&e.status===409);
  const restored=await run({...input,status:'active',expectedVersion:first.version,requestKey:randomUUID()});assert.equal(restored.status,'active');assert.equal(calls,2);
  const recovered=await readAccountReceipt({db,principal,requestKey:input.requestKey});assert.deepEqual(recovered.result,first);assert.equal(recovered.result.status,'disabled');
  assert.equal((await db.account.findUnique({where:{id}})).status,'active');
  // Audit failure after the real legacy status/refund must abort the whole caller
  // transaction. Savepoint lets this one diagnostic continue to inspect rollback.
  await db.tokenQuotaGrant.create({data:{tenantId:ids.tenant,accountId:id,scopeKey:id,deltaTokens:7n,idempotencyKey:id+'-failure-fixture'}});
  await db.$executeRawUnsafe('SAVEPOINT p2_receipt_atomic');
  const failedKey=randomUUID(),failed={...input,expectedVersion:restored.version,requestKey:failedKey};
  const broken=new Proxy(db,{get(t,key){return key==='auditLog'?{createMany:async()=>{throw Error('P2_RECEIPT_INSERT_FAILURE');}}:t[key];}});
  await assert.rejects(run(failed,broken),/P2_RECEIPT_INSERT_FAILURE/);
  await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p2_receipt_atomic');
  assert.equal((await db.account.findUnique({where:{id}})).status,'active');
  assert.equal((await db.tokenQuotaGrant.aggregate({where:{accountId:id},_sum:{deltaTokens:true}}))._sum.deltaTokens,7n);
  assert.equal(await readAccountReceipt({db,principal,requestKey:failedKey}),null);
  assert.equal(await db.auditLog.count({where:{tenantId:ids.tenant,researchProjectId:null}}),0);
  throw rollback;
 }),e=>e===rollback);
});
