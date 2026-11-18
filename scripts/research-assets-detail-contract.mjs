import {buildA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {CATALOG_ASSET_PREFIX,catalogError} from './research-assets-catalog-contract.mjs';
import {REPORT_CONTEXT} from './research-assets-report-context.mjs';
export const DETAIL_ASSET_PREFIX='rh-research-asset:detail-20261113:';
const fail=()=>{throw catalogError('INPUT_INVALID',400,'标签或版本比较输入无效，请核对后重试。');};
export function catalogAssetFamily(key,r,p){
 if(key===REPORT_CONTEXT.key&&r.assetId===REPORT_CONTEXT.assetId&&r.kind==='publication'&&r.ownerAccountId==='rh-kb-local-b0e2af9d-admin'&&p.researchProjectId===REPORT_CONTEXT.projectId)return{family:'report_context',maxVersions:2,maxOperations:12};
 const actor=Object.entries(p.catalogActors??{}).find(([,id])=>id===r.ownerAccountId)?.[0];
 if(!actor)return null;
 if(key===CATALOG_ASSET_PREFIX+actor+':'+r.kind)return{family:'catalog',maxVersions:8,maxOperations:24};
 if(typeof key!=='string'||!key.startsWith(DETAIL_ASSET_PREFIX))return null;
 let manifest;try{manifest=buildA02Manifest({tenant:p.tenantId,group:p.studyGroupId,project:p.researchProjectId,...p.catalogActors});}catch{return null;}
 const slot=manifest.assets.find(x=>x.key===key&&x.ownerAccountId===r.ownerAccountId&&x.kind===r.kind);
 return slot?{family:'detail',maxVersions:slot.maxVersions,maxOperations:slot.maxOperations}:null;
}
export function validateAssetTags(value){
 if(!Array.isArray(value)||value.length>12)fail();
 const tags=value.map(x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>24||/[\u0000-\u001f\u007f]/.test(x))fail();return x.trim();});
 if(new Set(tags).size!==tags.length)fail();return tags;
}
export function compareFixedAssetVersions(before,after){
 const old=before.contentMd.split('\n'),next=after.contentMd.split('\n');let prefix=0,suffix=0;
 while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix])prefix++;
 while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
 const changedFields=[...new Set([...Object.keys(before.metadata),...Object.keys(after.metadata)])].sort().filter(k=>JSON.stringify(before.metadata[k]??null)!==JSON.stringify(after.metadata[k]??null)).map(field=>({field,before:before.metadata[field]??null,after:after.metadata[field]??null}));
 return{changedFields,text:{changed:before.contentMd!==after.contentMd,prefixLines:prefix,suffixLines:suffix,removed:old.slice(prefix,old.length-suffix),added:next.slice(prefix,next.length-suffix)}};
}
