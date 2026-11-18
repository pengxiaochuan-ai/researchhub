import {createHash} from 'node:crypto';
import {planLiteratureQuery} from './literature-query.mjs';
import {planInterpretation} from './interpretation-plan.mjs';
import {GENERAL_MODE,GENERAL_POLICY_HASH} from './general-conversation-policy.mjs';
import {createLiteratureRequest} from './natural-literature-plan.mjs';
import {normalizeNetworkIntent,effectiveNetworkIntent,isLocalOnlyRequest} from './network-intent.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
import {DATA_ANALYSIS_INSTRUCTION} from './research-data-output.mjs';
import {VIDEO_MODE,VIDEO_INSTRUCTION} from './video-chat-contract.mjs';
export const ROUTER_VERSION='hub-medical-router.v1';
const prefix='doubao-medical-literature-';
const keys={search:prefix+'search',interpret:prefix+'interpretation',translate:prefix+'translation',protocol:'doubao-medical-protocol-design',pubmed:'pubmed-medical-literature',monitor:prefix+'monitoring',clinical:'doubao-clinical-decision-support',report:'doubao-medical-report',patient:'doubao-answer-with-medical-evidence'};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const routeDigest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code,status:409});};

export function routeSkillTask({text,context,previous,literatureEnabled=false,interpretationEnabled=false,naturalPlanningEnabled=false,retrieval,asOf,networkIntent,smartSearchEnabled=false,privateMaterialsEnabled=false,researchDataEnabled=false,videoContentEnabled=false,legacySingleCharacterRead=false}){
 // Old completed inputs used UTF-16 minimum length; only bound history may
 // retain a single non-BMP character. New commands still need two codepoints.
 const legacyShort=legacySingleCharacterRead&&typeof text==='string'&&[...text.trim()].length===1&&text.trim().length===2;
 if(agentQuestionError(text)&&!legacyShort||!['article','hub','private-materials','research-data','video-content'].includes(context?.kind))fail('HUB_SKILL_INPUT_INVALID');
 if(context.kind==='video-content'){
  if(!videoContentEnabled)fail('HUB_SKILL_RUNTIME_UNAVAILABLE');
  if(normalizeNetworkIntent(networkIntent).enabled)return{status:'clarify',question:'请关闭“智能搜索”后再分析本会话视频；私有视频内容不会用于联网搜索。'};
  return{status:'selected',skillKey:null,mode:VIDEO_MODE,requiredTools:['media_content_read'],scope:'selected-transcript-and-sampled-frames',anchorQuestion:text.trim()};
 }
 if(context.kind==='research-data'){
  if(!researchDataEnabled)fail('HUB_SKILL_RUNTIME_UNAVAILABLE');
  if(normalizeNetworkIntent(networkIntent).enabled)return{status:'clarify',question:'请关闭“智能搜索”后再解释本批研究数据；研究数据不会用于联网搜索。'};
  return{status:'selected',skillKey:null,mode:'hub-research-data',requiredTools:['research_data_result_read'],scope:'fixed-owner-import-results',anchorQuestion:text.trim()};
 }
 if(context.kind==='private-materials'){
  if(!privateMaterialsEnabled)fail('HUB_SKILL_RUNTIME_UNAVAILABLE');
  if(normalizeNetworkIntent(networkIntent).enabled)return{status:'clarify',question:'请关闭“智能搜索”后再分析本会话资料；本次不会把私有材料交给联网搜索。'};
  return{status:'selected',skillKey:keys.interpret,mode:'hub-private-materials',requiredTools:['private_material_read'],scope:'fixed-owner-private-materials',anchorQuestion:text.trim()};
 }
 const q=text.trim().replace(/(?:不要|无需|不需要|不做)(?:再)?(?:进行)?(?:检索|搜索|翻译|订阅)/g,'');
 const general=()=>({status:'selected',skillKey:null,mode:GENERAL_MODE,requiredTools:[],scope:'conversation-only',anchorQuestion:text.trim()});
 const capabilityQuestion=/介绍.{0,5}(?:自己|你)|你是谁|(?:你|岐研AI|帮我|帮助我).{0,18}(?:能力|功能|做什么|(?:哪些|什么).{0,6}(?:工作|任务))|(?:你|上面|刚才|能力|功能).{0,30}(?:怎么用|如何使用|从哪里开始)/.test(q);
 const requestedAction=/(?:[，,。；;？！?！]|然后|同时|并且|请|帮我|帮助我).{0,4}(?:检索|搜索|查找|寻找|翻译|订阅|比较|计算|生成|导出|发布|审批)/.test(q);
 if(context.kind==='hub'&&capabilityQuestion&&!requestedAction)return general();
 if(networkIntent!==undefined){
  const net=effectiveNetworkIntent(networkIntent,text),external=/PubMed|全网|联网|网上|网络|官网|网页|外部|https?:|最新|实时|近[一二两三\d].{0,3}(?:年|月)|最近.{0,8}进展/i.test(q);
  const action=q.replace(/(?:不|不要|无需|不需要|禁止)(?:再|新增|进行)?(?:联网)?(?:检索|搜索|查询|查找)/g,'');
  const newSearch=/查询|检索|搜索|查找|寻找|读取|查阅|官网|网页|https?:|最新|实时/.test(action);
  const frozen=previous?.mode==='hub-smart-search'&&(/^(?:继续|再详细|展开|接着说)/.test(q)||/上述|上轮|这些|第.{0,3}篇|第.{0,3}(?:条|个).{0,5}(?:来源|资料|网页|文献)/.test(q))&&!newSearch;
  if(frozen)return{status:'selected',skillKey:keys.search,mode:'hub-smart-search',requiredTools:['hub_web_snapshot'],scope:'fixed-web-snapshot',previousJobId:previous.jobId,anchorQuestion:previous.anchorQuestion};
  if(!net.enabled&&external&&!isLocalOnlyRequest(text))return{status:'clarify',question:'请先开启“智能搜索”，再发送联网检索问题。'};
  if(net.enabled&&smartSearchEnabled&&context.kind==='hub'&&newSearch&&!/PubMed/i.test(q)&&!(/订阅|每.{0,4}(?:周|月|天|日)/.test(q)))return{status:'selected',skillKey:keys.search,mode:'hub-smart-search',requiredTools:['websearch','hub_public_webfetch'],scope:'public-web',anchorQuestion:text.trim()};
  if(!net.enabled&&context.kind==='hub'&&!/翻译|订阅|(?:体检|检验|化验|影像|病理|检查).{0,8}(?:报告|指标)|解释|解读|比较|PICO|研究方案|研究设计|作为医生|作为患者|作为家属/i.test(q)&&/查询|检索|搜索|查找|寻找|已审核|资料|证据|针灸|抑郁|失眠|科研|研究/.test(q))return{status:'selected',skillKey:keys.search,mode:'existing-reviewed-hub',requiredTools:['hub_source_search'],scope:'reviewed-hub',anchorQuestion:text.trim()};
 }
 const boundInterpretation=interpretationEnabled&&context.kind==='hub'&&/解读|解释|比较/.test(q)&&/第.{0,3}篇|上述|上轮|这些|这几篇|多篇|PMID/.test(q)&&!/查找|寻找|搜索|检索|后续研究|其他相关论文/.test(q);
 let kind,fromPrevious=false;
 if(/^(?:继续|再详细(?:说明|解释)?|展开(?:说明)?|接着说)[。？?！!\s]*$/.test(q)){
  kind=Object.keys(keys).find(k=>keys[k]===previous?.skillKey);fromPrevious=Boolean(kind);
  if(!kind)return context.kind==='hub'?general():{status:'clarify',question:'你希望继续哪一项具体任务？'};
 }else if(/翻译|双语|translate\b/i.test(q))kind='translate';
 else if(naturalPlanningEnabled&&context.kind==='hub'&&!/订阅|每.{0,4}(?:周|月|天|日).{0,6}(?:更新|推送|提醒)/.test(q)&&!/(?:体检|检验|化验|血常规|影像|病理|检查).{0,8}(?:报告|指标)|异常指标|两次检查/.test(q)&&/查询|检索|搜索|查找|寻找|最新.{0,8}(?:研究|论文)|最近.{0,8}进展/.test(q))kind='search';
 else if(/订阅|追踪|跟踪|最新.{0,8}(?:研究|进展)|最近.{0,8}进展/.test(q)||(/每.{0,4}(?:周|月|天|日)/.test(q)&&/更新|推送|提醒|进展/.test(q)))kind='monitor';
 else if(/(?:体检|检验|化验|血常规|影像|病理|检查).{0,8}(?:报告|指标)|异常指标|两次检查/.test(q))kind='report';
 else if(/科研.{0,4}报告|本研究.{0,8}报告|统计分析报告/.test(q))return{status:'clarify',question:'你希望整理哪份研究结果，产出什么类型的科研报告？'};
 else if(/PICO|研究方案|研究设计|临床试验|审阅.{0,6}稿件|目标期刊/i.test(q)&&!/可靠|局限|这篇|本文/.test(q)&&!boundInterpretation)kind='protocol';
 else if(/作为家属|作为患者|我是.{0,5}(?:患者|家属)|我想通俗|通俗了解|家属.{0,8}(?:了解|理解)/.test(q))kind='patient';
 else if(/作为医生|专业病例|虚构病例|治疗决策|调整.{0,4}(?:药|治疗)|患者现在应|(?:制定|推荐|提供|给出).{0,8}(?:治疗|用药)(?:方案|建议)/.test(q))kind='clinical';
 else if(boundInterpretation)kind='interpret';
 else if(/DOI|PMID|PMCID|MeSH|拼写|格式化引用|核对题录/i.test(q)&&!/查找|寻找|搜索|检索/.test(q))kind='pubmed';
 else if(/查找|寻找|搜索|检索|后续研究|其他相关论文/.test(q))kind='search';
 else if(/比较.{0,8}(?:选择|这|给定).{0,6}(?:篇|论文)|(?:解读|解释).{0,8}(?:文章|论文)|这篇|本文|研究类型|研究局限|研究设计.{0,5}可靠/.test(q)||(context.kind==='article'&&/解读/.test(q)))kind='interpret';
 else if(/查找|寻找|搜索|检索|相关论文|随机试验|比较.{0,8}证据|PubMed/i.test(q))kind='search';
 else if(context.kind==='article'&&/设计|方法|结论|局限|主要发现|研究问题|因果|观察|测量/.test(q))kind='interpret';
 else if(/报告/.test(q))return{status:'clarify',question:'你希望解读医学检查报告，还是整理科研结果报告？'};
 else if(context.kind==='hub'&&/已审核|资料|证据|针灸|抑郁|失眠|科研|研究/.test(q))kind='search';
 else return context.kind==='hub'?general():{status:'clarify',question:'你希望针对这篇文章核对什么问题？'};
 let mode='unavailable',requiredTools=[];
 let taskPlan;
 if(kind==='interpret'&&context.kind==='hub'&&interpretationEnabled){
  taskPlan=planInterpretation(text,{retrieval,priorPlan:previous?.taskPlan,continuation:fromPrevious});
  if(taskPlan.status!=='ready')return taskPlan;
  mode='hub-literature-interpretation';requiredTools=['hub_fixed_interpretation_evidence'];
 }
 if(kind==='search'&&context.kind==='hub'&&literatureEnabled&&!(fromPrevious&&previous.mode==='existing-reviewed-hub')){
  if(networkIntent!==undefined&&!effectiveNetworkIntent(networkIntent,text).enabled)return{status:'selected',skillKey:keys.search,mode:'existing-reviewed-hub',requiredTools:['hub_source_search'],scope:'reviewed-hub',anchorQuestion:fromPrevious?previous.anchorQuestion:text.trim(),...(fromPrevious?{previousJobId:previous.jobId}:{})};
  const question=fromPrevious?previous.anchorQuestion:text,options={today:asOf??(fromPrevious?previous.taskAsOf:undefined)};
  taskPlan=naturalPlanningEnabled?createLiteratureRequest(question,options):planLiteratureQuery(question,options);
  if(!naturalPlanningEnabled&&taskPlan.status!=='ready')return{status:'clarify',question:taskPlan.question};
  mode='hub-literature-search';requiredTools=['hub_source_search',...((taskPlan.sourceCeiling??taskPlan.scope)==='hub-and-pubmed'?['pubmed_search_articles','pubmed_fetch_articles']:[])];
 }
 const multipleArticles=/多篇|这些(?:文章|论文)|几篇|比较.{0,8}论文/.test(q)||[...q.matchAll(/(\d+|[一二两三四五六七八九十百千]+)篇/g)].some(([,count])=>!['1','一'].includes(count));
 if(kind==='interpret'&&context.kind==='article'&&!multipleArticles){
  mode='existing-fixed-article';requiredTools=['hub_article_evidence'];
 }else if(!taskPlan&&kind==='search'&&context.kind==='hub'&&!/PubMed|全网|外部|查找|寻找|搜索|检索|相关论文|随机试验/i.test(q)){
  mode='existing-reviewed-hub';requiredTools=['hub_source_search'];
 }
 return{status:'selected',skillKey:keys[kind],mode,requiredTools,scope:taskPlan?.sourceCeiling??taskPlan?.scope??(context.kind==='article'?'fixed-article':'reviewed-hub'),...(taskPlan?{taskPlan}:{}),...(fromPrevious?{previousJobId:previous.jobId}:{}),anchorQuestion:fromPrevious?previous.anchorQuestion:text.trim()};
}

export function bindSkillRoute({user,session,text,decision,skill,sourceBinding,networkIntent}){
 if(decision?.status!=='selected'||decision.mode==='unavailable')fail('HUB_SKILL_RUNTIME_UNAVAILABLE');
 const general=decision.mode===GENERAL_MODE;
 const researchData=decision.mode==='hub-research-data';
 const video=decision.mode===VIDEO_MODE;
 if(general||researchData||video){if(skill!==null||decision.skillKey!==null||general&&decision.requiredTools.length!==0||researchData&&JSON.stringify(decision.requiredTools)!=='["research_data_result_read"]'||video&&JSON.stringify(decision.requiredTools)!=='["media_content_read"]')fail('HUB_SKILL_NOT_EQUIPPED');}else if(skill?.key!==decision.skillKey)fail('HUB_SKILL_NOT_EQUIPPED');
 const data={schema:networkIntent===undefined?ROUTER_VERSION:'hub-medical-router.v2',...(networkIntent===undefined?{}:{networkIntentHash:routeDigest(normalizeNetworkIntent(networkIntent))}),principal:{tenantId:user.tenantId,accountId:user.accountId,authVersion:user.authVersion,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId},
  session:{id:session.id,agentId:session.agentId,contextHash:routeDigest(session.contextKey)},inputHash:routeDigest(text.trim()),sourceBinding,
  skill:general||researchData||video?null:{id:skill.id,key:skill.key,version:skill.version,sourceHash:skill.sourceHash},...(general?{conversationPolicyHash:GENERAL_POLICY_HASH}:{}),...(researchData?{dataPolicyHash:routeDigest(DATA_ANALYSIS_INSTRUCTION)}:{}),...(video?{videoPolicyHash:routeDigest(VIDEO_INSTRUCTION)}:{}),decision};
 return{...data,snapshotHash:routeDigest(data)};
}

export function assertSkillRoute(route,args){
 if(!route||![ROUTER_VERSION,'hub-medical-router.v2'].includes(route.schema))fail('HUB_SKILL_ROUTE_CHANGED');
 const expected=bindSkillRoute(args);
 if(routeDigest(route)!==routeDigest(expected))fail('HUB_SKILL_ROUTE_CHANGED');
 if(route.decision.requiredTools.some(tool=>!args.availableTools?.includes(tool)))fail('HUB_SKILL_DEPENDENCY_UNAVAILABLE');
 return route;
}

export function routeExecutionInput(route,text){
 if(routeDigest(text.trim())!==route.inputHash)fail('HUB_SKILL_ROUTE_CHANGED');
 const continuation=Boolean(route.decision.previousJobId),query=continuation?route.decision.anchorQuestion:text;
 if(agentQuestionError(query))fail('HUB_SKILL_INPUT_INVALID');
 return{query,continuationInstruction:continuation?'本轮用户追问是继续展开上一轮本人任务。question已恢复该用户原问题；请进一步说明，不将历史AI回答当成证据，不扩展来源范围。':''};
}
