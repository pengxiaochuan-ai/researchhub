import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {MEDIA_IDENTITY_SCHEMA,MEDIA_IDENTITY_CHUNK,mediaIdentityDescriptor} from '../../src/media-content-identity.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(code,status=503)=>{throw Object.assign(Error(code),{code,status});};
const same=(a,b)=>a.ino===b.ino&&a.dev===b.dev&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
async function directory(path){const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())fail('MEDIA_CHUNKS_UNAVAILABLE');return s;}
async function readRegular(path,max,exact){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await handle.stat();
  if(!before.isFile()||before.size>max||exact!==undefined&&before.size!==exact)return null;
  const bytes=await handle.readFile(),after=await handle.stat();
  return same(before,after)&&bytes.length===before.size?bytes:null;
 }finally{await handle.close();}
}
// Read only the v1 native store's atomically renamed parts. No private methods,
// cleanup, TTL renewal, arbitrary paths, or changes to the legacy store.
export function createMediaChunkSnapshot({directory:root,ttlMs=2*60*60*1000,now=()=>Date.now()}){
 return async(context,row)=>{
  const uploadId=row.upload_id;
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(uploadId))fail('MEDIA_INPUT',400);
  const pending=join(root,'pending'),path=join(pending,uploadId),byteSize=Number(row.byte_size),totalChunks=Math.ceil(byteSize/MEDIA_IDENTITY_CHUNK);
  try{
   await directory(root);await directory(pending);const dir=await directory(path);
   if(dir.mtimeMs+ttlMs<=now())fail('MEDIA_UPLOAD_EXPIRED',410);
   const bytes=await readRegular(join(path,'manifest.json'),8192);if(!bytes)fail('MEDIA_CHUNKS_UNAVAILABLE');
   let m;try{m=JSON.parse(bytes.toString('utf8'));}catch{fail('MEDIA_CHUNKS_UNAVAILABLE');}
   if(m.version!==1||m.uploadId!==uploadId||Object.entries(context).some(([k,v])=>m[k]!==v)||m.binding!==row.request_fingerprint||m.sizeBytes!==byteSize||m.chunkSize!==MEDIA_IDENTITY_CHUNK||m.totalChunks!==totalChunks||m.extension!=='.'+row.extension||m.safeFilename!=='upload.'+row.extension||m.mimeType!==row.content_type)fail('MEDIA_CHUNKS_UNAVAILABLE');
   const received=[];
   for(let index=0;index<totalChunks;index++){
    const expected=Math.min(MEDIA_IDENTITY_CHUNK,byteSize-index*MEDIA_IDENTITY_CHUNK);
    let part;try{part=await readRegular(join(path,`part-${String(index).padStart(6,'0')}`),MEDIA_IDENTITY_CHUNK,expected);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(part)received.push({index,byteSize:part.length,sha256:sha(part)});
   }
   const after=await directory(path);if(after.ino!==dir.ino||after.dev!==dir.dev)fail('MEDIA_CHUNKS_UNAVAILABLE');
   return{uploadId,chunkSize:MEDIA_IDENTITY_CHUNK,totalChunks,byteSize,received};
  }catch(e){if(e.status)throw e;if(e.code==='ENOENT')fail('MEDIA_UPLOAD_EXPIRED',410);fail('MEDIA_CHUNKS_UNAVAILABLE');}
 };
}
export async function identityFromMediaPath(path,byteSize){
 if(!Number.isSafeInteger(byteSize)||byteSize<1||byteSize>500*MEDIA_IDENTITY_CHUNK)fail('MEDIA_INPUT',400);
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await handle.stat();if(!before.isFile()||before.size!==byteSize)fail('MEDIA_FILE_IDENTITY_CHANGED',409);
  const hashes=[],buffer=Buffer.allocUnsafe(MEDIA_IDENTITY_CHUNK);
  for(let position=0;position<byteSize;){
   const expected=Math.min(buffer.length,byteSize-position);let offset=0;
   while(offset<expected){const {bytesRead}=await handle.read(buffer,offset,expected-offset,position+offset);if(!bytesRead)fail('MEDIA_FILE_IDENTITY_CHANGED',409);offset+=bytesRead;}
   hashes.push(sha(buffer.subarray(0,expected)));position+=expected;
  }
  if(!same(before,await handle.stat()))fail('MEDIA_FILE_IDENTITY_CHANGED',409);
  return{schema:MEDIA_IDENTITY_SCHEMA,root:sha(mediaIdentityDescriptor(byteSize,hashes))};
 }finally{await handle.close();}
}
