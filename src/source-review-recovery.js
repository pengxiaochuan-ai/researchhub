const prefix='researchhub.source-review.pending.v1:';
const fields={pmc:['versionId','rawSha256','visibility','expectedVersion','expectedAssetFingerprint','operationId'],external:['kind','documentId','mode','visibility','expectedFingerprint','operationId'],workbook:['kind','batchId','sourceRegistryId','sourceRecordId','visibility','expectedFingerprint','operationId']};
function valid(value){
 const input=value?.input;
 return value&&fields[value.kind]&&typeof value.sourceKey==='string'&&value.sourceKey.length<=200&&typeof value.savedLabel==='string'&&value.savedLabel.length<=1000&&
  input&&Object.keys(input).every(k=>fields[value.kind].includes(k))&&Object.values(input).every(v=>v===null||['string','number'].includes(typeof v))&&
  ['public','tenant','withheld'].includes(input.visibility)&&typeof input.operationId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.operationId)&&JSON.stringify(input).length<=16384;
}
export function savePendingReview(storage,identity,value){
 if(typeof identity!=='string'||!identity||!valid(value))throw Error('无法保留本次操作，请核对登录状态后重试。');
 // Store only original request metadata, never cookies, source text or credentials.
 storage.setItem(prefix+identity,JSON.stringify({kind:value.kind,input:value.input,sourceKey:value.sourceKey,savedLabel:value.savedLabel}));
}
export function readPendingReview(storage,identity){
 if(!identity)return null;
 try{const value=JSON.parse(storage.getItem(prefix+identity));return valid(value)?value:null;}catch{return null;}
}
export function clearPendingReview(storage,identity){if(identity)storage.removeItem(prefix+identity);}
export function matchesReviewReceipt(pending,receipt){
 if(!valid(pending)||receipt?.kind!==pending.kind||!receipt.input||!receipt.review)return false;
 const visibilityMatches=receipt.review.visibility===pending.input.visibility||pending.input.mode==='display_only'&&receipt.review.visibility==='public_display';
 return visibilityMatches&&Object.keys(receipt.input).length===Object.keys(pending.input).length&&Object.entries(pending.input).every(([key,value])=>receipt.input[key]===value);
}
