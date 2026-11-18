import React, { useEffect, useRef, useState } from 'react';
import { hubVisibleRequest } from '../../src/hub-source-api.js';
import '../c01/src/real-clinical.css';
import GuidanceExcerptLoader from './GuidanceExcerptLoader.jsx';

const typeLabel = { research_standard: '研究标准', clinical_guideline: '临床指南' };

export default function RealGuidanceDocuments() {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [query, setQuery] = useState('');
  const active = useRef(null);
  const identityPending=useRef(false);
  const load = () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'loading', items: [] });
    hubVisibleRequest('guidance-documents', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ status: 'ready', items: result.items ?? [] }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: 'error', message: error.message, items: [] }); });
  };
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible'&&!identityPending.current) load(); };
    const identity=event=>{active.current?.abort();setState({status:'loading',items:[]});
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);if(!identityPending.current)load();};
    window.addEventListener('focus', refresh);
    window.addEventListener('qiyan:user-change',identity);
    document.addEventListener('visibilitychange', refresh);
    return () => { active.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('qiyan:user-change',identity); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const filtered = state.items.filter(item => [item.title, item.externalKey, item.sourceTargetCondition, item.sourceName]
    .some(value => String(value ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));

  return <main className="platform-main real-registry" aria-busy={state.status === 'loading'}>
    <div className="real-registry__content">
    <section className="real-registry__intro"><h2>指南与研究标准</h2>
      <p>查看当前获准的指南与标准，可展开关键条款核对原始页码。教材暂无已核验来源。</p></section>
    {state.status === 'loading' && <section className="real-registry__state" role="status">正在读取已审核指南与标准…</section>}
    {state.status === 'error' && <section className="real-registry__state" role="alert"><h3>暂时无法读取来源</h3><p>{state.message}</p><button type="button" onClick={load}>重试</button></section>}
    {state.status === 'ready' && <>
      <label className="real-registry__search">搜索当前获准来源
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入题名、编号或来源" />
      </label>
      <p className="real-registry__count" aria-live="polite">当前可见 {filtered.length} 条指南与研究标准来源</p>
      {state.items.length === 0 ? <section className="real-registry__state"><h3>暂无已审核指南或研究标准</h3><p>初始文件已受控入库，但需管理员逐份完成权利核验和书目展示审核后才能在此展示。</p></section>
        : filtered.length === 0 ? <section className="real-registry__state"><h3>没有符合条件的来源</h3><p>请调整搜索词。</p></section>
        : <section className="real-registry__items" aria-label="已审核指南与研究标准">
          {filtered.map(item => <article className="real-registry__card" key={item.documentId}>
            <p className="real-registry__type">{typeLabel[item.documentType]}</p><h3>{item.title}</h3>
            <dl>
              <div><dt>编号</dt><dd>{item.externalKey || '未提供'}</dd></div>
              <div><dt>原始疾病字段</dt><dd>{item.sourceTargetCondition || '未提供'}</dd></div>
              <div><dt>来源</dt><dd>{item.sourceName || '未提供'}</dd></div>
              <div><dt>展示审核版本</dt><dd>{item.reviewVersion}</dd></div>
            </dl>
            {typeof item.sourceUrl === 'string' && /^https:\/\/[^\s/]+(?:\/|$)/i.test(item.sourceUrl) &&
              <div className="real-registry__actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">来源网站</a></div>}
            <GuidanceExcerptLoader item={item} />
          </article>)}
        </section>}
      <p className="real-registry__disclaimer">仅按当前审核展示书目及局部条款；未获准正文、整本下载及 AI 解读不开放。原件版本不等于最新证据。</p>
    </>}
    </div>
  </main>;
}
