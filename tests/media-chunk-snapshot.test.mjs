import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,utimes,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMediaChunkSnapshot,identityFromMediaPath} from '../server/ai-agent/session-media-snapshot.mjs';
import {identifyMediaFile} from '../src/media-content-identity.js';
const uploadId='12345678-1234-4234-a234-123456789012',context={tenantId:'t',accountId:'a',sessionId:'s',studyGroupId:'g',researchProjectId:'p'};
const row={upload_id:uploadId,request_fingerprint:'a'.repeat(64),byte_size:2*1024*1024+7,extension:'mp4',content_type:'video/mp4',safe_filename:'synthetic.mp4'};
test('native v1 snapshot returns only real exact-sized regular parts, never paths or partial incoming files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rh-snapshot-')),path=join(root,'pending',uploadId);await mkdir(path,{recursive:true});
 const manifest={...context,version:1,uploadId,binding:row.request_fingerprint,sizeBytes:row.byte_size,chunkSize:1024*1024,totalChunks:3,extension:'.mp4',mimeType:row.content_type,safeFilename:'upload.mp4'};
 try{
  await writeFile(join(path,'manifest.json'),JSON.stringify(manifest));await writeFile(join(path,'part-000000'),Buffer.alloc(1024*1024));await writeFile(join(path,'part-000001'),Buffer.alloc(3));await writeFile(join(path,'part-000002.incoming-test'),Buffer.alloc(7));
  const read=createMediaChunkSnapshot({directory:root}),value=await read(context,row);
  assert.deepEqual(value.received,[{index:0,byteSize:1024*1024,sha256:createHash('sha256').update(Buffer.alloc(1024*1024)).digest('hex')}]);assert(!JSON.stringify(value).includes(root));
  await assert.rejects(read({...context,accountId:'other'},row),e=>e.code==='MEDIA_CHUNKS_UNAVAILABLE');
  await assert.rejects(read(context,{...row,request_fingerprint:'b'.repeat(64)}),e=>e.code==='MEDIA_CHUNKS_UNAVAILABLE');
  await symlink(join(path,'part-000000'),join(path,'part-000002'));await assert.rejects(read(context,row),e=>e.status===503);await rm(join(path,'part-000002'));
  const old=new Date(Date.now()-3*60*60*1000);await utimes(path,old,old);await assert.rejects(read(context,row),e=>e.status===410);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('browser bounded chunk identity equals actual server file identity, including a short tail',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rh-identity-')),path=join(root,'synthetic');const bytes=Buffer.alloc(1024*1024+23);bytes[10]=18;bytes[bytes.length-1]=93;
 try{await writeFile(path,bytes);const browser=await identifyMediaFile(new Blob([bytes]));assert.deepEqual(await identityFromMediaPath(path,bytes.length),browser.fileIdentity);await assert.rejects(identityFromMediaPath(path,bytes.length-1),e=>e.code==='MEDIA_FILE_IDENTITY_CHANGED');}
 finally{await rm(root,{recursive:true,force:true});}
});
