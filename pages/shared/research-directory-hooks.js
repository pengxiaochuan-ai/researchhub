import {useEffect,useRef,useState} from 'react';
import {readResearchDirectoryRange} from '../../src/research-directory-session.js';
import {useResearchProjectAccess} from './research-project-hooks.js';

const empty=(kind,message='')=>({kind,items:[],total:null,nextCursor:null,capabilities:{canCreateProject:false},message,refreshing:false,loadingMore:false});
export function useResearchDirectory({limit=20,query='',onIdentityReset=()=>{}}={}){
 const [state,setState]=useState(()=>empty('loading'));
 const inFlight=useRef(false);
 const sequence=useRef(0),desired=useRef(limit),previousQuery=useRef(null),morePending=useRef(false),identityReset=useRef(onIdentityReset);identityReset.current=onIdentityReset;
 const access=useResearchProjectAccess(()=>{inFlight.current=false;sequence.current++;desired.current=limit;morePending.current=false;setState(empty('restricted'));identityReset.current();},{probePath:'/research-directory?limit=1',shouldRevalidate:()=>!inFlight.current,onProbeError:error=>{if(error.code==='RESEARCH_STALE'||[401,403,404].includes(error.status))return;inFlight.current=false;sequence.current++;morePending.current=false;setState(empty('error',error.message));}});
 const normalized=query.trim();
 useEffect(()=>{
  const changed=previousQuery.current!==normalized;previousQuery.current=normalized;if(changed){desired.current=limit;morePending.current=false;}
  const token=++sequence.current,controller=new AbortController();inFlight.current=true;
  setState(current=>!changed&&current.kind==='ready'?{...current,refreshing:true,loadingMore:morePending.current,message:''}:empty('loading'));
  const timer=setTimeout(async()=>{
   try{const data=await readResearchDirectoryRange(access.client.request,{count:desired.current,query:normalized,signal:controller.signal});if(token!==sequence.current||controller.signal.aborted)return;desired.current=Math.max(limit,data.items.length);setState({kind:'ready',...data,message:'',refreshing:false,loadingMore:false});}
   catch(error){if(token!==sequence.current||controller.signal.aborted||error.code==='RESEARCH_STALE')return;setState(empty('error',error.message));}
   finally{if(token===sequence.current){inFlight.current=false;morePending.current=false;}}
  },changed&&normalized?200:0);
  return()=>{clearTimeout(timer);controller.abort();inFlight.current=false;};
 },[normalized,limit,access.revision]);
 function more(){if(morePending.current||state.kind!=='ready'||!state.nextCursor||state.refreshing)return;morePending.current=true;desired.current=state.items.length+limit;setState(current=>({...current,loadingMore:true}));access.retry();}
 return{...state,message:access.accessError||state.message,more,retry:access.retry};
}
