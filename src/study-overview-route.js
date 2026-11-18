import {makeDesignWorkspaceUrl} from './research-design-session.js';
import {makeCrfMethodAssetUrl} from './crf-method-assets-session.js';
import {studyTasksUrl} from './study-tasks-session.js';
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const invalid=()=>{throw new Error('Study概览范围无效；请从我的工作台重新选择，不会显示其他研究。');};

export function isStudyOverviewRoute(pageId,search=''){
  const params=new URLSearchParams(search);
  return pageId==='s01'&&(params.has('studyGroupId')||params.has('researchProjectId'));
}

export function readStudyOverviewLocation(search=''){
  const params=new URLSearchParams(search),allowed=new Set(['studyGroupId','researchProjectId']);
  if([...params.keys()].some(key=>!allowed.has(key))||[...allowed].some(key=>params.getAll(key).length!==1||!valid(params.get(key))))invalid();
  return{studyGroupId:params.get('studyGroupId'),researchProjectId:params.get('researchProjectId')};
}

export function makeStudyOverviewUrl(scope){
  if(!valid(scope?.studyGroupId)||!valid(scope?.researchProjectId))invalid();
  return'/pages/s01/?'+new URLSearchParams({studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId});
}

export function resolveStudyOverview(data,scope){
  const group=data?.studyGroups?.find(item=>item.id===scope.studyGroupId);
  const project=group?.projects?.find(item=>item.id===scope.researchProjectId);
  return group&&project?{group,project}:null;
}

export function studyOverviewHeader(config){
  return{...config,title:'Study概览',description:"当前账号已授权的研究；暂不可用指标保留区域并明确标注。",meta:'',crumbs:[['我的工作台','p01'],['Study概览']],
    actions:(config?.actions??[]).map(([label,,primary])=>[label,null,primary,"该操作暂不可用或未获授权，不会执行分享或修改。"]),hide:[]};
}

export function studyOverviewNavUrl(label,search){
  let scope;try{scope=readStudyOverviewLocation(search);}catch{return null;}
  if(label==='概览')return makeStudyOverviewUrl(scope);
  if(label==='研究设计')return makeDesignWorkspaceUrl('s02',scope);
  if(label==='研究执行')return studyTasksUrl(scope);
  if(label==='科研资产')return makeCrfMethodAssetUrl('a01',scope);
  if(label==='团队与设置')return'/pages/s11/?'+new URLSearchParams({members:'1',...scope});
  return null;
}
