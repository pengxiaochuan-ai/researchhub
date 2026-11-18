// A navigation preference only. Every restoration is checked against fresh /auth/me.
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const validScope=value=>valid(value?.studyGroupId)&&valid(value?.researchProjectId);
const same=(a,b)=>a?.studyGroupId===b?.studyGroupId&&a?.researchProjectId===b?.researchProjectId;
const authorized=(scope,scopes)=>validScope(scope)&&Array.isArray(scopes)&&scopes.some(item=>same(item,scope));
export function lastAssetStudyKey(user){
 return valid(user?.tenantId)&&valid(user?.accountId)?`rh:a01:last-study:v1:${user.tenantId}:${user.accountId}`:null;
}
export function forgetAssetStudy(storage,user,scope){
 const key=lastAssetStudyKey(user);if(!key||!storage)return;
 try{
  if(scope){const raw=storage.getItem(key);if(!raw)return;const saved=JSON.parse(raw);if(validScope(saved)&&!same(saved,scope))return;}
  storage.removeItem(key);
 }catch{/* Navigation must still work when browser storage is unavailable. */}
}
export function readLastAssetStudy(storage,user,scopes){
 const key=lastAssetStudyKey(user);if(!key||!storage)return null;
 try{
  const raw=storage.getItem(key);if(!raw)return null;
  const saved=JSON.parse(raw);
  if(saved?.version!==1||Object.keys(saved).sort().join(',')!=='researchProjectId,studyGroupId,version'||!authorized(saved,scopes)){
   forgetAssetStudy(storage,user);return null;
  }
  return{studyGroupId:saved.studyGroupId,researchProjectId:saved.researchProjectId};
 }catch{forgetAssetStudy(storage,user);return null;}
}
export function rememberAssetStudy(storage,user,scope,scopes){
 const key=lastAssetStudyKey(user);if(!key||!storage||!authorized(scope,scopes))return false;
 try{storage.setItem(key,JSON.stringify({version:1,studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId}));return true;}
 catch{return false;}
}
