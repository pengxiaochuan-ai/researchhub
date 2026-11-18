import React,{useEffect,useRef,useState} from 'react';
import {createAssetUsageFlow,usagePendingKey,usageNeedsProtection} from '../../src/research-assets-usage.js';
import {assetRegistrationContextKey} from '../../src/research-assets-registration.js';
import {researchAssetIdentityChanged} from '../../src/research-assets-session.js';
import ResearchAssetAccessDialog from './ResearchAssetAccessDialog.jsx';import ConfirmDialog from './ConfirmDialog.jsx';
export default function useAssetUsage({current,apiFactory,onSaved,readBoundary,canOpen=()=>true}){
 const context=useRef(current),factory=useRef(apiFactory),saved=useRef(onSaved),can=useRef(canOpen),flow=useRef(null),identity=useRef(''),trigger=useRef(null),allowLeave=useRef(false);
 const [model,setModel]=useState(null),[notice,setNotice]=useState(''),[leave,setLeave]=useState(null);context.current=current;factory.current=apiFactory;saved.current=onSaved;can.current=canOpen;
 const key=assetRegistrationContextKey(current);
 function invalidate(){flow.current?.invalidate();flow.current=null;identity.current='';setModel(null);setLeave(null);}
 useEffect(()=>readBoundary?.subscribe(e=>{if(e.authorizationLost)invalidate();else flow.current?.pause();}),[readBoundary]);
 useEffect(()=>{if(identity.current&&identity.current!==key)invalidate();},[key]);
 function open(target){const c=context.current;if(!c.ready||!c.user||!c.scope){setNotice('请先重新读取当前资产。');return;}if(!can.current()){setNotice('请先核对或处理上次资产操作。');return;}setNotice('');trigger.current=document.activeElement;
  if(!flow.current){const created=createAssetUsageFlow({user:c.user,scope:c.scope,api:factory.current(c.user,c.scope),storage:window.sessionStorage,onChange:v=>{if(flow.current===created)setModel(v);},onCommitted:r=>saved.current?.(r)});flow.current=created;identity.current=assetRegistrationContextKey(c);}
  void flow.current.open(target).catch(e=>setNotice(e.message));
 }
 useEffect(()=>{if(current.ready&&current.user&&current.scope&&!flow.current)try{if(window.sessionStorage.getItem(usagePendingKey(current.user,current.scope)))open();}catch{setNotice('无法读取上次用途操作标识，请先核对当前许可。');}},[key,current.ready]);
 function protect(action,element=document.activeElement){if(usageNeedsProtection(flow.current?.state()))setLeave({action,element});else action();}
 useEffect(()=>{
  const changed=e=>{if(flow.current&&researchAssetIdentityChanged(context.current.user,e.detail))invalidate();};
  const unload=e=>{if(!allowLeave.current&&usageNeedsProtection(flow.current?.state())){e.preventDefault();e.returnValue='';}};
  const click=e=>{if(!usageNeedsProtection(flow.current?.state())||allowLeave.current||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest?.('a[href],button[data-page],.qiyan-header-brand,.qiyan-page-actions button');if(!a||a.target==='_blank')return;let href=a.href;if(a.dataset.page)href='/pages/'+a.dataset.page+'/';else if(a.matches('.qiyan-header-brand'))href='/pages/p002/';else if(a.matches('.qiyan-page-actions button')&&a.textContent.trim()==='知识资料')href='/pages/k01/';if(!href||new URL(href,location.href).href===location.href)return;e.preventDefault();e.stopPropagation();protect(()=>{allowLeave.current=true;location.assign(href);},a);};
  window.addEventListener('qiyan:user-change',changed);window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('qiyan:user-change',changed);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);flow.current?.invalidate();flow.current=null;};
 },[]);
 return{open,protect,pending:()=>usageNeedsProtection(flow.current?.state()),recover:()=>open(flow.current?.state().target),notice,dialog:<>{model?.open&&<ResearchAssetAccessDialog model={model} unavailable={!current.ready} returnFocus={trigger.current} onChange={v=>flow.current.change(v)} onChoose={(a,r)=>flow.current.choose(a,r)} onSave={()=>{if(context.current.ready)void flow.current.save();}} onLookup={()=>void flow.current.lookup()} onCopy={()=>void flow.current.copy()} onClose={()=>flow.current.close()} onDiscard={()=>flow.current.discard()}/>}{leave&&<ConfirmDialog title="离开未保存的用途操作？" confirmLabel="离开" cancelLabel="留在此页" returnFocus={leave.element} onCancel={()=>setLeave(null)} onConfirm={()=>{const next=leave.action;setLeave(null);flow.current?.discard();next();}}><p>未保存输入不会提交；尚未确认的操作仍需返回核对原结果。</p></ConfirmDialog>}</>};
}
