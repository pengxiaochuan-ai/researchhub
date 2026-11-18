import {useEffect,useRef,useState} from 'react';
import {createAnalysisStart} from '../../src/analysis-start-session.js';
import {createCaptureClient} from '../../src/formal-capture-session.js';
import {getPlatformUser} from '../../src/platform-user.js';

const empty=()=>({ready:false,busy:false,error:'',phase:'',checkpoint:null,confirming:false,result:null});
export default function useAnalysisStart({branch,route,session,lock}){
 const [,refresh]=useState(0),latest=useRef(session),holder=useRef(null);latest.current=session;
 const stamp=u=>[branch,route?.studyId,u?.authenticated?u.id:'',u?.authVersion,location.href,route?.jobId??''].join(':'),user=getPlatformUser(),scope=stamp(user);
 if(holder.current?.scope!==scope){holder.current?.retire?.();holder.current={scope,actor:user.authenticated?user.id:null,authVersion:user.authVersion,data:empty(),core:null,live:false,epoch:0,attempt:'',adopted:null};lock.current=true;}
 const owner=holder.current;
 const selectedSnapshot=()=>branch==='full'&&!route?.snapshotId&&!route?.runGroupId?null:route?.snapshotId??latest.current.view?.snapshotId??latest.current.view?.snapshot?.basis?.snapshotId??latest.current.view?.source?.basis?.snapshotId??null;
 useEffect(()=>{const changed=()=>{if(holder.current?.scope!==stamp(getPlatformUser())){holder.current?.retire?.();holder.current=null;lock.current=true;refresh(n=>n+1);}};window.addEventListener('qiyan:user-change',changed);return()=>window.removeEventListener('qiyan:user-change',changed);},[branch,route?.studyId]);
 useEffect(()=>{
  const r=owner;if(!route||!r.actor||!Number.isSafeInteger(r.authVersion)||r.authVersion<0)return;
  r.live=true;const epoch=++r.epoch,client=createCaptureClient({requestTimeoutMs:30000,fetchImpl:async(path,init)=>{const response=await fetch(path,init);if(init?.method==='POST'&&response.ok&&(/\/analysis\/jobs$/.test(path)&&response.status!==202||/\/analysis\/jobs\/[^/]+\/cancellations$/.test(path)&&response.status!==200))throw Object.assign(Error('操作响应尚不能核定，请按原请求核对。'),{unknown:true});return response;}});
  const isCurrent=()=>holder.current===r&&r.live&&r.epoch===epoch&&stamp(getPlatformUser())===r.scope;
  const core=createAnalysisStart({transport:'jobs',branch,studyId:route.studyId,storage:sessionStorage,request:async(...args)=>{const value=await client.request(...args);if(args[0]==='/auth/me'&&(value.accountId!==r.actor||value.authVersion!==r.authVersion))throw Error('登录身份已变化，请重新核对。');return value;},current:()=>{const u=getPlatformUser();return{live:isCurrent(),url:location.href,actor:u.authenticated?u.id:null,authVersion:u.authVersion,jobId:route.jobId??null,snapshotId:selectedSnapshot(),plan:latest.current.view?.plan,preview:latest.current.view?.preview};},onChange:value=>{
   if(!isCurrent()||value.checkpoint&&(value.checkpoint.actor!==r.actor||value.checkpoint.authVersion!==r.authVersion||value.checkpoint.studyId!==route.studyId))return;
   lock.current=value.transport==='jobs'?!value.restored||value.busy||value.dirty||value.confirming:!value.restored||value.busy||value.confirming||!!value.checkpoint&&(value.requiresProof||value.checkpoint.stage!=='completed');
   if(value.transport!=='jobs'&&!value.busy&&!value.requiresProof&&value.checkpoint?.stage==='completed'&&value.result&&r.adopted!==value.result.id){r.adopted=value.result.id;if(branch==='full'&&latest.current.view?.plan?.planId===value.checkpoint.planId){const target=core.followResult();if(target&&isCurrent())latest.current.acceptStarted(value.result);value=core.state();}}
   r.data={...value,ready:value.restored};refresh(n=>n+1);
  }});
  r.core=core;r.retire=()=>{r.live=false;r.epoch++;client.invalidate();core.dispose();r.data=empty();};
  void core.restore();const timer=setInterval(()=>{core.expireReason();const s=core.state();if(s.transport==='jobs'&&s.job&&['queued','running','recovering','cancelling'].includes(s.job.status)&&!s.dirty&&!s.confirming&&!s.busy&&!s.reading)void core.poll();},5000);
  return()=>{clearInterval(timer);r.retire();};
 },[scope]);
 const p=session.view?.plan,v=session.view?.preview,state=owner.data;
 useEffect(()=>{const k=p?.planId+':'+p?.contentHash+':'+p?.review?.reviewId;if(!route||route.runId||typeof session.preview!=='function'||route.snapshotId||route.runGroupId||route.jobId||state.checkpoint||state.confirming||session.pending||!session.verified||session.busy||session.view?.group||session.view?.sourceError||p?.review?.decision!=='approved'||v||owner.attempt===k||!state.ready)return;owner.attempt=k;void session.preview();},[scope,p?.planId,p?.contentHash,p?.review?.reviewId,session.verified,session.busy,state.ready,state.checkpoint,state.confirming,v,session.pending,session.view?.sourceError]);
 return {...state,scope,isCurrentScope:()=>holder.current===owner&&owner.live&&owner.scope===scope,core:owner.core,isLocked:()=>lock.current,active:state.transport==='jobs'?!!state.dirty||state.confirming:!!state.checkpoint||state.confirming,dirty:state.transport==='jobs'?!!state.dirty:!!state.checkpoint&&(state.requiresProof||state.checkpoint.stage!=='completed'),selectedJobId:route?.jobId??null,snapshotId:selectedSnapshot(),planId:state.checkpoint?.planId??p?.planId,returnURL:owner.core?.returnURL?.()??null};
}
