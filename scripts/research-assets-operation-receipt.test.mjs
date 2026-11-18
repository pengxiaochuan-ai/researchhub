import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('./local-research-assets-registration.mjs');
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'s',accountId:'reader'},receipt={status:'committed',assetId:'asset',version:1,revision:5,operation:'cited',citation:{text:'此前私有书目',url:'/pages/a02/?assetCatalog=1',excerptIncluded:false}},now=Date.parse('2026-11-13T00:00:00Z');
const record={registry:{...p,assetId:'asset',ownerAccountId:'author',workingVersionNo:1},policies:[{version:1,sourceValid:true}],events:[{revision:1,version:1,type:'released',discoveryRecipients:['reader'],expiresAt:'2026-11-20T00:00:00Z'}],grants:[{version:1,recipientAccountId:'reader',state:'approved',actions:['cite'],expiresAt:'2026-11-20T00:00:00Z'}]};
test('original citation receipt is projected using current fixed-version discovery, cite and source rights',()=>{
 assert.equal(typeof mod.projectAssetOperationReceipt,'function');
 assert.deepEqual(mod.projectAssetOperationReceipt(receipt,record,p,now),receipt);
 const cases=[null,{...record,policies:[{version:1,sourceValid:false}]},{...record,grants:[]},{...record,events:[...record.events,{revision:2,version:1,type:'withdrawn'}]},{...record,events:[{...record.events[0],expiresAt:'2026-11-12T00:00:00Z'}]}];
 for(const current of cases){const r=mod.projectAssetOperationReceipt(receipt,current,p,now);assert.equal(r.status,'committed');assert.equal(r.assetId,'asset');assert.equal(r.contentAccess,'restricted');assert(!Object.hasOwn(r,'citation'));assert(!JSON.stringify(r).includes('此前私有书目'));}
 assert.equal(receipt.citation.text,'此前私有书目');
});
