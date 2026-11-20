import {useEffect,useRef,useState} from 'react';
import {getPlatformUser} from '../../src/platform-user.js';
import {readResearchProjectRoute,createResearchProjectsClient} from '../../src/research-projects-session.js';

// Each identity change invalidates every response from the preceding session.
export function useResearchProjectAccess(onReset,{probePath,onProbeError,shouldRevalidate}={}){
 const reset=useRef(onReset);reset.current=onReset;
 const probe=useRef(probePath);probe.current=probePath;
 const probeError=useRef(onProbeError);probeError.current=onProbeError;
 const canRevalidate=useRef(shouldRevalidate);canRevalidate.current=shouldRevalidate;
 const [revision,setRevision]=useState(0),[accessError,setAccessError]=useState('');
 const identity=useRef(getPlatformUser());
 const client=useRef(null);
 if(!client.current)client.current=createResearchProjectsClient({onAccessLost:error=>{reset.current();setAccessError(error.message);if(error.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}});
 useEffect(()=>{
  function changed(event){const next=event.detail??getPlatformUser(),previous=identity.current;identity.current=next;
   if(next.id!==previous.id||next.authenticated!==previous.authenticated){client.current.invalidate();reset.current();setAccessError(next.authenticated?'':'请登录后继续。');setRevision(value=>value+1);}
  }
  function revalidate(){if(document.visibilityState==='visible'&&canRevalidate.current?.()!==false)setRevision(value=>value+1);}
  let stopped=false,timer;
  async function poll(){try{const page=location.pathname.match(/\/pages\/([^/]+)/)?.[1],route=readResearchProjectRoute(page,location.search),path=probe.current??(route?(route.kind==='study'?'/research-studies/'+route.id:route.kind==='creation'&&route.id?'/research-projects/'+route.id:'/research-projects/context'):null);if(path&&document.visibilityState==='visible'){await client.current.request(path);if(!stopped&&canRevalidate.current?.()!==false)setRevision(value=>value+1);}}catch(error){if(!stopped)probeError.current?.(error);}finally{if(!stopped)timer=setTimeout(poll,3000);}}
  timer=setTimeout(poll,3000);
  window.addEventListener('qiyan:user-change',changed);window.addEventListener('focus',revalidate);document.addEventListener('visibilitychange',revalidate);
  // Reconcile a completed identity read that arrived before this effect subscribed.
  changed({detail:getPlatformUser()});
  return()=>{stopped=true;clearTimeout(timer);client.current.invalidate();window.removeEventListener('qiyan:user-change',changed);window.removeEventListener('focus',revalidate);document.removeEventListener('visibilitychange',revalidate);};
 },[]);
 return{client:client.current,revision,accessError,authenticated:identity.current.authenticated===true,retry:()=>{setAccessError('');setRevision(value=>value+1);}};
}
