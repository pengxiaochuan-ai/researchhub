import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {installAccountReceipt} from './account-receipt-schema.mjs';

const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const rollback=new Error('P2_ACCOUNT_RECEIPT_TEST_ROLLBACK');
test('application role recovers only its current-admin marked account receipt, without broad audit SELECT',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await installAccountReceipt(tx,{tenantId:ids.tenant});
  assert.equal((await installAccountReceipt(tx,{tenantId:ids.tenant})).applied,false);
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const account=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant},select:{authVersion:true}});
  await tx.$executeRaw`SELECT set_config('app.account_id',${ids.admin},true),set_config('app.auth_version',${String(account.authVersion)},true),set_config('app.research_project_id','',true)`;
  const key=randomUUID(),target='rh-p2-receipt-'+randomUUID().slice(0,8);
  await tx.account.create({data:{id:target,tenantId:ids.tenant,username:target+'@example.test',displayName:'P2回执临时对照',passwordHash:'not-a-login-hash'}});
  const result={id:target,status:'disabled',version:'2026-11-13T00:00:00.000Z',authVersion:1,refundedTokens:'0'};
  await tx.auditLog.createMany({data:{tenantId:ids.tenant,accountId:ids.admin,researchProjectId:null,action:'update_account',target:target+'@example.test',meta:{schemaVersion:'researchhub.account-status.receipt.v1',requestKey:key,requestHash:'a'.repeat(64),targetAccountId:target,result,privateField:'must-not-escape'}}});
  assert.equal(await tx.auditLog.count({where:{tenantId:ids.tenant,researchProjectId:null}}),0);
  const [row]=await tx.$queryRaw`SELECT public.researchhub_read_account_receipt(${ids.tenant},${ids.admin},${account.authVersion}::integer,${key}) AS receipt`;
  assert.deepEqual(row.receipt.result,result);
  assert.deepEqual(Object.keys(row.receipt).sort(),['completedAt','requestHash','requestKey','result']);
  assert.match(row.receipt.completedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert(!JSON.stringify(row.receipt).includes('must-not-escape'));
  throw rollback;
 }),e=>e===rollback);
});

test('receipt reader rejects foreign scope, missing context, stale current version and ordinary current role',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await installAccountReceipt(tx,{tenantId:ids.tenant});await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const admin=await tx.account.findUnique({where:{id:ids.admin},select:{authVersion:true}}),key=randomUUID();
  const context=async(actor=ids.admin,version=admin.authVersion,tenant=ids.tenant)=>tx.$executeRaw`SELECT set_config('app.tenant_id',${tenant},true),set_config('app.account_id',${actor},true),set_config('app.auth_version',${String(version)},true),set_config('app.research_project_id','',true)`;
  const call=(tenant=ids.tenant,actor=ids.admin,version=admin.authVersion,requestKey=key)=>tx.$queryRaw`SELECT public.researchhub_read_account_receipt(${tenant},${actor},${version}::integer,${requestKey}) AS receipt`;
  await context();assert.equal((await call())[0].receipt,null);
  for(const run of [()=>call('other-tenant'),()=>call(ids.tenant,'other-account'),()=>call(ids.tenant,ids.admin,admin.authVersion+1),()=>call(ids.tenant,ids.admin,admin.authVersion,'invalid')]){
   await tx.$executeRawUnsafe('SAVEPOINT denied');await assert.rejects(run,/HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT denied');
  }
  await context(ids.admin,admin.authVersion+1);await tx.$executeRawUnsafe('SAVEPOINT current_version');
  await assert.rejects(()=>call(ids.tenant,ids.admin,admin.authVersion+1),/HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED/);
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT current_version');
  await context();await tx.$executeRaw`SELECT set_config('app.account_id','',true)`;
  await tx.$executeRawUnsafe('SAVEPOINT no_actor');await assert.rejects(()=>call(),/HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT no_actor');
  await context();
  const ordinary='rh-p2-ordinary-'+randomUUID().slice(0,8);
  await tx.account.create({data:{id:ordinary,tenantId:ids.tenant,username:ordinary+'@example.test',displayName:'普通当前身份',passwordHash:'not-a-login-hash'}});
  await context(ordinary,0);await tx.$executeRawUnsafe('SAVEPOINT ordinary');
  await assert.rejects(()=>call(ids.tenant,ordinary,0),/HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ordinary');
  await context();
  const [security]=await tx.$queryRawUnsafe(`SELECT p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,
   has_schema_privilege('aisci_app','public','CREATE') AS app_create,
   EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
   FROM pg_proc p WHERE p.oid='public.researchhub_read_account_receipt(text,text,integer,text)'::regprocedure`);
  assert.deepEqual(security,{prosecdef:true,owner:'aisci_owner',proconfig:['search_path=pg_catalog'],app_create:false,public_execute:false});
  throw rollback;
 }),e=>e===rollback);
});

test('reader does not expose old/unmarked/other-actor audits and rejects ambiguous or malformed marked receipts',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await installAccountReceipt(tx,{tenantId:ids.tenant});await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const admin=await tx.account.findUnique({where:{id:ids.admin},select:{authVersion:true}});
  await tx.$executeRaw`SELECT set_config('app.account_id',${ids.admin},true),set_config('app.auth_version',${String(admin.authVersion)},true),set_config('app.research_project_id','',true)`;
  const target='rh-p2-hidden-'+randomUUID().slice(0,8);
  await tx.account.create({data:{id:target,tenantId:ids.tenant,username:target+'@example.test',displayName:'回执目标',passwordHash:'not-a-login-hash'}});
  const result={id:target,status:'active',version:'2026-11-13T00:00:00.000Z',authVersion:0,refundedTokens:'0'};
  const meta=key=>({schemaVersion:'researchhub.account-status.receipt.v1',requestKey:key,requestHash:'b'.repeat(64),targetAccountId:target,result});
  const insert=(key,change={})=>tx.auditLog.createMany({data:{tenantId:ids.tenant,accountId:ids.admin,action:'update_account',researchProjectId:null,meta:meta(key),...change}});
  const read=key=>tx.$queryRaw`SELECT public.researchhub_read_account_receipt(${ids.tenant},${ids.admin},${admin.authVersion}::integer,${key}) AS receipt`;
  for(const change of [{meta:{requestKey:'ignored-old-key',password:'must-not-escape'}},{accountId:target},{action:'other_action'},{studyGroupId:'other-group'}]){
   const key=randomUUID();await insert(key,change);assert.equal((await read(key))[0].receipt,null);
  }
  const invalid=randomUUID();await insert(invalid,{meta:{...meta(invalid),result:{...result,status:'unexpected'}}});
  await tx.$executeRawUnsafe('SAVEPOINT malformed');await assert.rejects(()=>read(invalid),/HUB_ACCOUNT_RECEIPT_INVALID/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT malformed');
  const badTarget=randomUUID();await insert(badTarget,{meta:{...meta(badTarget),targetAccountId:'not-in-tenant',result:{...result,id:'not-in-tenant'}}});
  await tx.$executeRawUnsafe('SAVEPOINT bad_target');await assert.rejects(()=>read(badTarget),/HUB_ACCOUNT_RECEIPT_INVALID/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT bad_target');
  const duplicate=randomUUID();await insert(duplicate);await insert(duplicate);
  await tx.$executeRawUnsafe('SAVEPOINT ambiguous');await assert.rejects(()=>read(duplicate),/HUB_ACCOUNT_RECEIPT_AMBIGUOUS/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ambiguous');
  throw rollback;
 }),e=>e===rollback);
});

test('installer rejects security-property drift even when the stored body and marker still match',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await installAccountReceipt(tx,{tenantId:ids.tenant});
  await tx.$executeRawUnsafe('ALTER FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) STABLE');
  await assert.rejects(installAccountReceipt(tx,{tenantId:ids.tenant}),/P2_RECEIPT_SCHEMA_DRIFT/);
  throw rollback;
 }),e=>e===rollback);
});
