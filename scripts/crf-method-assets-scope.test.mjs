import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const api=await import('./local-crf-method-assets.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const ids={tenant:'synthetic',group:'group',project:'study',owner:'owner',admin:'admin'},user={tenantId:'synthetic',studyGroupId:'group',researchProjectId:'study',accountId:'owner'};
const root={accountId:'owner',planId:'plan',collectionId:'collection',runId:'run',reportId:'report'};
const value=()=>({schema:'rh-crf-method-asset-scope.v1',enabled:true,approvedAt:'2026-10-26T03:44:38.000Z',tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accounts:[ids.owner,ids.admin],operations:['A01','A02','A03','A04'],marker:'rh-crf-method-asset.v1',prefix:'rh-crf-method-asset-20261026:',sourceRoots:[root]});
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'rh-wp08-scope-'));chmodSync(dir,0o700);const file=join(dir,'scope.json');try{writeFileSync(file,JSON.stringify(value()),{mode:0o600});fn({dir,file});}finally{rmSync(dir,{recursive:true,force:true});}}
test('new purpose validates exact actors/current Study/registered root on every read',()=>{
 assert.equal(typeof api.readCrfMethodAssetScope,'function','asset-purpose scope reader missing');fixture(({file})=>{
  assert.equal(api.readCrfMethodAssetScope(file,ids,user,'A01',root).enabled,true);
  for(const change of [{accountId:'other'},{tenantId:'other'},{studyGroupId:'other'},{researchProjectId:'other'}])assert.throws(()=>api.readCrfMethodAssetScope(file,ids,{...user,...change},'A01',root));
  assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01',{...root,reportId:'other'}));
  writeFileSync(file,JSON.stringify({...value(),enabled:false}));assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01',root));
 });
});
test('A01/A02/A03/A04 do not inherit from old permissions or one another',()=>{
 assert.equal(typeof api.readCrfMethodAssetScope,'function');fixture(({file})=>{
  writeFileSync(file,JSON.stringify({...value(),operations:['A01']}));assert(api.readCrfMethodAssetScope(file,ids,user,'A01'));
  for(const op of ['A02','A03','A04'])assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,op));
  writeFileSync(file,JSON.stringify({...value(),operations:['A02']}));assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A02'));
 });
});
test('scope rejects wrong marker, aliases, duplicate actors/roots, per-actor root overflow, malformed approval',()=>{
 assert.equal(typeof api.readCrfMethodAssetScope,'function');fixture(({file})=>{
  for(const change of [{schema:'old'},{marker:'old'},{prefix:'old'},{approvedAt:'invalid'},{accounts:['owner','owner']},{accounts:['owner','admin','other']},{operations:['A01','A01']},{operations:['A01','publish']},{sourceRoots:[root,root]},{sourceRoots:[{...root,accountId:'other'}]},{sourceRoots:Array.from({length:19},(_,i)=>({...root,reportId:'r'+i}))}]){
   writeFileSync(file,JSON.stringify({...value(),...change}));assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01'));
  }
 });
});
test('scope fails closed for missing file, symlink, public permissions, oversized input or public parent',()=>{
 assert.equal(typeof api.readCrfMethodAssetScope,'function');fixture(({file,dir})=>{
  assert.throws(()=>api.readCrfMethodAssetScope(join(dir,'missing'),ids,user,'A01'));
  const link=join(dir,'link.json');symlinkSync(file,link);assert.throws(()=>api.readCrfMethodAssetScope(link,ids,user,'A01'));
  chmodSync(file,0o644);assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01'));chmodSync(file,0o600);
  writeFileSync(file,' '.repeat(65537));assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01'));writeFileSync(file,JSON.stringify(value()));
  chmodSync(dir,0o755);assert.throws(()=>api.readCrfMethodAssetScope(file,ids,user,'A01'));
 });
});
