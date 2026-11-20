import React,{useEffect,useRef,useState} from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function useStudyDataLeaveGuard({enabled,dirty}){
 const [leave,setLeave]=useState(null),allow=useRef(false),fallback=useRef(null);
 useEffect(()=>{
  if(!enabled||!dirty)return;
  const beforeUnload=event=>{if(!allow.current){event.preventDefault();event.returnValue='';}};
  const click=event=>{
   if(allow.current||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
   const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self')return;
   const target=new URL(link.href,location.href);if(target.origin!==location.origin||!target.pathname.startsWith('/pages/')||target.pathname===location.pathname&&target.search===location.search)return;
   event.preventDefault();event.stopPropagation();setLeave({href:target.pathname+target.search+target.hash,trigger:link});
  };
  window.addEventListener('beforeunload',beforeUnload);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',click,true);};
 },[enabled,dirty]);
 const dialog=leave?<ConfirmDialog title="离开前核对未保存内容" confirmLabel="离开此页" returnFocus={leave.trigger} fallbackFocus={fallback.current} onCancel={()=>setLeave(null)} onConfirm={()=>{allow.current=true;location.assign(leave.href);}}><p>未发送的问题和未确认的关联选择将丢失，已登记内容保留。</p><p>上传或登记结果尚未确认时，请返回原会话核对，避免重复提交。</p></ConfirmDialog>:null;
 return{fallback,dialog};
}
