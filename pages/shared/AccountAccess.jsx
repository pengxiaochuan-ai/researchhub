import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {createAccountAccessClient,takeActionToken,validateAccountForm} from '../../src/account-session.js';
import {createAuthClient} from '../../src/auth-session.js';
import {createAdmissionClient} from '../../src/admission-session.js';
import {registrationEntryTarget,uncertainRegistration} from '../../src/registration-admission.js';
import './account-access.css';

export default function AccountAccess({page}){
 const verificationLink=()=>/^#verify=[A-Za-z0-9_-]{43}$/.test(location.hash);
 const [ready,setReady]=useState(()=>page!=='p004'||verificationLink()||!import.meta.env.VITE_AUTH_TENANT_SLUG),[failure,setFailure]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(ready)return;let cancelled=false;
  const receive=()=>{if(verificationLink()){cancelled=true;setReady(true);}};window.addEventListener('hashchange',receive);
  void(async()=>{try{const user=await createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG}).me();if(cancelled)return;
   if(!user||verificationLink()){setReady(true);return;}
   const state=await createAdmissionClient().self();if(cancelled)return;
   const target=registrationEntryTarget(user,state,{verificationLink:verificationLink()});if(target)location.replace(target);else setReady(true);
  }catch(e){if(!cancelled)setFailure(e.message);}})();
  return()=>{cancelled=true;window.removeEventListener('hashchange',receive);};
 },[ready,attempt]);
 if(!ready)return <div className="wp02-access"><h2>加入灵枢心域</h2><p role={failure?'alert':'status'}>{failure||'正在核对当前账号…'}</p>{failure&&<Button onClick={()=>{setFailure('');setAttempt(n=>n+1);}}>重新核对</Button>}</div>;
 return <AccountAccessForm page={page}/>;
}
function AccountAccessForm({page}){
 const register=page==='p004',purpose=register?'verify':'reset';
 const client=useMemo(()=>createAccountAccessClient({enabled:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG)}),[]);
 const [token,setToken]=useState(()=>takeActionToken(purpose)),[values,setValues]=useState({email:'',displayName:'',password:''}),[errors,setErrors]=useState({}),[notice,setNotice]=useState(null),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[until,setUntil]=useState(0),[seconds,setSeconds]=useState(0);
 const [unknown,setUnknown]=useState(false);
 const pending=useRef(false),alive=useRef(true),generation=useRef(0),refs=useRef({}),summary=useRef(null),key=useRef(crypto.randomUUID());
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 useEffect(()=>{const receive=()=>{const next=takeActionToken(purpose),wasPending=pending.current;generation.current++;pending.current=false;setBusy(false);setToken(next);setDone(false);setErrors({});setNotice(wasPending?{text:'已切换验证链接。原操作可能仍在处理中，请先核对账号或邮件中的处理结果。'}:null);setValues(v=>({...v,password:'',displayName:''}));setUntil(0);setSeconds(0);key.current=crypto.randomUUID();};window.addEventListener('hashchange',receive);return()=>window.removeEventListener('hashchange',receive);},[purpose]);
 useEffect(()=>{if(!until)return;const tick=()=>setSeconds(Math.max(0,Math.ceil((until-Date.now())/1000)));tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[until]);
 const stage=token?purpose:'request';
 function change(name,value){setValues(v=>({...v,[name]:value}));setErrors(e=>{const n={...e};delete n[name];return n;});}
 async function submit(event){event.preventDefault();if(pending.current||done||unknown)return;
  const fieldErrors=validateAccountForm(values,stage,{registration:register});setErrors(fieldErrors);
  if(Object.keys(fieldErrors).length){setNotice({error:true,text:'请核对下列字段。'});requestAnimationFrame(()=>refs.current[Object.keys(fieldErrors)[0]]?.focus());return;}
  const current=generation.current;pending.current=true;setBusy(true);setNotice(null);
  try{
   if(!token){await client[register?'requestRegistration':'requestReset']({email:values.email,requestKey:key.current});if(!alive.current||generation.current!==current)return;setUntil(Date.now()+60000);setSeconds(60);key.current=crypto.randomUUID();setNotice({text:register?'请求已受理。如邮箱符合条件，请查收验证邮件。':'请求已受理。如邮箱符合条件，请在体验收件箱查收邮件。'});}
   else{await client[register?'confirmRegistration':'confirmReset']({token,password:values.password,requestKey:key.current,...(register?{displayName:values.displayName}:{})});if(!alive.current||generation.current!==current)return;setDone(true);setToken('');setNotice({text:register?'邮箱已验证，账号已创建；加入申请待审核，请登录查看结果。':'密码已重置，原登录状态已失效，请使用新密码登录。'});}
  }catch(e){if(alive.current&&generation.current===current){const uncertain=register&&!!token&&uncertainRegistration(e);if(uncertain)setUnknown(true);setNotice({error:true,text:uncertain?'账号创建结果尚未确认。请使用刚设置的密码登录并查看加入状态，暂不重复创建。':e.message});requestAnimationFrame(()=>generation.current===current&&summary.current?.focus());}}
  finally{if(alive.current&&generation.current===current){pending.current=false;setBusy(false);setValues(v=>({...v,password:''}));}}
 }
 function field(name,label,type='text',extra={}){return <div><label htmlFor={'wp02-'+name}>{label}<input {...extra} id={'wp02-'+name} name={name} type={type} value={values[name]} onChange={e=>change(name,e.target.value)} ref={node=>{refs.current[name]=node;}} disabled={busy} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name]?'wp02-error-'+name:undefined}/></label>{errors[name]&&<p className="wp02-field-error" id={'wp02-error-'+name}>{errors[name]}</p>}</div>;}
 return <div className="wp02-access" aria-busy={busy}>
  <h2>{register?(token?'验证邮箱并创建账号':'加入灵枢心域'):(token?'设置新密码':'找回密码')}</h2>
  <p>{register?'完成邮箱验证后提交加入审核，通过后使用平台；私有课题另按授权访问。':'仅已验证邮箱的账号可自助找回；旧账号未绑定验证邮箱时请联系管理员。'}</p>
  {!register&&<div className="ls-mode-note">体验模式 · 邮件仅在体验收件箱查看，不向外发送；不代表专业资质认证</div>}
  {!client.configured&&<p role="alert">账号注册与密码找回暂不可用，请联系管理员。</p>}
  {!done&&!unknown&&<form noValidate onSubmit={submit}>
   {!token?field('email','邮箱','email',{autoComplete:'email',placeholder:register?'name@example.com':'name@example.test'}):<>
    {register&&field('displayName','展示名称','text',{autoComplete:'name',maxLength:40})}
    {field('password',register?'设置密码':'新密码','password',{autoComplete:'new-password',maxLength:64})}
    <p className="wp02-help">密码12–64字符，UTF-8最多72字节。可以粘贴或使用密码管理器。</p>
   </>}
   <Button className="ls-primary" type="submit" loading={busy} disabled={!client.configured||(!token&&seconds>0)}>{token?(register?'确认创建账号':'确认重置密码'):(seconds?'稍后重新发送':register?'发送验证邮件':'发送找回邮件')}</Button>
   {seconds>0&&<p className="wp02-help">重发还需 {seconds} 秒；请先查收邮件，不会自动重发。</p>}
  </form>}
  {notice&&<div className={'wp02-feedback '+(notice.error?'wp02-error':'')} role={notice.error?'alert':'status'} tabIndex={-1} ref={summary}><p>{notice.text}</p>{Object.entries(errors).length>0&&<ul>{Object.entries(errors).map(([name,message])=><li key={name}><a href={'#wp02-'+name} onClick={e=>{e.preventDefault();refs.current[name]?.focus();}}>{message}</a></li>)}</ul>}</div>}
  {!done&&!token&&<p className="wp02-help">若刷新后验证链接失效，请从原邮件重新打开。</p>}
  {done&&<a className="ls-primary" href="/pages/p003/?returnTo=%2Fpages%2Fp01%2F">登录并进入我的工作台</a>}
  {unknown&&<a className="ls-primary" href="/pages/p003/?returnTo=%2Fpages%2Fp006%2F%3Fsection%3Dadmission">登录并核对加入状态</a>}
  {register&&<p className="wp02-help"><a href="/pages/p006/?section=research-identity">完善科研身份资料（选填，可稍后完善）</a>。不填写不影响提交加入申请；仍须通过加入审核及相应授权，科研身份认证需另行申请。</p>}
  {register&&done&&<a className="ls-secondary" href="/pages/p003/?returnTo=%2Fpages%2Fp006%2F%3Fsection%3Dresearch-identity">登录并完善资料</a>}
  <div className="ls-auth-links"><a href="/pages/p003/">返回登录</a><a href={register?'/pages/p005/':'/pages/p004/'}>{register?'找回密码':'新用户注册'}</a><a href="/pages/p008/">需要帮助</a></div>
 </div>;
}
