import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createAuthClient} from '../../src/auth-session.js';
import {createAssetReadBoundary} from '../../src/research-assets-read-boundary.js';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {createCatalogSelectionFence,readCatalogListLocation,assertCatalogAssetDetail,safeCatalogReturn,catalogScopes,catalogPreviewDuringRefresh,catalogRenderState} from '../../src/research-assets-catalog-session.js';
import {researchAssetReadMessage,researchAssetIdentityChanged} from '../../src/research-assets-session.js';
import ResearchAssetCatalog from './ResearchAssetCatalog.jsx';
import useAssetRegistration from './useAssetRegistration.jsx';
import useAssetGovernance from './useAssetGovernance.jsx';
import useAssetUsage from './useAssetUsage.jsx';
import useAssetLifecycle from './useAssetLifecycle.jsx';
import {assertAssetPreviewExtras} from '../../src/research-assets-views.js';
import {readAssetOverview,overviewAssetScope} from '../../src/research-assets-overview.js';
import ResearchAssetRegistrationDialog from './ResearchAssetRegistrationDialog.jsx';
import {assetRegistrationEntryReady,bindAssetRegistrationEntry} from '../../src/research-assets-registration.js';

export default function ResearchAssetCatalogWorkspace(){
 const auth=useMemo(()=>createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG}),[]);
 const [operationScope,setOperationScope]=useState(null),[queuedOperation,setQueuedOperation]=useState(null),[choosingScope,setChoosingScope]=useState(null),lastOperation=useRef(null);
 const [search,setSearch]=useState(location.search),[attempt,setAttempt]=useState(0),[state,setState]=useState({status:'loading'}),[scopes,setScopes]=useState([]);
 const readBoundary=useMemo(()=>createAssetReadBoundary(),[]);
 const [recommendationCursor,setRecommendationCursor]=useState({key:'',cursor:null});
 const fence=useRef(createCatalogSelectionFence()),previewFence=useRef(createCatalogSelectionFence()),currentUser=useRef(null),pendingIdentity=useRef(null),root=useRef(null);
 let route,routeError;try{route=readCatalogListLocation(search);}catch(e){routeError=e;route=readCatalogListLocation('');}
 const returnTo=routeError?'/pages/a01/':safeCatalogReturn('/pages/a01/'+search),routeKey=search;
 const pendingGovernance=useRef(()=>false),pendingRegistration=useRef(()=>false),pendingUsage=useRef(()=>false),pendingLifecycle=useRef(()=>false);
 const displayState=catalogRenderState(state,routeKey);
 const operationCurrent={user:currentUser.current,scope:operationScope??overviewAssetScope(displayState.overview,{assetId:route.selection?.id})??route.scope,ready:displayState.status==='ready',creationScopes:displayState.overview?.creationScopes??[],scopes:displayState.overview?.scopes??[],onChooseScope:scope=>startCreate(scope)},apiFactory=(user,scope)=>readBoundary.guard(createAssetCatalogClient({user,scope}));
 const entryReady=assetRegistrationEntryReady(operationCurrent);
 useEffect(()=>bindAssetRegistrationEntry(document,{ready:entryReady,busy:displayState.status==='loading'}),[entryReady,displayState.status]);
 const registration=useAssetRegistration({current:operationCurrent,apiFactory,readBoundary,canOpen:()=>!pendingGovernance.current()&&!pendingUsage.current()&&!pendingLifecycle.current(),onSaved:receipt=>change({selectedAssetId:receipt.assetId,selectedVersion:receipt.version,previewTab:'basic'}),onCreate:()=>startCreate()});
 const governance=useAssetGovernance({current:operationCurrent,apiFactory,readBoundary,canOpen:()=>!pendingRegistration.current()&&!pendingUsage.current()&&!pendingLifecycle.current(),onSaved:()=>setAttempt(n=>n+1)});
 const usage=useAssetUsage({current:operationCurrent,apiFactory,readBoundary,canOpen:()=>!pendingRegistration.current()&&!pendingGovernance.current()&&!pendingLifecycle.current(),onSaved:()=>setAttempt(n=>n+1)});
 const lifecycle=useAssetLifecycle({current:operationCurrent,apiFactory,readBoundary,canOpen:()=>!pendingRegistration.current()&&!pendingGovernance.current()&&!pendingUsage.current(),onSaved:()=>{change({selectedAssetId:null,selectedVersion:null});setAttempt(n=>n+1);}});
 pendingRegistration.current=registration.pending;pendingGovernance.current=governance.pending;pendingUsage.current=usage.pending;
 pendingLifecycle.current=lifecycle.pending;
 function change(values){
  const p=new URLSearchParams(location.search);
  for(const[k,v]of Object.entries(values))v===null?p.delete(k):p.set(k,String(v));
  readCatalogListLocation(p);
  if('studyGroupId' in values||'selectedAssetId' in values)setOperationScope(null);
  const url='/pages/a01/'+(p.size?'?'+p:'');history.pushState(null,'',url);setSearch(location.search);
 }
 function protectedAction(run){registration.protect(()=>governance.protect(()=>usage.protect(()=>lifecycle.protect(run))));}
 function guardedChange(values){protectedAction(()=>change(values));}
 function queueOperation(scope,run,key){if(!scope)return;const identity=JSON.stringify([currentUser.current?.tenantId,currentUser.current?.accountId,currentUser.current?.authVersion,scope,key]);if(lastOperation.current===identity&&operationScope?.studyGroupId===scope.studyGroupId&&operationScope?.researchProjectId===scope.researchProjectId){run();return;}protectedAction(()=>{lastOperation.current=identity;setOperationScope(scope);setQueuedOperation({run});});}
 function rowOperation(target,run,kind){queueOperation(overviewAssetScope(displayState.overview,target),()=>run(target),{kind,target});}
 function startCreate(preferred){if(!entryReady)return;const options=displayState.overview?.creationScopes??[];const picked=(preferred&&options.find(s=>s.studyGroupId===preferred.studyGroupId&&s.researchProjectId===preferred.researchProjectId))??(route.scope&&options.find(s=>s.studyGroupId===route.scope.studyGroupId&&s.researchProjectId===route.scope.researchProjectId))??(options.length===1?options[0]:null);if(picked){setChoosingScope(null);queueOperation(picked,()=>registration.open(),{kind:'registration',target:null});}else setChoosingScope({options,selected:null});}
 useEffect(()=>{if(queuedOperation){queuedOperation.run();setQueuedOperation(null);}},[queuedOperation]);
 useEffect(()=>{
  const token=fence.current.begin(),observation={latest:null};pendingIdentity.current=observation;previewFence.current.invalidate();setState({status:'loading'});
  let probing=false,disposed=false;
  const isCurrent=()=>!disposed&&fence.current.current(token)&&location.search===routeKey;
  const fail=e=>{if(isCurrent()){readBoundary.fail(e);previewFence.current.invalidate();if(e.status===401){currentUser.current=null;setScopes([]);}setState({status:e.status===401?'signed-out':'error',message:researchAssetReadMessage(e)});}};
  async function load(){
   if(probing)return;probing=true;
   try{
    if(routeError)throw routeError;
    const user=await auth.me();if(!isCurrent())return;
    if(!user)throw Object.assign(new Error('请先登录。'),{status:401});
    if(observation.latest&&researchAssetIdentityChanged(user,observation.latest))throw Object.assign(new Error('当前身份已变化。'),{status:401});
    currentUser.current=user;pendingIdentity.current=null;const nextScopes=catalogScopes(user);setScopes(nextScopes);
    const overview=await readAssetOverview({user,route,cursor:recommendationCursor.key===routeKey?recommendationCursor.cursor:null});if(!isCurrent())return;
    setScopes(overview.scopes);
    const catalog={...overview.catalog,identityRevision:overview.identityRevision},collaborations=route.tab==='collaborations'?overview.mainView:null;
    const mainView=['graph','contributions','trash'].includes(route.tab)?{value:overview.mainView}:null,recommendations={value:overview.recommendations},trend={value:overview.trend};
    const panels={mainView,recommendations,trend,overview};
    if(!isCurrent())return;
    readBoundary.ready();
    setState(previous=>({status:'ready',routeKey,catalog,collaborations,...panels,user,previewStatus:route.selection?'loading':undefined,...(previous.routeKey===routeKey?catalogPreviewDuringRefresh(previous,catalog,route.selection):{})}));
    if(route.selection){
     const selectedScope=overviewAssetScope(overview,{assetId:route.selection.id}),selected={assetId:route.selection.id,versionNo:route.selection.version,scope:selectedScope},pt=previewFence.current.begin(selected.assetId,selected.versionNo,catalog.identityRevision);
     try{
      const api=createAssetCatalogClient({user,scope:selectedScope});
      const preview=assertCatalogAssetDetail(await api.get('/research-assets/'+selected.assetId+'/preview?version='+selected.versionNo+'&tab='+route.previewTab),selected,{preview:true});
      assertAssetPreviewExtras(preview,route.previewTab,selectedScope);
      if(isCurrent()&&previewFence.current.current(pt)){
       if(preview.identityRevision!==overview.contexts.find(x=>x.assetId===selected.assetId)?.identityRevision)throw Object.assign(new Error('权限已变化。'),{status:409});
       setState({status:'ready',routeKey,catalog,collaborations,...panels,user,preview,previewStatus:'ready'});
      }
     }catch(e){if(isCurrent()&&previewFence.current.current(pt)){if([401,403].includes(e.status))fail(e);else setState({status:'ready',routeKey,catalog,collaborations,...panels,user,previewError:researchAssetReadMessage(e)});}}
    }
   }catch(e){fail(e);}finally{probing=false;}
  }
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);
  return()=>{disposed=true;fence.current.invalidate();previewFence.current.invalidate();pendingIdentity.current=null;clearInterval(timer);};
 },[auth,routeKey,attempt,recommendationCursor]);
 useEffect(()=>{
  const refresh=()=>{setSearch(location.search);setAttempt(n=>n+1);};
  const identity=e=>{
   if(pendingIdentity.current&&e.detail?.status!=='checking')pendingIdentity.current.latest=e.detail;
   if(researchAssetIdentityChanged(currentUser.current,e.detail)){readBoundary.fail({status:401});fence.current.invalidate();previewFence.current.invalidate();currentUser.current=null;setScopes([]);setState({status:'error',message:'账号或会话权限已变化，请重新读取资产。'});}
  };
  window.addEventListener('popstate',refresh);window.addEventListener('qiyan:auth-changed',refresh);window.addEventListener('qiyan:user-change',identity);
  return()=>{window.removeEventListener('popstate',refresh);window.removeEventListener('qiyan:auth-changed',refresh);window.removeEventListener('qiyan:user-change',identity);};
 },[]);
 useEffect(()=>{if(state.status==='ready')root.current?.scrollTo({top:route.scroll,behavior:'instant'});},[routeKey,state.status]);
 // Capture the actual content scroll just before navigation, without persisting private body text.
 function captureReturn(event){
  const link=event.target.closest('a[href*="assetCatalog=1"]');if(!link)return;
  const url=new URL(link.href),back=new URL(returnTo,location.origin);back.searchParams.set('scroll',String(Math.round(root.current?.scrollTop??0)));
  url.searchParams.set('assetReturnTo',safeCatalogReturn(back.pathname+back.search,route.scope));link.href=url.pathname+url.search;
 }
 return <><ResearchAssetCatalog rootRef={root} onClickCapture={captureReturn} state={displayState} route={route} scopes={scopes} onChange={guardedChange} onSelect={guardedChange} onEdit={t=>rowOperation(t,registration.open,'registration')} onGovernance={t=>rowOperation(t,governance.open,'governance')} onUsage={t=>rowOperation(t,usage.open,'usage')} onLifecycle={t=>rowOperation(t,lifecycle.open,'lifecycle')} onRecover={()=>lifecycle.pending()?lifecycle.recover():usage.pending()?usage.recover():governance.recover()} recovery={governance.pending()||usage.pending()||lifecycle.pending()} notice={lifecycle.notice||usage.notice||governance.notice||registration.notice} onRetry={()=>setAttempt(n=>n+1)} onNextRecommendation={()=>{if(state.recommendations?.value?.nextCursor)setRecommendationCursor({key:routeKey,cursor:state.recommendations.value.nextCursor});}} onRetryRecommendations={()=>setRecommendationCursor({key:routeKey,cursor:null})} returnTo={returnTo}/>{choosingScope&&<ResearchAssetRegistrationDialog model={{open:true,phase:'choose-study',message:choosingScope.options.length?'':'当前没有可登记资产的研究。'}} scopeChoices={choosingScope.options} selectedScope={choosingScope.selected} onScopeChange={scope=>setChoosingScope({...choosingScope,selected:scope})} onSave={()=>{if(choosingScope.selected)startCreate(choosingScope.selected);}} onClose={()=>setChoosingScope(null)} onDiscard={()=>setChoosingScope(null)}/> }{registration.dialog}{governance.dialog}{usage.dialog}{lifecycle.dialog}</>;
}
