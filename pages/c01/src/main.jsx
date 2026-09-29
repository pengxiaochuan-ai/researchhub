import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FilterBar, STUDIES, ViewTabs, diseaseTone, matchStudy, methodTone, useRegistryState } from './chrome.jsx';
import { MapView } from '../../c02/src/main.jsx';
import { TrendView } from './trend-view.jsx';
import './style.css';

function initialView() {
  if (window.location.hash === '#map') return 'map';
  if (window.location.hash === '#trend') return 'trend';
  return 'list';
}

function App() {
  const registry = useRegistryState();
  const [view, setView] = useState(initialView);
  const [page, setPage] = useState(1);
  const openView = (next) => {
    setView(next);
    const hash = next === 'list' ? '' : `#${next}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
  };
  const rows = useMemo(() => {
    const matched = STUDIES.filter((item) => matchStudy(item, registry.query, registry.filters));
    return [...matched].sort((a, b) => {
      if (registry.sort === '更新时间') return b.updated.localeCompare(a.updated);
      if (registry.sort === '注册号') return b.code.localeCompare(a.code);
      return 0;
    });
  }, [registry.query, registry.filters, registry.sort]);
  const filtering = registry.query.trim() || Object.values(registry.filters).some((value) => value !== '全部');
  const visible = filtering ? rows : STUDIES;
  const show = (key) => !registry.hidden.has(key);

  return (
    <main className="platform-main reg-board">
      <div className="reg-view-row">
        <ViewTabs view={view} onChange={openView} />
        {view === 'trend' && <p className="trend-scope">当前筛选条件下：共 <b>68</b> 项研究 · 涉及 <b>24</b> 家机构 · 覆盖 <b>12</b> 个城市</p>}
      </div>
      {view !== 'trend' && <FilterBar {...registry} resultCount={filtering ? rows.length : 64} />}
      {view === 'map' && <MapView registry={registry} onMore={() => openView('list')} />}
      {view === 'trend' && <TrendView />}
      {view === 'list' && (
        <section className="reg-panel">
          <div className="reg-table-wrap">
            <table>
              <thead>
                <tr>
                  {show('title') && <th>研究题目</th>}
                  {show('code') && <th>注册号</th>}
                  {show('type') && <th>研究类型</th>}
                  {show('disease') && <th>主要疾病</th>}
                  {show('method') && <th>干预方式</th>}
                  {show('org') && <th>牵头机构</th>}
                  {show('city') && <th>城市</th>}
                  {show('status') && <th>研究状态</th>}
                  {show('recruit') && <th>招募状态</th>}
                  {show('dates') && <th className="wrap">首次公示 / 更新时间</th>}
                  {show('source') && <th>来源</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.code}>
                    {show('title') && <td className="reg-title" title={item.title}><span>{item.title}</span></td>}
                    {show('code') && <td className="reg-code">{item.code}</td>}
                    {show('type') && <td>{item.type}</td>}
                    {show('disease') && <td><em className={`tag ${diseaseTone(item.disease)}`}>{item.disease}</em></td>}
                    {show('method') && <td className="reg-methods">{item.methods.map((name) => <em key={name} className={`tag ${methodTone(name)}`}>{name}</em>)}</td>}
                    {show('org') && <td className="reg-org" title={item.org}><span>{item.org}</span></td>}
                    {show('city') && <td>{item.city}</td>}
                    {show('status') && <td><em className={`status ${item.status}`}>{item.status}</em></td>}
                    {show('recruit') && <td><em className={`status ${item.recruit}`}>{item.recruit}</em></td>}
                    {show('dates') && <td className="reg-dates"><span>{item.published}</span><span>{item.updated}</span></td>}
                    {show('source') && <td className="reg-sources">{item.sources.map((source) => <span key={source}>{source}</span>)}</td>}
                    <td className="reg-ops"><button type="button" className="reg-open">查看方案</button><button type="button" aria-label="更多操作">···</button></td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={12}>没有符合当前条件的注册研究。</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="reg-pager">
            <span>共 {filtering ? visible.length : 64} 项研究</span>
            <label>每页 <select aria-label="每页条数" defaultValue="10"><option>10</option></select></label>
            <div>
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="上一页">‹</button>
              {[1, 2, 3, 4, 5, 6, 7].map((item) => <button key={item} type="button" className={item === page ? 'on' : ''} onClick={() => setPage(item)}>{item}</button>)}
              <button type="button" disabled={page === 7} onClick={() => setPage((value) => value + 1)} aria-label="下一页">›</button>
            </div>
          </footer>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
