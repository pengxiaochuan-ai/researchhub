import {makeDesignWorkspaceUrl} from './research-design-session.js';
import {makeCrfMethodAssetUrl} from './crf-method-assets-session.js';

const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
export function realEntryLinks(user,kind){
  const projects=(user?.studyGroups??[]).flatMap(group=>(group.researchProjects??[]).filter(project=>valid(group.id)&&valid(project.id)).map(project=>({scope:{studyGroupId:group.id,researchProjectId:project.id},label:group.name+' / '+project.name})));
  const design=projects.map(item=>({label:'进入研究设计草稿',description:item.label,url:makeDesignWorkspaceUrl('q02',item.scope)}));
  const assets=projects.map(item=>({label:'查看本人方法资产候选',description:item.label,url:makeCrfMethodAssetUrl('a01',item.scope)}));
  if(kind==='design')return design;
  if(kind==='assets')return assets;
  if(kind==='ai')return [{label:'基于已审核资料问答',description:"检索已授权知识资料，并基于已审核内容提问。",url:'/pages/k01/'},...design,...assets];
  return [];
}
