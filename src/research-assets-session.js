// Fixed-version Hub asset reads only; deliberately distinct from old candidate and demo URLs.
import {isAssetDraftRoute} from './synthetic-asset-route.js';
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const version=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
const fail=()=>{throw new Error('资产入口或版本无效，请返回科研资产重新选择。');};
export const RESEARCH_ASSET_LABELS=Object.freeze({protocol:'研究方案',dataset:'数据集',instrument:'量表/工具',analysis:'分析结果',publication:'论文/报告'});
export const isResearchAssetRoute=(pageId,search)=>pageId==='a02'&&(new URLSearchParams(search).has('researchAssetId')||new URLSearchParams(search).has('assetVersion')&&!isAssetDraftRoute(pageId,search));
export function readResearchAssetLocation(pageId,search){
 const p=new URLSearchParams(search),keys=['researchAssetId','studyGroupId','researchProjectId','assetVersion'];
 if(!isResearchAssetRoute(pageId,search)||[...p.keys()].some(k=>!keys.includes(k)||p.getAll(k).length!==1))fail();
 const assetId=p.get('researchAssetId'),scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')};
 if(!valid(assetId)||!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||p.has('assetVersion')&&!version(p.get('assetVersion')))fail();
 return{scope,assetId,versionNo:p.has('assetVersion')?Number(p.get('assetVersion')):null};
}
export function makeResearchAssetUrl(scope,assetId,versionNo){
 const p=new URLSearchParams({researchAssetId:assetId,studyGroupId:scope?.studyGroupId??'',researchProjectId:scope?.researchProjectId??''});
 if(versionNo!==undefined&&versionNo!==null)p.set('assetVersion',String(versionNo));
 readResearchAssetLocation('a02',p.toString());return'/pages/a02/?'+p;
}
export function researchAssetRequestAllowed(method,path){
 if(method!=='GET'||typeof path!=='string')return false;
 const match=path.match(/^\/research-assets\/([A-Za-z0-9_-]{1,160})(?:\/versions\/([1-9][0-9]*))?$/);
 return Boolean(match&&(!match[2]||version(match[2])));
}
export function researchAssetHeader(config,pageId,search){
 if(!isResearchAssetRoute(pageId,search))return config;
 return{...config,title:'资产详情',concept:undefined,tags:[],crumbs:[['科研资产','a01'],['资产详情']],description:'核对本人资产草稿的固定版本、用途与来源。',meta:'私有草稿 · 尚未审核或共享',actions:(config.actions??[]).map(([label])=>[label,undefined,false,true]),nav:undefined};
}
export function assertResearchAssetDetail(value,route,accountId){
 const positive=n=>Number.isSafeInteger(n)&&n>0,text=v=>typeof v==='string'&&v.trim().length>0;
 const invalid=()=>{throw Object.assign(new Error('资产响应与当前对象、身份或版本不一致，请重新打开。'),{status:409,code:'RESEARCH_ASSET_CONTEXT_INVALID'});};
 if(!value||value.schemaVersion!=='rh-research-asset-detail.v1'||value.id!==route.assetId||value.ownerAccountId!==accountId||
  value.studyGroupId!==route.scope.studyGroupId||value.researchProjectId!==route.scope.researchProjectId||!Object.hasOwn(RESEARCH_ASSET_LABELS,value.kind)||
  value.status!=='draft'||value.readOnly!==true||!positive(value.version)||!positive(value.currentVersion)||value.version>value.currentVersion||
  value.version!==(route.versionNo??value.currentVersion)||value.isHistorical!==(value.version!==value.currentVersion)||!text(value.contentMd)||
  !['title','summary','purpose','limitations','author'].every(k=>text(value.metadata?.[k]))||value.title!==value.metadata.title||
  value.source?.kind!=='author_declared_synthetic'||!text(value.source.label)||!Array.isArray(value.versions)||value.versions.length>50||
  value.versions.some(v=>!positive(v.version)||v.version>value.currentVersion)||new Set(value.versions.map(v=>v.version)).size!==value.versions.length||typeof value.hasMoreVersions!=='boolean')invalid();
 return value;
}
export function researchAssetReadMessage(error){
 return({401:'会话已失效，请重新登录后查看资产。',403:'当前账号没有此资产的读取权限，请核对研究范围或联系管理员。',404:'未找到可访问的资产或版本，请返回科研资产重新选择。',409:'资产版本信息无法核对，请重新读取或返回目录。'})[error?.status]??'资产服务暂不可用，请重试；未显示未经核对的内容。';
}
export function researchAssetIdentityChanged(expected,next){
 return Boolean(expected&&next?.status!=='checking'&&(!next?.authenticated||next.id!==expected.accountId||next.authVersion!==expected.authVersion));
}
/** Both initial reads and authorization probes publish only the newest verified response. */
export async function readResearchAssetResponse({read,route,accountId,isCurrent,publish}){
 try{const value=await read();if(!isCurrent())return false;publish(assertResearchAssetDetail(value,route,accountId));return true;}
 catch(error){if(isCurrent())throw error;return false;}
}
export async function readResearchAssetIdentity({read,isCurrent,latestIdentity}){
 const user=await read();if(!isCurrent())return null;
 const latest=latestIdentity();
 if(!valid(user?.accountId)||!Number.isSafeInteger(user.authVersion)||user.authVersion<0||latest&&researchAssetIdentityChanged(user,latest))throw Object.assign(new Error('会话身份已变化。'),{status:401});
 return user;
}
