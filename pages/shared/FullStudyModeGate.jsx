import React,{useEffect,useRef,useState} from 'react';
import {createCaptureClient} from '../../src/formal-capture-session.js';
import {getPlatformUser} from '../../src/platform-user.js';
import {FULL_STUDY_SCHEMA} from '../../src/full-study-ui-session.js';
import {Button} from './Components.jsx';
export default function FullStudyModeGate({route,legacy:Legacy,full:Full,invalid}){
 const [state,setState]=useState(null),[retry,setRetry]=useState(0),seq=useRef(0),seen=useRef(null);
 useEffect(()=>{if(!route)return;seen.current=null;const client=createCaptureClient();const read=async()=>{const token=++seq.current;setState(null);const user=getPlatformUser();if(!user.authenticated){setState({error:'请核对当前登录状态。'});return;}try{const c=await client.request('/research-studies/'+route.studyId+'/analysis/configuration');if(token!==seq.current)return;if(c.studyId!==route.studyId||!['t15-synthetic-plan-v1',FULL_STUDY_SCHEMA].includes(c.schemaVersion))throw Error('当前研究分析配置无法核对。');setState({configuration:c});}catch(e){if(token===seq.current)setState({error:e.message});}};const changed=()=>{const u=getPlatformUser(),signature=JSON.stringify([u.id,u.authenticated,u.authVersion]);if(signature===seen.current)return;seen.current=signature;void read();};window.addEventListener('qiyan:user-change',changed);changed();return()=>{seq.current++;client.invalidate();window.removeEventListener('qiyan:user-change',changed);};},[route?.studyId,retry]);
 if(!route)return <Legacy/>;
 if(!state?.configuration)return <main className="platform-main execution-preparation"><div className="wf-content"><p role={state?.error?'alert':'status'}>{state?.error||invalid||'正在核对研究分析范围…'}</p>{state?.error&&<Button onClick={()=>setRetry(x=>x+1)}>重新核对</Button>}</div></main>;
 return state.configuration.schemaVersion===FULL_STUDY_SCHEMA?<Full route={route} configuration={state.configuration}/>:<Legacy/>;
}
