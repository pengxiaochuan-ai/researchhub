import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {listVisiblePmc} from './pmc-visible.mjs';import {runHubSourceSearch,assertCurrentAiSources} from './agent-retrieval.mjs';
import {createHubSourceReadController} from './read-controller.mjs';
import {prepareHubQuery,hubQuerySql,sql,matchesHubQuery,hubQueryRankSql,publicationRank} from './search-projection.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const runtime=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),{ids}=runtime,scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu'};
const checks=[],out='docs/testing/evidence/bilingual-search-pg-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const tx=async fn=>{assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');return withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;return fn(db);},{readOnly:true});};
const actor=async(db,id=ids.owner)=>{const row=await db.account.findFirst({where:{id,tenantId:ids.tenant,status:'active'},select:{authVersion:true}});assert(row);return {accountId:id,tenantId:ids.tenant,authVersion:row.authVersion};};
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url)),Controller=createHubSourceReadController({env,ids,require,secret:runtime.secret}),controller=new Controller(),response={setHeader(){}};
test('Chinese acupuncture maps to reviewed English PMC without expanding source authorization',()=>tx(async db=>{
 const principal=await actor(db),items=await listVisiblePmc({db,...scope,principal,query:'针灸'});assert(items.some(x=>/[a-z]/i.test(x.title)),'CHINESE_MUST_HIT_APPROVED_ENGLISH');
 const original=await listVisiblePmc({db,...scope});assert(items.every(x=>original.some(y=>x.id===y.id)));
 const hit=await runHubSourceSearch({db,...scope,principal,query:'针灸 抑郁',limit:20});assert.equal(hit.meta.queryPlan.mode,'mapped');assert.equal(hit.meta.queryPlan.conceptGroups.length,2);assert(hit.meta.sources.some(x=>x.pmcRecordId));await assertCurrentAiSources({db,...scope,principal,sources:hit.meta.sources});
 const negative=await runHubSourceSearch({db,...scope,principal,query:'针灸 2099 未知约束'});assert.equal(negative.meta.queryPlan.mode,'literal');assert.equal(negative.meta.sources.length,0);
 await assert.rejects(()=>runHubSourceSearch({db,...scope,principal:{...principal,authVersion:principal.authVersion+100},query:'针灸'}),/HUB_SOURCE_SCOPE_REJECTED/);checks.push('current_reviewed_projection_chinese_AND_and_stale_identity');
}));
test('mixed public publication pages filter before limit with bound cursor and stable exact counts',async()=>{
 let cursor=null;const idsSeen=[],counts=[];do{const page=await controller.publications('acupuncture',cursor,'2',response);assert(page.items.length<=2,'PMC_MUST_NOT_BYPASS_PAGE_LIMIT');assert(page.queryPlan);counts.push(page.counts.matchedRecords);idsSeen.push(...page.items.map(x=>x.id));cursor=page.nextCursor;if(cursor){await assert.rejects(()=>controller.publications('抑郁',cursor,'2',response),e=>e.getStatus?.()===400);}}while(cursor&&idsSeen.length<100);
 assert(idsSeen.length>2);assert.equal(new Set(idsSeen).size,idsSeen.length);assert(counts.every(n=>n===idsSeen.length));
 const all=await controller.publications('acupuncture',null,'20',response);assert.deepEqual(idsSeen,all.items.map(x=>x.id));assert(all.items.every(item=>!Object.hasOwn(item,'searchRank')),'INTERNAL_RANK_NOT_PUBLIC_DTO');checks.push('real_mixed_keyset_pages_no_duplicate_or_missing_and_bound_query');
});
test('member and anonymous use same plan while signed cursors cannot cross identities',()=>tx(async db=>{
 const owner=await actor(db),admin=await actor(db,ids.admin),page=await controller.memberCollection({user:owner},'publications','针灸',null,'2',response);assert.equal(page.queryPlan.mode,'mapped');assert(page.nextCursor);
 await assert.rejects(()=>controller.memberCollection({user:admin},'publications','针灸',page.nextCursor,'2',response),e=>e.getStatus?.()===400);
 const anon=await controller.publications('针灸',null,'2',response);assert.deepEqual(page.queryPlan,anon.queryPlan);await assert.rejects(()=>controller.publications('针灸',page.nextCursor,'2',response),e=>e.getStatus?.()===400);await assert.rejects(()=>controller.memberCollection({user:owner},'publications','针灸',page.nextCursor+'x','2',response),e=>e.getStatus?.()===400);checks.push('real_member_public_same_compiler_cursor_identity_isolation');
}));
test('real PostgreSQL production predicate applies AND/word-boundary/unknown rules before LIMIT with no fixture writes',()=>tx(async db=>{
 const data=JSON.stringify([{id:1,title:'acupuncture only',abstract:''},{id:2,title:'depression only',abstract:''},{id:3,title:'electroacupuncture for depression',abstract:''},{id:4,title:'ACUPUNCTURE for DEPRESSION',abstract:''},{id:5,title:'针灸',abstract:'抑郁'}]);
 const plan=prepareHubQuery('针灸 抑郁'),condition=hubQuerySql(plan,[sql`x.title`,sql`x.abstract`]);
 const page=after=>db.$queryRaw`SELECT x.id,count(*) OVER()::int AS total FROM jsonb_to_recordset(${data}::jsonb) AS x(id int,title text,abstract text) WHERE ${condition} AND x.id>${after} ORDER BY x.id LIMIT 1`;
 assert.deepEqual(await page(0),[{id:4,total:2}]);assert.deepEqual(await page(4),[{id:5,total:1}]);
 for(const query of ['针灸 2099','not acupuncture',"needle' OR 1=1 --",'PMC13691533','10.1234/example']){
  const p=prepareHubQuery(query),predicate=hubQuerySql(p,[sql`x.title`,sql`x.abstract`],[sql`x.title`]);const rows=await db.$queryRaw`SELECT x.id FROM jsonb_to_recordset(${data}::jsonb) AS x(id int,title text,abstract text) WHERE ${predicate}`;assert.deepEqual(rows,[],query);
 }
 assert.equal(matchesHubQuery(plan,['electroacupuncture for depression']),false);assert.equal(matchesHubQuery(plan,['ACUPUNCTURE for DEPRESSION']),true);checks.push('production_parameterized_predicate_before_limit_readonly_synthetic_values');
}));
test('literal original Chinese hits rank before mapped English in production SQL and PMC projection',()=>tx(async db=>{
 const data=JSON.stringify([{id:1,title:'acupuncture'},{id:2,title:'针灸'},{id:3,title:'moxibustion'}]),plan=prepareHubQuery('针灸');
 const rank=hubQueryRankSql(plan,[sql`x.title`]),predicate=hubQuerySql(plan,[sql`x.title`]);
 const rows=await db.$queryRaw`SELECT x.id,${rank} AS rank FROM jsonb_to_recordset(${data}::jsonb) AS x(id int,title text) WHERE ${predicate} ORDER BY rank,x.id`;
 assert.deepEqual(rows,[{id:2,rank:0},{id:1,rank:1},{id:3,rank:1}]);assert.equal(publicationRank(plan,['针灸']),0);assert.equal(publicationRank(plan,['acupuncture']),1);checks.push('original_literal_rank_before_mapped_in_SQL_and_bounded_PMC');
}));
after(()=>writeFileSync(out+'result.json',JSON.stringify({passed:checks.length===5,checks,at:new Date().toISOString(),databaseReadOnly:true,modelCalls:0},null,2)));
