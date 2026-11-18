import React,{useEffect,useState} from 'react';
import {createCaptureClient} from '../../src/formal-capture-session.js';
import './study-simulation-notice.css';
export function StudySimulationLabel({simulation}){return simulation?.enabled===true?<p className="study-simulation-notice" role="status">合成数据模拟 · {simulation.ready===true&&/^V[1-4]$/.test(simulation.stage)?'当前访视 '+simulation.stage:'当前访视待核对'}</p>:null;}
export default function StudySimulationNotice({studyId,verified=false,actor}){
 const [simulation,setSimulation]=useState(null);
 useEffect(()=>{setSimulation(null);if(!verified||!studyId||!actor)return;let live=true;const client=createCaptureClient({onAccessLost:error=>{if(error.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}});
 const read=async()=>{try{const value=await client.request('/research-studies/'+studyId+'/simulation/context');if(live&&value.studyId===studyId)setSimulation(value.simulation);}catch{if(live)setSimulation(previous=>previous?.enabled?{enabled:true,ready:false}:null);}};void read();const focus=()=>{if(document.visibilityState==='visible')void read();};window.addEventListener('focus',focus);return()=>{live=false;client.invalidate();window.removeEventListener('focus',focus);};
 },[studyId,verified,actor]);
 return <StudySimulationLabel simulation={simulation}/>;
}
