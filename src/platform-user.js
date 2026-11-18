import {createAuthClient} from './auth-session.js';
import {createPlatformAuth} from './platform-auth.js';
import {designIdentityMode} from './research-design-session.js';
import {createSessionLifecycle,isProtectedPage,bindSessionActivity} from './session-lifecycle.js';
import {safeAuthenticatedReturnTo} from './route-context.js';
import {reportQaLoginCandidate} from './report-asset-qa.js';
import {readStudyIdentityRoute,resolveStudyIdentityScope} from './study-identity-scope.js';
export const DEFAULT_PLATFORM_USER = Object.freeze({
  id: 'demo-professor',
  displayName: '王教授',
  roleName: '演示 · 课题负责人',
  avatarText: '王',
  authenticated: false,
  mode: 'demo',
});

let demoProfile={};
let explicitDemo=false;try{explicitDemo=sessionStorage.getItem('lingshu-demo-mode')==='true';}catch{}
export const realIdentityMode=designIdentityMode(Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG),explicitDemo,location.pathname.match(/\/pages\/([^/]+)/)?.[1],location.search);
if(!realIdentityMode)try{demoProfile=JSON.parse(localStorage.getItem('lingshu-demo-profile')||'{}');}catch{}
let currentUser = realIdentityMode?{displayName:'正在核验身份',roleName:'正在核验登录状态',avatarText:'访',authenticated:false,mode:'real',status:'checking'}:{
  ...DEFAULT_PLATFORM_USER,
  ...(demoProfile.displayName?{displayName:demoProfile.displayName,roleName:'演示 · '+demoProfile.roleName,avatarText:demoProfile.displayName.slice(0,1)}:{}),
  ...(window.__QIYAN_USER__ ?? {}),
};

export function getPlatformUser() {
  return { ...currentUser };
}

export function setPlatformUser(user) {
  currentUser = user
    ? { ...(realIdentityMode?{}:DEFAULT_PLATFORM_USER), ...user, authenticated: user.authenticated ?? true }
    : { displayName: '未登录', roleName: '登录后访问', avatarText: '访', authenticated: false };

  window.dispatchEvent(new CustomEvent('qiyan:user-change', {
    detail: getPlatformUser(),
  }));
}

let frameScope=null;
let sessionActivityHandler=null;const activityDocuments=new WeakSet();
export function attachSessionActivityDocument(target){if(target&&sessionActivityHandler&&!activityDocuments.has(target)){activityDocuments.add(target);bindSessionActivity(target,sessionActivityHandler);}}
const sessionClient=createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG});
let redirecting=false;
const expired=()=>{if(!redirecting&&isProtectedPage(location.pathname)){redirecting=true;location.replace('/pages/p003/?'+new URLSearchParams({returnTo:safeAuthenticatedReturnTo(reportQaLoginCandidate(location))}));}};
export const platformAuth=realIdentityMode?createPlatformAuth({client:sessionClient,setUser:setPlatformUser,onExpired:expired,resolveScope:resolveStudyIdentityScope,readScope:()=>{const p=new URLSearchParams(location.search);return readStudyIdentityRoute(location.pathname,location.search)??frameScope??{studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')};}}):null;
if(platformAuth){
 let pending;
 const refresh=()=>{clearTimeout(pending);pending=setTimeout(()=>void platformAuth.refresh(),30);};
 window.addEventListener('focus',refresh);window.addEventListener('qiyan:auth-refresh',refresh);window.addEventListener('popstate',refresh);
 window.addEventListener('online',refresh);
 const lifecycle=createSessionLifecycle({renew:()=>sessionClient.renew(),onExpired:expired,isVisible:()=>document.visibilityState==='visible',onUnavailable:()=>{const user=getPlatformUser();if(user.authenticated)setPlatformUser({...user,sessionHealth:'unavailable',roleName:'连接暂不可用，请检查网络后重试'});}});
 const activity=event=>{if(getPlatformUser().authenticated)void lifecycle.activity(event);};
 sessionActivityHandler=activity;attachSessionActivityDocument(document);
 window.addEventListener('qiyan:auth-scope',event=>{frameScope=event.detail;refresh();});
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('researchhub-auth'):null;
 channel?.addEventListener('message',event=>{if(event.data?.type==='changed')refresh();});
 window.addEventListener('qiyan:auth-changed',()=>{refresh();channel?.postMessage({type:'changed'});});
 refresh();
}
