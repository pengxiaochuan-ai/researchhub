import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createAuthClient } from '../../src/auth-session.js';
import './login-session.css';
import {createAdmissionClient,ADMISSION_PAGE} from '../../src/admission-session.js';
import {safeAuthenticatedReturnTo} from '../../src/route-context.js';

export default function LoginSession({ enterDemo, returnTo = '/pages/p01/' }) {
  const client = useMemo(() => createAuthClient({ tenantSlug: import.meta.env.VITE_AUTH_TENANT_SLUG }), []);
  const admission=useMemo(()=>createAdmissionClient(),[]);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ text: '', error: false });
  const pending = useRef(false), mounted = useRef(true), errorRef = useRef(null);

  async function run(action, operation) {
    if (pending.current) return;
    pending.current = true;
    setBusy(action);
    setNotice({ text: '', error: false });
    try { await operation(); }
    catch (error) {
      if (mounted.current) setNotice({ text: error.message, error: true });
    } finally {
      pending.current = false;
      if (mounted.current) setBusy('');
    }
  }
  const refresh = initial => run('refresh', async () => {
    const profile = await client.me();
    if (!mounted.current) return;
    setUser(profile);
    setNotice({ text: profile || initial ? '' : '当前未登录或登录已过期，请重新登录。', error: false });
  });
  useEffect(() => {
    mounted.current = true;
    if (client.configured) refresh(true);
    return () => { mounted.current = false; };
  }, [client]);
  useEffect(() => { if (notice.error) errorRef.current?.focus(); }, [notice]);
  async function continueUser(profile){
    const state=await admission.self();
    if(!mounted.current)return;
    if(state.accountId!==profile.accountId)throw Error('登录身份已变化，请刷新页面后继续。');
    const safeTarget=safeAuthenticatedReturnTo(returnTo),target=safeTarget===ADMISSION_PAGE?'/pages/p01/':safeTarget;
    if(state.status==='approved')window.location.assign(target);
    else{sessionStorage.setItem('rh-admission-return',JSON.stringify({actor:profile.accountId,authVersion:profile.authVersion,target}));window.location.assign(ADMISSION_PAGE);}
  }

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    run('login', async () => {
      const profile = await client.login({ username: values.get('email'), password: values.get('password') });
      if (!mounted.current) return;
      form.reset();
      try{sessionStorage.removeItem('lingshu-demo-mode');}catch{}
      window.dispatchEvent(new Event('qiyan:auth-changed'));
      setUser(profile);
      await continueUser(profile);
    });
  }
  return <div className="ls-auth-session" aria-busy={Boolean(busy)}>
    <h2>{user ? '已登录灵枢心域' : '登录灵枢心域'}</h2>
    <p>{user ? (user.displayName || user.username) : '继续你的研究与学术协作。'}</p>
    {!user&&<div className="ls-mode-note">{client.configured ? "研究访问权限以当前账号授权为准" : "登录暂不可用，请稍后重试。"}</div>}
    {user ? <>
      {user.displayName&&user.displayName!==user.username&&<p className="ls-small">{user.username}</p>}
      <div className="ls-session-actions">
        <button className="ls-primary" type="button" disabled={Boolean(busy)} onClick={()=>run('continue',()=>continueUser(user))}>{busy==='continue'?'正在进入…':'继续进入'}</button>
        <button className="ls-secondary" type="button" disabled={Boolean(busy)} onClick={() => run('logout', async () => {
          await client.logout();
          window.dispatchEvent(new Event('qiyan:auth-changed'));
          if (mounted.current) { setUser(null); setNotice({ text: '已退出登录。', error: false }); }
        })}>{busy === 'logout' ? '正在退出登录…' : '退出登录'}</button>
      </div>
    </> : <form onSubmit={submit} aria-busy={Boolean(busy)}>
      <label>邮箱<input type="email" name="email" autoComplete="username" required placeholder="name@institution.org" disabled={Boolean(busy)} /></label>
      <label>密码<input type="password" name="password" autoComplete="current-password" required minLength={1} maxLength={64} disabled={Boolean(busy)} /></label>
      <button className="ls-primary" type="submit" disabled={Boolean(busy)}>{busy === 'login' ? '正在登录…' : busy === 'refresh' ? '正在检查登录状态…' : '登录'}</button>
    </form>}
    {notice.text&&<p className="ls-feedback" ref={errorRef} tabIndex={-1} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {!user&&<><button className="ls-secondary" type="button" disabled={Boolean(busy)} onClick={enterDemo}>进入演示模式</button>
    <div className="ls-auth-links"><a href="/pages/p004/">新用户注册</a><a href="/pages/p005/">找回密码</a><a href="/pages/p008/">需要帮助</a></div></>}
  </div>;
}
