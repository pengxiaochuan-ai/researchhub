import {isAssetDraftRoute} from './synthetic-asset-route.js';
import {isResearchDesignRoute} from './research-design-session.js';
import {isPreparationRoute} from './research-execution-preparation-session.js';
import {isSyntheticEdcRoute} from './synthetic-edc-session.js';
import {isCrfMethodsRoute} from './crf-methods-session.js';
import {isCrfMethodAssetsRoute} from './crf-method-assets-session.js';
import {isAssetApplicabilityRoute} from './asset-applicability-session.js';

// Presentation only: no identity, permission or business-action decisions here.
export function showWorkspaceNotice(pageId,search,routeState){
 if(pageId==='g02'&&new URLSearchParams(search).get('view')==='directory-review')return false;
 if(routeState==='demo')return true;
 return pageId==='q01'&&new URLSearchParams(search).has('researchPlanId')||isAssetDraftRoute(pageId,search)||isResearchDesignRoute(pageId,search)||isPreparationRoute(pageId,search)||isSyntheticEdcRoute(pageId,search)||isCrfMethodsRoute(pageId,search)||isCrfMethodAssetsRoute(pageId,search)||isAssetApplicabilityRoute(pageId,search);
}
