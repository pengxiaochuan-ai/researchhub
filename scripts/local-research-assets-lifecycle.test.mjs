import test from 'node:test';import assert from 'node:assert/strict';
const m=await import('./local-research-assets-lifecycle.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner',identityRevision:'identity',permissions:['artifact.edit']},r={registry:{...p,assetId:'a',ownerAccountId:'owner',revision:1,workingVersionNo:1,workingState:'draft',releaseState:'unreleased',everSubmitted:false,deletedAt:null},policies:[{version:1,sourceValid:true,contentHash:'a'.repeat(64),policyHash:'b'.repeat(64)}],events:[{type:'created',version:1,revision:1}],grants:[]};
const input=(action,extra={})=>({action,version:1,expectedRevision:1,identityRevision:'identity',contentHash:'a'.repeat(64),policyHash:'b'.repeat(64),requestKey:'original-key',reason:'原创新草稿阶段结束',...extra});
const run=(record,i)=>{assert.equal(typeof m.lifecycleTransition,'function','approved soft recycle transition is missing');return m.lifecycleTransition(record,[record],i,p,Date.parse('2026-11-13T00:00:00Z'));};
test('only never-submitted drafts without reference/grant history can be soft recycled',()=>{
 assert(run(r,input('trash')).deletedAt);assert.equal(r.registry.deletedAt,null);
 for(const change of [{everSubmitted:true},{workingState:'approved'},{releaseState:'withdrawn'}])assert.throws(()=>run({...r,registry:{...r.registry,...change}},input('trash')),e=>e.status===409);
 assert.throws(()=>run({...r,grants:[{state:'revoked'}]},input('trash')),e=>e.status===409);
 assert.throws(()=>run({...r,events:[...r.events,{type:'cited',version:1,revision:2}]},input('trash')),e=>e.status===409);
});
test('restoring rechecks fixed source and CAS and never returns or reconstructs old grants',()=>{
 const deleted={...r,registry:{...r.registry,deletedAt:'2026-11-12T00:00:00Z'}};assert.equal(run(deleted,input('restore')).deletedAt,null);
 assert.throws(()=>run(deleted,input('restore',{expectedRevision:2})),e=>e.status===409);
 assert.throws(()=>run({...deleted,policies:[{...r.policies[0],sourceValid:false}]},input('restore')),e=>e.status===409);
 assert(!Object.hasOwn(run(deleted,input('restore')),'grants'));
});
test('trash reserves one remaining restore event inside the unchanged 24-event ceiling',()=>{
 const at=n=>({...r,registry:{...r.registry,revision:n}});
 const trashed=run(at(22),input('trash',{expectedRevision:22}));assert.equal(trashed.revision,23);
 assert.equal(run({...r,registry:trashed},input('restore',{expectedRevision:23})).revision,24);
 assert.throws(()=>run(at(23),input('trash',{expectedRevision:23})),e=>e.code==='ASSET_CATALOG_FIXTURE_CAPACITY');
 assert.throws(()=>run({...r,registry:{...trashed,revision:24}},input('restore',{expectedRevision:24})),e=>e.code==='ASSET_CATALOG_FIXTURE_CAPACITY');
});
