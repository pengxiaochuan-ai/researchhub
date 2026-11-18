export const MEDIA_IDENTITY_SCHEMA='hub-media-content.v1';
export const MEDIA_IDENTITY_CHUNK=1024*1024;
export const validMediaIdentity=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='root,schema'&&value.schema===MEDIA_IDENTITY_SCHEMA&&/^[a-f0-9]{64}$/.test(value.root);
// A domain-separated digest of fixed-size chunk digests, not the original file SHA.
export const mediaIdentityDescriptor=(byteSize,hashes)=>JSON.stringify([MEDIA_IDENTITY_SCHEMA,byteSize,MEDIA_IDENTITY_CHUNK,hashes]);
export async function identifyMediaFile(file,{current=async()=>{},onChecking=()=>{}}={}){
 if(!globalThis.crypto?.subtle)throw Error('浏览器无法核对视频，请使用当前版本Chrome并从原页面操作。');
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 const hashes=[];
 for(let start=0;start<file.size;start+=MEDIA_IDENTITY_CHUNK){
  await current();hashes.push(await digest(await file.slice(start,Math.min(file.size,start+MEDIA_IDENTITY_CHUNK)).arrayBuffer()));onChecking();
 }
 await current();const root=await digest(new TextEncoder().encode(mediaIdentityDescriptor(file.size,hashes)));await current();
 return{fileIdentity:{schema:MEDIA_IDENTITY_SCHEMA,root},hashes};
}
