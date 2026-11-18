// Only an explicit file selection may resume an unknown upload. Never issue a
// second request key or treat a missing receipt as proof of failure.
export function assertMaterialUploadRetry(retry,current,files){
 if(!retry)return null;
 const extension=retry.key.startsWith('research-data-')?/\.(csv|xlsx)$/i:retry.key.startsWith('material-')?/\.(pdf|docx|txt|md|markdown)$/i:null;
 if(!current||['sessionId','identity','client'].some(k=>retry[k]!==current[k])||files.length!==1||!extension?.test(files[0].name))throw Error('请选择原会话中同类型的原文件恢复上传；本次未上传。');
 return retry.key;
}
