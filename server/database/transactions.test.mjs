import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRuntimeTransactions,bindRuntimeTransactionsInto,withFixtureTransaction,validateRuntimeIdentity,verifyRuntimeSchema,assertVerifiedRuntimeSchema} from './transactions.mjs';
const expected={database:'rh_deploy_unit',appRole:'unit_app',directRole:'unit_owner',markerDigest:'a'.repeat(64),deploymentId:'unit-deployment',tenantId:'unit-tenant'};
const identity=kind=>({database:expected.database,role:kind==='app'?expected.appRole:expected.directRole,superuser:false,bypassRls:kind!=='app',markerDigest:expected.markerDigest});
test('runtime transactions validate the same connection before any business callback',async()=>{
 const calls=[];let observed=identity('app');const tx={$executeRawUnsafe:async(sql,...args)=>calls.push({sql,args}),$queryRawUnsafe:async()=>[observed]};
 const client={$transaction:async(fn)=>fn(tx)},prisma={app:client,elevated:client};
 const env=bindRuntimeTransactions({prisma,expected});let visited=0;
 await withFixtureTransaction(env,'app',async current=>{assert.equal(current,tx);visited++;},{readOnly:true});assert.equal(visited,1);assert(calls.some(x=>x.sql==='SET TRANSACTION READ ONLY'));assert(calls.some(x=>x.args.includes(expected.tenantId)));
 for(const change of [{database:'aisci'},{markerDigest:'b'.repeat(64)},{role:'another'},{superuser:true},{bypassRls:true}]){observed={...identity('app'),...change};await assert.rejects(()=>withFixtureTransaction(env,'app',()=>{visited++;}),/RUNTIME_DATABASE_IDENTITY_REJECTED/);assert.equal(visited,1);}
 await assert.rejects(()=>withFixtureTransaction(env,'unknown',()=>{}),/RUNTIME_TRANSACTION_ROLE_REJECTED/);
});
test('runtime schema proof requires the bound target and exact full catalog fingerprint',async()=>{
 let fingerprint='b'.repeat(32);
 const tx={$executeRawUnsafe:async()=>{},$queryRawUnsafe:async sql=>[sql.includes('AS fingerprint')?{fingerprint}:identity('direct')]};
 const client={$transaction:async fn=>fn(tx)},env=bindRuntimeTransactions({prisma:{app:client,elevated:client},expected});
 assert.throws(()=>assertVerifiedRuntimeSchema(env),/RUNTIME_SCHEMA_NOT_VERIFIED/);
 await assert.rejects(verifyRuntimeSchema(env,{fingerprint:'c'.repeat(32),schemas:['public']}),/RUNTIME_SCHEMA_MISMATCH/);
 assert.throws(()=>assertVerifiedRuntimeSchema(env),/RUNTIME_SCHEMA_NOT_VERIFIED/);
 await verifyRuntimeSchema(env,{fingerprint,schemas:['public']});assertVerifiedRuntimeSchema(env);
 assert.throws(()=>assertVerifiedRuntimeSchema({...env}),/RUNTIME_SCHEMA_NOT_VERIFIED/);
});
test('fixture env can be bound to the bundled runtime client without replacing legacy fields',async()=>{
 const fixture={WP01_TEST_DATABASE_URL:'postgresql://app@localhost/db',WP01_TEST_DB_NAME:'wp01_test_db',WP01_FIXTURE_RUN_ID:'run-1234',WP01_TEST_DIRECT_URL:'postgresql://owner@localhost/db'};
 const tx={$executeRawUnsafe:async()=>{},$queryRawUnsafe:async()=>[identity('app')]};
 const client={$transaction:async fn=>fn(tx)},prisma={app:client,elevated:client};
 assert.equal(bindRuntimeTransactionsInto(fixture,{prisma,expected}),fixture);
 assert.equal(fixture.WP01_TEST_DB_NAME,'wp01_test_db');
 let visited=0;await withFixtureTransaction(fixture,'app',async current=>{assert.equal(current,tx);visited++;});assert.equal(visited,1);
 assert.throws(()=>bindRuntimeTransactionsInto(fixture,{prisma,expected}),/RUNTIME_DATABASE_CONFIG_REJECTED/);
 assert.throws(()=>bindRuntimeTransactionsInto(null,{prisma,expected}),/RUNTIME_DATABASE_CONFIG_REJECTED/);
});
test('deployment transaction contexts cannot be forged or serialized into a request body',async()=>{
 assert.throws(()=>bindRuntimeTransactions({prisma:{},expected:{...expected,markerDigest:''}}),/RUNTIME_DATABASE_CONFIG_REJECTED/);
 const env=bindRuntimeTransactions({prisma:{app:{},elevated:{}},expected});const copy=JSON.parse(JSON.stringify(env));
 await assert.rejects(()=>withFixtureTransaction(copy,'app',()=>{}, {requireRuntime:true}),/RUNTIME_TRANSACTIONS_NOT_BOUND/);
 assert.throws(()=>validateRuntimeIdentity(expected,'app',{...identity('app'),superuser:true}),/RUNTIME_DATABASE_IDENTITY_REJECTED/);
});
