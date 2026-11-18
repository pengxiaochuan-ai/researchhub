import React, { useEffect, useRef, useState } from 'react';
import { hubVisibleRequest } from '../../src/hub-source-api.js';
import { Button } from './Components.jsx';
import GuidanceClauseDetails from './GuidanceClauseDetails.jsx';

export default function GuidanceExcerptLoader({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState({ status: 'idle' });
  const active = useRef(null);
  const load = () => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setState({ status: 'loading' });
    hubVisibleRequest(`guidance-documents/${item.documentId}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ status: 'ready', item: result.item }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: error.status === 404 ? 'unavailable' : 'error', message: error.message }); });
  };
  useEffect(() => {
    if (expanded) load(); else { active.current?.abort(); setState({ status: 'idle' }); }
    return () => active.current?.abort();
  }, [expanded, item.documentId]);
  useEffect(()=>{
    const identity=()=>{active.current?.abort();setState({status:'idle'});setExpanded(false);};
    window.addEventListener('qiyan:user-change',identity);
    return()=>window.removeEventListener('qiyan:user-change',identity);
  },[]);
  return <details className="guidance-excerpt-loader" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary aria-label={`${item.externalKey}：查看关键条款与页码`}>查看关键条款与页码</summary>
    <div aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <p role="status">正在核对条款当前版本与展示审核…</p>}
      {state.status === 'error' && <div role="alert"><p>{state.message}</p><Button onClick={load}>重试读取条款</Button></div>}
      {state.status === 'unavailable' && <p role="status">该来源当前不可见，可能已撤回或换版。请刷新来源列表。</p>}
      {state.status === 'ready' && (state.item.clausesStatus === 'approved' && state.item.clauseDetails
        ? <GuidanceClauseDetails details={state.item.clauseDetails} />
        : <p role="status">关键条款当前未获准展示、已撤回或提取版本变化；不从示例补齐正文。</p>)}
    </div>
  </details>;
}
