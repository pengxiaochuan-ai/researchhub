import React,{useEffect,useRef,useState} from 'react';
import './account-portal-header.css';
import {accountImages} from './account-image-assets.js';

const links=[['平台介绍','/pages/p002/#home'],['科研全流程','/pages/p002/#process'],['适用人群','/pages/p002/#audience'],['学术发起','/pages/p007/'],['帮助中心','/pages/p008/']];

export default function AccountPortalHeader({page}){
 const [open,setOpen]=useState(false),header=useRef(null),toggle=useRef(null);
 const currentHref=page==='p007'?'/pages/p007/':['p008','p009'].includes(page)?'/pages/p008/':null;
 useEffect(()=>{
  const media=window.matchMedia('(max-width:900px)'),resize=event=>{if(!event.matches)setOpen(false);};
  media.addEventListener('change',resize);
  return()=>media.removeEventListener('change',resize);
 },[]);
 useEffect(()=>{
  if(!open)return;
  const outside=event=>{if(!header.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 function escape(event){if(open&&event.key==='Escape'){event.preventDefault();setOpen(false);toggle.current?.focus();}}
 return <header className="ls-account-header" ref={header} onKeyDown={escape}>
  <div className="ls-account-header-inner">
   <a className="ls-account-brand" href="/pages/p002/#home"><span className="ls-account-brand-icon"><img src={accountImages.logo} width="66" height="67" alt="灵枢心域标识"/></span><span>灵枢心域<small>针灸防治情志病学术科研平台</small></span></a>
   <button className="ls-account-menu" type="button" ref={toggle} aria-expanded={open} aria-controls="account-portal-navigation" onClick={()=>setOpen(value=>!value)}>菜单</button>
   <nav id="account-portal-navigation" className={open?'is-open':''} aria-label="公共门户导航" onClick={()=>setOpen(false)}>
    {links.map(([label,href])=><a key={href} href={href} aria-current={href===currentHref?(page==='p009'?'location':'page'):undefined}>{label}</a>)}
    <a className="ls-account-mobile-auth" href="/pages/p003/" aria-current={page==='p003'?'page':undefined}>登录</a>
    <a className="ls-account-mobile-auth" href="/pages/p004/" aria-current={page==='p004'?'page':undefined}>免费注册</a>
   </nav>
   <a className="ls-account-entry ls-account-login" href="/pages/p003/" aria-current={page==='p003'?'page':undefined}>登录</a>
   <a className="ls-account-entry" href="/pages/p004/" aria-current={page==='p004'?'page':undefined}>免费注册</a>
  </div>
 </header>;
}
