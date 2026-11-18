import {isReportsRoute} from './formal-reports-session.js';
import {isSubjectRoute} from './research-subjects-session.js';
import {isFormalRoute} from './formal-preparation-session.js';
import {isResearchProjectRoute} from './research-projects-session.js';
import {isPreparationRoute} from './research-execution-preparation-session.js';
import {isSyntheticEdcRoute} from './synthetic-edc-session.js';
import {isCrfMethodsRoute} from './crf-methods-session.js';
import {isCrfMethodAssetsRoute} from './crf-method-assets-session.js';
import {isAssetApplicabilityRoute} from './asset-applicability-session.js';
import {isResearchAssetRoute} from './research-assets-session.js';
import {isCatalogAssetRoute} from './research-assets-catalog-session.js';
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
const fail=()=>{throw Error('研究设计入口或范围无效；不会回退演示或选择其他研究。');};
export function isResearchDesignRoute(pageId,search){return['q02','s02','s07'].includes(pageId)&&new URLSearchParams(search).has('designWorkspace');}
export function readResearchDesignLocation(pageId,search){
 const p=new URLSearchParams(search);
 if(!isResearchDesignRoute(pageId,search)||p.get('designWorkspace')!=='1'||p.has('projectId')||p.has('protocolId'))fail();
 for(const key of ['designWorkspace','studyGroupId','researchProjectId','researchPlanId'])if(p.getAll(key).length>1)fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')},planId=p.get('researchPlanId');
 if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||(pageId==='s07'&&!valid(planId))||(pageId==='s02'&&planId)||(planId&&!valid(planId)))fail();
 return{pageId,scope,planId};
}
export function makeDesignWorkspaceUrl(pageId,scope,planId){
 if(!['q01','q02','s02','s07'].includes(pageId)||!valid(scope?.studyGroupId)||!valid(scope?.researchProjectId)||(pageId==='s02'&&planId)||(!['q02','s02'].includes(pageId)&&!valid(planId)))fail();
 const p=new URLSearchParams(pageId==='q01'?{researchPlanId:planId}:{designWorkspace:'1'});
 p.set('studyGroupId',scope.studyGroupId);p.set('researchProjectId',scope.researchProjectId);if(pageId==='s07')p.set('researchPlanId',planId);
 return'/pages/'+pageId+'/?'+p;
}
export function createDesignReadFence(){let sequence=0;return{begin:()=>++sequence,current:token=>token===sequence,invalidate:()=>{sequence++;}};}
export function createDesignRefreshGate(){let active=null,forced=false;return{begin(force=false){if(active){forced||=force;return null;}active=Symbol('design-read');return active;},finish(token){if(token!==active)return false;active=null;const again=forced;forced=false;return again;},invalidate(){active=null;forced=false;}};}
export function validateEvidenceEdits(rows,drafts){
 const changes=[],errors={};for(const row of rows){const value=drafts[row.rowId]??row,decision=value.decision,reason=typeof value.reason==='string'?value.reason.trim():'';
  if(decision===row.decision&&reason===(row.reason??''))continue;
  if(!['include','exclude','background','needs_verification'].includes(decision))errors[row.rowId]='请选择有效的证据处置。';
  else if(reason.length>1000||decision!=='include'&&!reason)errors[row.rowId]='排除、仅背景或待核验须说明理由，最多1000字。';
  changes.push({rowId:row.rowId,decision,reason});
 }return{valid:Object.keys(errors).length===0,changes,errors};
}
export function validateSuggestionEdits(items,drafts){
 const changes=[],errors={};for(const item of items){const d=drafts[item.suggestionId];if(item.decision||!d?.action)continue;const reason=(d.reason??'').trim();
  if(!['accept','edit_accept','reject'].includes(d.action))errors[item.suggestionId]='请选择有效的本人决策。';
  else if(reason.length>600||d.action==='reject'&&!reason)errors[item.suggestionId]='拒绝须填写理由，理由最多600字。';
  else if(d.action==='edit_accept'&&(!(d.text??'').trim()||d.text.length>1800))errors[item.suggestionId]='修改后采纳须填写1–1800字文本。';
  changes.push({suggestionId:item.suggestionId,action:d.action,...(d.action==='edit_accept'?{text:(d.text??'').trim()}:{}),reason});
 }return{valid:Object.keys(errors).length===0,changes,errors};
}
export function diffDesignLines(left,right,{maxChars=24000}={}){
 if(!Number.isSafeInteger(maxChars)||maxChars<1||maxChars>131072||typeof left!=='string'||typeof right!=='string'||left.length>maxChars||right.length>maxChars)throw Error("差异正文超过本次上限。");
 const a=left.split('\n'),b=right.split('\n');let start=0,end=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 return[...a.slice(0,start).map(text=>({kind:'same',text})),...a.slice(start,a.length-end).map(text=>({kind:'removed',text})),...b.slice(start,b.length-end).map(text=>({kind:'added',text})),...a.slice(a.length-end).map(text=>({kind:'same',text}))];
}
export function researchDesignHeader(config,pageId,search){
 if(!isResearchDesignRoute(pageId,search))return config;
 return{...config,title:pageId==='q02'?'我的研究设计草稿':pageId==='s02'?'Study研究设计':'完善研究设计',description:"当前已授权合成Study内的本人已保存草稿；不是正式立项或方案审批。",meta:"合成数据演练 · 私有本人草稿",actions:[],nav:undefined,crumbs:pageId==='s02'?[['我的工作台','p01'],['Study概览'],['研究设计']]:[['科研资产','a01'],['知识资料','k01'],['研究设计草稿']]};
}
export function designIdentityMode(configured,explicitDemo,pageId,search){return ['p01','k01'].includes(pageId)||Boolean(configured)&&(!explicitDemo||isCatalogAssetRoute(pageId,search)||isResearchAssetRoute(pageId,search)||isReportsRoute(pageId,search)||isAssetApplicabilityRoute(pageId,search)||isCrfMethodAssetsRoute(pageId,search)||isCrfMethodsRoute(pageId,search)||isSyntheticEdcRoute(pageId,search)||isPreparationRoute(pageId,search)||isResearchProjectRoute(pageId,search)||isFormalRoute(pageId,search)||isSubjectRoute(pageId,search)||isResearchDesignRoute(pageId,search)||pageId==='q01'&&new URLSearchParams(search).has('researchPlanId'));}
