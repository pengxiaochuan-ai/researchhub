import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from '../shared/Shell.jsx';
import '../../src/page-linking.js';
import './host.css';
import {attachSessionActivityDocument} from '../../src/platform-user.js';
import {readMaterialKnowledgeTarget} from '../../src/session-material-session.js';

function KnowledgeHost() {
  const target=readMaterialKnowledgeTarget(location.search),frameQuery=new URLSearchParams(target.kind==='valid'?Object.fromEntries(Object.entries(target).filter(([key])=>key!=='kind')):{});
  const frame = useRef(null), dialog = useRef(null), returnFocus = useRef(null);
  const [busy, setBusy] = useState(false), [management, setManagement] = useState(() => new URLSearchParams(location.search).get('mode') === 'manage'), [admin, setAdmin] = useState(false);
  const inFlight = useRef(false);
  function updateVisibleFrame() {
    const element = frame.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const top = Math.max(0, 72 - rect.top), bottom = Math.min(element.clientHeight, innerHeight - rect.top - 8);
    element.contentWindow?.postMessage({ type:'knowledge-visible-frame', top, height:Math.max(120, bottom - top) }, location.origin);
  }
  useEffect(() => {
    const message = event => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'knowledge-busy') { setBusy(event.data.busy === true); inFlight.current = event.data.inFlight === true; }
      if (event.data?.type === 'knowledge-role') setAdmin(event.data.admin === true);
      if (event.data?.type === 'knowledge-identity') window.dispatchEvent(new CustomEvent('qiyan:auth-scope',{detail:event.data.scope??{}}));
      if (event.data?.type === 'knowledge-dialog-open') {
        window.scrollTo({ top:Math.max(0, scrollY + frame.current.getBoundingClientRect().top - 80), behavior:'instant' });
        updateVisibleFrame();
      }
    };
    window.addEventListener('message', message);
    window.addEventListener('scroll', updateVisibleFrame, { passive:true }); window.addEventListener('resize', updateVisibleFrame);
    return () => { window.removeEventListener('message', message); window.removeEventListener('scroll', updateVisibleFrame); window.removeEventListener('resize', updateVisibleFrame); };
  }, []);
  function switchMode(event) {
    if (inFlight.current) return;
    if (busy) { returnFocus.current = event.currentTarget; dialog.current.showModal(); } else setManagement(value => !value);
  }
  function close(discard) { dialog.current.close(); if (discard) { setBusy(false); setManagement(value => !value); } returnFocus.current?.focus(); }
  if(management)frameQuery.set('mode','manage');
  return <Shell stableSlots active="科研资产" hero={{ breadcrumb: '科研资产 › 知识资料', title: '知识资料', en: 'Knowledge', subtitle: '整理研究材料，经审核后检索与复用。数据范围以当前登录会话和研究项目授权为准。' }}>
    <div className="content knowledge-host">
      <div className="knowledge-host-toolbar"><span>研究资料与知识检索</span><div><a href="/pages/a01/">返回科研资产</a>{admin && <button type="button" onClick={switchMode}>{management ? '返回资料模式' : '知识库治理'}</button>}</div></div>
      {target.kind==='invalid'?<p role="alert">资料链接无效，请从原会话重新进入。</p>:<iframe key={management ? 'manage' : 'read'} ref={frame} title="知识资料操作区" onLoad={()=>{updateVisibleFrame();attachSessionActivityDocument(frame.current?.contentDocument);}} src={'/pages/k01/frame.html'+(frameQuery.size?'?'+frameQuery:'')}/>}
      <p className="knowledge-host-note">仅上传合成材料。AI问答使用已审核、已授权资料，按实际用量计费。</p>
      <dialog ref={dialog} onCancel={() => close(false)} aria-labelledby="knowledge-unsaved-title"><h2 id="knowledge-unsaved-title">有未保存或进行中的操作</h2><p>切换模式将离开当前资料视图。请先保存草稿并确认导入任务状态。</p><div><button onClick={() => close(false)} autoFocus>继续编辑</button><button onClick={() => close(true)}>仍然切换</button></div></dialog>
    </div>
  </Shell>;
}
document.documentElement.dataset.page = 'k01';
createRoot(document.getElementById('root')).render(<KnowledgeHost/>);
