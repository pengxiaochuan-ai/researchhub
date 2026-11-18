import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {directoryRollback,runtime} from './test-support.mjs';
import {createDirectoryService} from './commands.mjs';
import {runHubSourceSearch,assertCurrentAiSources} from '../hub-sources/agent-retrieval.mjs';
import {stageBatch} from '../hub-sources/staging-repository.mjs';
import {reviewSource} from '../hub-sources/review-service.mjs';
import {env} from '../wp02/test-support.mjs';

test('real PG app role: pending, revised, tenant-only, revoked and expired directory facts never become Agent evidence',async()=>directoryRollback(async({db,direct,ctx,provenance,suffix})=>{
 const service=createDirectoryService({db}),admin=ctx('admin'),owner=ctx('owner').user;
 const marker='directorycanary'+suffix,control='sourcecanary'+suffix;
 const entity=await service.createEntity(admin,{kind:'team',stableKey:marker,requestKey:randomUUID()});
 let revision=await service.appendAssertion(admin,entity.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:marker,directions:['针灸']},provenance,requestKey:randomUUID()});
 const appRole=decodeURIComponent(new URL(env.WP01_TEST_DATABASE_URL).username);assert.match(appRole,/^[A-Za-z0-9_]+$/);
 const asApp=fn=>direct(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE "'+appRole+'"');try{await tx.$executeRaw`SELECT set_config('app.tenant_id',${db.tenantId},true)`;return await fn(tx);}finally{await tx.$executeRawUnsafe('RESET ROLE');}});
 const search=(query,overrides={})=>asApp(tx=>runHubSourceSearch({db:tx,tenantId:db.tenantId,hubKey:db.hubKey,principal:owner,query,...overrides}));
 const absent=async()=>{const answer=await search(marker);assert.deepEqual(answer.meta.sources,[]);assert.deepEqual(answer.meta.sourceTexts,[]);assert(!answer.result.includes(marker));assert.equal(answer.mutated,false);};
 const count=(audience='public',context={})=>service.teams(context,{q:marker},audience).then(x=>x.pagination.totalItems);
 const decide=(decision='approve',audience='public',expectedDecisionVersion=0)=>service.decide(admin,revision.id,{decision,audience,expectedDecisionVersion,assertionHash:revision.hash,reason:'仅事务回滚隔离测试',requestKey:randomUUID()});
 assert.equal(await count(),0);await absent(); // Pending directory fact.
 await decide();assert.equal(await count(),1);await absent(); // Public display approval is not AI authorization.
 revision=await service.appendAssertion(admin,entity.id,{kind:'profile',assertionKey:'profile',expectedRevision:1,payload:{name:marker,summary:'新版待审',directions:['针灸']},provenance,requestKey:randomUUID()});
 assert.equal(await count(),0);await absent(); // New pending revision cannot reuse prior approval.
 await decide('approve','tenant');assert.equal(await count(),0);assert.equal(await count('tenant',ctx('owner')),1);await absent();
 await decide('revoke','none',1);assert.equal(await count('tenant',ctx('owner')),0);await absent();
 await decide('approve','public',2);assert.equal(await count(),1);
 await direct(tx=>tx.$executeRaw`UPDATE rh_directory.decision SET expires_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${db.tenantId} AND assertion_id=${revision.id} AND decision_version=3`);
 assert.equal(await count(),0);await absent(); // Expired display approval.
}));

test('real PG app role: approved source positive control, independent directory authorization and stale-citation rejection',async()=>directoryRollback(async({db,direct,ctx,provenance,suffix})=>{
 const service=createDirectoryService({db}),admin=ctx('admin'),owner=ctx('owner').user,marker='directorycanarycontrol'+suffix,control='sourcecanary'+suffix;
 const appRole=decodeURIComponent(new URL(env.WP01_TEST_DATABASE_URL).username);assert.match(appRole,/^[A-Za-z0-9_]+$/);
 const asApp=fn=>direct(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE "'+appRole+'"');try{await tx.$executeRaw`SELECT set_config('app.tenant_id',${db.tenantId},true)`;return await fn(tx);}finally{await tx.$executeRawUnsafe('RESET ROLE');}});
 const search=(query,overrides={})=>asApp(tx=>runHubSourceSearch({db:tx,tenantId:db.tenantId,hubKey:db.hubKey,principal:owner,query,...overrides}));
 const absent=async()=>{const answer=await search(marker);assert.deepEqual(answer.meta.sources,[]);assert.deepEqual(answer.meta.sourceTexts,[]);assert(!answer.result.includes(marker));};
 const entity=await service.createEntity(admin,{kind:'team',stableKey:marker,requestKey:randomUUID()});
 const revision=await service.appendAssertion(admin,entity.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:marker,directions:['针灸']},provenance,requestKey:randomUUID()});
 await service.decide(admin,revision.id,{decision:'approve',audience:'public',expectedDecisionVersion:0,assertionHash:revision.hash,reason:'仅事务回滚正向对照',requestKey:randomUUID()});
 const count=()=>service.teams({},{q:marker}).then(x=>x.pagination.totalItems);assert.equal(await count(),1);

 // Positive control: a real separately staged source, not an absent-query test.
 const sha='8'.repeat(64),batch=await direct(tx=>stageBatch({db:tx,tenantId:db.tenantId,hubKey:db.hubKey,preview:{filePath:'synthetic-isolation.xlsx',fileSha256:sha,sheetName:'合成',sourceKey:control,mapperVersion:'v1',rows:[{rowNumber:2,sourceName:control,title:control,doi:'',url:'https://example.test/isolation',raw:{'Title-题名':control},rowSha256:sha,errors:[]}]},source:{createdBy:runtime.ids.admin,snapshotPath:'synthetic://'+control,snapshotSha256:sha}}));
 const [row]=await direct(tx=>tx.$queryRaw`SELECT id,source_registry_id AS source_id FROM rh_source.source_record WHERE batch_id=${batch.batchId}`);
 const review=(purpose,decision='approve',expectedVersion=0)=>direct(tx=>reviewSource({db:tx,tenantId:db.tenantId,hubKey:db.hubKey,principal:admin.user,input:{batchId:batch.batchId,sourceRegistryId:row.source_id,sourceRecordId:row.id,fieldKind:'bibliographic',purpose,decision,expectedVersion,evidenceRef:'https://example.test/synthetic-license',confirmedCount:1,excludedCount:0,audience:'public',expiresAt:null}}));
 await review('display');assert.deepEqual((await search(control)).meta.sources,[]);
 const approval=await review('ai_retrieval');const hit=await search(control);assert.equal(hit.meta.sources.length,1);assert.equal(hit.meta.sources[0].sourceRecordId,row.id);assert(hit.result.includes(control));
 await absent(); // Positive retrieval does not silently include approved directory facts.
 for(const overrides of [{tenantId:'other-tenant'},{hubKey:'other-hub'},{principal:{...owner,authVersion:owner.authVersion+10000}},{principal:{...owner,tenantId:'other-tenant'}}])await assert.rejects(()=>search(control,overrides),/HUB_SOURCE_SCOPE_REJECTED/);
 await review('ai_retrieval','revoke',approval.version);assert.deepEqual((await search(control)).meta.sources,[]);
 await assert.rejects(()=>asApp(tx=>assertCurrentAiSources({db:tx,tenantId:db.tenantId,hubKey:db.hubKey,principal:owner,sources:hit.meta.sources})),/HUB_SOURCE_CHANGED/);
 // Revoking the underlying display evidence removes an otherwise approved team.
 const ref=provenance[0];await direct(tx=>tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${db.tenantId},${db.hubKey},${ref.sourceId},${ref.rowId},'abstract','display','public','revoke','synthetic://isolation-revocation',${runtime.ids.admin},1)`);
 assert.equal(await count(),0);await absent();
}));
