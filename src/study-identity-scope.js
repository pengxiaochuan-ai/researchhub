import {isResearchProjectRoute,readResearchProjectRoute} from './research-projects-session.js';
import {isSubjectRoute,readSubjectRoute} from './research-subjects-session.js';
import {isCaptureRoute,readCaptureRoute} from './formal-capture-session.js';

const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
// The Hub Study id is not an execution-project id and cannot be matched to a
// group member by guessing. Resolve only the explicit, validated real routes.
export function readStudyIdentityRoute(pathname,search=''){
 const page=pathname.match(/^\/pages\/([^/]+)\/$/)?.[1],routeKey=pathname+search;
 try{
  if(page==='s01'&&isResearchProjectRoute(page,search))return{studyId:readResearchProjectRoute(page,search).id,routeKey};
  if(['s03','s04'].includes(page)&&isSubjectRoute(page,search))return{studyId:readSubjectRoute(page,search).studyId,routeKey};
  if(['s05','s09'].includes(page)&&isCaptureRoute(page,search))return{studyId:readCaptureRoute(page,search).studyId,routeKey};
 }catch{return{scopeStatus:'invalid',routeKey};}
 return null;
}

export async function resolveStudyIdentityScope(user,scope,{fetchImpl=globalThis.fetch}={}){
 if(!scope?.studyId||scope.scopeStatus==='invalid')return scope;
 const unavailable={studyId:scope.studyId,routeKey:scope.routeKey,scopeStatus:'unavailable'};
 if(!user||!id(user.accountId)||!id(scope.studyId))return unavailable;
 try{
  const response=await fetchImpl('/api/research-studies/'+encodeURIComponent(scope.studyId),{method:'GET',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return{...unavailable,scopeStatus:[403,404].includes(response.status)?'forbidden':'unavailable'};
  const study=(await response.json())?.item?.study;
  if(study?.id!==scope.studyId||study.status!=='active'||!id(study.studyGroupId)||!id(study.executionProjectId))return unavailable;
  return{studyId:scope.studyId,routeKey:scope.routeKey,studyGroupId:study.studyGroupId,researchProjectId:study.executionProjectId,scopeStatus:'resolved'};
 }catch{return unavailable;}
}
