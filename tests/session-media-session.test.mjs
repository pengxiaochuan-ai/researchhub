import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/session-media-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('media paths stay in the current session and never accept arbitrary URLs or storage keys',()=>{
 assert(api,'media frontend contract missing');
 assert(api.sessionMediaRequestAllowed('POST','/sessions/session-1/media-uploads'));
 assert(api.sessionMediaRequestAllowed('POST','/sessions/session-1/media-uploads/12345678-1234-4234-a234-123456789012/chunks/0'));
 for(const p of ['/sessions/../media','https://other/media','/sessions/s/media?storageKey=x','/sessions/s/media?limit=500'])assert(!api.sessionMediaRequestAllowed('GET',p));
 assert.equal(api.mediaContentHref('s1','media-1'),'/api/sessions/s1/media/media-1/content');
 assert.equal(api.mediaContentHref('../s1','media-1'),null);
});
test('raw video uses three bounded workers and stops before completion after a context change',async()=>{
 assert(api);let active=0,max=0,completed=0,chunks=0,allow=true;
 const file=new Blob([new Uint8Array(4*1024*1024+7)]);file.name='generated.mp4';
 const item={id:'media-1',version:2,name:'media-1.mp4',extension:'mp4',byteSize:file.size,archiveState:'pending',inspectionState:'pending',classification:null,inspection:{hasAudio:false,hasVideo:false},contentUnderstood:false,createdAt:new Date().toISOString()};
 const client={post:async(path)=>{if(path.endsWith('/complete')){completed++;return{...item,archiveState:'archived',inspectionState:'complete',classification:'valid'};}return{item,uploadId:'12345678-1234-4234-a234-123456789012',chunkSize:1024*1024,totalChunks:5};},upload:async(_p,_b,opts)=>{assert.equal(opts.contentType,'application/octet-stream');active++;max=Math.max(active,max);await new Promise(ok=>setTimeout(ok,2));active--;chunks++;return{uploaded:true};}};
 await api.uploadMediaFile({client,sid:'s1',file,requestKey:'media-test',beforeRequest:async()=>allow});assert.equal(completed,1);assert.equal(chunks,5);assert(max<=3);
 chunks=0;completed=0;client.upload=async()=>{allow=false;return{uploaded:true};};
 await assert.rejects(api.uploadMediaFile({client,sid:'s1',file,requestKey:'media-test-2',beforeRequest:async()=>allow}),/变化/);assert.equal(completed,0);
});
test('pending media retains completion identity until the server confirms archive or definitive failure',()=>{
 assert.equal(typeof api.readPendingMedia,'function');
 const record={requestKey:'media-unknown',uploadId:'12345678-1234-4234-a234-123456789012',phase:'completing',byteSize:20,extension:'mp4'};
 assert.deepEqual(api.readPendingMedia(JSON.stringify([record])),[record]);
 const item={id:'media-1',version:3,name:'media-1.mp4',extension:'mp4',byteSize:20,archiveState:'pending',inspectionState:'pending',classification:null,inspection:{},contentUnderstood:false,createdAt:new Date().toISOString()};
 assert.deepEqual(api.recoverMediaReceipt(record,{found:true,item}).pending,record);
 assert.equal(api.recoverMediaReceipt(record,{found:true,item:{...item,archiveState:'archived'}}).pending,null);
});
