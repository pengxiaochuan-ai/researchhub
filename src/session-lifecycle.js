import {isReportsRoute,readReportsRoute} from './formal-reports-session.js';
import {isResearchAssetRoute,readResearchAssetLocation,makeResearchAssetUrl} from './research-assets-session.js';
import {isCatalogAssetRoute,readCatalogAssetLocation,makeCatalogAssetUrl,safeCatalogReturn} from './research-assets-catalog-session.js';
import {isMethodsRoute,readMethodsRoute} from './formal-methods-session.js';
import {isAnalysisRoute,readAnalysisRoute} from './formal-analysis-session.js';
import {isFormalTaskRoute,readFormalTaskRoute} from './formal-tasks-session.js';
import {isCaptureRoute,readCaptureRoute} from './formal-capture-session.js';
import {isSubjectRoute,readSubjectRoute} from './research-subjects-session.js';
import {isFormalRoute,readFormalRoute} from './formal-preparation-session.js';
// Public literature/directory routes remain anonymous; only workspace routes redirect.
import {readArticleAiRoute,articleAiHref,hubAiHref} from './article-ai-session.js';
import {readReportQaRoute,reportQaHref,readReportQaCitation,reportQaCitationHref} from './report-asset-qa.js';
import {safeGovernanceReturn} from './governance-overview.js';
import {safeAcademicReturn} from './academic-content-route.js';
import {safeHubAssetReturn} from './hub-asset-route.js';
import {readProtocolReviewRoute} from './governance-protocol-route.js';
import {readInvitationLocation,invitationLocationHref} from './invitation-location.js';
const protectedPages=new Set(['p01','p006','q01','q02','k01','ai01','a01','a02','s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','g01','g02','g03','g04','g05']);
export function bindSessionActivity(target,callback){const events=['pointerdown','keydown','input','change','submit'];for(const type of events)target.addEventListener(type,callback,{capture:true,passive:true});return()=>{for(const type of events)target.removeEventListener(type,callback,{capture:true});};}
export const isProtectedPage=path=>protectedPages.has(path.match(/^\/pages\/([a-z0-9]+)\/$/)?.[1]);
const scope=['studyGroupId','researchProjectId'],plan=[...scope,'researchPlanId'];
const parameters={p01:[],k01:['mode'],p006:['section'],g02:['view'],g03:[],g04:[],g05:[],ai01:[],q01:[...plan,'syntheticRunId','syntheticReportVersion'],q02:[...plan,'designWorkspace'],s01:scope,s02:[...scope,'designWorkspace'],s03:[...plan,'syntheticCapture','collectionId','recordId'],s04:[...plan,'syntheticCapture','collectionId','recordId'],s05:plan,s06:[...plan,'crfMethods','collectionId','runId','compareRunId','methodReportId','methodReportVersion'],s07:[...plan,'designWorkspace'],s08:[...scope,'taskId'],s09:plan,s10:plan,s11:[...plan,'members','executionPreparation'],a01:[...scope,'assetDrafts','crfMethodAssets'],a02:[...scope,'assetDraftId','assetVersion','crfMethodAssets','crfMethodAssetId','crfMethodAssetVersion','assetApplicability','applicabilityId','applicabilityVersion']};
export function safeSessionReturn(value){
 const hubAsset=safeHubAssetReturn(value);if(hubAsset)return hubAsset;
 const academic=safeAcademicReturn(value);if(academic)return academic;
 const fallback='/pages/p01/';if(typeof value!=='string'||!value.startsWith('/pages/')||/[\\\r\n]/.test(value))return fallback;
 let u;try{u=new URL(value,'http://researchhub.local');}catch{return fallback;}
 if(u.origin!=='http://researchhub.local'||!isProtectedPage(u.pathname))return fallback;
 const page=u.pathname.split('/')[2],keys=parameters[page]??[];
 if(isCatalogAssetRoute(page,u.search)){try{const quote=u.hash?readReportQaCitation(u.hash):null;if(u.hash&&(!quote||quote.invalid))return fallback;const r=readCatalogAssetLocation(page,u.search);return quote?reportQaCitationHref(r.scope,r.assetId,r.versionNo,quote):makeCatalogAssetUrl(r.scope,r.assetId,r.versionNo,r.returnTo);}catch{return fallback;}}
 if(page==='a01'&&!u.searchParams.has('assetDrafts')&&!u.searchParams.has('crfMethodAssets')){try{return safeCatalogReturn(value);}catch{return fallback;}}
 if(isResearchAssetRoute(page,u.search)){try{if(u.hash)return fallback;const route=readResearchAssetLocation(page,u.search);return makeResearchAssetUrl(route.scope,route.assetId,route.versionNo);}catch{return fallback;}}
 if(page==='g02')return safeGovernanceReturn(value);
 if(page==='s11'&&u.searchParams.has('invitationId')){try{if(u.hash)return fallback;const r=readInvitationLocation(u.search);return invitationLocationHref(r.groupId,r.projectId,r.invitationId,r.overview);}catch{return fallback;}}
 if(page==='g01'){try{readProtocolReviewRoute(u.search);if(u.hash)return fallback;return u.pathname+u.search;}catch{return fallback;}}
 if(isReportsRoute(page,u.search)){try{readReportsRoute(u.search);return u.pathname+u.search;}catch{return fallback;}}
 if(isMethodsRoute(page,u.search)){try{readMethodsRoute(u.search);return u.pathname+u.search;}catch{return fallback;}}
 if(isAnalysisRoute(page,u.search)){try{readAnalysisRoute(u.search);return u.pathname+u.search;}catch{return fallback;}}
 if(isFormalTaskRoute(page,u.search)){try{readFormalTaskRoute(u.search);return u.pathname+u.search;}catch{return fallback;}}
 if(isCaptureRoute(page,u.search)){try{readCaptureRoute(page,u.search);return u.pathname+u.search+(page==='s09'&&u.hash==='#capture-files'?u.hash:'');}catch{return fallback;}}
 if(isSubjectRoute(page,u.search)){try{readSubjectRoute(page,u.search);return u.pathname+u.search+((page==='s03'&&u.hash==='#study-data'||page==='s04'&&u.hash==='#subject-data')?u.hash:'');}catch{return fallback;}}
 if(isFormalRoute(page,u.search)){try{readFormalRoute(page,u.search);return u.pathname+u.search;}catch{return fallback;}}
 if(page==='s01'&&u.searchParams.has('researchStudy')){const p=u.searchParams;if([...p.keys()].some(k=>!['researchStudy','studyId'].includes(k)||p.getAll(k).length!==1)||p.get('researchStudy')!=='1'||!/^[A-Za-z0-9_-]{1,160}$/.test(p.get('studyId')??''))return fallback;return u.pathname+u.search;}
 if(page==='ai01'&&u.search){const qa=readReportQaRoute(u.search);if(qa)return qa.invalid||u.hash?fallback:reportQaHref(qa.scope,qa.assetId,qa.version);const r=readArticleAiRoute(u.search);return r.kind==='article'?articleAiHref(r.recordId,r.recovery):r.kind==='hub'?hubAiHref(r.sessionId,r.uploadStudyId,{...(r.uploadSubjectId?{uploadSubjectId:r.uploadSubjectId}:{}),...(r.uploadVisitId?{uploadVisitId:r.uploadVisitId}:{})}):fallback;}
 if([...u.searchParams].some(([k,v])=>!keys.includes(k)||u.searchParams.getAll(k).length!==1||!/^[A-Za-z0-9_-]{1,160}$/.test(v)))return fallback;
 // Hashes can contain tokens; don't carry them into a login URL.
 if(page==='p006'&&u.search&&!['research-identity','admission'].includes(u.searchParams.get('section')))return fallback;
 if(page==='k01'&&u.search&&u.searchParams.get('mode')!=='manage')return fallback;
 return u.pathname+u.search;
}
export function createSessionLifecycle({renew,onExpired,onUnavailable=()=>{},now=Date.now,isVisible=()=>true}){
 let stopped=false,busy=false,last=-Infinity;
 return{
  async activity(event){if(stopped||busy||!isVisible()||!event.isTrusted||!['pointerdown','keydown','input','change','submit'].includes(event.type)||now()-last<60000)return;busy=true;
   try{await renew();if(!stopped)last=now();}catch(e){if(!stopped){if(e.code==='AUTH_INVALID_CREDENTIALS'||e.status===401){stopped=true;onExpired();}else onUnavailable(e);}}finally{busy=false;}
  },
  dispose(){stopped=true;},
 };
}
