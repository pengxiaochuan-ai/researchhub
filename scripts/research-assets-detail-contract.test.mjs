import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./research-assets-detail-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
const p={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'rh-kb-local-b0e2af9d-project',catalogActors:{owner:'rh-kb-local-b0e2af9d-owner',admin:'rh-kb-local-b0e2af9d-admin'}};
test('old keys retain eight versions while exact A02 base and copy have separate caps',()=>{
 assert.equal(typeof api.catalogAssetFamily,'function');
 const row={ownerAccountId:p.catalogActors.owner,kind:'protocol'};
 assert.equal(api.catalogAssetFamily('rh-research-asset:catalog-20261112:owner:protocol',row,p).maxVersions,8);
 assert.equal(api.catalogAssetFamily('rh-research-asset:detail-20261113:owner:protocol',row,p).maxVersions,4);
 assert.equal(api.catalogAssetFamily('rh-research-asset:detail-20261113:owner:protocol:copy',row,p).maxVersions,2);
 assert.equal(api.catalogAssetFamily('rh-research-asset:detail-20261113:owner:analysis:copy',{...row,kind:'analysis'},p),null);
 assert.equal(api.catalogAssetFamily('rh-research-asset:detail-20261113:owner:protocol',row,{...p,researchProjectId:'other'}),null);
});
test('tag edits normalize edges, permit clearing and reject duplicates, control characters or oversize input',()=>{
 assert.equal(typeof api.validateAssetTags,'function');assert.deepEqual(api.validateAssetTags([' 针灸 ','情志病']),['针灸','情志病']);assert.deepEqual(api.validateAssetTags([]),[]);
 for(const v of [['a','a'],['a\u0000'],['x'.repeat(25)],Array.from({length:13},(_,i)=>String(i)),['  '],{},null])assert.throws(()=>api.validateAssetTags(v));
});
test('comparison preserves scientific text and reports deterministic metadata and line changes only',()=>{
 assert.equal(typeof api.compareFixedAssetVersions,'function');
 const a={version:1,contentMd:'原始行\n待核对\n末行',metadata:{title:'原题名',tags:[]}},b={version:2,contentMd:'原始行\n人工修订\n末行',metadata:{title:'修订题名',tags:['针灸']}};
 const c=api.compareFixedAssetVersions(a,b);assert.deepEqual(c.changedFields.map(x=>x.field),['tags','title']);assert.deepEqual(c.text.removed,['待核对']);assert.deepEqual(c.text.added,['人工修订']);assert.equal(c.text.prefixLines,1);assert.equal(c.text.suffixLines,1);
 assert.equal(api.compareFixedAssetVersions(a,{...a,version:2}).text.changed,false);assert.equal('scientificConclusion' in c,false);
});
