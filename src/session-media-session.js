import {identifyMediaFile,validMediaIdentity,MEDIA_IDENTITY_SCHEMA} from './media-content-identity.js';
export const MEDIA_REQUEST_MARKER='session-media-v1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const sid='[A-Za-z0-9_-]{1,160}',uuid='[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}';
export const sessionMediaRequestAllowed=(method,path)=>
 method==='POST'&&new RegExp(`^/sessions/${sid}/media/${sid}/content-runs(?:/${sid}/retries)?$`).test(path)||
 method==='GET'&&new RegExp(`^/sessions/${sid}/media/${sid}/(?:content-receipts/${sid}|content-runs/${sid}(?:/evidence/${sid})?)$`).test(path)||
 method==='POST'&&new RegExp(`^/sessions/${sid}/(?:media-uploads(?:/${uuid}/(?:chunks/[0-9]{1,3}|complete))?|media/${sid}/(?:recheck|ingests(?:/${sid}/confirm)?))$`).test(path)||
 method==='GET'&&(new RegExp(`^/sessions/${sid}/media(?:\\?limit=(?:[1-9]|1[0-9]|20)(?:&cursor=${sid})?|/receipts/${sid})?$`).test(path)||new RegExp(`^/sessions/${sid}/media-uploads/${uuid}$`).test(path)||new RegExp(`^/sessions/${sid}/media/${sid}/(?:ingest-targets|ingests/${sid}|ingest-receipts/${sid})$`).test(path));
export function mediaContentHref(sessionId,mediaId){return id(sessionId)&&id(mediaId)?`/api/sessions/${sessionId}/media/${mediaId}/content`:null;}
export function readPendingMedia(raw){
 try{
  const rows=JSON.parse(raw??'[]');
  if(!Array.isArray(rows)||rows.length>20||rows.some(x=>!id(x?.requestKey)||!['initializing','transferring','completing'].includes(x.phase)||x.uploadId!==null&&!new RegExp(`^${uuid}$`).test(x.uploadId)||!Number.isSafeInteger(x.byteSize)||x.byteSize<1||x.byteSize>500*1024*1024||!['mp4','mov','webm'].includes(x.extension)))return [];
  if(rows.some(x=>Object.hasOwn(x,'fileIdentity')&&!validMediaIdentity(x.fileIdentity)))return [];
  return [...new Map(rows.map(x=>[x.requestKey,{requestKey:x.requestKey,uploadId:x.uploadId,phase:x.phase,byteSize:x.byteSize,extension:x.extension,...(x.fileIdentity?{fileIdentity:x.fileIdentity}:{})}])).values()];
 }catch{return [];}
}
export function recoverMediaReceipt(record,receipt){
 if(!receipt?.found)return{pending:record,item:null};
 const item=assertMediaPage({items:[receipt.item],nextCursor:null}).items[0];
 if(['archived','failed'].includes(item.archiveState))return{pending:null,item};
 const uploadId=receipt.upload?.uploadId??record.uploadId;
 if(uploadId!==null&&!new RegExp(`^${uuid}$`).test(uploadId))throw Error('视频上传状态无法核对，请查询原上传。');
 return{pending:{...record,uploadId,phase:record.phase==='initializing'&&uploadId?'transferring':record.phase,byteSize:item.byteSize,extension:item.extension},item};
}
export function assertMediaPage(value){
 if(!value||!Array.isArray(value.items)||value.items.length>20||value.nextCursor!==null&&!id(value.nextCursor)||value.items.some(item=>
  !id(item?.id)||!Number.isSafeInteger(item.version)||item.version<1||typeof item.name!=='string'||!['mp4','mov','webm'].includes(item.extension)||!Number.isSafeInteger(item.byteSize)||item.byteSize<1||item.byteSize>500*1024*1024||
  !['pending','archived','failed'].includes(item.archiveState)||!['pending','running','complete','unavailable'].includes(item.inspectionState)||item.contentUnderstood!==false||!Number.isFinite(Date.parse(item.createdAt))||
  item.inspectionState==='complete'&&item.classification!=='valid'||item.inspectionState==='unavailable'&&!['tool_unavailable','timeout','corrupt','parse_failed','unknown_stream'].includes(item.classification)))throw Error('视频状态无法核对，请重新获取。');
 return value;
}
export function mediaStateLabel(item){
 if(item.archiveState!=='archived')return item.archiveState==='failed'?'未能归档':'上传尚未完成';
 if(item.inspectionState==='complete')return '已归档 · 文件检查通过';
 if(item.inspectionState==='running'&&!item.canRecheck)return '已归档 · 正在检查文件';
 const labels={corrupt:'文件损坏，请重新导出',tool_unavailable:'检查服务暂不可用',timeout:'文件检查超时',unknown_stream:'未识别到音视频流',parse_failed:'文件检查未完成'};
 return '已归档 · '+(labels[item.classification]??'文件检查未完成');
}
export async function uploadMediaFile({client,sid,file,requestKey,initialization,resumable=false,fileIdentity,onIdentity=()=>{},onChecking=()=>{},onInitialized=()=>{},onCompleting=()=>{},beforeRequest=async()=>true,onProgress=()=>{}}){
 const current=async()=>{if(!await beforeRequest())throw Error('会话或视频权限已变化，本次未继续上传。');};
 await current();
 let identified;
 if(resumable){
  identified=await identifyMediaFile(file,{current,onChecking});
  await current();
  if(fileIdentity&&(!validMediaIdentity(fileIdentity)||fileIdentity.root!==identified.fileIdentity.root))throw Error('所选文件与原视频内容不同，请重新选择原视频。');
  await onIdentity(identified.fileIdentity);await current();
 }
 const init=!resumable&&initialization?initialization:await client.post(`/sessions/${sid}/media-uploads`,{requestKey,filename:file.name,mimeType:file.type??'',size:file.size,...(identified?{fileIdentity:identified.fileIdentity}:{})});
 await current();assertMediaPage({items:[init?.item],nextCursor:null});
 if(init.item.archiveState==='archived')return init.item;
 if(!new RegExp(`^${uuid}$`).test(init.uploadId)||init.chunkSize!==1024*1024||init.totalChunks!==Math.ceil(file.size/init.chunkSize))throw Error('视频上传状态无法核对，请先查询原上传。');
 await onInitialized(init);
 const loaded=new Array(init.totalChunks).fill(0),received=new Set();let next=0,failure=null;
 if(resumable){
  if(init.identityMode!==MEDIA_IDENTITY_SCHEMA)throw Error('视频上传状态无法核对，请先查询原上传。');
  let snapshot;
  try{snapshot=await client.get(`/sessions/${sid}/media-uploads/${init.uploadId}`);}catch(reason){
   // Explicit recovery only: the original may already be safely stored even
   // when the temporary chunks expired. Completion decides, never a new ID.
   if(reason.status!==410)throw reason;
   await current();await onCompleting(init);const item=await client.post(`/sessions/${sid}/media-uploads/${init.uploadId}/complete`,{});await current();
   return assertMediaPage({items:[item],nextCursor:null}).items[0];
  }
  await current();
  if(snapshot?.uploadId!==init.uploadId||snapshot.chunkSize!==init.chunkSize||snapshot.totalChunks!==init.totalChunks||snapshot.byteSize!==file.size||!Array.isArray(snapshot.received)||snapshot.received.length>init.totalChunks)throw Error('视频上传状态无法核对，请先查询原上传。');
  const indexes=new Set();
  for(const part of snapshot.received){
   if(!Number.isSafeInteger(part.index)||part.index<0||part.index>=init.totalChunks||indexes.has(part.index)||part.byteSize!==Math.min(init.chunkSize,file.size-part.index*init.chunkSize)||!/^[a-f0-9]{64}$/.test(part.sha256))throw Error('视频上传状态无法核对，请先查询原上传。');
   indexes.add(part.index);if(part.sha256===identified.hashes[part.index]){received.add(part.index);loaded[part.index]=part.byteSize;}
  }
  onProgress({loaded:loaded.reduce((a,b)=>a+b,0),total:file.size});
 }
 const workers=Array.from({length:Math.min(3,init.totalChunks)},async()=>{
  while(!failure&&next<init.totalChunks){
   const index=next++;if(received.has(index))continue;
   const start=index*init.chunkSize,blob=file.slice(start,Math.min(file.size,start+init.chunkSize));
   try{
    await current();
    await client.upload(`/sessions/${sid}/media-uploads/${init.uploadId}/chunks/${index}`,blob,{contentType:'application/octet-stream',onProgress:event=>{
     loaded[index]=Math.min(blob.size,event.loaded??0);onProgress({loaded:loaded.reduce((a,b)=>a+b,0),total:file.size});
    }});
    loaded[index]=blob.size;onProgress({loaded:loaded.reduce((a,b)=>a+b,0),total:file.size});await current();
   }catch(e){failure=e;throw e;}
  }
 });
 const results=await Promise.allSettled(workers);const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
 await current();await onCompleting(init);const item=await client.post(`/sessions/${sid}/media-uploads/${init.uploadId}/complete`,{});await current();
 return assertMediaPage({items:[item],nextCursor:null}).items[0];
}
