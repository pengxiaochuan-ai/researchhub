import React,{useEffect,useRef,useState} from 'react';
import {createAssetRegistrationFlow} from '../../src/research-assets-registration-flow.js';
import {assetRegistrationNeedsProtection as protects,assetRegistrationContextKey} from '../../src/research-assets-registration.js';
import {researchAssetIdentityChanged} from '../../src/research-assets-session.js';
import ResearchAssetRegistrationDialog from './ResearchAssetRegistrationDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function useAssetRegistration({current,apiFactory,onSaved,readBoundary,canOpen=()=>true,onCreate}){
 const context=useRef(current),saved=useRef(onSaved),factory=useRef(apiFactory),can=useRef(canOpen),flow=useRef(null),flowIdentity=useRef(''),allowLeave=useRef(false),trigger=useRef(null);
 const [model,setModel]=useState(null),[leave,setLeave]=useState(null),[notice,setNotice]=useState('');
 const createRequest=useRef(onCreate);createRequest.current=onCreate;
 context.current=current;saved.current=onSaved;factory.current=apiFactory;can.current=canOpen;
 const identity=assetRegistrationContextKey(current);
 function invalidate(){flow.current?.invalidate();flow.current=null;flowIdentity.current='';setModel(null);setLeave(null);}
 useEffect(()=>readBoundary?.subscribe(e=>{if(e.authorizationLost)invalidate();else flow.current?.pause();}),[readBoundary]);
 useEffect(()=>{if(flowIdentity.current&&flowIdentity.current!==identity)invalidate();},[identity]);
 function open(target){
  const c=context.current;if(!c.ready||!c.user||!c.scope){setNotice('当前资产状态尚未核对，请先重新读取。');return;}
  if(!can.current()){setNotice('尚有未完成的资产操作，请先保存、核对或放弃原输入。');return;}
  setNotice('');trigger.current=document.activeElement;
  if(!flow.current){
   const api=factory.current(c.user,c.scope),created=createAssetRegistrationFlow({user:c.user,scope:c.scope,api,storage:window.sessionStorage,onChange:value=>{if(flow.current===created)setModel(value);},onCommitted:receipt=>saved.current?.(receipt)});
   flow.current=created;flowIdentity.current=assetRegistrationContextKey(c);
  }
  void flow.current.open(target).catch(e=>setNotice(e.message));
 }
 function protect(action,element=document.activeElement){
  if(!protects(flow.current?.state())){action();return;}
  setLeave({action,element});
 }
 useEffect(()=>{
  const page=e=>{if(e.detail?.pageId==='a01'&&e.detail.label==='上传资产'&&!e.detail.blockedReason){if(createRequest.current)createRequest.current();else open();}};
  const identityChanged=e=>{if(flow.current&&researchAssetIdentityChanged(context.current.user,e.detail))invalidate();};
  const unload=e=>{if(!allowLeave.current&&protects(flow.current?.state())){e.preventDefault();e.returnValue='';}};
  const click=e=>{
   if(!protects(flow.current?.state())||allowLeave.current||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   const a=e.target.closest?.('a[href],button[data-page],.qiyan-header-brand,.qiyan-page-actions button');if(!a||a.target==='_blank')return;
   let href=a.href;
   if(a.dataset.page)href='/pages/'+a.dataset.page+'/';else if(a.matches('.qiyan-header-brand'))href='/pages/p002/';else if(a.matches('.qiyan-page-actions button')&&a.textContent.trim()==='知识资料')href='/pages/k01/';
   if(!href||new URL(href,location.href).href===location.href)return;
   e.preventDefault();e.stopPropagation();protect(()=>{allowLeave.current=true;location.assign(href);},a);
  };
  window.addEventListener('qiyan:page-action',page);window.addEventListener('qiyan:user-change',identityChanged);window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('qiyan:page-action',page);window.removeEventListener('qiyan:user-change',identityChanged);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);flow.current?.invalidate();flow.current=null;};
 },[]);
 const dialog=model?.open?<ResearchAssetRegistrationDialog model={model} scopeChoices={model.edit?current.scopes:current.creationScopes} selectedScope={current.scope} onScopeChange={scope=>current.onChooseScope?.(scope)} returnFocus={trigger.current} unavailable={!current.ready} onChange={v=>flow.current.change(v)} onSource={id=>flow.current.selectSource(id)} onFile={file=>flow.current.selectFile(file)} onSave={()=>{if(context.current.ready)void flow.current.save();}} onLookup={()=>void flow.current.lookup()} onClose={()=>flow.current.close()} onDiscard={()=>flow.current.discard()}/>:null;
 const leaveDialog=leave?<ConfirmDialog title="离开未保存的资产输入？" confirmLabel="离开" cancelLabel="继续编辑" returnFocus={leave.element} onCancel={()=>setLeave(null)} onConfirm={()=>{const next=leave.action;setLeave(null);flow.current?.discard();next();}}><p>未保存输入不会写入资产。尚未确认的保存仍需返回后核对；正文与文件不会保存在浏览器中。</p></ConfirmDialog>:null;
 return{open,protect,pending:()=>protects(flow.current?.state()),dialog:<>{dialog}{leaveDialog}</>,notice};
}
