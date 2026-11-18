import {createResearchProjectsClient} from './research-projects-session.js';
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const fail=()=>{throw Error('研究方案链接无效，请从研究概览重新进入。');};
export const isFormalRoute=(page,search='')=>['s02','s07','s11'].includes(page)&&new URLSearchParams(search).has('formalPreparation');
export function readFormalRoute(page,search=''){
 const p=new URLSearchParams(search),allowed=new Set(['formalPreparation','studyId','protocolId',...(page==='s07'?['governanceModule','governancePage','reviewTab']:[])]);
 if(!isFormalRoute(page,search)||p.get('formalPreparation')!=='1'||[...p.keys()].some(k=>!allowed.has(k)||p.getAll(k).length!==1)||!valid(p.get('studyId'))||(p.has('protocolId')&&!valid(p.get('protocolId')))||(page==='s07'&&!p.has('protocolId')))fail();
 const hasReturn=p.has('governanceModule')||p.has('governancePage');
 if(hasReturn&&(!['all','ethics','data','quality','access','centers','audit','system'].includes(p.get('governanceModule'))||!/^[1-9]\d{0,3}$/.test(p.get('governancePage')??'')))fail();
 if(p.has('reviewTab')&&(hasReturn||!['pending','processed'].includes(p.get('reviewTab'))))fail();
 return {studyId:p.get('studyId'),protocolId:p.get('protocolId'),...(hasReturn?{governance:{module:p.get('governanceModule'),page:Number(p.get('governancePage'))}}:{}),...(p.has('reviewTab')?{reviewList:{tab:p.get('reviewTab')}}:{})};
}
export function formalUrl(page,studyId,protocolId){if(!['s02','s07','s11'].includes(page)||!valid(studyId)||(protocolId!=null&&!valid(protocolId))||(page==='s07'&&!protocolId))fail();return '/pages/'+page+'/?'+new URLSearchParams({formalPreparation:'1',studyId,...(protocolId?{protocolId}:{})});}
export function formalBackHref(route){return route.reviewList?'/pages/g01/?'+new URLSearchParams({reviewTab:route.reviewList.tab}):route.governance?'/pages/g02/?'+new URLSearchParams({governanceModule:route.governance.module,governancePage:String(route.governance.page)}):'/pages/s01/?'+new URLSearchParams({researchStudy:'1',studyId:route.studyId});}
export function formalHeader(config,page,search){
 if(!isFormalRoute(page,search))return config;let route;
 try{route=readFormalRoute(page,search);}catch{return {...config,title:'研究方案',description:'',meta:'',actions:[],nav:undefined,crumbs:[['我的工作台','p01'],['研究方案']]};}
 const title=page==='s11'?'研究执行准备':page==='s02'?'研究方案':'方案详情';
 const crumbs=route.reviewList?[['管理与治理','g01',{reviewTab:route.reviewList.tab}],[title]]:route.governance?[['管理与治理','g02',{governanceModule:route.governance.module,governancePage:String(route.governance.page)}],[title]]:[['我的工作台','p01'],['我的课题','q02',{researchProjects:'1'}],['研究概览','s01',{researchStudy:'1',studyId:route.studyId}],[title]];
 return {...config,title,description:'查看并准备当前研究的方案与采集配置。',meta:'',actions:[],nav:undefined,crumbs};
}
export const createFormalClient=options=>createResearchProjectsClient(options);
export function nullableInteger(value){if(value==='')return null;const n=Number(value);if(!Number.isSafeInteger(n))throw Error('请输入整数。');return n;}
export function makeFormalMutation(request,key=()=>crypto.randomUUID(),onPending=()=>{}){
 let pending=null;
 async function execute(){const current=pending;try{const value=await request(current.path,{method:current.method,body:current.body});if(pending===current){pending=null;onPending(null);}return value;}catch(error){if(!error.unknown&&pending===current){pending=null;onPending(null);}throw error;}}
 return {pending:()=>pending,clear:()=>{pending=null;onPending(null);},restore(value){if(pending||!value||!['POST','PUT'].includes(value.method)||typeof value.path!=='string'||typeof value.body?.requestKey!=='string')throw Error('无法恢复保存请求。');pending=structuredClone(value);},submit(path,method,body){if(pending)throw Error('请先核对上次保存结果。');pending={path,method,body:{...structuredClone(body),requestKey:key()}};try{onPending(pending);}catch(error){pending=null;throw error;}return execute();},retry(){if(!pending)throw Error('没有待核对的保存。');return execute();}};
}
export function selectFormalProtocol(protocols,protocolId){const protocol=protocolId?protocols?.find(p=>p.id===protocolId):protocols?.find(p=>p.status==='draft');return {protocol:protocol??null,missing:Boolean(protocolId&&!protocol)};}
export function formalExpectedRevision(draft,protocol){return draft?.id===protocol?.id?draft?.revision:undefined;}
export function validFormalPending(value,studyId,protocolId,routeProtocolId=null){
 if(!valid(studyId)||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['path','method','body'].includes(k)))return false;
 const root='/research-studies/'+encodeURIComponent(studyId)+'/protocols',isCreate=!routeProtocolId&&value.method==='POST'&&value.path===root,isUpdate=valid(protocolId)&&value.method==='PUT'&&value.path===root+'/'+encodeURIComponent(protocolId)+'/configuration';if(!isCreate&&!isUpdate)return false;
 const b=value.body,allowed=['requestKey','title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary','visitPlans',...(isUpdate?['expectedRevision']:[])];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k))||!valid(b.requestKey)||typeof b.title!=='string'||typeof b.purpose!=='string'||!['methodsSummary','populationSummary','statisticsSummary'].every(k=>b[k]===null||typeof b[k]==='string')||isUpdate&&(typeof b.expectedRevision!=='string'||!b.expectedRevision)||!['primaryOutcomes','secondaryOutcomes','visitPlans'].every(k=>Array.isArray(b[k])))return false;
 if(![...b.primaryOutcomes,...b.secondaryOutcomes].every(x=>x&&typeof x==='object'&&Object.keys(x).every(k=>['outcomeDefinitionId','versionNumber'].includes(k))&&valid(x.outcomeDefinitionId)&&Number.isSafeInteger(x.versionNumber)))return false;
 return b.visitPlans.every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>['id','code','name','sequence','anchor','anchorEventKey','targetDayOffset','windowBeforeDays','windowAfterDays','required','allowRepeat','requirements'].includes(k))&&(!v.id||isUpdate&&valid(v.id))&&typeof v.code==='string'&&typeof v.name==='string'&&Array.isArray(v.requirements)&&v.requirements.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>['id','kind','code','name','required','config'].includes(k))&&(!r.id||isUpdate&&valid(r.id))&&typeof r.kind==='string'&&typeof r.code==='string'&&typeof r.name==='string'&&r.config&&typeof r.config==='object'&&!Array.isArray(r.config)));
}
export function describeOutcomeMapping(outcome,forms=[],scales=[],visits=[]){
 const sourceKey=outcome?.dataFieldKey||outcome?.scoreKey||null,visitKey=outcome?.timepointCode||null;
 const matchingVisits=visitKey?visits.filter(v=>v.code===visitKey):visits;
 const visit=visitKey?(matchingVisits.length===1&&matchingVisits[0].name&&matchingVisits[0].name!==visitKey?matchingVisits[0].name:'访视已指定'):null;
 const ids=new Set(matchingVisits.flatMap(v=>(v.requirements??[]).filter(r=>r.kind==='form_response').map(r=>r.config?.formVersionId)));
 const candidates=outcome?.scoreKey?scales.filter(s=>s.id===outcome.scaleVersionId):forms.filter(f=>ids.has(f.id));
 const labels=new Set(candidates.flatMap(x=>Array.isArray(x.schema?.fields)?x.schema.fields:[]).filter(f=>f.key===sourceKey&&typeof f.label==='string'&&f.label.trim()&&f.label!==sourceKey).map(f=>f.label.trim()));
 const source=!sourceKey?'来源待确认':labels.size===1?[...labels][0]:'采集字段已指定';
 return {source,visit,sourceKey,visitKey};
}
