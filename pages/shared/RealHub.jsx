import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookOpen, ChevronRight, Search } from 'lucide-react';
import { hubRequest } from '../../src/hub-api.js';
import HubRegistryPreview from './HubRegistryPreview.jsx';
import { hubSourceRequest } from '../../src/hub-source-api.js';
import { createAuthClient } from '../../src/auth-session.js';
import './real-hub.css';
import HubTeamMap from './HubTeamMap.jsx';
import HubMetrics from './HubMetrics.jsx';
import HubSourceCatalog from './HubSourceCatalog.jsx';
import {AcademicDirectory} from './AcademicDirectory.jsx';

const hubHref = key => `/pages/h01/?hubKey=${encodeURIComponent(key)}`;
const errorText = error => error?.status === 403 ? '当前账号无权访问此领域。'
  : error?.status === 404 ? '该领域尚未开放。' : '读取失败，请稍后重试。';

export function RealHubDirectory() {
  const auth = useRef(createAuthClient({ tenantSlug: import.meta.env.VITE_AUTH_TENANT_SLUG }));
  const account = useRef(null);
  const epoch = useRef(0);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [directoryScope,setDirectoryScope]=useState('all');
  const [follow, setFollow] = useState({});
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const reload = () => {
    epoch.current += 1; account.current = null;
    setError(''); setItems(null); setFollow({});
    hubRequest('').then(data => setItems(data.items || [])).catch(e => setError(errorText(e)));
  };
  useEffect(reload, []);
  useEffect(() => {
    if (!items) return;
    let active = true;
    const refresh = async () => {
      const token = ++epoch.current;
      account.current = null; setFollow({});
      const me = await auth.current.me().catch(() => null);
      if (!active || token !== epoch.current) return;
      account.current = me?.accountId || null;
      if (!me) { setFollow(Object.fromEntries(items.map(item => [item.key, null]))); return; }
      const entries = await Promise.all(items.map(item => hubRequest(`/${encodeURIComponent(item.key)}/follow`)
        .then(data => [item.key, data.followed]).catch(() => [item.key, null])));
      const current = await auth.current.me().catch(() => null);
      if (active && token === epoch.current && current?.accountId === me.accountId)
        setFollow(Object.fromEntries(entries));
      else if (active && token === epoch.current) { account.current = null; setFollow({}); }
    };
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; epoch.current += 1; window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible); };
  }, [items]);
  async function toggle(item) {
    if (saving || follow[item.key] == null) return;
    const me = await auth.current.me().catch(() => null);
    if (!me || me.accountId !== account.current) {
      account.current = null; setFollow({}); setNotice('身份已变化，请刷新领域目录后重试。'); return;
    }
    const token = epoch.current;
    setSaving(item.key); setNotice('');
    try {
      const data = await hubRequest(`/${encodeURIComponent(item.key)}/follow`, {
        method: 'PUT', body: JSON.stringify({ followed: !follow[item.key] }),
      });
      const current = await auth.current.me().catch(() => null);
      if (token === epoch.current && current?.accountId === me.accountId)
        setFollow(previous => ({ ...previous, [item.key]: data.followed }));
      else { account.current = null; setFollow({}); setNotice('身份已变化，请刷新领域目录后重试。'); }
    } catch (e) { setNotice(errorText(e)); }
    finally { setSaving(''); }
  }
  const shown = items?.filter(item => `${item.name} ${item.summary}`.toLowerCase().includes(query.trim().toLowerCase())&&(directoryScope!=='followed'||follow[item.key]===true));
  return <main className="platform-main real-hub"><div className="content hub-home">
    <div className="hub-stats"><button type="button" className="stat" disabled><BookOpen/><span><b>—</b><small>我负责的 Hub（暂不可用）</small></span></button><button type="button" className="stat" disabled><BookOpen/><span><b>—</b><small>我参与的 Hub（暂不可用）</small></span></button><button type="button" className={'stat '+(directoryScope==='followed'?'on':'')} onClick={()=>setDirectoryScope(value=>value==='all'?'followed':'all')}><Bookmark/><span><b>{items&&items.every(item=>typeof follow[item.key]==='boolean')?items.filter(item=>follow[item.key]).length:'—'}</b><small>关注的 Hub（当前目录）</small></span></button><button type="button" className="create-hub" disabled>＋ 创建 Research Hub（暂不可用）</button></div>
    <div className="hub-toolbar"><label className="hub-search"><Search size={18} /><input aria-label="搜索研究领域" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 Research Hub" /></label>{['全部领域','全部状态','排序'].map(label=><div className="hub-select" key={label}><button type="button" disabled>{label}（暂不可用）</button></div>)}</div>
    {items === null && !error && <p role="status" className="real-hub-state">正在读取领域目录…</p>}
    {error && <div role="alert" className="real-hub-state">{error} <button type="button" onClick={reload}>重试</button></div>}
    {shown?.length === 0 && <p role="status" className="real-hub-state">{query ? '没有符合条件的领域。' : '当前没有已启用的领域。'}</p>}
    <section className="hub-block"><header><h2>我负责的 Research Hub（暂不可用）</h2></header><div className="card-grid two"><p className="hub-empty">当前无法查询负责人关系。</p></div></section>
    <section className="hub-block"><header><h2>我参与的 Research Hub（暂不可用）</h2></header><div className="card-grid three"><p className="hub-empty">参与关系暂不可查询；关注不等于加入私有研究。</p></div></section>
    <section className="hub-block"><header><h2>{directoryScope==='followed'?'当前已关注':'全部'} Research Hub（{shown?.length??'—'}）</h2><button className="text-link" type="button" onClick={()=>setDirectoryScope('all')}>查看全部</button></header><div className="table-wrap"><table><thead><tr>{['领域名称','研究方向','负责人','成员数','研究数','文献数','更新日期','状态','操作'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{shown?.map(item=><tr key={item.key}><td><a className="name-btn" href={hubHref(item.key)}>{item.name}</a></td><td>{item.summary}</td>{['owner','members','studies','papers','updated'].map(key=><td key={key}>未提供</td>)}<td>当前已启用<br/>范围{item.scopeStatus==='confirmed'?'已确认':'待专家确认'}</td><td className="ops"><a href={hubHref(item.key)}>进入</a><button type="button" disabled={saving===item.key||follow[item.key]==null} onClick={()=>toggle(item)}>{follow[item.key]===undefined?'核验中':follow[item.key]===null?'登录后关注':follow[item.key]?'取消关注':'关注'}</button></td></tr>)}</tbody></table></div></section>
    {notice && <p role="alert" className="real-hub-state">{notice}</p>}
  </div></main>;
}

export function RealHubOverview() {
  if(new URLSearchParams(location.search).has('section')||new URLSearchParams(location.search).has('contentId'))return <AcademicDirectory/>;
  return <HubOverviewContent/>;
}
function HubOverviewContent() {
  const key = new URLSearchParams(location.search).get('hubKey') || 'lingshu-xinyu';
  const [hub, setHub] = useState(null);
  const [sources, setSources] = useState(null);
  const [reviewedCount, setReviewedCount] = useState(null);
  const [external, setExternal] = useState(null);
  const [registries,setRegistries]=useState(null);
  const [error, setError] = useState('');
  const [trend,setTrend]=useState('研究数量');
  const [metrics,setMetrics]=useState(null);
  const overviewEpoch=useRef(0);
  const reload = () => {
    const epoch=++overviewEpoch.current;
    setMetrics(null);
    setError(''); setHub(null); setSources(null); setExternal(null); setRegistries(null);setReviewedCount(null);
    Promise.all([hubRequest(`/${encodeURIComponent(key)}/overview`),
      key === 'lingshu-xinyu' ? hubSourceRequest('external-documents') : Promise.resolve({ items: [] })])
      .then(([data, documents]) => { if(epoch!==overviewEpoch.current)return; setMetrics(data.metrics);setHub(data.hub); setSources(data.reviewedSources || []);
        setReviewedCount(data.reviewedSourceRecordCount); setExternal(documents.items || []);setRegistries(data.clinicalRegistries||[]); })
      .catch(e => {if(epoch===overviewEpoch.current)setError(errorText(e));});
  };
  useEffect(()=>{reload();return()=>{overviewEpoch.current+=1;};}, [key]);
  return <main className="platform-main real-hub hub-board"><div className="content hub-board">
    {error && <div role="alert" className="real-hub-state">{error} <button type="button" onClick={reload}>重试</button></div>}
    {!hub && !error && <p role="status" className="real-hub-state">正在读取领域数据…</p>}
    <>
      <HubMetrics metrics={metrics} loading={!hub&&!error} error={!!error}/>
      <section className="hub-grid"><article className="hub-card"><header><h2>临床注册趋势</h2><div className="hub-switch" role="tablist" aria-label="趋势维度">{['研究数量','疾病','研究设计','干预'].map(label=><button role="tab" type="button" key={label} aria-selected={trend===label} className={trend===label?'on':''} onClick={()=>setTrend(label)}>{label}</button>)}</div></header><div className="hub-trend-body"><p className="real-hub-state">{trend}趋势尚无完整核验口径，不根据当前少量来源推断全域分布。</p></div></article><HubTeamMap hubKey={key}/>
      <HubSourceCatalog sources={sources} recordCount={reviewedCount} error={!!error}/></section>
      {key==='lingshu-xinyu'&&<AcademicDirectory compact/>}
      <section className="hub-grid hub-lower"><HubRegistryPreview items={registries} error={!!error}/><article className="hub-card"><header><h2>活跃研究者 / 学者</h2><button disabled>查看全部</button></header><p className="real-hub-state">研究者活跃度尚未核验。</p></article>
      <article className="hub-card real-hub-external"><header><h2>领域观察</h2></header><p className="real-hub-muted">尚无真实 AI 观察。下方保留已审核标准与指南目录，非自动生成观点。</p>
        {external?.some(item=>item.documentType!=='clinical_registry') ? <ul className="real-hub-sources">{external.filter(item=>item.documentType!=='clinical_registry').map(item => <li key={item.documentId}>
          <strong><a href="/pages/h06/">{item.title}</a></strong><small>{item.documentType === 'research_standard' ? '研究标准' : '临床指南'} · {item.externalKey}</small>
          <span>原始疾病：{item.sourceTargetCondition || '未标注'} · 来源：{item.sourceName}</span>
          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看原始来源</a>}
        </li>)}</ul> : <p role="status" className="real-hub-state">暂无获准公开的临床注册、标准或指南。暂存文件和未获准字段不会展示或进入 AI 检索。</p>}
      </article></section>
    </>
  </div></main>;
}
