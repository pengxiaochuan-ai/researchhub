import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./research-assets-a02-preflight-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
const ids={tenant:'rh-kb-local-b0e2af9d-tenant',group:'rh-kb-local-b0e2af9d-group',project:'rh-kb-local-b0e2af9d-project',owner:'rh-kb-local-b0e2af9d-owner',admin:'rh-kb-local-b0e2af9d-admin'};
const manifest=()=>{assert.equal(typeof api.buildA02Manifest,'function');return api.buildA02Manifest(ids);};
test('exact approved inventory covers both actors, five kinds and six copies without granting anything',()=>{
 const m=manifest();assert.equal(m.assets.length,16);assert.equal(m.assets.filter(x=>x.mode==='base').length,10);assert.equal(m.assets.filter(x=>x.mode==='copy').length,6);
 assert.equal(new Set(m.assets.map(x=>x.key)).size,16);assert.equal(m.assets.reduce((n,x)=>n+x.maxVersions,0),52);assert.equal(m.assets.reduce((n,x)=>n+x.maxOperations,0),384);
 for(const a of ['owner','admin'])assert.equal(m.assets.filter(x=>x.actor===a&&x.mode==='base').length,5);
 assert.deepEqual(new Set(m.assets.filter(x=>x.mode==='copy').map(x=>x.kind)),new Set(['protocol','dataset','instrument','analysis','publication']));
 assert(m.assets.every(x=>x.initialState==='draft'&&x.initialGrants.length===0&&x.key.startsWith('rh-research-asset:detail-20261113:')));
});
test('B, four application drafts and owner membership are named, non-default and separate from source A',()=>{
 const m=manifest();assert.notEqual(m.targetStudy.id,ids.project);assert.equal(m.targetStudy.setDefault,false);assert.equal(m.targetStudy.ownerMembership.roleKey,'researcher');assert.equal(m.targetStudy.ownerMembership.accountId,ids.owner);
 assert.equal(m.applications.length,4);for(const a of ['owner','admin'])assert.equal(m.applications.filter(x=>x.actor===a).length,2);
 assert(m.applications.every(x=>x.targetProjectId===m.targetStudy.id&&x.maxVersions===2&&x.initialState==='draft'));
});
test('new four UTF8 files have verified bytes, and comments have same-version named parent links',()=>{
 const m=manifest();assert.equal(m.files.length,4);assert(m.files.every(x=>x.maxBytes===1048576&&x.byteLength>0&&x.byteLength<=x.maxBytes&&/^[a-f0-9]{64}$/.test(x.sha256)));
 assert.equal(m.comments.length,8);assert(m.comments.every(x=>x.version===1&&x.maxEvents===3));
 for(const c of m.comments.filter(x=>x.parentKey)){const p=m.comments.find(x=>x.key===c.parentKey);assert(p);assert.equal(p.assetKey,c.assetKey);assert.equal(p.version,c.version);}
 assert.equal(m.execution.applied,false);assert.equal(m.execution.paidCallsAllowed,false);
});
test('wrong tenant or duplicate actors cannot generate an approved-looking manifest',()=>{
 manifest();for(const next of [{...ids,tenant:'rh-kb-local-other-tenant'},{...ids,admin:ids.owner}])assert.throws(()=>api.buildA02Manifest(next));
});
test('tampered asset key, owner, limits or added purpose grant is rejected rather than normalized',()=>{
 const original=manifest();assert.equal(typeof api.assertA02Manifest,'function');assert.equal(api.assertA02Manifest(original,ids).length,64);
 for(const change of [m=>m.assets[0].key='rh-research-asset:catalog-20261112:owner:protocol',m=>m.assets[0].ownerAccountId=ids.admin,m=>m.assets[0].maxVersions=8,m=>m.assets[0].initialGrants.push('download'),m=>m.assets.push(structuredClone(m.assets[0]))]){
  const m=structuredClone(original);change(m);assert.throws(()=>api.assertA02Manifest(m,ids));
 }
});
test('cross-version reply, replacement target or clinical input cannot be smuggled into the plan',()=>{
 const original=manifest();for(const change of [m=>m.comments[1].version=2,m=>m.targetStudy.id=ids.project,m=>m.files[0].content='patient identifying data',m=>m.execution.paidCallsAllowed=true]){const m=structuredClone(original);change(m);assert.throws(()=>api.assertA02Manifest(m,ids));}
});
