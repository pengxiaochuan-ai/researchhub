import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import KnowledgeBasePage from '../../src/knowledge-reuse/pages/knowledge/KnowledgeBasePage';
import { SystemDialogProvider } from '../../src/knowledge-reuse/components/SystemDialogProvider';
import { session, isAdmin } from '../../src/knowledge-reuse/store/auth';
import { resolveKnowledgeScope } from '../../src/knowledge-session.js';
import { useKnowledgeModalFocus } from '../../src/knowledge-modal-focus.js';
import {readMaterialKnowledgeTarget} from '../../src/session-material-session.js';
import './frame.css';

function KnowledgeFrame() {
  const target=readMaterialKnowledgeTarget(location.search);
  useKnowledgeModalFocus();
  const [profile, setProfile] = useState(null), [scope, setScope] = useState(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [accessError, setAccessError] = useState(''), [attempt, setAttempt] = useState(0);
  const busy = useRef(false), inFlight = useRef(false), dialog = useRef(null), pending = useRef(null), previousFocus = useRef(null);
  const management = new URLSearchParams(location.search).get('mode') === 'manage';
  useEffect(()=>{window.parent.postMessage({type:'knowledge-identity',scope},location.origin);},[scope,profile]);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true); setError('');
    if (!import.meta.env.VITE_AUTH_TENANT_SLUG) { setError('知识资料暂不可用，请联系管理员。'); setLoading(false); return; }
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) throw new Error('请先登录，再进入知识资料。');
        if (!response.ok || !(response.headers.get('Content-Type') || '').includes('application/json')) throw new Error('知识资料会话服务暂时不可用，请重试。');
        const user = await response.json();
        if (!user?.accountId || !user.tenantId || !Array.isArray(user.studyGroups)) throw new Error('会话响应无效，未加载任何知识资料。');
        if (!alive) return;
        const next = target.kind==='valid'?resolveKnowledgeScope(user,target.studyGroupId,target.researchProjectId):resolveKnowledgeScope(user);
        if(target.kind==='invalid'||target.kind==='valid'&&(next?.studyGroupId!==target.studyGroupId||next?.researchProjectId!==target.researchProjectId))throw Error('该资料关联的研究当前不可访问，请从原会话核对。');
        session.user = user; session.scope = next;
        setProfile(user); setScope(next); setAccessError('');
        window.parent.postMessage({ type: 'knowledge-role', admin: isAdmin(user.role) }, location.origin);
      }).catch(reason => { if (alive) {setProfile(null);setScope(null);session.user=null;session.scope=null;window.parent.postMessage({type:'knowledge-role',admin:false},location.origin);setError(reason.message || '无法连接知识资料服务。');} })
      .finally(() => { if (alive) setLoading(false); });
    const timer = setTimeout(() => controller.abort(), 15000);
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  useEffect(() => {
    const lost = event => setAccessError(event.detail);
    const activity = event => { busy.current = event.detail.busy; inFlight.current = event.detail.inFlight; };
    const viewport = event => {
      if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'knowledge-visible-frame') return;
      if (!Number.isFinite(event.data.top) || !Number.isFinite(event.data.height)) return;
      document.documentElement.style.setProperty('--frame-visible-top', Math.max(0, event.data.top) + 'px');
      document.documentElement.style.setProperty('--frame-visible-height', Math.max(120, event.data.height) + 'px');
    };
    window.addEventListener('knowledge-access-lost', lost); window.addEventListener('knowledge-busy-local', activity);
    window.addEventListener('message', viewport);
    return () => { window.removeEventListener('knowledge-access-lost', lost); window.removeEventListener('knowledge-busy-local', activity); window.removeEventListener('message', viewport); };
  }, []);
  function change(next, trigger) {
    if (inFlight.current) { setAccessError('操作仍在进行，请等待保存或导入完成后再切换研究上下文。'); return; }
    if (busy.current) { pending.current = next; previousFocus.current = trigger; dialog.current.showModal(); }
    else { session.scope = next; setScope(next); setAccessError(''); }
  }
  function decide(discard) { dialog.current.close(); if (discard) { session.scope = pending.current; setScope(pending.current); setAccessError(''); busy.current = false; } previousFocus.current?.focus(); }
  if (loading) return <div className="p-6" role="status">正在确认真实会话与研究项目授权…</div>;
  if (error) return <section className="p-6 space-y-4"><p role="alert">{error}</p><button className="btn-outline" onClick={() => setAttempt(v => v + 1)}>重试会话</button> <a href="/pages/p003/" target="_top">前往登录</a></section>;
  if (!scope) return <section className="p-6"><h2 className="text-base font-semibold">尚无可访问的知识资料研究项目</h2><p className="mt-3">当前会话：{profile.displayName}。请联系负责人邀请加入私有 Study，并授予既有知识库菜单权限；公开注册不会自动取得 Study 授权。</p><a href="/pages/p003/" target="_top">查看登录会话</a></section>;
  if (management && !isAdmin(profile.role)) return <p className="p-6" role="alert">仅租户管理员可进入知识库治理。</p>;
  const groups = profile.studyGroups.filter(group => group.role?.menuPermissions?.some(p => ['*', 'knowledge'].includes(p)));
  const group = groups.find(item => item.id === scope.studyGroupId);
  const locatedTarget=target.kind==='valid'&&target.studyGroupId===scope.studyGroupId&&target.researchProjectId===scope.researchProjectId?target:null;
  return <SystemDialogProvider><div className="knowledge-frame">
    <header className="knowledge-context"><span>实际会话：{profile.displayName} · {management ? '治理模式' : '资料模式'}</span>
      <label>课题组<select aria-label="课题组" value={scope.studyGroupId} onChange={event => change(resolveKnowledgeScope(profile, event.target.value), event.target)}>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>研究项目<select aria-label="研究项目" value={scope.researchProjectId} onChange={event => change(resolveKnowledgeScope(profile, scope.studyGroupId, event.target.value), event.target)}>{group.researchProjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </header>
    {accessError && <div role="alert" className="knowledge-access-error">{accessError} <a target="_top" href="/pages/p003/">查看会话</a>；草稿保留，请先复制保存。</div>}
    <section className="knowledge-island" key={scope.studyGroupId + scope.researchProjectId}><KnowledgeBasePage embedded managementMode={management} initialKbId={locatedTarget?.kbId} initialDocId={locatedTarget?.docId} initialImportTaskId={locatedTarget?.importTaskId} initialDocVersion={locatedTarget?.docVersion} initialContentSha256={locatedTarget?.contentSha256}/></section>
    <dialog ref={dialog} onCancel={() => decide(false)} aria-labelledby="scope-change-title"><h2 id="scope-change-title">切换研究上下文？</h2><p>当前有未保存或进行中的操作。切换后本地草稿将离开，已提交的导入任务不会因此自动取消。</p><button className="btn-primary" onClick={() => decide(false)} autoFocus>继续编辑</button><button className="btn-outline" onClick={() => decide(true)}>放弃本地修改并切换</button></dialog>
  </div></SystemDialogProvider>;
}
createRoot(document.getElementById('root')).render(<KnowledgeFrame/>);
