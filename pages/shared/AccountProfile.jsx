import AdmissionBoundary from './AdmissionStatus.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';import {createAccountAccessClient} from '../../src/account-session.js';
import './account-access.css';
import ResearchIdentityProfile from './ResearchIdentityProfile.jsx';
import {getPlatformUser} from '../../src/platform-user.js';
export default function AccountProfile(){return <AdmissionBoundary profile><AccountProfileContent/></AdmissionBoundary>;}
function AccountProfileContent(){
 const [user,setUser]=useState(getPlatformUser),[checking,setChecking]=useState(getPlatformUser().status==='checking');
 useEffect(()=>{const changed=e=>{const next=e.detail;setChecking(next.status==='checking');if(next.status!=='checking')setUser(next);};window.addEventListener('qiyan:user-change',changed);return()=>window.removeEventListener('qiyan:user-change',changed);},[]);
 if(!user.authenticated||!user.id)return <section className="ls-profile-card wp02-access"><h1>我的账号资料</h1><p>{checking?'正在核对身份…':'请先登录，个人科研资料仅本人可见。'}</p><a href="/pages/p003/?returnTo=%2Fpages%2Fp006%2F%3Fsection%3Dresearch-identity">登录并完善科研资料</a></section>;
 return <>{checking&&<p role="status">正在重新核对服务端身份…</p>}<div hidden={checking}><OwnAccountProfile key={user.id}/></div></>;
}
function OwnAccountProfile(){
 const client=useMemo(()=>createAccountAccessClient({enabled:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG)}),[]),[profile,setProfile]=useState(null),[name,setName]=useState(''),[notice,setNotice]=useState(null),[busy,setBusy]=useState(false),alive=useRef(true),pending=useRef(false),errorRef=useRef(null),inputRef=useRef(null),key=useRef(crypto.randomUUID()),sequence=useRef(0);
 async function load(){if(pending.current)return;const seq=++sequence.current;pending.current=true;setBusy(true);try{const p=await client.readProfile();if(alive.current&&seq===sequence.current){setProfile(p);setName(p.displayName);setNotice(null);}}catch(e){if(alive.current){setNotice({error:true,text:e.message});if(e.status===401||e.status===403)setProfile(null);}}finally{pending.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{if(!profile||name===profile.displayName)return;const stop=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[name,profile]);
 useEffect(()=>{if(notice?.error)errorRef.current?.focus();},[notice]);
 async function submit(e){e.preventDefault();if(pending.current||!profile)return;if(!name.trim()||[...name.trim()].length>40){setNotice({error:true,text:'展示名称须为1–40字符。'});inputRef.current?.focus();return;}pending.current=true;setBusy(true);
  try{const result=await client.updateProfile({displayName:name,baseVersion:profile.baseVersion,requestKey:key.current});if(alive.current){setProfile(result);setName(result.displayName);key.current=crypto.randomUUID();setNotice({text:'个人展示名称已保存；不改变角色或研究权限。'});window.dispatchEvent(new Event('qiyan:auth-refresh'));}}
  catch(e){if(alive.current){setNotice({error:true,text:e.message});if(e.status===401||e.status===403)setProfile(null);}}finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="ls-profile-card wp02-access" aria-busy={busy}><h1>我的账号资料</h1><p>仅修改本人展示名称。邮箱验证不是L2/L3资质认证，也不授予Study或管理员权限。</p>
  {profile?<form noValidate onSubmit={submit}><label htmlFor="wp02-profile-name">展示名称<input id="wp02-profile-name" ref={inputRef} value={name} onChange={e=>setName(e.target.value)} maxLength={40} autoComplete="name" disabled={busy}/></label><p>验证邮箱：{profile.email??'尚未绑定验证邮箱（旧账号）'}</p><Button type="submit" className="ls-primary" loading={busy}>保存展示名称</Button></form>:<p>{busy?'正在核对本人资料…':'尚无可显示的已核验账号资料。'}</p>}
  {notice&&<p tabIndex={-1} ref={errorRef} className={notice.error?'wp02-error':''} role={notice.error?'alert':'status'}>{notice.text}</p>}
  <div className="ls-auth-links"><Button className="ls-secondary" disabled={busy} onClick={()=>{if(!profile||name===profile.displayName||window.confirm('放弃未保存的展示名称并重新加载？'))load();}}>重新加载本人资料</Button><a href="/pages/p003/">返回登录与研究授权</a></div>
  <ResearchIdentityProfile/>
 </section>;
}
