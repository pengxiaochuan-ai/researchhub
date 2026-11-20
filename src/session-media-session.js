import {identifyMediaFile,validMediaIdentity,MEDIA_IDENTITY_SCHEMA} from './media-content-identity.js';
import {isTongueExtension,isAudioExtension,mediaFileExtension,mediaMaxBytes,validImageInspection,validAudioInspection,isEegExtension,validEegInspection} from './session-media-types.js';
export const MEDIA_REQUEST_MARKER='session-media-v1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const sid='[A-Za-z0-9_-]{1,160}',uuid='[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}';
export const sessionMediaRequestAllowed=(method,path)=>
 method==='POST'&&new RegExp(`^/sessions/${sid}/media/${sid}/content-runs(?:/${sid}/retries)?$`).test(path)||
 method==='GET'&&new RegExp(`^/sessions/${sid}/media/${sid}/(?:content-receipts/${sid}|content-runs/${sid}(?:/evidence/${sid})?)$`).test(path)||
 method==='POST'&&new RegExp(`^/sessions/${sid}/(?:media-uploads(?:/${uuid}/(?:chunks/[0-9]{1,3}|complete))?|media/${sid}/(?:recheck|ingests(?:/${sid}/confirm)?))$`).test(path)||
 method==='GET'&&(new RegExp(`^/sessions/${sid}/media(?:\\?limit=(?:[1-9]|1[0-9]|20)(?:&cursor=${sid})?|/receipts/${sid})?$`).test(path)||new RegExp(`^/sessions/${sid}/media-uploads/${uuid}$`).test(path)||new RegExp(`^/sessions/${sid}/media/${sid}/(?:ingest-targets(?:[?]studyId=${sid})?|ingests/${sid}|ingest-receipts/${sid})$`).test(path));
export function mediaContentHref(sessionId,mediaId){return id(sessionId)&&id(mediaId)?`/api/sessions/${sessionId}/media/${mediaId}/content`:null;}
export function readPendingMedia(raw){
 try{
  const rows=JSON.parse(raw??'[]');
  if(!Array.isArray(rows)||rows.length>20||rows.some(x=>!id(x?.requestKey)||!['initializing','transferring','completing'].includes(x.phase)||x.uploadId!==null&&!new RegExp(`^${uuid}$`).test(x.uploadId)||!Number.isSafeInteger(x.byteSize)||x.byteSize<1||x.byteSize>mediaMaxBytes(x.extension)||!['mp4','mov','webm','png','jpg','jpeg','wav','mp3','m4a','eeglab'].includes(x.extension)))return [];
  if(rows.some(x=>Object.hasOwn(x,'fileIdentity')&&!validMediaIdentity(x.fileIdentity)))return [];
  return [...new Map(rows.map(x=>[x.requestKey,{requestKey:x.requestKey,uploadId:x.uploadId,phase:x.phase,byteSize:x.byteSize,extension:x.extension,...(x.fileIdentity?{fileIdentity:x.fileIdentity}:{})}])).values()];
 }catch{return [];}
}
export function recoverMediaReceipt(record,receipt){
 if(!receipt?.found)return{pending:record,item:null};
 const item=assertMediaPage({items:[receipt.item],nextCursor:null}).items[0];
 if(['archived','failed'].includes(item.archiveState))return{pending:null,item};
 const uploadId=receipt.upload?.uploadId??record.uploadId;
 if(uploadId!==null&&!new RegExp(`^${uuid}$`).test(uploadId))throw Error('文件上传状态无法核对，请查询原上传。');
 return{pending:{...record,uploadId,phase:record.phase==='initializing'&&uploadId?'transferring':record.phase,byteSize:item.byteSize,extension:item.extension},item};
}
export function assertMediaPage(value){
 if(!value||!Array.isArray(value.items)||value.items.length>20||value.nextCursor!==null&&!id(value.nextCursor)||value.items.some(item=>
  !id(item?.id)||!Number.isSafeInteger(item.version)||item.version<1||typeof item.name!=='string'||!['mp4','mov','webm','png','jpg','jpeg','wav','mp3','m4a','eeglab'].includes(item.extension)||!Number.isSafeInteger(item.byteSize)||item.byteSize<1||item.byteSize>mediaMaxBytes(item.extension)||
  isTongueExtension(item.extension)&&(item.modality!=='tongue'||!item.inspection||item.inspection.hasVideo!==false||item.inspection.hasAudio!==false||item.inspectionState==='complete'&&!validImageInspection(item.inspection))||
  isAudioExtension(item.extension)&&(item.modality!=='audio'||!item.inspection||item.inspection.hasVideo!==false||item.inspection.hasImage!==false||item.inspectionState==='complete'&&!validAudioInspection(item.inspection,item.extension))||
  isEegExtension(item.extension)&&(item.modality!=='eeg'||!item.inspection||item.inspection.hasVideo!==false||item.inspection.hasAudio!==false||item.inspection.hasImage!==false||item.inspectionState==='complete'&&!validEegInspection(item.inspection))||
  !isTongueExtension(item.extension)&&!isAudioExtension(item.extension)&&!isEegExtension(item.extension)&&(item.modality!=null&&item.modality!=='video'||item.inspection?.hasImage===true)||
  !isEegExtension(item.extension)&&item.inspection?.hasEeg===true||
  !['pending','archived','failed'].includes(item.archiveState)||!['pending','running','complete','unavailable'].includes(item.inspectionState)||item.contentUnderstood!==false||!Number.isFinite(Date.parse(item.createdAt))||
  item.inspectionState==='complete'&&item.classification!=='valid'||item.inspectionState==='unavailable'&&!['tool_unavailable','timeout','corrupt','parse_failed','unknown_stream'].includes(item.classification)))throw Error('文件状态无法核对，请重新获取。');
 return value;
}
export function mediaStateLabel(item){
 if(item.archiveState!=='archived')return item.archiveState==='failed'?'未能归档':'上传尚未完成';
 if(item.inspectionState==='complete')return '已归档 · 文件检查通过';
 if(item.inspectionState==='running'&&!item.canRecheck)return '已归档 · 正在检查文件';
 const labels={corrupt:'文件损坏，请重新导出',tool_unavailable:'检查服务暂不可用',timeout:'文件检查超时',unknown_stream:isEegExtension(item.extension)?'未识别到完整EEGLAB文件组':isTongueExtension(item.extension)?'未识别到图像数据':isAudioExtension(item.extension)?'未识别到可读取的单一音轨':'未识别到音视频流',parse_failed:'文件检查未完成'};
 const eegFailures={missing_fdt:'缺少配套FDT，请重新选择SET及同次导出的FDT',reference_mismatch:'SET引用与FDT不一致，请核对同次导出的完整文件组',unexpected_fdt:'内嵌SET无需FDT，请只选择SET',metadata_mismatch:'EEG数据尺寸与登记信息不一致，请在EEGLAB核对后重新导出',resource_limit:'文件超过当前检查容量，请在EEGLAB核对并重新导出',unsupported_mat:'SET格式暂不可读取，请在EEGLAB重新保存',invalid_envelope:'原件包结构异常，请重新选择原SET及配套FDT'};
 return (isEegExtension(item.extension)?'文件组未通过检查 · ':'已归档 · ')+(isEegExtension(item.extension)&&eegFailures[item.inspection?.failureCode]||labels[item.classification]||'文件检查未完成');
}
export async function uploadMediaFile({client,sid,file,requestKey,initialization,resumable=false,fileIdentity,onIdentity=()=>{},onChecking=()=>{},onInitialized=()=>{},onCompleting=()=>{},beforeRequest=async()=>true,onProgress=()=>{}}){
 const current=async()=>{if(!await beforeRequest())throw Error('会话或文件权限已变化，本次未继续上传。');};
 await current();
 const extension=mediaFileExtension(file.name);
 if(!extension||!Number.isSafeInteger(file.size)||file.size<1||file.size>mediaMaxBytes(extension))throw Error('请选择完整EEGLAB文件组（总计500MiB以内），或200MiB以内的WAV/MP3/M4A语音、25MiB以内的PNG/JPG/JPEG舌图，或500MiB以内的MP4/MOV/WebM视频。');
 let identified;
 if(resumable){
  identified=await identifyMediaFile(file,{current,onChecking});
  await current();
  if(fileIdentity&&(!validMediaIdentity(fileIdentity)||fileIdentity.root!==identified.fileIdentity.root))throw Error(isEegExtension(extension)?'所选文件组与原EEG原件不同，请选择原SET及它的配套FDT。':isTongueExtension(extension)?'所选文件与原舌图内容不同，请重新选择原舌图。':isAudioExtension(extension)?'所选文件与原语音内容不同，请重新选择原语音。':'所选文件与原视频内容不同，请重新选择原视频。');
  await onIdentity(identified.fileIdentity);await current();
 }
 const init=!resumable&&initialization?initialization:await client.post(`/sessions/${sid}/media-uploads`,{requestKey,filename:file.name,mimeType:file.type??'',size:file.size,...(identified?{fileIdentity:identified.fileIdentity}:{})});
 await current();assertMediaPage({items:[init?.item],nextCursor:null});
 if(init.item.archiveState==='archived')return init.item;
 if(!new RegExp(`^${uuid}$`).test(init.uploadId)||init.chunkSize!==1024*1024||init.totalChunks!==Math.ceil(file.size/init.chunkSize))throw Error('文件上传状态无法核对，请先查询原上传。');
 await onInitialized(init);
 const loaded=new Array(init.totalChunks).fill(0),received=new Set();let next=0,failure=null;
 if(resumable){
  if(init.identityMode!==MEDIA_IDENTITY_SCHEMA)throw Error('文件上传状态无法核对，请先查询原上传。');
  let snapshot;
  try{snapshot=await client.get(`/sessions/${sid}/media-uploads/${init.uploadId}`);}catch(reason){
   // Explicit recovery only: the original may already be safely stored even
   // when the temporary chunks expired. Completion decides, never a new ID.
   if(reason.status!==410)throw reason;
   await current();await onCompleting(init);const item=await client.post(`/sessions/${sid}/media-uploads/${init.uploadId}/complete`,{});await current();
   return assertMediaPage({items:[item],nextCursor:null}).items[0];
  }
  await current();
  if(snapshot?.uploadId!==init.uploadId||snapshot.chunkSize!==init.chunkSize||snapshot.totalChunks!==init.totalChunks||snapshot.byteSize!==file.size||!Array.isArray(snapshot.received)||snapshot.received.length>init.totalChunks)throw Error('文件上传状态无法核对，请先查询原上传。');
  const indexes=new Set();
  for(const part of snapshot.received){
   if(!Number.isSafeInteger(part.index)||part.index<0||part.index>=init.totalChunks||indexes.has(part.index)||part.byteSize!==Math.min(init.chunkSize,file.size-part.index*init.chunkSize)||!/^[a-f0-9]{64}$/.test(part.sha256))throw Error('文件上传状态无法核对，请先查询原上传。');
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
