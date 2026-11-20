const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v),sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),count=v=>Number.isSafeInteger(v)&&v>=0;
const cursor=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=4096;
const part=(total,items,next,first=true)=>count(total)&&Array.isArray(items)&&items.length<=50&&cursor(next)&&total>=items.length&&(next===null?!first||total===items.length:total>items.length);
export function sameFileSource(a,b){if(a===null||b===null)return a===b;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a).sort();return keys.length===Object.keys(b).length&&keys.every(k=>a[k]===b[k]);}
export const fileModalities=[['video','视频特征'],['audio','音频特征'],['eeg','脑电'],['fnirs','近红外脑功能'],['eye','眼动'],['eye_tracking','眼动追踪'],['emotion','情绪特征'],['ttff','首次注视'],['behavior','行为'],['dataset','数据集'],['face','面部特征'],['infrared','红外'],['other','其他']];
export const fileModalityLabel=code=>fileModalities.find(([key])=>key===code)?.[1]||'数据类型待核对';
export async function prepareCaptureFile(filename,bytes){
 if(!/^[-A-Za-z0-9_]{1,80}\.(csv|json)$/i.test(filename))throw Error('文件名须为1至80个英文、数字、下划线或短横线，以.csv或.json结尾。请在本机更名后重新选择。');
 if(!bytes.byteLength||bytes.byteLength>131072)throw Error('请选择非空且不超过128KiB的预处理文件。');
 try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('文件须使用UTF-8编码，请转换后重新选择。');}
 const sourceSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');let binary='';for(const value of new Uint8Array(bytes))binary+=String.fromCharCode(value);
 return {filename,contentBase64:btoa(binary),sourceSha256,bytes:bytes.byteLength};
}
function featureRows(items,file,task,seen=new Set(),canReadValues=false){
 for(const x of items){if(!id(x.id)||seen.has(x.id)||typeof x.featureKey!=='string')return false;seen.add(x.id);if(x.sourceRef!==null&&(!file.sourceRef||x.sourceRef?.kind!=='feature'||x.sourceRef.id!==x.id||x.sourceRef.fileId!==file.id||x.sourceRef.taskId!==task.id||x.sourceRef.hashVersion!=='t14-source-v1'||!sha(x.sourceRef.contentHash)))return false;
  const projected=['value','unit','sourcePipeline','extractionVersion','valueStatus'].some(k=>Object.hasOwn(x,k));
  if(projected&&(!canReadValues||!file.sourceRef||!task.sourceRef||!x.sourceRef||task.status!=='complete'||!Object.hasOwn(x,'value')||x.value!==null&&(typeof x.value!=='number'||!Number.isFinite(x.value))||['unit','sourcePipeline','extractionVersion'].some(k=>x[k]!==null&&typeof x[k]!=='string')||Object.hasOwn(x,'valueStatus')&&(x.valueStatus!=='invalid'||x.value!==null)))return false;
 }return true;
}
function taskRows(items,file,tasks=new Set(),features=new Set(),canReadValues=false){
 for(const t of items){if(!id(t.id)||tasks.has(t.id)||typeof t.status!=='string'||typeof t.skillKey!=='string'||!part(t.featureCount,t.features,t.featuresNextCursor))return false;tasks.add(t.id);if(t.sourceRef!==null&&(!file.sourceRef||t.sourceRef?.kind!=='processing_task'||t.sourceRef.id!==t.id||t.sourceRef.fileId!==file.id||t.sourceRef.hashVersion!=='t14-source-v1'||!sha(t.sourceRef.contentHash)||typeof t.sourceRef.updatedAt!=='string'))return false;
  if(t.quality?.status==='reported'?!count(t.quality.alerts)||!count(t.quality.missing):t.quality?.status!=='unknown')return false;if(!featureRows(t.features,file,t,features,canReadValues))return false;
 }return true;
}
export function validFilePage(value,route){
 if(value?.studyId!==route.studyId||value.visitId!==route.visitId||!Array.isArray(value.items)||value.items.length>50||!count(value.unassignedFeatureCount)||value.nextCursor!==null&&(typeof value.nextCursor!=='string'||!value.nextCursor||value.nextCursor.length>4096)||typeof value.capabilities?.canUploadPreprocessed!=='boolean'||!['available','unavailable'].includes(value.preprocessedUploadStatus))return false;
 const files=new Set(),tasks=new Set(),features=new Set();
 for(const f of value.items){if(!id(f.id)||files.has(f.id)||f.filename!==null&&typeof f.filename!=='string'||typeof f.modality!=='string'||typeof f.kind!=='string'||typeof f.status!=='string'||!part(f.taskCount,f.tasks,f.tasksNextCursor))return false;files.add(f.id);if(f.sourceRef!==null&&(f.sourceRef?.kind!=='modality_file'||f.sourceRef.id!==f.id||!sha(f.sourceRef.sha256)))return false;
  if(!taskRows(f.tasks,f,tasks,features,value.capabilities.canReadFeatureValues===true))return false;
 }return true;
}
export function validFileTaskPage(value,route,file){return value?.studyId===route.studyId&&value.visitId===route.visitId&&value.fileId===file.id&&value.total===file.taskCount&&sameFileSource(value.fileSourceRef,file.sourceRef)&&part(value.total,value.items,value.nextCursor,false)&&taskRows(value.items,file,new Set(),new Set(),value.capabilities?.canReadFeatureValues===true);}
export function validFileFeaturePage(value,route,file,task){return value?.studyId===route.studyId&&value.visitId===route.visitId&&value.fileId===file.id&&value.taskId===task.id&&value.total===task.featureCount&&sameFileSource(value.fileSourceRef,file.sourceRef)&&sameFileSource(value.taskSourceRef,task.sourceRef)&&part(value.total,value.items,value.nextCursor,false)&&featureRows(value.items,file,task,new Set(),value.capabilities?.canReadFeatureValues===true);}
const fieldLabels={feature_key:'特征标识',value:'数值',confidence:'置信度',unit:'单位',collected_at:'采集时间',time_window:'时间窗',aoi:'兴趣区域',condition:'条件',valence:'效价',phase:'阶段',trial:'试次'};
export function fileIssue(error){return (Number.isSafeInteger(error.rowNumber)&&error.rowNumber>0?'文件第'+error.rowNumber+'行':'文件')+(fieldLabels[error.fieldKey]?' · '+fieldLabels[error.fieldKey]:'')+'：格式或字段值无效，请核对原文件；不会自动转换或舍入。';}
export function sameFileResult(a,b){return ['studyId','visitId','fileId','taskId','sourceSha256','inserted','alerts','missing'].every(k=>a?.[k]===b?.[k]);}
export const fileVerified=v=>v?.storageIntegrity?.status==='verified'&&v.storageIntegrity.recorded===true;
