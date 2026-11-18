import test from'node:test';import assert from'node:assert/strict';import{parseAssetOverviewQuery,createAssetOverview}from'./research-assets-overview-local.mjs';
const ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},user={tenantId:'t',accountId:'a',role:'tenant_admin',authVersion:1};
test('explicit local business actor admission still revalidates current account before discovery',async()=>{
 const u={...user,accountId:'rh-c1-asset-member-20261117',role:'researcher'};let calls=0;
 const transaction=async(_u,run)=>{calls++;return run({account:{findFirst:async()=>null},$queryRawUnsafe:()=>assert.fail('missing current account reached discovery')});};
 await assert.rejects(createAssetOverview({ids,transaction}).read(u,{}),e=>e.status===403);assert.equal(calls,0);
 await assert.rejects(createAssetOverview({ids,transaction,businessActors:[u.accountId]}).read(u,{}),e=>e.status===401);assert.equal(calls,1);
});
test('overview fixed selection uses business integer bounds without widening legacy versions',()=>{
 const selectedAssetId='rhab-12345678-1234-4123-8123-123456789abc';
 for(const selectedVersion of ['9','2147483647'])assert.equal(parseAssetOverviewQuery({selectedAssetId,selectedVersion}).selection.version,Number(selectedVersion));
 for(const selectedVersion of ['0','01','9.0','1e2','2147483648'])assert.throws(()=>parseAssetOverviewQuery({selectedAssetId,selectedVersion}));
 assert.throws(()=>parseAssetOverviewQuery({selectedAssetId:'legacy-asset',selectedVersion:'9'}));
 assert.throws(()=>parseAssetOverviewQuery({selectedAssetId:'rhab-forged',selectedVersion:'9'}));
});
test('overview has optional Study filter and strict read grammar',()=>{assert.equal(parseAssetOverviewQuery({}).studyFilter,null);assert.deepEqual(parseAssetOverviewQuery({studyGroupId:'g',researchProjectId:'p'}).studyFilter,{studyGroupId:'g',researchProjectId:'p'});for(const q of [{studyGroupId:'g'},{tab:'write'},{page:'0'},{token:'secret'},{selectedAssetId:'a'},new URLSearchParams('tab=graph&tab=trash')])assert.throws(()=>parseAssetOverviewQuery(q));});
test('cross-tenant identities and stale active accounts cannot reach catalog discovery',async()=>{let calls=0;const service=createAssetOverview({ids,assertSources:()=>true,transaction:async(_u,run)=>{calls++;return run({account:{findFirst:async()=>({...user,id:'a',status:'active',authVersion:2,tenant:{status:'active'}})},$queryRawUnsafe:()=>assert.fail('stale identity reached asset metadata')});}});await assert.rejects(service.read({...user,tenantId:'other'},{}),e=>e.status===403);assert.equal(calls,0);await assert.rejects(service.read(user,{}),e=>e.status===401);assert.equal(calls,1);});
test('a registered but unassembled Study blocks completeness instead of becoming false zero',async()=>{const service=createAssetOverview({ids,assertSources:()=>true,transaction:async(_u,run)=>run({account:{findFirst:async()=>({...user,id:'a',status:'active',tenant:{status:'active'}})},$queryRawUnsafe:async()=>[{study_group_id:'g',research_project_id:'unassembled'}]})});await assert.rejects(service.read(user,{}),e=>e.code==='ASSET_CATALOG_OVERVIEW_SCOPE_UNAVAILABLE');});
