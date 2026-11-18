import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createHubSourceReadController} from './read-controller.mjs';
import {extractClassification,projectClassification} from './publication-classification.mjs';
import {classificationValuesSql,filterSql,facetCountsSql} from './publication-filter-sql.mjs';
import {sql} from './search-projection.mjs';
import {normalizePublicationFilters,matchesPublicationFilters,publicationFacets} from '../../src/publication-filters.js';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const runtime=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),{ids}=runtime;
const controller=new (createHubSourceReadController({env,ids,secret:runtime.secret,require:createRequire(new URL('../../../app/server/package.json',import.meta.url))}))(),response={setHeader(){}};
const checks=[],out='docs/testing/evidence/publication-filters-pg-'+randomUUID();mkdirSync(out,{recursive:true});
const tx=async fn=>{assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');return withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;return fn(db);},{readOnly:true});};
async function all(filters={},limit='3'){const rows=[];let cursor=null,total;do{const p=await controller.publications('',cursor,limit,response,JSON.stringify(filters));total??=p.counts.matchedRecords;assert.equal(p.counts.matchedRecords,total);rows.push(...p.items);cursor=p.nextCursor;assert(rows.length<20000);}while(cursor);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);assert.equal(rows.length,total);return rows;}
test('real database stock has classified fields; combination counts and keyset pages match full currently approved universe',async()=>{
 const original=await all();assert(original.some(x=>x.classification?.claims.length));
 for(const input of [{types:['original','systematic']},{methods:['acupuncture'],diseases:['depression']},{designs:['unknown']},{year:'3'},{languages:['en'],fulltext:'readable'},{year:'custom',from:'2026-01-01',to:'2026-12-31'}]){
  const f=normalizePublicationFilters(input),expected=original.filter(x=>matchesPublicationFilters(x,f));
  const page=await controller.publications('',null,'2',response,JSON.stringify(input));
  assert.equal(page.counts.matchedRecords,expected.length);assert.deepEqual(page.facets,publicationFacets(original,f));
  const paged=await all(input,'2');assert.deepEqual(paged.map(x=>x.id),expected.map(x=>x.id));
  if(page.nextCursor)await assert.rejects(()=>controller.publications('',page.nextCursor,'2',response,JSON.stringify({...input,fulltext:input.fulltext==='readable'?'unavailable':'readable'})),e=>e.getStatus?.()===400);
 }
 checks.push('stock_classifications_combination_counts_and_full_keyset_pages');
});
test('production parameterized SQL matches JS semantics, counts all rows before LIMIT and drops revoked abstract labels',()=>tx(async db=>{
 const input=[{id:1,title:'Acupuncture for depression: a randomized controlled trial',abstract:'Methods: Adult patients with depression received acupuncture.',year:2026},{id:2,title:'Acupuncture for anxiety disorders: a systematic review',abstract:'Methods: Older adults were studied.',year:2024},{id:3,title:'An unclassified paper',abstract:'Methods: Adult patients with depression received electroacupuncture.',year:2025},{id:4,title:'Novel unknown paper',abstract:null,year:2023}];
 const rows=input.map(x=>({...x,hash:'hash-'+x.id,classification:extractClassification({...x,sourceHash:'hash-'+x.id}),allowedAbstract:x.id===3?null:x.abstract}));
 const values=classificationValuesSql(sql`x.classification`,sql`x.hash`,sql`x.title`,sql`x."allowedAbstract"`);
 const base=sql`SELECT x.*,${values} AS "facetValues" FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(id int,title text,abstract text,"allowedAbstract" text,year int,hash text,classification jsonb)`;
 const fields={values:sql`e."facetValues"`,year:sql`e.year`,date:sql`NULL::jsonb`,readable:sql`false`};
 for(const input of [{},{types:['original'],people:['adult']},{people:['unknown']},{diseases:['depression'],methods:['acupuncture','electroacupuncture']},{year:'3'}]){
  const filters=normalizePublicationFilters(input),projected=rows.map(x=>({...x,classification:projectClassification(x.classification,{title:x.title,abstract:x.allowedAbstract,sourceHash:x.hash})}));
  const expected=projected.filter(x=>matchesPublicationFilters(x,filters));
  const actual=await db.$queryRaw`WITH eligible AS MATERIALIZED (${base}) SELECT e.id,count(*) OVER()::int AS total FROM eligible e WHERE ${filterSql(fields,filters)} ORDER BY id LIMIT 1`;
  assert.deepEqual(actual,expected.length?[{id:expected[0].id,total:expected.length}]:[]);
  const [stats]=await db.$queryRaw`WITH eligible AS MATERIALIZED (${base}) SELECT ${facetCountsSql(fields,filters)} AS facets FROM eligible e`;assert.deepEqual(stats.facets,publicationFacets(projected,filters));
 }
 checks.push('SQL_JS_parity_pre_limit_count_and_revoked_abstract_projection');
}));
test('invalid filters reject instead of silently broadening; current identity and real RLS remain enforced',()=>tx(async db=>{
 for(const input of ['{',JSON.stringify({designs:['rct) OR true --']}),JSON.stringify({year:'custom',from:'2026-99-01'}),JSON.stringify({unrecognized:1})])await assert.rejects(()=>controller.publications('',null,'2',response,input),e=>e.getStatus?.()===400);
 const row=await db.account.findFirst({where:{id:ids.owner,tenantId:ids.tenant},select:{authVersion:true}});
 await assert.rejects(()=>controller.memberCollection({user:{accountId:ids.owner,tenantId:ids.tenant,authVersion:row.authVersion+99}},'publications','',null,'2',response,'{}'),e=>e.getStatus?.()===403);
 await db.$executeRaw`SELECT set_config('app.tenant_id','paper-filters-unowned-synthetic-tenant',true)`;
 const [count]=await db.$queryRaw`SELECT (SELECT count(*)::int FROM rh_source.canonical_publication) AS workbook,(SELECT count(*)::int FROM rh_source.pmc_candidate_version) AS pmc`;assert.deepEqual(count,{workbook:0,pmc:0});
 checks.push('strict_validation_stale_identity_and_actual_RLS');
}));
test('independent review real inventory cases are re-extracted without inherited RCTs or animal clinical classifications',()=>tx(async db=>{
 const rows=await db.$queryRaw`SELECT r.id,r.title,c.classification FROM rh_source.source_record r JOIN rh_source.canonical_publication c ON c.source_record_id=r.id AND c.tenant_id=r.tenant_id AND c.hub_key=r.hub_key
  WHERE r.tenant_id=${ids.tenant} AND r.hub_key='lingshu-xinyu' AND
   (r.id IN ('rhsr-e05b355763baa1b54449d869dcb4d155ae83e75e','rhsr-29a94d44305ffd41c55ed7040e958548439fe725','rhsr-34c162e3b0e9835fe741ff7af9a8f2cb80713180')
    OR lower(r.title) LIKE '%overview of meta-analyses%' OR lower(r.title) LIKE '%meta-regression of randomized controlled trials%' OR r.title LIKE 'No One-Size-Fits-All Placebo:%')`;
 assert(rows.length>=6,'REAL_STOCK_REGRESSION_CASES_REQUIRED');
 for(const row of rows){assert.equal(row.classification.extractorVersion,'paper-facets-rules-v1.3');assert(!row.classification.claims.some(c=>c.value==='rct'),row.title);
  if(/\bmouse\b|\bmice\b/i.test(row.title))assert(!row.classification.claims.some(c=>['diseases','people'].includes(c.facet)),row.title);
 }
 checks.push('independent_review_inventory_cases_reclassified_v1_3');
}));
after(()=>writeFileSync(out+'/result.json',JSON.stringify({passed:checks.length===4,checks,databaseReadOnly:true,modelCalls:0},null,2)));
