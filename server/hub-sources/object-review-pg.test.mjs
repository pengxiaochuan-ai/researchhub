import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID,createHash } from 'node:crypto';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { withHubSourceTransaction } from './fixture-transaction.mjs';
import { stageBatch } from './staging-repository.mjs';
import { workbookReviewScope, submitObjectReview, externalReviewFingerprint } from './object-review.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { getVisible, retrieveForAi } from './visible-repository.mjs';
import { getVisibleGuidanceDocument, retrieveExternalForAi } from './external-visible.mjs';
import {runHubSourceSearch,assertCurrentAiSources} from './agent-retrieval.mjs';
import {reviewSource} from './review-service.mjs';
import {submitExternalReview} from './external-review.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin };
const currentVersions=await withFixtureTransaction(env,'direct',db=>db.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.admin,ids.owner]}},select:{id:true,authVersion:true}}),{readOnly:true});
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: currentVersions.find(x=>x.id===ids.admin).authVersion };
const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: currentVersions.find(x=>x.id===ids.owner).authVersion };
const rollback = new Error('ROLLBACK_OBJECT_REVIEW');
const hashText=value=>createHash('sha256').update(value).digest('hex');
const transaction = operation => withHubSourceTransaction(env, async db => {
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  return operation(db);
});

test('workbook one action is atomic, scoped, replay-safe and follows public/tenant/withheld for pages and AI', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => transaction(async db => {
    const marker = randomUUID();
    const preview = { filePath:'review-workspace-synthetic.xlsx',fileSha256:'7'.repeat(64),sheetName:'合成主表',
      sourceKey:'review-workspace-'+marker,mapperVersion:'v1',rows:[
        {rowNumber:2,sourceName:'合成来源 '+marker,title:'针灸合成审核 '+marker,raw:{'Summary-摘要':'合成摘要 '+marker},rowSha256:'8'.repeat(64),errors:[]},
        {rowNumber:3,sourceName:'合成来源 '+marker,title:null,raw:{},rowSha256:'9'.repeat(64),errors:['缺题名']},
      ]};
    const batch = await stageBatch({db,...scope,preview,source:{createdBy:ids.admin,snapshotPath:'/synthetic/'+marker+'.xlsx',snapshotSha256:preview.fileSha256}});
    const [row] = await db.$queryRaw`SELECT id,source_registry_id AS "sourceRegistryId" FROM rh_source.source_record
      WHERE batch_id=${batch.batchId} AND title IS NOT NULL`;
    const args={db,...scope,principal:admin,batchId:batch.batchId,sourceRegistryId:row.sourceRegistryId};
    let current=await workbookReviewScope(args);
    assert.equal(current.rowCount,2);assert.equal(current.eligibleBibliographic,1);assert.equal(current.excludedCount,1);
    const input={kind:'workbook',batchId:batch.batchId,sourceRegistryId:row.sourceRegistryId,visibility:'public',
      expectedFingerprint:current.fingerprint,operationId:randomUUID()};
    await assert.rejects(()=>submitObjectReview({...args,principal:owner,input}),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    await submitObjectReview({...args,input});
    assert.equal((await workbookReviewScope(args)).state.status,'public');
    assert.equal((await getVisible({db,...scope,recordId:row.id})).abstract,'合成摘要 '+marker);
    assert.equal((await retrieveForAi({db,...scope,principal:owner,query:marker})).length,1);
    const cited=await runHubSourceSearch({db,...scope,principal:owner,query:marker});
    await assertCurrentAiSources({db,...scope,principal:owner,sources:cited.meta.sources});
    await assert.rejects(()=>reviewSource({...args,input:{batchId:batch.batchId,sourceRegistryId:row.sourceRegistryId,
      fieldKind:'bibliographic',purpose:'display',decision:'approve',audience:'public',evidenceRef:'https://example.org/legacy',
      confirmedCount:1,excludedCount:1,homogeneousRightsConfirmed:true,expectedVersion:'0'}}),/HUB_SOURCE_OBJECT_DECISION_REQUIRED/);
    assert.equal((await submitObjectReview({...args,input})).replayed,true);
    await assert.rejects(()=>submitObjectReview({...args,input:{...input,operationId:randomUUID()}}),/HUB_SOURCE_VERSION_CONFLICT/);
    current=await workbookReviewScope(args);
    await submitObjectReview({...args,input:{...input,visibility:'tenant',expectedFingerprint:current.fingerprint,operationId:randomUUID()}});
    await assert.rejects(()=>assertCurrentAiSources({db,...scope,principal:owner,sources:cited.meta.sources}),/HUB_SOURCE_CHANGED/);
    assert.equal(await getVisible({db,...scope,recordId:row.id}),null);
    assert.equal((await getVisible({db,...scope,principal:owner,audience:'member',recordId:row.id})).visibility,'tenant');
    assert.equal((await retrieveForAi({db,...scope,principal:owner,query:marker})).length,1);
    await assert.rejects(()=>getVisible({db,...scope,audience:'member',recordId:row.id}),/HUB_SOURCE_SCOPE_REJECTED/);
    current=await workbookReviewScope(args);
    await submitObjectReview({...args,input:{...input,visibility:'withheld',expectedFingerprint:current.fingerprint,operationId:randomUUID()}});
    assert.equal((await workbookReviewScope(args)).state.status,'withheld');
    assert.equal(await getVisible({db,...scope,principal:owner,audience:'member',recordId:row.id}),null);
    assert.equal((await retrieveForAi({db,...scope,principal:owner,query:marker})).length,0);
    throw rollback;
  }),error=>error===rollback);
});

test('external one action includes exact verified extraction, tenant read and AI, then retracts everything', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(()=>transaction(async db=>{
    const args={db,...scope,principal:admin};
    const read=async()=>(await listExternalReviewItems(args)).find(x=>x.guidanceExtraction);
    let item=await read();assert.ok(item);
    const input={kind:'external',documentId:item.id,expectedFingerprint:externalReviewFingerprint(item),visibility:'tenant',operationId:randomUUID()};
    await submitObjectReview({...args,input});
    assert.equal((await submitObjectReview({...args,input})).replayed,true);
    await assert.rejects(()=>submitExternalReview({...args,input:{documentId:item.id,versionId:item.versionId,sha256:item.sha256,
      fieldKind:'bibliographic',purpose:'display',decision:'approve',expectedVersion:'0',confirmed:true,evidenceRef:'https://example.org/legacy'}}),/HUB_SOURCE_OBJECT_DECISION_REQUIRED/);
    assert.equal(await getVisibleGuidanceDocument({db,...scope,documentId:item.id}),null);
    const detail=await getVisibleGuidanceDocument({db,...scope,principal:owner,audience:'member',documentId:item.id});
    assert.equal(detail.visibility,'tenant');assert.equal(detail.clausesStatus,'approved');
    const hits=await retrieveExternalForAi({db,...scope,principal:owner,query:item.externalKey});
    assert.ok(hits.some(x=>x.documentId===item.id&&x.snippetField==='guidance_clauses'));
    await assert.rejects(()=>getVisibleGuidanceDocument({db,...scope,principal:{...owner,tenantId:'wrong'},audience:'member',documentId:item.id}),/HUB_SOURCE_SCOPE_REJECTED/);
    item=await read();
    await submitObjectReview({...args,input:{...input,expectedFingerprint:externalReviewFingerprint(item),visibility:'withheld',operationId:randomUUID()}});
    assert.equal(await getVisibleGuidanceDocument({db,...scope,principal:owner,audience:'member',documentId:item.id}),null);
    assert.equal((await retrieveExternalForAi({db,...scope,principal:owner,query:item.externalKey})).some(x=>x.documentId===item.id),false);
    throw rollback;
  }),error=>error===rollback);
});

test('failure during the second child insert rolls the complete submitted action back',async()=>{
  await assertFixtureTarget(env);
  const marker='review-fault-'+randomUUID();
  const fixture=await withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    const preview={filePath:marker+'.json',fileSha256:'6'.repeat(64),sheetName:'合成故障测试',sourceKey:marker,mapperVersion:'v1',rows:[
      {rowNumber:2,sourceName:marker,title:marker,raw:{'Summary-摘要':'合成摘要'},rowSha256:'5'.repeat(64),errors:[]}]};
    const batch=await stageBatch({db,...scope,preview,source:{createdBy:ids.admin,snapshotPath:'/synthetic/'+marker,snapshotSha256:preview.fileSha256}});
    const [row]=await db.$queryRaw`SELECT source_registry_id AS "sourceRegistryId" FROM rh_source.source_record WHERE batch_id=${batch.batchId}`;
    return {batchId:batch.batchId,sourceRegistryId:row.sourceRegistryId};
  });
  const read=()=>withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    return workbookReviewScope({db,...scope,...fixture,principal:admin});
  });
  const before=await read();
  await assert.rejects(()=>withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    let writes=0;const wrapped=new Proxy(db,{get(target,key){
      if(key!=='$queryRaw')return Reflect.get(target,key);
      return (...args)=>{if(args[0].join('').includes('INSERT INTO rh_source.review_decision')&&++writes===2)throw new Error('SYNTHETIC_CHILD_INSERT_FAILED');
        return target.$queryRaw(...args);};
    }});
    await submitObjectReview({db:wrapped,...scope,principal:admin,input:{kind:'workbook',...fixture,visibility:'public',
      expectedFingerprint:before.fingerprint,operationId:randomUUID()}});
  }),/SYNTHETIC_CHILD_INSERT_FAILED/);
  const after=await read();assert.equal(after.fingerprint,before.fingerprint);assert.deepEqual(after.decisions,[]);
  await withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    await submitObjectReview({db,...scope,principal:admin,input:{kind:'workbook',...fixture,visibility:'withheld',
      expectedFingerprint:after.fingerprint,operationId:randomUUID()}});
  });
});

test('single-row review invalidates stale batch preview, and a batch decision never changes another batch',async()=>{
  await assertFixtureTarget(env);
  await assert.rejects(()=>transaction(async db=>{
    const marker=randomUUID(),sourceName='合成重叠来源 '+marker;
    const make=async suffix=>{
      const preview={filePath:suffix+'.json',fileSha256:hashText(marker+suffix),sheetName:'合成',sourceKey:marker+suffix,mapperVersion:'v1',rows:[
        {rowNumber:2,sourceName,title:marker+suffix,raw:{},rowSha256:hashText(suffix),errors:[]},
        {rowNumber:3,sourceName,title:marker+suffix+' sibling',raw:{},rowSha256:hashText(suffix+'sibling'),errors:[]}]};
      const batch=await stageBatch({db,...scope,preview,source:{createdBy:ids.admin,snapshotPath:'/synthetic/'+marker+suffix,snapshotSha256:preview.fileSha256}});
      const rows=await db.$queryRaw`SELECT id,source_registry_id AS "sourceRegistryId" FROM rh_source.source_record WHERE batch_id=${batch.batchId} ORDER BY row_number`;
      return {batchId:batch.batchId,sourceRegistryId:rows[0].sourceRegistryId,rows};
    };
    const a=await make('a'),b=await make('b');
    const args={db,...scope,principal:admin,...a};
    const batch=await workbookReviewScope(args),row=await workbookReviewScope({...args,sourceRecordId:a.rows[0].id});
    await submitObjectReview({...args,input:{kind:'workbook',batchId:a.batchId,sourceRegistryId:a.sourceRegistryId,sourceRecordId:a.rows[0].id,
      expectedFingerprint:row.fingerprint,operationId:randomUUID(),visibility:'public'}});
    await assert.rejects(()=>submitObjectReview({...args,input:{kind:'workbook',batchId:a.batchId,sourceRegistryId:a.sourceRegistryId,
      expectedFingerprint:batch.fingerprint,operationId:randomUUID(),visibility:'tenant'}}),/HUB_SOURCE_VERSION_CONFLICT/);
    const bs=await workbookReviewScope({...args,...b});
    await submitObjectReview({...args,input:{kind:'workbook',batchId:b.batchId,sourceRegistryId:b.sourceRegistryId,
      expectedFingerprint:bs.fingerprint,operationId:randomUUID(),visibility:'public'}});
    const fresh=await workbookReviewScope(args);
    await submitObjectReview({...args,input:{kind:'workbook',batchId:a.batchId,sourceRegistryId:a.sourceRegistryId,
      expectedFingerprint:fresh.fingerprint,operationId:randomUUID(),visibility:'withheld'}});
    assert.equal(await getVisible({db,...scope,recordId:a.rows[0].id}),null);
    assert.ok(await getVisible({db,...scope,recordId:b.rows[0].id}));
    throw rollback;
  }),error=>error===rollback);
});
