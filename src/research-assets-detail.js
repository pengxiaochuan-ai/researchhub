import {assetVersionInRange,assetEventCeiling} from '../scripts/research-assets-business-identity.mjs';
const fail=()=>{throw Object.assign(new Error('固定版本结果无法核对，请重新读取。'),{status:409});};
export function assetDetailRequestAllowed(method,path){
 if(typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 if(method==='POST')return /^\/research-assets\/[A-Za-z0-9_-]{1,160}\/versions\/[1-8]\/tags$/.test(path);
 if(method!=='GET')return false;
 const m=path.match(/^\/research-assets\/([A-Za-z0-9_-]{1,160})\/versions\/([1-9][0-9]*)\/(?:compare\?withVersion=([1-9][0-9]*)|activity(?:\?cursor=[A-Za-z0-9_-]{1,512})?)$/);
 return Boolean(m&&assetVersionInRange(m[1],Number(m[2]))&&(m[3]===undefined||assetVersionInRange(m[1],Number(m[3]))));
}
export function assertAssetComparison(v,{id,from,to,identityRevision}){
 if(v?.schemaVersion!=='rh-asset-comparison.v1'||v.id!==id||v.before?.version!==from||v.after?.version!==to||v.identityRevision!==identityRevision||!Array.isArray(v.changedFields)||v.changedFields.length>12||v.changedFields.some(x=>typeof x.field!=='string')||typeof v.text?.changed!=='boolean'||!Array.isArray(v.text?.added)||!Array.isArray(v.text?.removed)||[...v.text.added,...v.text.removed].some(x=>typeof x!=='string'))fail();return v;
}
export function assertAssetActivity(v,{id,version,identityRevision}){
 if(Array.isArray(v?.items)&&v.items.some(x=>(Object.hasOwn(x,'reason')||Object.hasOwn(x,'conclusion'))&&(x.type!=='reviewed'||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>2000||!['approved','changes_requested'].includes(x.conclusion))))fail();
 const types=['created','revised','submitted','reviewed','released','scope_narrowed','withdrawn','requested','decided','grant_revoked','cited','trashed','restored','comment_changed','attachment_bound','file_accessed','markdown_exported','asset_copy','asset_apply'];
 if(v?.schemaVersion!=='rh-asset-activity.v1'||v.id!==id||v.version!==version||v.identityRevision!==identityRevision||!Number.isSafeInteger(v.total)||v.total<0||v.total>assetEventCeiling(id)||!Array.isArray(v.items)||v.items.length>20||v.items.some(x=>!types.includes(x.type)||x.version!==version||!Number.isSafeInteger(x.revision)||typeof x.actor!=='string'||Number.isNaN(Date.parse(x.at)))||v.nextCursor!==null&&(typeof v.nextCursor!=='string'||v.nextCursor.length>512))fail();return v;
}
