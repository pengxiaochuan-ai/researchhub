import {assertAssetCatalogInput,catalogError} from './research-assets-catalog-contract.mjs';
export const ASSET_AUX_VIEWS=['graph','contributions','trash','recommendations','usage'];
export const ASSET_COLLABORATION_VIEWS=['all','sent','received','requested','pending'];
export function parseAssetCollaborationQuery(query){
 const entries=query instanceof URLSearchParams?[...query]:Object.entries(query??{}),matches=entries.filter(([k])=>k==='collaborationView');
 if(entries.some(([_k,v])=>typeof v!=='string')||matches.length>1||matches.length&&(!ASSET_COLLABORATION_VIEWS.includes(matches[0][1])))throw catalogError('INPUT_INVALID',400,'共享记录筛选无效。');
 return{view:matches[0]?.[1]??'all',query:assertAssetCatalogInput(new URLSearchParams(entries.filter(([k])=>k!=='collaborationView')))};
}
export function parseAssetViewQuery(type,query){
 const fail=()=>{throw catalogError('INPUT_INVALID',400,'资产视图查询无效，请重新选择。');};
 if(!ASSET_AUX_VIEWS.includes(type)||!query||typeof query!=='object')fail();
 const entries=query instanceof URLSearchParams?[...query]:Object.entries(query),extras=type==='recommendations'?['assetId','version','cursor']:[];
 if(new Set(entries.map(([k])=>k)).size!==entries.length||entries.some(([_k,v])=>typeof v!=='string'))fail();
 const extra=Object.fromEntries(entries.filter(([k])=>extras.includes(k))),catalog=Object.fromEntries(entries.filter(([k])=>!extras.includes(k))),parsed=assertAssetCatalogInput(catalog);
 if((extra.assetId!==undefined||extra.version!==undefined)&&(!/^[A-Za-z0-9_-]{1,160}$/.test(extra.assetId??'')||!/^[1-8]$/.test(extra.version??'')))fail();
 if(extra.cursor!==undefined&&(!/^[A-Za-z0-9_-]{1,1024}$/.test(extra.cursor)))fail();
 return{query:Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,String(v)])),selection:extra.assetId?{id:extra.assetId,version:Number(extra.version)}:null,cursor:extra.cursor??null};
}
