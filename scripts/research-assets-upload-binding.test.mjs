import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetUploadBinding} from './research-assets-upload-binding.mjs';
const p={accountId:'o',tenantId:'t',studyGroupId:'g',researchProjectId:'p',authVersion:1},ids={owner:'o',admin:'a'};
const value={kind:'dataset',metadata:{title:'合成字典'},sourceKind:'upload',sourceBindings:[],policy:{rightsEvidence:'原创合成',discoveryRecipients:['o','a']},uploadId:'upload-one',requestKey:'register-upload-1'};
const item={uploadId:'upload-one',accountId:'o',tenantId:'t',studyGroupId:'g',researchProjectId:'p',contentMd:'合成字典正文',sha256:'a'.repeat(64),sizeBytes:18,mimeType:'text/markdown',filename:'asset-safe.md',storageMode:'local_fallback',storageKey:'not-returned',status:'pending'};
test('upload resolution preserves one reserved target across an unknown result and refuses another request',async()=>{
 let saved,confirmed=0;const store={resolve:async()=>saved?{...item,binding:saved}:item,prepareBinding:async(_p,_id,target)=>{saved=target;},confirmBinding:async()=>{confirmed++;},inspect:()=>({items:[]})};
 const binding=createAssetUploadBinding({ids,store,withAccess:async(_u,permission,run)=>{assert.equal(permission,'artifact.read');return run({$queryRawUnsafe:async()=>[{request_hash:saved.requestHash,result_receipt:{assetId:saved.assetId,version:1,status:'committed'}}]},p);}});
 const first=await binding.resolve(null,p,value,{requestHash:'b'.repeat(64),version:1});await binding.prepare(null,p,first);
 const retry=await binding.resolve(null,p,value,{requestHash:'b'.repeat(64),version:1});assert.equal(retry.reservedAssetId,first.reservedAssetId);assert.equal(first.sourceBindings[0].id,'upload-one');assert(first.file.storageKey.startsWith('hub-local-fallback:'));
 await assert.rejects(binding.resolve(null,p,{...value,requestKey:'register-other'},{requestHash:'b'.repeat(64),version:1}),e=>e.status===409);
 await binding.confirm({},retry,{assetId:first.reservedAssetId,version:1,status:'committed'});assert.equal(confirmed,1);
});
test('a bound manifest alone cannot make a file source current without the committed event and true version/file parent',async()=>{
 const target={assetId:'asset-one',version:1,requestKey:value.requestKey,requestHash:'b'.repeat(64)},bound={...item,binding:target,status:'binding'};let receipt=true,file=true,bytes=true;
 const store={inspect:()=>({items:[bound]}),verifyBound:async()=>bytes};
 const binding=createAssetUploadBinding({ids,store,withAccess:()=>assert.fail()});
 const tx={$queryRawUnsafe:async()=>receipt?[{request_hash:target.requestHash,result_receipt:{assetId:'asset-one',version:1,status:'committed'}}]:[],researchArtifactVersion:{findFirst:async()=>({id:'version-one'})},researchArtifactFile:{findFirst:async()=>file?{sha256:item.sha256}:null}};
 const policy={assetId:'asset-one',version:1,sourceKind:'upload',sourceBindings:[{kind:'upload',id:item.uploadId,version:1,contentHash:item.sha256}]};
 assert.equal(await binding.assertSources(tx,p,policy),true);
 receipt=false;assert.equal(await binding.assertSources(tx,p,policy),false);receipt=true;file=false;assert.equal(await binding.assertSources(tx,p,policy),false);file=true;bytes=false;assert.equal(await binding.assertSources(tx,p,policy),false);
});
test('pending upload choices use the same clock and expose only this identity, not another account or bound/expired files',()=>{
 const now=Date.parse('2026-11-12T00:00:00Z'),current={...item,authVersion:1,expiresAt:new Date(now+1000).toISOString()};
 const binding=createAssetUploadBinding({ids,now:()=>now,withAccess:()=>assert.fail(),store:{inspect:()=>({items:[current,{...current,uploadId:'other',accountId:'a'},{...current,uploadId:'expired',expiresAt:new Date(now).toISOString()},{...current,uploadId:'bound',status:'bound'},{...current,uploadId:'old-token',authVersion:0}]})}});
 const rows=binding.list(p);assert.deepEqual(rows.map(x=>x.uploadId),[item.uploadId]);assert(!JSON.stringify(rows).includes('not-returned'));
});
test('operation reconciliation needs current locked no-event/no-parent proof, and commits finalize only the true file',async()=>{
 const target={assetId:'asset-one',version:1,requestKey:value.requestKey,requestHash:'b'.repeat(64)},bound={...item,authVersion:1,binding:target,status:'binding'};let released=0,confirmed=0,parent=null,file=true,event=true;
 const store={inspect:()=>({items:[bound]}),releaseUncommittedBinding:async()=>{released++;},confirmBinding:async()=>{confirmed++;},verifyBound:async()=>true};
 const binding=createAssetUploadBinding({ids,store,withAccess:()=>assert.fail()});
 const tx={researchArtifact:{findFirst:async()=>parent},$queryRawUnsafe:async()=>event?[{request_hash:target.requestHash,result_receipt:{assetId:target.assetId,version:1,status:'committed'}}]:[],researchArtifactVersion:{findFirst:async()=>({id:'v'})},researchArtifactFile:{findFirst:async()=>file?{sha256:item.sha256}:null}};
 await binding.reconcile(tx,p,target.requestKey,{assetId:target.assetId,version:1,status:'committed',uploadId:item.uploadId});assert.equal(confirmed,1);assert.equal(released,0);
 file=false;await assert.rejects(binding.reconcile(tx,p,target.requestKey,{assetId:target.assetId,version:1,status:'committed',uploadId:item.uploadId}));assert.equal(confirmed,1);
 parent={id:target.assetId};event=false;await assert.rejects(binding.reconcile(tx,p,target.requestKey,null));assert.equal(released,0);
 parent=null;await binding.reconcile(tx,p,target.requestKey,null);assert.equal(released,1);
});
