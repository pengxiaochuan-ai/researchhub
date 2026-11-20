import React,{useState,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {goToPage} from '../../src/platform-navigation.js';
import {safeReturnTo,safeAuthenticatedReturnTo} from '../../src/route-context.js';
import LoginSession from './LoginSession.jsx';
import PublicLayout from './PublicLayout.jsx';
import PublicPageBoundary from './PublicPageBoundary.jsx';
import LoginResearchVisual from './LoginResearchVisual.jsx';
import AccountAccess from './AccountAccess.jsx';
const AccountProfile=lazy(()=>import('./AccountProfile.jsx'));
const MemberInvitations=lazy(()=>import('./MemberInvitations.jsx'));
import Initiative from '../p007/Initiative.jsx';
import {HelpCenter,HelpArticle} from './HelpCenter.jsx';
import './public-pages.css';
import '../../src/lingshu-brand.css';


function AuthPage({page}){
  const register=page==='p004',reset=page==='p005';
  const [notice,setNotice]=useState('');
  const returnTo=safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
  function submit(event){event.preventDefault();setNotice(reset?"找回密码暂不可用，未发送邮件。":"当前为演示模式，未创建账号或登录。可继续浏览演示。");}
  function enterDemo(){try{sessionStorage.setItem('lingshu-demo-mode','true');}catch{setNotice('浏览器不允许保存演示状态，仍可直接浏览页面。');}location.assign(register?'/pages/p006/?returnTo='+encodeURIComponent(returnTo):returnTo);}
  return <div className="ls-auth-grid"><LoginResearchVisual/><section className="ls-auth-card">{!register&&!reset ? <LoginSession returnTo={safeAuthenticatedReturnTo(new URLSearchParams(location.search).get('returnTo'))}/> : <><h2>{reset?'找回密码':'加入灵枢心域'}</h2><p>{reset?'通过工作邮箱恢复账号。':'继续你的研究与学术协作。'}</p><div className="ls-mode-note">演示模式 · 注册与找回密码暂不可用</div><form onSubmit={submit}><label>邮箱<input type="email" name="email" autoComplete="email" required placeholder="name@institution.org"/></label>{!reset&&<label>密码<input type="password" name="password" autoComplete="new-password" required minLength={12} maxLength="64"/></label>}{register&&<p className="ls-small">演示模式不会创建账号、发送验证码或保存密码。</p>}<button className="ls-primary" type="submit">{reset?'检查恢复入口':'检查注册资料'}</button><p role="status" className="ls-feedback">{notice}</p></form>{!reset&&<button className="ls-secondary" onClick={enterDemo}>完善演示身份并体验</button>}<div className="ls-auth-links"><a href={register?'/pages/p003/':'/pages/p004/'}>{register?'已有账号，返回登录':'新用户注册'}</a><a href="/pages/p005/">找回密码</a><a href="/pages/p008/">需要帮助</a></div></>}</section></div>;
}
function Profile(){const [notice,setNotice]=useState('');function submit(event){event.preventDefault();const form=new FormData(event.currentTarget);const profile={displayName:form.get('name').trim(),institution:form.get('institution').trim(),roleName:form.get('role'),direction:form.get('direction').trim(),mode:'demo'};try{localStorage.setItem('lingshu-demo-profile',JSON.stringify(profile));location.assign(safeReturnTo(new URLSearchParams(location.search).get('returnTo')));}catch{setNotice('本机资料保存失败，未保存，请检查浏览器存储设置。');}}let profile={};try{profile=JSON.parse(localStorage.getItem('lingshu-demo-profile')||'{}');}catch{}
  return <section className="ls-profile-card"><h1>完善你的学术身份</h1><p>这些资料仅用于本机演示，不验证机构身份，也不授予管理权限。</p><form onSubmit={submit}><label>展示名称<input name="name" required maxLength="40" defaultValue={profile.displayName||'演示研究者'}/></label><label>身份<select name="role" defaultValue={profile.roleName||'科研人员'}>{['临床医生','科研人员','青年研究者','团队成员'].map(role=><option key={role}>{role}</option>)}</select></label><label>所在机构<input name="institution" maxLength="100" defaultValue={profile.institution||''}/></label><label>研究方向<textarea name="direction" maxLength="500" rows="3" defaultValue={profile.direction||''}/></label><button className="ls-primary">保存本机资料并继续</button><p role="status">{notice}</p></form></section>;
}

const page=location.pathname.match(/\/pages\/([^/]+)/)?.[1];
let demoAccount=false;try{demoAccount=sessionStorage.getItem('lingshu-demo-mode')==='true';}catch{}
const realAccount=Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG);
function ProfileRoute(){return realAccount&&!demoAccount?<AccountProfile/>:<Profile/>;}
const Page=()=>['p003','p004','p005'].includes(page)?(['p004','p005'].includes(page)&&realAccount?<div className="ls-auth-grid"><LoginResearchVisual/><section className="ls-auth-card"><AccountAccess page={page}/></section></div>:<AuthPage page={page}/>):page==='p006'?<ProfileRoute/>:page==='p010'?<MemberInvitations mode="accept"/>:page==='p007'?<Initiative/>:page==='p008'?<HelpCenter/>:<HelpArticle/>;
createRoot(document.getElementById('root')).render(<PublicLayout page={page}><PublicPageBoundary><Suspense fallback={<p role="status">正在加载页面…</p>}><Page/></Suspense></PublicPageBoundary></PublicLayout>);
