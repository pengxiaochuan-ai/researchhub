import React,{useEffect,useRef,useState} from 'react';
import {hubSourceRequest} from '../../src/hub-source-api.js';
import {Button} from './Components.jsx';

export default function WorkbookReviewDetails({entry,refreshVersion,busy,onScope}) {
  const [row,setRow]=useState(null),[page,setPage]=useState({items:[],nextCursor:null});
  const [status,setStatus]=useState('loading'),[error,setError]=useState('');
  const [history,setHistory]=useState(null);
  const [historyOpen,setHistoryOpen]=useState(false);
  const generation=useRef(0);
  const params=new URLSearchParams({batchId:entry.detail.batchId,sourceRegistryId:entry.detail.sourceRegistryId});
  useEffect(()=>{
    const controller=new AbortController(),version=++generation.current;
    setStatus('loading');setError('');setHistory(null);onScope(null);
    const query=new URLSearchParams({batchId:entry.detail.batchId,sourceRegistryId:entry.detail.sourceRegistryId});
    if(row) query.set('sourceRecordId',row.id);
    hubSourceRequest(`review-workbook?${query}`,{signal:controller.signal}).then(result=>{
      if(version!==generation.current||controller.signal.aborted)return;
      setPage(result);onScope(result.scope);setStatus('ready');
    }).catch(cause=>{if(!controller.signal.aborted){setStatus('error');setError(cause.message);}});
    return()=>{controller.abort();generation.current++;};
  },[entry.key,entry.fingerprint,refreshVersion,row?.id,onScope]);
  useEffect(()=>{if(status==='ready'&&historyOpen&&history===null)readHistory();},[status,historyOpen,history]);

  async function more() {
    if(!page.nextCursor||busy||status==='loading')return;
    const current=generation.current;setStatus('loading');setError('');
    try {const result=await hubSourceRequest(`review-workbook?${params}&cursor=${page.nextCursor}`);
      if(current===generation.current){setPage(value=>({...value,items:[...value.items,...result.items],nextCursor:result.nextCursor}));setStatus('ready');}
    } catch(cause){if(current===generation.current){setStatus('error');setError(cause.message);}}
  }
  async function readHistory() {
    if(history)return;
    const current=generation.current;
    try {const result=await hubSourceRequest(`review-history/${entry.detail.sourceRegistryId}?batchId=${entry.detail.batchId}`);
      if(current===generation.current)setHistory(result.history);
    } catch(cause){if(current===generation.current)setError(cause.message);}
  }
  return <div className="hub-review-workbook">
    <p>{entry.detail.fileName} · 来源：{entry.detail.sourceName}</p>
    <p className="hub-review-content-state">合格书目 {entry.detail.eligibleBibliographic.toLocaleString()} 条；
      其中含摘要 {entry.detail.eligibleAbstract.toLocaleString()} 条；
      异常行 {entry.detail.excludedCount.toLocaleString()} 条保留在库中并排除放行。该工作簿没有可用全文。</p>
    {row&&<section className="hub-review-row-reading"><h4>当前单行：第 {row.rowNumber} 行</h4><p>{row.title}</p>
      <p>{[row.authors,row.journal,row.year,row.doi].filter(Boolean).join(' · ')}</p><p className="hub-review-reading">{row.abstract||'本行未提供摘要'}</p>
      <Button disabled={busy} onClick={()=>setRow(null)}>返回审核本来源的 {entry.detail.eligibleBibliographic} 条合格记录</Button>
    </section>}
    {status==='loading'&&<p role="status">正在核对本次审核范围…</p>}
    {error&&<p className="hub-source-error" role="alert">{error}；请使用上方“重新核对”恢复。</p>}
    <details open={!row}><summary>查看原始行并选择单行审核（已加载 {page.items.length} 行）</summary>
      <ul className="hub-review-workbook-rows">{page.items.map(item=><li key={item.id}>
        <span>第 {item.rowNumber} 行</span><strong>{item.title||'缺题名'}</strong>
        {item.errors.length?<p>不可放行：{item.errors.join('、')}</p>:<Button disabled={busy||status==='loading'} onClick={()=>setRow(item)}>单独审核此行</Button>}
      </li>)}</ul>
      {page.nextCursor&&<Button disabled={busy||status==='loading'} onClick={more}>加载后续原始行</Button>}
    </details>
    <details className="hub-review-technical" onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary>历史决定与系统追溯信息</summary>
      <p>原始文件SHA-256：{entry.detail.fileSha256}</p>
      {history===null?<p>正在读取审核记录…</p>:history.length?<ul>{history.map(x=><li key={x.version}>
        {x.sourceRecordId?'单行':'当前批次'} · {x.fieldKind} · {x.purpose} · {x.decision} · {x.audience} · {x.createdAt}<br/>记录引用：{x.evidenceRef}</li>)}</ul>:<p>暂无审核决定。</p>}
    </details>
  </div>;
}
