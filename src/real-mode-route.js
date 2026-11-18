import {isReportsRoute} from './formal-reports-session.js';
import {isMethodsRoute} from './formal-methods-session.js';
import {isAnalysisRoute} from './formal-analysis-session.js';
import {isFormalTaskRoute} from './formal-tasks-session.js';
import {isCaptureRoute} from './formal-capture-session.js';
import {isSubjectRoute} from './research-subjects-session.js';
import {isFormalRoute} from './formal-preparation-session.js';
import {isResearchProjectRoute} from './research-projects-session.js';
import {isResearchDesignRoute} from './research-design-session.js';
import {isSyntheticEdcRoute} from './synthetic-edc-session.js';
import {isCrfMethodsRoute} from './crf-methods-session.js';
import {isAssetDraftRoute} from './synthetic-asset-route.js';
import {isCrfMethodAssetsRoute} from './crf-method-assets-session.js';
import {isAssetApplicabilityRoute} from './asset-applicability-session.js';
import {isStudyOverviewRoute} from './study-overview-route.js';
import {isStudyTaskRoute} from './study-tasks-session.js';
import {isResearchAssetRoute} from './research-assets-session.js';
import {isCatalogListRoute,isCatalogAssetRoute} from './research-assets-catalog-session.js';

const PUBLIC=['p00','p001','p002','p007','p008','p009'];
const AUTH=['p003','p004','p005','p006','p010'];
const LIVE=['p01','k01','s11','e01','e02','g02','g03','g04','g05','g01','h01','h05','c01','c03','h06','t01','t02','r01','r02'];
const ENTRY=['q02','a01','ai01'];
const SCOPED=['q01','s03','s04','s05','s06','s07','a02'];
const PENDING=['e03','s01','s02','o01','o02','h02','h03','h04','s08','s09','s10','h07'];
export const REAL_MODE_ROUTE_IDS=[...PUBLIC,...AUTH,...LIVE,...ENTRY,...SCOPED,...PENDING];
const publicPages=new Set(PUBLIC),authPages=new Set(AUTH),livePages=new Set(LIVE),entryPages=new Set(ENTRY);

export function realModeRouteState(pageId,search='',{configured=false,explicitDemo=false}={}){
  if(isCatalogAssetRoute(pageId,search))return configured?'live':'pending';
  if(isResearchAssetRoute(pageId,search))return configured?'live':'pending';
  if(configured&&(isReportsRoute(pageId,search)||isMethodsRoute(pageId,search)||isAnalysisRoute(pageId,search)||isFormalTaskRoute(pageId,search)||isCaptureRoute(pageId,search)||isSubjectRoute(pageId,search)||isResearchProjectRoute(pageId,search)||isFormalRoute(pageId,search)))return 'live';
  if(!configured||explicitDemo)return 'demo';
  if(isCatalogListRoute(pageId,search))return 'entry';
  if(publicPages.has(pageId))return 'public';
  if(authPages.has(pageId))return 'auth';
  if(livePages.has(pageId))return 'live';
  if(isStudyOverviewRoute(pageId,search))return 'live';
  if(isStudyTaskRoute(pageId,search))return 'live';
  if(pageId==='q01'&&new URLSearchParams(search).has('researchPlanId'))return 'live';
  if(isResearchDesignRoute(pageId,search)||isSyntheticEdcRoute(pageId,search)||isCrfMethodsRoute(pageId,search)||isAssetDraftRoute(pageId,search)||isCrfMethodAssetsRoute(pageId,search)||isAssetApplicabilityRoute(pageId,search))return 'live';
  // Invalid article URLs must reach the real restricted state, never the demo app.
  if(pageId==='ai01')return 'entry';
  if(entryPages.has(pageId)&&!search)return 'entry';
  return 'pending';
}
