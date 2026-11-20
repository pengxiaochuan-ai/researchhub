import {makeCrfMethodsUrl,readCrfMethodsLocation} from './crf-methods-session.js';
const key='[A-Za-z0-9_-]{1,160}',base='/crf-method-asset-drafts';
const valid=v=>typeof v==='string'&&new RegExp('^'+key+'$').test(v);
const version=v=>/^(?:[1-9]|[12][0-9]|30)$/.test(String(v));
const fail=()=>{throw Error('方法资产链接或版本无效，请从科研资产重新打开。');};
export const crfMethodAssetReadFailure=e=>({state:e.status===409?'invalid':'unverified',message:e.message??'当前读取无法核实，请重试。'});
export const crfMethodAssetReadState=(local,probe)=>[local,probe].find(v=>v?.state==='invalid')??local??probe??null;
export const formatCrfMethodAssetOptions=options=>options.map(o=>typeof o==='string'?o:o.label+'='+o.value).join('，');
export const isCrfMethodAssetsRoute=(pageId,search)=>['a01','a02'].includes(pageId)&&['crfMethodAssets','crfMethodAssetId','crfMethodAssetVersion'].some(k=>new URLSearchParams(search).has(k));
export function readCrfMethodAssetLocation(pageId,search){
 const p=new URLSearchParams(search),allowed=['crfMethodAssets','studyGroupId','researchProjectId','crfMethodAssetId','crfMethodAssetVersion'];
 if(!isCrfMethodAssetsRoute(pageId,search)||p.get('crfMethodAssets')!=='1'||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')},assetId=p.get('crfMethodAssetId'),versionNo=p.has('crfMethodAssetVersion')?Number(p.get('crfMethodAssetVersion')):null;
 if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||(pageId==='a02'?!valid(assetId):p.has('crfMethodAssetId')||p.has('crfMethodAssetVersion'))||(p.has('crfMethodAssetVersion')&&!version(p.get('crfMethodAssetVersion'))))fail();return{scope,assetId,versionNo};
}
export function makeCrfMethodAssetUrl(pageId,scope,assetId,versionNo){const p=new URLSearchParams({crfMethodAssets:'1',studyGroupId:scope?.studyGroupId??'',researchProjectId:scope?.researchProjectId??''});if(assetId!==undefined)p.set('crfMethodAssetId',assetId);if(versionNo!==undefined&&versionNo!==null)p.set('crfMethodAssetVersion',String(versionNo));readCrfMethodAssetLocation(pageId,p.toString());return'/pages/'+pageId+'/?'+p;}
export function makeCrfMethodReportUrl(scope,planId,collectionId,runId,reportId,versionNo){const u=new URL(makeCrfMethodsUrl(scope,planId,collectionId,runId),'http://local');u.searchParams.set('methodReportId',reportId);u.searchParams.set('methodReportVersion',String(versionNo));readCrfMethodsLocation('s06',u.search);return u.pathname+u.search;}
export function crfMethodAssetsHeader(config,pageId,search){return isCrfMethodAssetsRoute(pageId,search)?{...config,concept:undefined,tags:[],title:pageId==='a01'?'我的方法资产候选':'方法资产候选详情',description:'固定真实方法报告的历史证据与复用准备；本人私有草稿，不是正式科研资产。',meta:"合成数据演练 · 未共享／未审批",actions:[],nav:undefined,crumbs:[['科研资产','a01'],['方法资产候选']]}:config;}
export function crfMethodAssetRequestAllowed(method,path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('..'))return false;
 let u;try{u=new URL(path,'http://local');}catch{return false;}
 if(u.origin!=='http://local'||u.hash||u.pathname!==path.split('?')[0])return false;
 if(method==='GET'&&u.pathname===base){
  if([...u.searchParams.keys()].some(k=>!['limit','before'].includes(k)||u.searchParams.getAll(k).length!==1))return false;
  return(!u.searchParams.has('limit')||/^(?:[1-9]|1[0-9]|20)$/.test(u.searchParams.get('limit')))&&(!u.searchParams.has('before')||new RegExp('^'+key+'$').test(u.searchParams.get('before')));
 }
 if(u.search)return false;
 if(method==='GET')return new RegExp('^'+base+'/'+key+'(?:/versions/(?:[1-9]|[12][0-9]|30))?$').test(u.pathname);
 return method==='POST'&&(new RegExp('^'+base+'/'+key+'/(?:notes|derivations)$').test(u.pathname)||new RegExp('^/research-plan-drafts/'+key+'/synthetic-collections/'+key+'/method-runs/'+key+'/report-drafts/'+key+'/asset-drafts$').test(u.pathname));
}
// Deliberately broader than decoded ID validation so encoded IDs cannot bypass
// the raw byte limit. Controller validation still rejects invalid decoded IDs.
export const crfMethodAssetBodyRoute=()=>/^\/api\/crf-method-asset-drafts\/[^/]+\/(?:notes|derivations)\/?$/i;
