import {makeCrfMethodAssetUrl} from './crf-method-assets-session.js';
const key='[A-Za-z0-9_-]{1,160}',valid=v=>typeof v==='string'&&new RegExp('^'+key+'$').test(v),version=v=>/^(?:[1-9]|[12][0-9]|30)$/.test(String(v));
const fail=()=>{throw Error('资产核对入口或固定版本无效，不回退演示或其他研究。');};
export const applicabilityLabels={question:'研究问题与PICO',eligibility:'人群与入排标准',outcomes:'结局声明',visits:'访视声明',crf_mapping:'CRF与结局映射',method_scope:'方法覆盖范围'};
export const isAssetApplicabilityRoute=(page,search)=>['a01','a02'].includes(page)&&['assetApplicability','applicabilityId','applicabilityVersion'].some(k=>new URLSearchParams(search).has(k));
export function readAssetApplicabilityLocation(page,search){
 const p=new URLSearchParams(search),allowed=['assetApplicability','applicabilityId','applicabilityVersion','studyGroupId','researchProjectId'];
 if(page!=='a02'||!isAssetApplicabilityRoute(page,search)||p.get('assetApplicability')!=='1'||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')},recordId=p.get('applicabilityId'),versionNo=p.has('applicabilityVersion')?Number(p.get('applicabilityVersion')):null;
 if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||p.has('applicabilityId')&&!valid(recordId)||p.has('applicabilityVersion')&&(!valid(recordId)||!version(p.get('applicabilityVersion'))))fail();
 return{scope,recordId,versionNo};
}
export function makeAssetApplicabilityUrl(scope,id,no){const p=new URLSearchParams({assetApplicability:'1',studyGroupId:scope?.studyGroupId??'',researchProjectId:scope?.researchProjectId??''});if(id!==undefined)p.set('applicabilityId',id);if(no!==undefined&&no!==null)p.set('applicabilityVersion',String(no));readAssetApplicabilityLocation('a02',p.toString());return'/pages/a02/?'+p;}
export const applicabilitySourceUrl=(scope,ref)=>makeCrfMethodAssetUrl('a02',scope,ref.id,ref.versionNo);
export const isApplicabilitySelfCheck=binding=>typeof binding?.sourceRoot?.planId==='string'&&binding.sourceRoot.planId.length>0&&binding.sourceRoot.planId===binding.targetPlan?.id;
export function applicabilityTargetPath(ref){if(!valid(ref?.id)||!version(ref.versionNo))fail();return'/research-plan-drafts/'+ref.id+'/versions/'+ref.versionNo;}
export function assetApplicabilityHeader(config,page,search){return isAssetApplicabilityRoute(page,search)?{...config,concept:undefined,tags:[],title:'本人资产复用条件核对',description:'对照固定资产与目标方案声明，记录本人建议；不自动应用，不作临床适用结论。',meta:"合成数据演练 · 私有核对草稿",actions:[],nav:undefined,crumbs:[['科研资产','a01'],['本人资产核对']]}:config;}
export function assetApplicabilityRequestAllowed(method,path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('..'))return false;
 let u;try{u=new URL(path,'http://local');}catch{return false;}if(u.origin!=='http://local'||u.hash||u.pathname!==path.split('?')[0])return false;
 const base='/asset-applicability-drafts';
 if(method==='GET'&&u.pathname===base){return![...u.searchParams.keys()].some(k=>!['limit','before'].includes(k)||u.searchParams.getAll(k).length!==1)&&(!u.searchParams.has('limit')||/^(?:[1-9]|1[0-9]|20)$/.test(u.searchParams.get('limit')))&&(!u.searchParams.has('before')||valid(u.searchParams.get('before')));}
 if(u.search)return false;
 if(method==='GET')return new RegExp('^'+base+'/'+key+'(?:/versions/(?:[1-9]|[12][0-9]|30))?$').test(path)||new RegExp('^/sessions/'+key+'/knowledge-sources/'+key+'/[AT][1-9][0-9]*$').test(path);
 return method==='POST'&&(path===base||new RegExp('^'+base+'/'+key+'/(?:opinions|jobs)$').test(path));
}
export function validateApplicabilityOpinions(old,drafts){const changes=[],errors={};for(const [ruleId,v]of Object.entries(drafts)){const reason=(v.reason??'').trim();if(v.decision===(old[ruleId]?.decision??'')&&reason===(old[ruleId]?.reason??''))continue;if(!Object.hasOwn(applicabilityLabels,ruleId)||!['reference','revise','decline'].includes(v.decision)||!reason||reason.length>1000)errors[ruleId]='请选择意见并填写1–1000字理由。';else changes.push({ruleId,decision:v.decision,reason});}return{changes,errors};}
export function displayApplicabilityValue(v){if(!v?.present)return'未声明／未检查';if(typeof v.value==='boolean')return v.value?'是（true）':'否（false）';return typeof v.value==='object'?JSON.stringify(v.value):String(v.value);}
