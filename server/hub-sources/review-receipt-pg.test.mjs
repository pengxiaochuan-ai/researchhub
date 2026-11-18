import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {stageBatch} from './staging-repository.mjs';
import {workbookReviewScope,submitObjectReview} from './object-review.mjs';
import {submitWithReviewReceipt,readReviewReceipt} from './review-receipt.mjs';
import {installReceiptRead} from './review-receipt-schema.mjs';
import {listPmcReviewItems,submitPmcArticleReview} from './pmc-review-service.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const rollback=new Error('P1_RECEIPT_ALL_ROLLBACK');

test('PMC receipt uses the unchanged application-role write transaction and replays original version',async()=>{
 await assert.rejects(()=>withFixtureTransaction(env,'app',async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  await db.$executeRaw`SELECT set_config('app.research_project_id','',true)`;
  const account=await db.account.findUnique({where:{id:ids.admin},select:{authVersion:true}});
  const args={db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,principal:{accountId:ids.admin,tenantId:ids.tenant,authVersion:account.authVersion}};
  const item=(await listPmcReviewItems(args)).find(x=>x.versionId&&x.articleDecision?.visibility!=='withheld');assert(item);
  const input={operationId:randomUUID(),versionId:item.versionId,rawSha256:item.rawSha256,visibility:'withheld',expectedVersion:item.articleDecision?.version||'0',expectedAssetFingerprint:item.assetFingerprint};
  const run=()=>submitWithReviewReceipt({...args,kind:'pmc',input},()=>submitPmcArticleReview({...args,input}));
  const saved=await run();assert.equal(saved.visibility,'withheld');assert.deepEqual(await run(),saved);
  assert.deepEqual((await readReviewReceipt({...args,operationId:input.operationId})).review,saved);
  throw rollback;
 }),e=>e===rollback);
});

test('controlled reader rejects foreign tenant/account/hub/version and preserves original audit RLS',async()=>{
 await assert.rejects(()=>withFixtureTransaction(env,'direct',async db=>{
  await installReceiptRead(db,{tenantId:ids.tenant,reviewerAccountId:ids.admin});
  const [account]=await db.$queryRaw`SELECT "authVersion" FROM public.account WHERE id=${ids.admin}`;
  const key=randomUUID(),id='rh-source-review-'+'a'.repeat(64);
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  await db.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const call=(tenant=ids.tenant,hub='lingshu-xinyu',actor=ids.admin,version=account.authVersion,operation=key)=>db.$queryRaw`SELECT rh_source.read_review_receipt(${tenant},${hub},${actor},${version}::integer,${id},${operation}) AS meta`;
  assert.equal((await call())[0].meta,null);
  for(const change of [()=>call('other-tenant'),()=>call(ids.tenant,'other-hub'),()=>call(ids.tenant,'other-account'),()=>call(ids.tenant,'lingshu-xinyu',ids.admin,account.authVersion+1),()=>call(ids.tenant,'lingshu-xinyu',ids.admin,account.authVersion,'invalid')]){
   await db.$executeRawUnsafe('SAVEPOINT bad_read');
   await assert.rejects(change,/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
   await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT bad_read');
  }
  await db.$executeRaw`SELECT set_config('app.tenant_id','',true)`;
  await db.$executeRawUnsafe('SAVEPOINT missing_context');await assert.rejects(()=>call(),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT missing_context');
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const [ordinary]=await db.$queryRaw`SELECT count(*)::int AS count FROM public.audit_log WHERE "tenantId"=${ids.tenant} AND "researchProjectId" IS NULL`;assert.equal(ordinary.count,0);
  const [security]=await db.$queryRawUnsafe(`SELECT p.prosecdef AS definer,pg_get_userbyid(p.proowner) AS owner,has_schema_privilege('aisci_app','rh_source','CREATE') AS can_create,
    EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') AS public_execute
    FROM pg_proc p WHERE p.oid=to_regprocedure('rh_source.read_review_receipt(text,text,text,integer,text,text)')`);
  assert.deepEqual(security,{definer:true,owner:'aisci_owner',can_create:false,public_execute:false});
  await db.$executeRawUnsafe('SET LOCAL ROLE NONE');
  await db.$executeRaw`INSERT INTO rh_source.review_grant_event(tenant_id,hub_key,account_id,capability,decision,approval_ref,actor_ref)
    VALUES(${ids.tenant},'lingshu-xinyu',${ids.admin},'source.review','revoke',${'p1-receipt-rollback-'+randomUUID()},'synthetic-rollback')`;
  await db.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await db.$executeRawUnsafe('SAVEPOINT revoked_read');await assert.rejects(()=>call(),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT revoked_read');
  throw rollback;
 }),e=>e===rollback);
});

test('real synthetic PG: original review and original receipt are atomic, exact-key replay is unique, current access is mandatory',async()=>{
 await assert.rejects(()=>withFixtureTransaction(env,'direct',async db=>{
  await installReceiptRead(db,{tenantId:ids.tenant,reviewerAccountId:ids.admin});
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const marker='governance-p1-rollback-'+randomUUID();
  const batch=await stageBatch({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',preview:{filePath:marker+'.xlsx',fileSha256:'4'.repeat(64),sheetName:'合成P1',sourceKey:marker,mapperVersion:'p1-synthetic-v1',rows:[{rowNumber:2,sourceName:marker,title:marker,raw:{},rowSha256:'5'.repeat(64),errors:[]}]},source:{createdBy:ids.admin,snapshotPath:'/synthetic/'+marker+'.xlsx',snapshotSha256:'4'.repeat(64)}});
  const [row]=await db.$queryRaw`SELECT source_registry_id AS id FROM rh_source.source_record WHERE batch_id=${batch.batchId}`;
  const [account]=await db.$queryRaw`SELECT "authVersion" FROM public.account WHERE id=${ids.admin} AND "tenantId"=${ids.tenant}`;
  const args={db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,principal:{accountId:ids.admin,tenantId:ids.tenant,authVersion:account.authVersion},batchId:batch.batchId,sourceRegistryId:row.id};
  const scope=await workbookReviewScope(args),input={kind:'workbook',batchId:batch.batchId,sourceRegistryId:row.id,visibility:'tenant',expectedFingerprint:scope.fingerprint,operationId:randomUUID()};
  // Match the existing controller: workbook writes already use its guarded
  // direct transaction; recovery GET uses the application role. Do not add GRANTs.
  const run=()=>submitWithReviewReceipt({...args,kind:'workbook',input},()=>submitObjectReview({...args,input}));
  const saved=await run();assert.equal(saved.visibility,'tenant');assert.equal((await workbookReviewScope(args)).state.status,'tenant');
  const replay=await run();assert.deepEqual(replay,saved);
  await db.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const expectedId='rh-source-review-'+createHash('sha256').update(JSON.stringify([ids.tenant,'lingshu-xinyu',ids.admin,input.operationId])).digest('hex');
  const [raw]=await db.$queryRaw`SELECT rh_source.read_review_receipt(${ids.tenant},'lingshu-xinyu',${ids.admin},${account.authVersion}::integer,${expectedId},${input.operationId}) AS meta`;
  assert.deepEqual(Object.keys(raw.meta).sort(),['input','kind','review']);
  const receipt=await readReviewReceipt({...args,operationId:input.operationId});assert.deepEqual(receipt.input,input);assert.deepEqual(receipt.review,saved);
  await db.$executeRawUnsafe('SET LOCAL ROLE NONE');
  const [count]=await db.$queryRaw`SELECT count(*)::int AS count FROM public.audit_log WHERE "tenantId"=${ids.tenant} AND action='researchhub.source_review.receipt' AND target=${batch.batchId}`;assert.equal(count.count,1);
  await assert.rejects(()=>submitWithReviewReceipt({...args,kind:'workbook',input:{...input,visibility:'public'}},()=>assert.fail('do not submit changed replay')),/HUB_SOURCE_REQUEST_KEY_CONFLICT/);
  await assert.rejects(()=>readReviewReceipt({...args,principal:{...args.principal,authVersion:account.authVersion+1},operationId:input.operationId}),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
  // Savepoint models a dropped/failed receipt write. The enclosing DB transaction,
  // not a compensating delete, owns atomicity of both records.
  await db.$executeRawUnsafe('SAVEPOINT receipt_atomic');
  const nextScope=await workbookReviewScope(args),nextInput={...input,operationId:randomUUID(),visibility:'withheld',expectedFingerprint:nextScope.fingerprint};
  await submitWithReviewReceipt({...args,kind:'workbook',input:nextInput},()=>submitObjectReview({...args,input:nextInput}));
  await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT receipt_atomic');
  assert.equal((await workbookReviewScope(args)).state.status,'tenant');
  await assert.rejects(()=>readReviewReceipt({...args,operationId:nextInput.operationId}),/HUB_SOURCE_RECEIPT_NOT_FOUND/);
  throw rollback;
 }),error=>error===rollback);
});
