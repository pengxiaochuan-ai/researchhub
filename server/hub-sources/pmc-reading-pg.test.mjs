import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {readFile} from 'node:fs/promises';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {listPmcReviewItems} from './pmc-review-service.mjs';import {getPmcReviewArticle} from './pmc-reading-service.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const runtime=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8')),{ids}=runtime;
const scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin};
const principal=()=>({accountId:ids.admin,tenantId:ids.tenant,authVersion:0});
const tx=async fn=>{await assertFixtureTarget(env);return withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;return fn(db);},{readOnly:true});};
test('two actual local articles yield structured original sections, references and exact semantic tables without DB writes',()=>tx(async db=>{
  const items=await listPmcReviewItems({db,...scope,principal:principal()});
  for(const pmcid of ['PMC13678665','PMC13672493']) {
    const item=items.find(x=>x.pmcid===pmcid),r=await getPmcReviewArticle({db,...scope,principal:principal(),versionId:item.versionId});
    assert.ok(r.blocks.length);assert.ok(r.references.length>10);assert.ok(Object.keys(r.targets).length>10);
    assert.equal(r.rawSha256,item.rawSha256);assert.equal(r.pmcid,pmcid);
    if(pmcid==='PMC13672493'){assert.equal(r.tables.length,2);assert.equal(r.media.length,2);assert.ok(r.tables[0].rows[0].some(x=>x.kind==='th'));}
    assert.ok(item.componentManifest.some(x=>x.kind==='pdf'));
  }
}));
test('reading rejects wrong reviewer, wrong tenant, missing version and corrupted bytes',()=>tx(async db=>{
  const item=(await listPmcReviewItems({db,...scope,principal:principal()})).find(x=>x.pmcid==='PMC13672493');
  for(const bad of [{...principal(),accountId:ids.owner},{...principal(),tenantId:'other-tenant'}])
    await assert.rejects(()=>getPmcReviewArticle({db,...scope,principal:bad,versionId:item.versionId}),/REVIEW_AUTH_REQUIRED/);
  await assert.rejects(()=>getPmcReviewArticle({db,...scope,principal:principal(),versionId:'missing-version'}),/SCOPE_REJECTED/);
  await assert.rejects(()=>getPmcReviewArticle({db,...scope,principal:principal(),versionId:item.versionId,readObject:async()=>Buffer.from('corrupt')}),/READING_INVALID/);
  const changed=principal();await assert.rejects(()=>getPmcReviewArticle({db,...scope,principal:changed,versionId:item.versionId,readObject:async path=>{const bytes=await readFile(path);changed.authVersion=999;return bytes;}}),/REVIEW_AUTH_REQUIRED/);
}));
test('actual HTTP reading uses original reviewer authorization, never researcher or anonymous access',async()=>{
  const base='http://127.0.0.1:19501',cookies={};
  for(const actor of ['admin','owner']){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(r.status,201);cookies[actor]=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');}
  const queue=await fetch(base+'/api/hub-sources/review-queue',{headers:{Cookie:cookies.admin}});assert.equal(queue.status,200);
  const item=(await queue.json()).items.find(x=>x.detail?.pmcid==='PMC13672493');const url=base+'/api/hub-sources/pmc-review-articles/'+item.detail.versionId;
  for(const [cookie,status] of [[cookies.admin,200],[cookies.owner,403],['',401]]){const r=await fetch(url,{headers:{Cookie:cookie}});assert.equal(r.status,status);if(status===200){assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).article.media.length,2);}}
});
