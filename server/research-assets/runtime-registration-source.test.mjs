import test from 'node:test';
import assert from 'node:assert/strict';
import {originalAssetInputOnly} from '../research-runtime/assets.mjs';
const principal={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
const authored={sourceKind:'author',sourceBindings:[],contentMd:'Explicit synthetic authored protocol'};
const rejected=e=>e.status===422&&e.code==='ASSET_CATALOG_SOURCE_ROUTE_REQUIRED';
test('generic registration rejects browser supplied report/copy/knowledge/upload origins',async()=>{
 for(const sourceKind of ['artifact','knowledge','upload'])await assert.rejects(async()=>originalAssetInputOnly(null,null,{...authored,sourceKind}),rejected);
 await assert.rejects(async()=>originalAssetInputOnly(null,null,{...authored,sourceBindings:[{}]}),rejected);
 assert.equal(await originalAssetInputOnly(null,null,authored),authored);
});
test('generic revision cannot erase report or copy lineage, including a previously laundered current version',async()=>{
 for(const rows of [[],[{source_kind:'artifact',source_bindings:[{}]}],[{source_kind:'artifact',source_bindings:[{}]},{source_kind:'author',source_bindings:[]}],[{source_kind:'author',source_bindings:[{}]}]]){
  const tx={$queryRawUnsafe:async(sql,...args)=>{assert.match(sql,/JOIN rh_asset.asset_registry/);assert.deepEqual(args,['tenant','group','project','rhab-test']);return rows;}};
  await assert.rejects(async()=>originalAssetInputOnly(tx,principal,authored,{assetId:'rhab-test'}),rejected);
 }
});
test('generic revision remains available for scoped assets whose entire history is original',async()=>{
 const tx={$queryRawUnsafe:async()=>[{source_kind:'author',source_bindings:[]},{source_kind:'author',source_bindings:[]}]};
 assert.equal(await originalAssetInputOnly(tx,principal,authored,{assetId:'rhab-test'}),authored);
});
test('explicit upload adapter can extend original/upload history but can never overwrite report/copy lineage',async()=>{const upload={sourceKind:'upload',sourceBindings:[],uploadId:'staged'};for(const kind of ['artifact','knowledge'])await assert.rejects(originalAssetInputOnly({$queryRawUnsafe:async()=>[{source_kind:kind,source_bindings:[{kind}]}]},principal,upload,{assetId:'rhab-test'},{allowUpload:true}),rejected);const tx={$queryRawUnsafe:async()=>[{source_kind:'author',source_bindings:[]},{source_kind:'upload',source_bindings:[{kind:'upload'}]}]};assert.equal(await originalAssetInputOnly(tx,principal,upload,{assetId:'rhab-test'},{allowUpload:true}),upload);await assert.rejects(originalAssetInputOnly(tx,principal,authored,{assetId:'rhab-test'},{allowUpload:true}),rejected);});
