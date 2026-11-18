import React,{useEffect,useRef,useState} from 'react';
import {createAssetGovernanceFlow,governanceNeedsProtection,assetGovernancePendingKey} from '../../src/research-assets-governance.js';
import {assetRegistrationContextKey} from '../../src/research-assets-registration.js';
import {researchAssetIdentityChanged} from '../../src/research-assets-session.js';
import ResearchAssetGovernanceDialog from './ResearchAssetGovernanceDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
export default function useAssetGovernance({current,apiFactory,onSaved,readBoundary,canOpen=()=>true}){
 const context=useRef(current),saved=useRef(onSaved),factory=useRef(apiFactory),can=useRef(canOpen),flow=useRef(null),identity=useRef(''),trigger=useRef(null),allowLeave=useRef(false);
 const [model,setModel]=useState(null),[notice,setNotice]=useState(''),[leave,setLeave]=useState(null);context.current=current;saved.current=onSaved;factory.current=apiFactory;can.current=canOpen;
 const key=assetRegistrationContextKey(current);
 function invalidate(){flow.current?.invalidate();flow.current=null;identity.current='';setModel(null);setLeave(null);}
 useEffect(()=>readBoundary?.subscribe(e=>{if(e.authorizationLost)invalidate();else flow.current?.pause();}),[readBoundary]);
 useEffect(()=>{if(identity.current&&identity.current!==key)invalidate();},[key]);
 useEffect(()=>{
  if(!current.ready||!current.user||!current.scope||flow.current)return;
  try{if(window.sessionStorage.getItem(assetGovernancePendingKey(current.user,current.scope)))open();}catch{setNotice('无法读取上次操作核对标识，请先核对当前资产状态。');}
 },[key,current.ready]);
 function open(target){
  const c=context.current;if(!c.ready||!c.user||!c.scope){setNotice('请先重新读取当前资产。');return;}
  if(!can.current()){setNotice('尚有未完成的资产输入，请先保存、核对或放弃。');return;}
  trigger.current=document.activeElement;setNotice('');
  if(!flow.current){const created=createAssetGovernanceFlow({user:c.user,scope:c.scope,api:factory.current(c.user,c.scope),storage:window.sessionStorage,onChange:value=>{if(flow.current===created)setModel(value);},onCommitted:receipt=>saved.current?.(receipt)});flow.current=created;identity.current=assetRegistrationContextKey(c);}
  void flow.current.open(target).catch(e=>setNotice(e.message));
 }
 function protect(action,element=document.activeElement){if(!governanceNeedsProtection(flow.current?.state()))action();else setLeave({action,element});}
 useEffect(()=>{
  const changed=e=>{if(flow.current&&researchAssetIdentityChanged(context.current.user,e.detail))invalidate();};
  const unload=e=>{if(!allowLeave.current&&governanceNeedsProtection(flow.current?.state())){e.preventDefault();e.returnValue='';}};
  const click=e=>{
   if(!governanceNeedsProtection(flow.current?.state())||allowLeave.current||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   const a=e.target.closest?.('a[href],button[data-page],.qiyan-header-brand,.qiyan-page-actions button');if(!a||a.target==='_blank')return;
   let href=a.href;if(a.dataset.page)href='/pages/'+a.dataset.page+'/';else if(a.matches('.qiyan-header-brand'))href='/pages/p002/';else if(a.matches('.qiyan-page-actions button')&&a.textContent.trim()==='知识资料')href='/pages/k01/';
   if(!href||new URL(href,location.href).href===location.href)return;e.preventDefault();e.stopPropagation();protect(()=>{allowLeave.current=true;location.assign(href);},a);
  };
  window.addEventListener('qiyan:user-change',changed);window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('qiyan:user-change',changed);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);flow.current?.invalidate();flow.current=null;};
 },[]);
 return{open,protect,recover:()=>open(flow.current?.state().target),pending:()=>governanceNeedsProtection(flow.current?.state()),notice,dialog:<>{model?.open&&<ResearchAssetGovernanceDialog model={model} scope={current.scope} unavailable={!current.ready} returnFocus={trigger.current} onChange={v=>flow.current.change(v)} onSave={()=>{if(context.current.ready)void flow.current.save();}} onLookup={()=>void flow.current.lookup()} onClose={()=>flow.current.close()} onDiscard={()=>flow.current.discard()}/>}{leave&&<ConfirmDialog title="离开未保存的资产操作？" confirmLabel="离开" cancelLabel="留在此页" returnFocus={leave.element} onCancel={()=>setLeave(null)} onConfirm={()=>{const next=leave.action;setLeave(null);flow.current?.discard();next();}}><p>未保存的审核输入不会写入资产；尚未确认的操作仍需返回核对。</p></ConfirmDialog>}</>};
}
