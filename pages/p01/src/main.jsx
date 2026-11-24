import AdmissionBoundary from '../../shared/AdmissionStatus.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Home,BookOpen,Box,BrainCircuit,Landmark,ChevronRight,Folder,ClipboardCheck,Sparkles,Clock,FileText,Users,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {getPlatformUser} from '../../../src/platform-user.js';
import {fetchMyResearchOverview} from '../../../src/my-research-api.js';
import {makeDesignWorkspaceUrl} from '../../../src/research-design-session.js';
import {makeStudyOverviewUrl} from '../../../src/study-overview-route.js';
import './style.css';
import PersonalOverview,{PersonalOverviewSkeleton} from '../../shared/PersonalOverview.jsx';
import {useDirectoryIdentity} from '../../shared/DirectoryState.jsx';
import {createResearchProjectsClient} from '../../../src/research-projects-session.js';
import {readProtocolReviewRange} from '../../../src/protocol-review-queue.js';
import {useResearchDirectory} from '../../shared/research-directory-hooks.js';

function Nav(){return <aside><nav aria-label="主要导航"><button type="button" className="active"><Home/>我的工作台</button><button type="button"><BookOpen/>领域研究</button><button type="button"><BrainCircuit/>岐研 AI</button><button type="button"><Box/>科研资产</button><button type="button"><Landmark/>管理与治理</button></nav><div className="aihelp"><Sparkles/><div><b>岐研 AI 助手</b><small>在已授权的研究与资料中工作</small></div><ChevronRight/></div><div className="collapse">‹　收起菜单</div></aside>}
function usePendingDecisions(){
 const {user,identityKey,checking,unavailable}=useDirectoryIdentity();
 const [range,setRange]=useState(5),[revision,refresh]=useState(0),[state,setState]=useState(null);
 const request=useRef(null);
 const ready=user.authenticated&&!checking&&!unavailable;
 useEffect(()=>{setRange(5);},[identityKey]);
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  request.current=controller;
  const client=createResearchProjectsClient();
  setState({kind:'loading',identityKey});
  readProtocolReviewRange(client.request,'pending',range,{signal:controller.signal}).then(result=>{
   if(!controller.signal.aborted)setState({kind:'ready',identityKey,...result});
  }).catch(error=>{
   if(controller.signal.aborted)return;
   setState({kind:'error',identityKey});
   if(error.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));
  }).finally(()=>{if(request.current===controller)request.current=null;});
  return()=>{controller.abort();client.invalidate();if(request.current===controller)request.current=null;};
 },[ready,identityKey,range,revision]);
 useEffect(()=>{
  const revalidate=()=>{if(document.visibilityState==='visible'&&!request.current)refresh(x=>x+1);};
  window.addEventListener('focus',revalidate);
  window.addEventListener('pageshow',revalidate);
  document.addEventListener('visibilitychange',revalidate);
  return()=>{window.removeEventListener('focus',revalidate);window.removeEventListener('pageshow',revalidate);document.removeEventListener('visibilitychange',revalidate);};
 },[]);
 return {...(ready&&state?.identityKey===identityKey?state:{kind:'loading'}),
  retry:()=>refresh(x=>x+1),more:()=>setRange(x=>x+5)};
}

function App(){
 const [state,setState]=useState({kind:'checking'}),[retry,setRetry]=useState(0);
 const decisions=usePendingDecisions();
 const projectDirectory=useResearchDirectory({limit:5,refreshOnPoll:true});
 useEffect(()=>{let controller=new AbortController(),sequence=0;const refresh=()=>{controller.abort();controller=new AbortController();const current=++sequence,user=getPlatformUser();if(!user.authenticated){setState({kind:user.status==='unavailable'?'error':user.status==='checking'?'checking':'signed-out'});return;}setState({kind:'loading'});fetchMyResearchOverview({signal:controller.signal}).then(data=>{if(current===sequence)setState({kind:'ready',data});}).catch(error=>{if(current!==sequence||error.name==='AbortError')return;setState({kind:error.code==='MY_RESEARCH_UNAUTHENTICATED'?'signed-out':'error',message:error.message});});};const onVisible=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('qiyan:user-change',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',onVisible);refresh();return()=>{sequence++;controller.abort();window.removeEventListener('qiyan:user-change',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisible);};},[retry]);
 return <><Nav/><main className="platform-main">{state.kind==='ready'?<PersonalOverview data={state.data} decisions={decisions} projectDirectory={projectDirectory} onRetryProjectDirectory={projectDirectory.retry} onAccessLost={error=>setState({kind:error.status===401?'signed-out':'error',message:error.message})}/>:<PersonalOverviewSkeleton notice={<div className="page-state personal-auth-state" role="status" aria-live="polite"><div className="state-icon">{state.kind==='error'?<RefreshCw/>:<Users/>}</div><h2>{state.kind==='signed-out'?'登录后查看我的工作台':state.kind==='error'?'首页数据暂时不可用':'正在核验我的工作台数据'}</h2><p>{state.kind==='signed-out'?"登录后查看本人的研究与待办。":state.kind==='error'?state.message??"请稍后重试。":'正在核对当前账号与研究权限。'}</p>{state.kind==='signed-out'?<a className="primary-link" href="/pages/p003/?returnTo=%2Fpages%2Fp01%2F">前往登录</a>:state.kind==='error'?<button type="button" onClick={()=>setRetry(x=>x+1)}>重新读取</button>:null}</div>}/>}</main></>;
}
createRoot(document.getElementById('root')).render(<AdmissionBoundary><App/></AdmissionBoundary>);
