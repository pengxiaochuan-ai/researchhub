import {readArticleAiRoute,articleAiHref,hubAiHref} from './article-ai-session.js';
import {safeSessionReturn,isProtectedPage} from './session-lifecycle.js';
import {safeAcademicReturn} from './academic-content-route.js';
export const CONTEXT_KEYS=['hubId','opportunityId','projectId','protocolId','subjectId','assetId','outputId','view','returnTo'];
export function safeReturnTo(value){
  if(typeof value!=='string'||!/^\/pages\/[a-z0-9]+\/(?:[?#].*)?$/.test(value)||/[\\\r\n]/.test(value))return '/pages/q02/';
  return value;
}
const AUTH_ENTRY_PAGES=new Set(['p01','q02','k01','ai01','a01','s11','p006']);
export function safeAuthenticatedReturnTo(value){
  const academic=safeAcademicReturn(value);if(academic)return academic;
  const fallback='/pages/p01/';
  if(typeof value!=='string'||!value.startsWith('/pages/')||/[\\\r\n]/.test(value))return fallback;
  let url;try{url=new URL(value,'http://researchhub.local');}catch{return fallback;}
  const page=url.pathname.match(/^\/pages\/([a-z0-9]+)\/$/)?.[1];
  if(url.origin!=='http://researchhub.local'||!AUTH_ENTRY_PAGES.has(page)&&!isProtectedPage(url.pathname))return fallback;
  if(page==='p006')return !url.hash&&!url.search?url.pathname:!url.hash&&url.searchParams.size===1&&url.searchParams.getAll('section').length===1&&['research-identity','admission'].includes(url.searchParams.get('section'))?'/pages/p006/?section='+url.searchParams.get('section'):fallback;
  if(page==='ai01'&&url.searchParams.has('reportQa'))return safeSessionReturn(value);
  if(page==='ai01'&&url.search){const route=readArticleAiRoute(url.search);return url.hash?fallback:route.kind==='article'?articleAiHref(route.recordId,route.recovery):route.kind==='hub'?hubAiHref(route.sessionId,route.uploadStudyId):fallback;}
  if(page==='s11'&&url.searchParams.has('invitationId'))return safeSessionReturn(value);
  if(page!=='q02'&&page!=='s11'||url.searchParams.has('executionPreparation'))return safeSessionReturn(value);
  if(!url.search)return url.pathname;
  const keys=page==='q02'?['designWorkspace','studyGroupId','researchProjectId','researchPlanId']:page==='s11'?['members','studyGroupId','researchProjectId']:[];
  if(!keys.length||[...url.searchParams.keys()].some(key=>!keys.includes(key)||url.searchParams.getAll(key).length!==1))return fallback;
  const mode=page==='q02'?'designWorkspace':'members';
  if(url.searchParams.get(mode)!=='1'||!['studyGroupId','researchProjectId'].every(key=>/^[\w-]{1,160}$/.test(url.searchParams.get(key)??'')))return fallback;
  const params=new URLSearchParams({[mode]:'1',studyGroupId:url.searchParams.get('studyGroupId'),researchProjectId:url.searchParams.get('researchProjectId')});
  if(page==='q02'&&url.searchParams.has('researchPlanId')){const id=url.searchParams.get('researchPlanId');if(!/^[\w-]{1,160}$/.test(id))return fallback;params.set('researchPlanId',id);}
  return url.pathname+'?'+params;
}
export function readContext(search=''){
  const params=new URLSearchParams(search),context={};
  for(const key of CONTEXT_KEYS){const value=params.get(key);if(value&&(key==='returnTo'||/^[\w-]{1,100}$/.test(value)))context[key]=key==='returnTo'?safeReturnTo(value):value;}
  return context;
}
export function buildPageRoute(routes,pageId,context={}){
  const route=routes[pageId];if(!route)throw Error("页面暂不可用："+pageId);
  const params=new URLSearchParams();
  for(const key of CONTEXT_KEYS){const value=context[key];if(value!=null&&value!==''){if(key==='returnTo')params.set(key,safeReturnTo(String(value)));else if(/^[\w-]{1,100}$/.test(String(value)))params.set(key,value);}}
  return route+(params.size?'?'+params.toString():'');
}
