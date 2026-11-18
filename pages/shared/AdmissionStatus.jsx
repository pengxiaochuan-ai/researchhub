import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {getPlatformUser} from '../../src/platform-user.js';
import {ADMISSION_PAGE,createAdmissionClient} from '../../src/admission-session.js';
import {safeAuthenticatedReturnTo} from '../../src/route-context.js';
import './account-access.css';

const labels={pending:'加入申请待审核',needs_information:'请补充指定资料',approved:'已通过加入审核',rejected:'本次申请未通过',unregistered:'账号准入记录待核对'};
function targetFor(user){try{const saved=JSON.parse(sessionStorage.getItem('rh-admission-return')??'null');if(saved?.actor===user.id&&saved.authVersion===user.authVersion){const target=safeAuthenticatedReturnTo(saved.target);return target===ADMISSION_PAGE?'/pages/p01/':target;}}catch{}return '/pages/p01/';}
export default function AdmissionBoundary({children,profile=false}){
 const api=useMemo(()=>createAdmissionClient(),[]),[user,setUser]=useState(getPlatformUser),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[epoch,setEpoch]=useState(0),[paused,setPaused]=useState(false);
 const identity=useRef(''),generation=useRef(0),seenPending=useRef(false),restoredActor=useRef('');
 const key=user.authenticated?user.id+':'+user.authVersion:'';
 const state=snapshot?.actor===key?snapshot.data:null;
 let restoring=false;try{restoring=JSON.parse(sessionStorage.getItem('rh-admission-pending')??'null')?.actor===key;}catch{}
 if(restoring)restoredActor.current=key;
 useEffect(()=>{const changed=()=>setUser(getPlatformUser());window.addEventListener('qiyan:user-change',changed);window.addEventListener('qiyan:auth-changed',changed);return()=>{window.removeEventListener('qiyan:user-change',changed);window.removeEventListener('qiyan:auth-changed',changed);};},[]);
 useEffect(()=>{
  if(identity.current!==key){identity.current=key;seenPending.current=false;setSnapshot(null);setError('');}
  if(!key)return;const n=++generation.current,start=Date.now();let controller=new AbortController(),timer,busy=false,stopped=false,failures=0,readEpoch=0,approved=false;
  setPaused(false);
  const check=async()=>{
   if(stopped||busy||approved||document.visibilityState!=='visible')return;
   if(Date.now()-start>=120000){setPaused(true);return;}
   busy=true;const attempt=++readEpoch;
   try{const next=await api.self({signal:controller.signal});if(next.accountId!==user.id)throw Error('登录身份已变化，请重新核对。');if(!stopped&&n===generation.current&&attempt===readEpoch&&document.visibilityState==='visible'&&identity.current===key){if(next.status!=='approved')seenPending.current=true;approved=next.status==='approved';setSnapshot({actor:key,data:next,stale:false});setError('');failures=0;}}
   catch(e){if(!stopped&&n===generation.current&&attempt===readEpoch&&document.visibilityState==='visible'){setError(e.message);failures++;setSnapshot(old=>old?.actor===key?{...old,stale:true}:null);if(e.status===401||e.status===403){setSnapshot(null);if(e.status===401)setUser({...user,authenticated:false,status:'anonymous'});}}}
   finally{busy=false;if(!stopped&&!approved&&attempt===readEpoch)timer=setTimeout(check,Math.min(30000,5000*2**failures));}
  };
  const visible=()=>{clearTimeout(timer);if(document.visibilityState!=='visible'){readEpoch++;controller.abort();busy=false;}else{controller=new AbortController();void check();}};
  document.addEventListener('visibilitychange',visible);void check();
  return()=>{stopped=true;generation.current++;controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[key,epoch]);
 const refresh=()=>setEpoch(v=>v+1);
 if(!import.meta.env.VITE_AUTH_TENANT_SLUG)return children;
 if(key&&state?.status==='approved'&&!snapshot.stale&&!seenPending.current&&restoredActor.current!==key&&(!profile||new URLSearchParams(location.search).get('section')!=='admission'))return children;
 const content=!key?<section className="ls-profile-card wp02-access"><h1>加入灵枢心域</h1><p>{user.status==='checking'?'正在核对登录状态…':'请登录后查看本人的审核结果。'}</p>{user.status!=='checking'&&<a className="ls-primary" href={'/pages/p003/?'+new URLSearchParams({returnTo:ADMISSION_PAGE})}>前往登录</a>}</section>:<AdmissionSelf key={key} api={api} user={user} state={state} unverified={snapshot?.stale} error={error} paused={paused} refresh={refresh}/>;
 return profile?content:<main className="platform-main">{content}</main>;
}
function AdmissionSelf({api,user,state,unverified,error,paused,refresh}){
 const[text,setText]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(null),[retryAllowed,setRetryAllowed]=useState(false);
 const alive=useRef(true),flight=useRef(false),started=useRef(null),actor=user.id+':'+user.authVersion;
 useEffect(()=>{alive.current=true;try{const saved=JSON.parse(sessionStorage.getItem('rh-admission-pending')??'null');if(saved?.actor===actor){setUnknown(saved.operation);if(saved.operation.body?.text)setText(saved.operation.body.text);}else sessionStorage.removeItem('rh-admission-pending');}catch{}return()=>{alive.current=false;};},[actor]);
 useEffect(()=>{if(!text&&!unknown)return;const stop=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[text,unknown]);
 function enter(){if(text||unknown||busy||unverified||document.visibilityState!=='visible')return;const target=targetFor(user);try{sessionStorage.removeItem('rh-admission-return');}catch{}location.assign(target);}
 useEffect(()=>{if(state?.status==='approved'&&!unverified&&!text&&!unknown&&!busy&&document.visibilityState==='visible'&&(new URLSearchParams(location.search).get('section')==='admission'||location.pathname==='/pages/p01/')){const timer=setTimeout(enter,150);return()=>clearTimeout(timer);}},[state?.status,unverified,text,unknown,busy]);
 async function recover(op=unknown){
  if(!op||flight.current)return;flight.current=true;setBusy(true);
  try{const result=await api.operation(op);if(!alive.current)return;if(result.state==='unsubmitted'){setRetryAllowed(true);setNotice('已核定原操作尚未提交，可明确重试原输入。');return;}if(result.state==='superseded'){setUnknown(null);setRetryAllowed(false);sessionStorage.removeItem('rh-admission-pending');setNotice('原操作未提交，申请已变化，请核对最新结果。');refresh();return;}if(result.state!=='committed')throw Error('原提交结果尚未确认，请继续核对。');if(alive.current){setUnknown(null);setRetryAllowed(false);sessionStorage.removeItem('rh-admission-pending');setText('');setNotice('已核对原提交结果。');refresh();}}
  catch(e){if(alive.current)setNotice(e.message);}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function submit(e){
  e.preventDefault();if(flight.current||unknown||unverified||!state||!text.trim())return;
  flight.current=true;setBusy(true);setNotice('');const body={requestKey:crypto.randomUUID(),action:state.canSupplement?'supplement':'resubmit',baseRevision:state.revision,text:text.trim()},operation={id:state.id,body};started.current=operation;
  try{sessionStorage.setItem('rh-admission-pending',JSON.stringify({actor,operation}));await api.submit(body);if(alive.current){sessionStorage.removeItem('rh-admission-pending');setText('');setNotice('资料已提交，请等待审核。');refresh();}}
  catch(e){if(alive.current){setNotice(e.message);if(e.unknown){setUnknown(operation);setRetryAllowed(false);}else sessionStorage.removeItem('rh-admission-pending');}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(unknown)void recover(unknown);},[unknown?.body?.requestKey]);
 const material=state?.material?.registration;
 return <section className="ls-profile-card wp02-access" aria-busy={busy}><h1>{state?labels[state.status]:'正在核对加入审核'}</h1>
  {material&&<><p>{material.displayName}</p><p>验证邮箱：{material.email??'原账号未绑定验证邮箱'}</p></>}
  {state?.status==='pending'&&<p>申请已提交，无需再次注册。可稍后登录查看结果。</p>}
  {state?.reason&&<p>{state.reason}</p>}
  {state?.material?.supplement&&<details><summary>已提交的补充</summary><p>{state.material.supplement}</p></details>}
  {(state?.canSupplement||state?.canResubmit)&&<form onSubmit={submit}><label htmlFor="admission-supplement">{state.canSupplement?'补充指定缺项':'重新申请说明'}<textarea id="admission-supplement" maxLength={500} rows={4} value={text} disabled={busy||!!unknown||unverified} onChange={e=>setText(e.target.value)}/></label><Button type="submit" className="ls-primary" disabled={!text.trim()||!!unknown||unverified} loading={busy}>{state.canSupplement?'提交补充':'重新申请'}</Button></form>}
  {state?.status==='approved'&&<>{text||unknown?<p>审核已通过。请先核对尚未确认的提交或处理未保存内容，再继续。</p>:null}<Button className="ls-primary" disabled={busy||!!unknown||!!text||unverified} onClick={enter}>进入我的工作台</Button>{text&&!unknown&&<Button onClick={()=>setText('')}>放弃未提交补充</Button>}</>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{unknown&&<><Button disabled={busy} onClick={()=>recover()}>核对原提交结果</Button>{retryAllowed&&<Button disabled={busy} onClick={async()=>{if(flight.current)return;flight.current=true;setBusy(true);try{await api.submit(unknown.body);if(alive.current){sessionStorage.removeItem('rh-admission-pending');setUnknown(null);setRetryAllowed(false);setText('');refresh();}}catch(e){if(alive.current){setRetryAllowed(false);setNotice(e.message);}}finally{flight.current=false;if(alive.current)setBusy(false);}}}>重试原提交</Button>}</>}
  {(error||paused)&&<><p>{paused?'自动核对已暂停，可重新核对结果。':''}</p><Button disabled={busy} onClick={refresh}>重新核对</Button></>}
 </section>;
}
