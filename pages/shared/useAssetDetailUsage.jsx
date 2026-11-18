import {useEffect,useMemo,useRef} from 'react';
import useAssetUsage from './useAssetUsage.jsx';
import {createAssetReadBoundary} from '../../src/research-assets-read-boundary.js';
export default function useAssetDetailUsage({asset,user,scope,api,blocked,canProceed,onAccessLost,onChanged,canOpen=()=>true}){
 const live=useRef({}),boundary=useMemo(()=>createAssetReadBoundary(),[]);live.current={api,blocked,canProceed,onAccessLost};
 useEffect(()=>{if(blocked)boundary.fail({status:503});else boundary.ready();},[blocked]);
 const usage=useAssetUsage({current:{user,scope,ready:!blocked&&Boolean(user)},readBoundary:boundary,canOpen,apiFactory:()=>Object.fromEntries(['get','post'].map(method=>[method,async(...args)=>{const ready=()=>!live.current.blocked&&(!live.current.canProceed||live.current.canProceed());if(!ready())throw Object.assign(Error('请先重新核对当前固定版本。'),{status:503});try{const result=await live.current.api[method](...args);if(!ready())throw Object.assign(Error('当前读取已暂停，请核对原结果。'),{status:503});return result;}catch(e){if([401,403,404].includes(e.status))live.current.onAccessLost?.(e);throw e;}}])),onSaved:onChanged});
 const action=useRef(null);action.current=()=>{if(blocked||canProceed&&!canProceed())return;usage.open({assetId:asset.id,version:asset.version,action:asset.canActions?.includes('share')?'share':asset.canActions?.includes('request_access')?'request':'manage'});};
 const current=useRef(null);current.current={asset,usage,blocked,canProceed};
 useEffect(()=>{
  function sync(){const c=current.current;for(const b of document.querySelectorAll('.qiyan-page-actions button')){const label=b.textContent.trim();if(['引用','分享'].includes(label))b.disabled=c.blocked||!(label==='引用'?c.asset.canActions?.includes('cite'):c.asset.canActions?.some(a=>['share','request_access','manage_access'].includes(a)));}}
  sync();const observer=new MutationObserver(sync);observer.observe(document.querySelector('main')??document.body,{childList:true,subtree:true});
  const act=e=>{if(e.detail?.pageId!=='a02')return;const c=current.current;if(c.blocked||c.canProceed&&!c.canProceed())return;if(e.detail.label==='引用')c.usage.open({assetId:c.asset.id,version:c.asset.version,action:'cite'});else if(e.detail.label==='分享')action.current();};window.addEventListener('qiyan:page-action',act);
  return()=>{observer.disconnect();window.removeEventListener('qiyan:page-action',act);};
 },[]);
 useEffect(()=>{for(const b of document.querySelectorAll('.qiyan-page-actions button')){const label=b.textContent.trim();if(label==='引用')b.disabled=blocked||!asset.canActions?.includes('cite');if(label==='分享')b.disabled=blocked||!asset.canActions?.some(a=>['share','request_access','manage_access'].includes(a));}},[blocked,asset]);
 return usage;
}
