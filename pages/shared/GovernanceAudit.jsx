import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {createAuthClient} from '../../src/auth-session.js';
import {createGovernanceAuditClient,createAuditEpoch,readAuditFilters} from '../../src/governance-audit-session.js';
import './workflow-pages.css';
import './governance-audit.css';
const time=v=>new Date(v).toLocaleString('zh-CN',{hour12:false});
export default function GovernanceAudit(){
 const api=useMemo(()=>createGovernanceAuditClient(),[]),auth=useMemo(()=>createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG}),[]),epoch=useMemo(()=>createAuditEpoch(),[]);
 const initial=useMemo(()=>readAuditFilters(location.search),[]);
 const[data,setData]=useState(null),[detail,setDetail]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState(''),[detailError,setDetailError]=useState(''),[busy,setBusy]=useState(false),[detailBusy,setDetailBusy]=useState(false),[action,setAction]=useState(initial.action??''),[target,setTarget]=useState(initial.target??''),[query,setQuery]=useState(initial);
 const latest=useRef(query),detailVersion=useRef(0),previousPages=useRef(Array.isArray(history.state?.auditPages)?history.state.auditPages.slice(-100):[]);latest.current=query;
 function clear(){epoch.advance();detailVersion.current++;setData(null);setDetail(null);setSelected(null);setDetailError('');setDetailBusy(false);}
 async function load(q){clear();const n=epoch.current();setBusy(true);setError('');try{const identity=await auth.me();if(!epoch.isCurrent(n))return;if(!identity){location.assign('/pages/p003/?'+new URLSearchParams({returnTo:location.pathname+location.search}));return;}const value=await api.list(q);if(epoch.isCurrent(n))setData(value);}catch(e){if(epoch.isCurrent(n))setError(e.message);}finally{if(epoch.isCurrent(n))setBusy(false);}}
 useEffect(()=>{history.replaceState({auditPages:previousPages.current},'','/pages/g04/?'+new URLSearchParams(query));void load(query);},[query]);
 useEffect(()=>{const refresh=()=>{clear();setError('');void load(latest.current);};const visible=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('qiyan:user-change',refresh);window.addEventListener('qiyan:auth-changed',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);return()=>{epoch.advance();window.removeEventListener('qiyan:user-change',refresh);window.removeEventListener('qiyan:auth-changed',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};},[]);
 async function open(id){if(selected===id){detailVersion.current++;setSelected(null);setDetail(null);return;}setSelected(id);setDetail(null);setDetailError('');setDetailBusy(true);const n=epoch.current(),d=++detailVersion.current;try{const value=await api.detail(id);if(epoch.isCurrent(n)&&d===detailVersion.current)setDetail(value);}catch(e){if(epoch.isCurrent(n)&&d===detailVersion.current){setDetailError(e.message);if(e.status===401||e.status===403){clear();setError(e.message);}}}finally{if(epoch.isCurrent(n)&&d===detailVersion.current)setDetailBusy(false);}}
 return <main className="platform-main ga-page"><div className="wf-content"><section className="wf-panel" aria-busy={busy}>
  <h2>审计日志</h2><form className="ga-filters" onSubmit={e=>{e.preventDefault();previousPages.current=[];setQuery({take:20,skip:0,...(action?{action}:{}),...(target.trim()?{target:target.trim()}:{})});}}>
   <label>操作类型<select aria-label="操作类型" value={action} onChange={e=>setAction(e.target.value)}><option value="">全部操作</option>{data?.actionOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <label>对象标识<input aria-label="对象标识" value={target} maxLength={160} onChange={e=>setTarget(e.target.value)} placeholder="输入对象标识"/></label><Button type="submit" disabled={busy}>查询</Button><Button disabled={busy} onClick={()=>{setAction('');setTarget('');previousPages.current=[];setQuery({take:20,skip:0});}}>重置</Button>
  </form>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">正在读取审计记录…</p>}
  {data&&<><ul className="wf-list ga-list">{data.items.map(item=><li key={item.id}><div className="ga-row"><div><strong>{item.actionLabel}</strong><p>{time(item.createdAt)} · {item.actorLabel}</p><p>对象：{item.objectId??'未记录可显示标识'}</p></div><Button aria-expanded={selected===item.id} aria-controls={'audit-'+item.id} onClick={()=>void open(item.id)}>{selected===item.id?'收起详情':'查看详情'}</Button></div>
   {selected===item.id&&<section id={'audit-'+item.id} className="ga-detail" aria-label="审计详情" aria-busy={detailBusy}>{detailBusy&&<p role="status">正在核对原记录…</p>}{detailError&&<p role="alert">{detailError}</p>}{detail&&<><dl><dt>操作</dt><dd>{detail.actionLabel}</dd><dt>结果</dt><dd>{detail.result}</dd><dt>证据状态</dt><dd>{detail.evidence.label}</dd>{detail.evidence.fields.map(x=><React.Fragment key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></React.Fragment>)}</dl>{detail.navigation&&<a href={detail.navigation.href}>{detail.navigation.label}</a>}<details><summary>记录标识</summary><p>{detail.id}</p><p>{detail.actionCode??'历史操作代码未记录'}</p></details></>}</section>}</li>)}</ul>
   {!data.items.length&&<p>没有符合条件的审计记录。</p>}<div className="ga-pagination"><span>共 {data.total} 条 · 第 {Math.floor(data.skip/data.take)+1} 页</span><Button disabled={busy||data.skip===0} onClick={()=>{const q=previousPages.current.pop();if(q)setQuery(q);}}>上一页</Button><Button disabled={busy||!data.nextCursor} onClick={()=>{previousPages.current.push(query);setQuery(q=>({...q,skip:q.skip+data.items.length,cursor:data.nextCursor}));}}>下一页</Button></div></>}
  <Button disabled={busy} onClick={()=>void load(query)}>刷新</Button>
 </section></div></main>;
}
