import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {getVisiblePmc} from './pmc-visible.mjs';
import {runHubSourceSearch,assertCurrentAiSources} from './agent-retrieval.mjs';

const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu'};
const owner={accountId:ids.owner,tenantId:ids.tenant};
const tx=async fn=>{await assertFixtureTarget(env);return withFixtureTransaction(env,'app',async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const current=await db.account.findFirst({where:{id:ids.owner,tenantId:ids.tenant,status:'active'},select:{authVersion:true}});assert(current);owner.authVersion=current.authVersion;
  return fn(db);
},{readOnly:true});};

test('current approved real PMC citation passes revalidation; changed hash, DOI and versions fail without writes',()=>tx(async db=>{
  const item=await getVisiblePmc({db,...scope,recordId:'pmc-PMC13672493'});
  assert.ok(item,'CURRENT_ADMIN_APPROVAL_REQUIRED');
  const result=await runHubSourceSearch({db,...scope,principal:owner,query:item.title.slice(0,70)});
  const source=result.meta.sources.find(s=>s.pmcRecordId===item.id);assert.ok(source);
  await assertCurrentAiSources({db,...scope,principal:owner,sources:[source]});
  for(const changed of [{rawSha256:'0'.repeat(64)},{snippetHash:'0'.repeat(64)},
    {doi:'tampered-doi'},{reviewVersion:'article:0'},{articleVersion:'changed-version'},
    {snippetOffset:-1},{sourceUrl:'https://invalid.example/not-the-source'}]){
    await assert.rejects(()=>assertCurrentAiSources({db,...scope,principal:owner,sources:[{...source,...changed}]}),/HUB_SOURCE_CHANGED/);
  }
}));

test('real approved article body is searchable and bound to its actual field, not invented title-only provenance',()=>tx(async db=>{
  const item=await getVisiblePmc({db,...scope,recordId:'pmc-PMC13672493'});assert.ok(item?.body);
  const body=String(item.body).replace(/\s+/g,' ');
  const query=body.slice(-90,-20);assert.ok(query.length>=2);
  const result=await runHubSourceSearch({db,...scope,principal:owner,query});
  const source=result.meta.sources.find(s=>s.pmcRecordId===item.id);assert.ok(source);
  assert.equal(source.snippetField,'body');
  await assertCurrentAiSources({db,...scope,principal:owner,sources:[source]});
}));

test('current read-only sources reject cross-tenant and stale account authorization without changing roles',()=>tx(async db=>{
  for(const principal of [{...owner,tenantId:'other-tenant'},{...owner,authVersion:999}])
    await assert.rejects(()=>runHubSourceSearch({db,...scope,principal,query:'acupuncture'}),/HUB_SOURCE_SCOPE_REJECTED/);
}));
