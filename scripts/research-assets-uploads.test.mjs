import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createAssetUploadStore} from './research-assets-uploads.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {assertKnowledgeImportFile}=require('./src/knowledge/knowledge-file-policy.ts');
const directories=[];after(()=>{for(const path of directories)rmSync(path,{recursive:true,force:true});});
const ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'o',authVersion:1};
function fixture(options={}){const directory=mkdtempSync(join(tmpdir(),'rh-asset-upload-test-'));directories.push(directory);return createAssetUploadStore({directory,ids,inspectFile:assertKnowledgeImportFile,storageEndpoint:'http://127.0.0.1:19402',...options});}
const file={originalname:'original-synthetic.md',mimetype:'text/markdown',buffer:Buffer.from('# 合成材料\n\n无患者数据，仅本轮方法说明。','utf8')};
test('real old file inspector plus local fallback preserve one idempotent private upload without KB import',async()=>{
 const store=fixture({storage:{available:true,put:async()=>{throw new Error('local synthetic storage offline');}}});
 const first=await store.stage(p,file,'upload-original-1'),repeat=await store.stage(p,file,'upload-original-1');assert.equal(first.uploadId,repeat.uploadId);assert.equal(first.status,'pending');assert.equal(first.storageMode,'local_fallback');assert.equal('storageKey' in first,false);
 const resolved=await store.resolve(p,first.uploadId);assert.equal(resolved.contentMd,file.buffer.toString('utf8'));
 await assert.rejects(store.stage(p,{...file,buffer:Buffer.from('不同正文')},'upload-original-1'),e=>e.status===409);
 await assert.rejects(store.resolve({...p,accountId:'a'},first.uploadId),e=>e.status===404);
 await assert.rejects(store.resolve({...p,authVersion:2},first.uploadId),e=>e.status===409);
});
test('invalid bytes, wrong formats and limits are refused before any storage write',async()=>{
 let writes=0;const store=fixture({storage:{available:true,put:async()=>writes++}});
 for(const invalid of [{...file,originalname:'evil.pdf'},{...file,buffer:Buffer.from([255,254,0,0])},{...file,buffer:Buffer.from('a\u0000b')},{...file,buffer:Buffer.alloc(5*1024*1024+1,65)},{...file,buffer:Buffer.alloc(0)}])await assert.rejects(store.stage(p,invalid,'bad-upload-'+writes));
 assert.equal(writes,0);
 for(let n=0;n<4;n++)await store.stage(p,{...file,buffer:Buffer.from('原创合成材料 '+n)},'bounded-upload-'+n);
 await assert.rejects(store.stage(p,file,'bounded-upload-over'),e=>e.status===409);
});
test('creation and expiry derive from one captured clock value, not two drifting reads',async()=>{
 let tick=Date.parse('2026-11-12T00:00:00Z');const store=fixture({now:()=>tick++});await store.stage(p,file,'single-clock-upload');
 const [item]=store.inspect().items;assert.equal(Date.parse(item.expiresAt)-Date.parse(item.createdAt),24*3600000);
});
test('24h pending expiry and once-only commit binding keep unknown results recoverable, not deleted',async()=>{
 let now=Date.parse('2026-11-12T00:00:00Z');const store=fixture({now:()=>now});const first=await store.stage(p,file,'binding-upload-1');
 const target={assetId:'asset-new',version:1,requestKey:'asset-register-1',requestHash:'a'.repeat(64)};
 await store.prepareBinding(p,first.uploadId,target);await store.prepareBinding(p,first.uploadId,target);
 await assert.rejects(store.prepareBinding(p,first.uploadId,{...target,requestKey:'different-key'}),e=>e.status===409);
 assert.equal((await store.resolve(p,first.uploadId,target)).binding.assetId,'asset-new');
 await store.confirmBinding(p,first.uploadId,{assetId:'asset-new',version:1,status:'committed'},target);assert.equal((await store.resolve(p,first.uploadId,target)).status,'bound');
 const pending=await store.stage(p,{...file,buffer:Buffer.from('另一个合成材料')},'binding-upload-2');now+=24*3600000;
 await assert.rejects(store.resolve(p,pending.uploadId),e=>e.status===409);assert.equal((await store.resolve(p,first.uploadId,target)).status,'bound');
 await assert.rejects(store.stage(p,{...file,buffer:Buffer.from('另一个合成材料')},'binding-upload-2'),e=>e.status===409);
 assert.equal(store.inspect().items.length,2);assert.equal(store.inspect().items.find(x=>x.uploadId===pending.uploadId).status,'pending');
});
test('only an explicitly reconciled uncommitted binding returns to pending; bound files never rebind',async()=>{
 const store=fixture(),file1=await store.stage(p,file,'recover-upload-1'),target={assetId:'asset-recover',version:1,requestKey:'asset-recover-1',requestHash:'b'.repeat(64)};
 await store.prepareBinding(p,file1.uploadId,target);
 await assert.rejects(store.releaseUncommittedBinding(p,file1.uploadId,{...target,requestKey:'wrong-original'}),e=>e.status===409);
 await store.releaseUncommittedBinding(p,file1.uploadId,target);assert.equal((await store.resolve(p,file1.uploadId)).status,'pending');assert(!store.inspect().items[0].binding);
 const next={...target,requestKey:'asset-recover-2'};await store.prepareBinding(p,file1.uploadId,next);await store.confirmBinding(p,file1.uploadId,{assetId:next.assetId,version:1,status:'committed'},next);
 await assert.rejects(store.releaseUncommittedBinding(p,file1.uploadId,next),e=>e.status===409);assert.equal(store.inspect().items.length,1);
});
