import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronRight, Search, X } from 'lucide-react';
import { PEOPLE, openResearcher } from './people.js';
import './style.css';

const DIRECTIONS = ['抑郁障碍', '焦虑障碍', '针灸治疗', '心理治疗', '神经影像', '神经调控'];
const REGIONS = ['北京', '上海', '长沙', '成都', '武汉'];
const ORGS = [...new Set(PEOPLE.map((person) => person.org))];
const ROLES = ['PI / 负责人', '临床研究者', '方法学研究者', '其他'];
const RANKS = ['博士生导师', '主任医师'];

function teamLine(person) {
  const org = person.org.split(' ')[0];
  const rest = person.teamName.startsWith(org) ? person.teamName.slice(org.length).trim() : person.teamName;
  return `${org} · ${rest}`;
}

function App() {
  const [showcase, setShowcase] = useState(true);
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [direction, setDirection] = useState('');
  const [region, setRegion] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [rank, setRank] = useState('');
  const [sort, setSort] = useState('相关性');
  const [page, setPage] = useState(1);

  const chips = showcase
    ? [['direction', '抑郁障碍'], ['region', '北京']]
    : [
      direction && ['direction', direction],
      region && ['region', region],
      org && ['org', org],
      role && ['role', role],
      rank && ['rank', rank],
    ].filter(Boolean);

  const rows = useMemo(() => {
    const matched = showcase ? PEOPLE : PEOPLE.filter((person) => {
      const text = `${person.name}${person.org}${person.tags.join('')}${person.summary}`;
      if (keyword && !text.includes(keyword.trim())) return false;
      if (direction && !person.tags.includes(direction)) return false;
      if (region && person.city !== region) return false;
      if (org && person.org !== org) return false;
      if (role && person.role !== role) return false;
      if (rank && !person.rank.includes(rank)) return false;
      return true;
    });
    return [...matched].sort((a, b) => {
      if (sort === '论文') return b.papers - a.papers;
      if (sort === '临床试验') return b.trials - a.trials;
      if (sort === '研究团队') return Number(Boolean(b.teamId)) - Number(Boolean(a.teamId));
      if (a.level !== b.level) return a.level === '高相关' ? -1 : 1;
      return 0;
    });
  }, [showcase, keyword, direction, region, org, role, rank, sort]);

  const total = showcase ? 1256 : rows.length;
  const pageCount = showcase ? 126 : Math.max(1, Math.ceil(rows.length / 10));
  const visible = showcase || page === 1 ? rows : [];

  const clearChip = (key) => {
    setShowcase(false);
    setPage(1);
    if (key === 'direction') setDirection('');
    if (key === 'region') setRegion('');
    if (key === 'org') setOrg('');
    if (key === 'role') setRole('');
    if (key === 'rank') setRank('');
    if (showcase && key === 'direction') setRegion('北京');
    if (showcase && key === 'region') setDirection('抑郁障碍');
  };

  const pick = (setter) => (event) => {
    setShowcase(false);
    setPage(1);
    setter(event.target.value);
  };

  return (
    <main className="platform-main scholar-board">
      <section className="scholar-filters">
        <label className="scholar-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索研究者姓名、机构、研究方向..." onKeyDown={(event) => { if (event.key === 'Enter') { setKeyword(query); setShowcase(false); setPage(1); } }} />
        </label>
        <button type="button" className="scholar-go" onClick={() => { setKeyword(query); setShowcase(false); setPage(1); }}>搜索</button>
        <select aria-label="研究方向" value="" onChange={pick(setDirection)}>
          <option value="" disabled>研究方向</option>
          {DIRECTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="地区" value="" onChange={pick(setRegion)}>
          <option value="" disabled>地区</option>
          {REGIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="当前机构" value="" onChange={pick(setOrg)}>
          <option value="" disabled>当前机构</option>
          {ORGS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="研究角色" value="" onChange={pick(setRole)}>
          <option value="" disabled>研究角色</option>
          {ROLES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="更多筛选" value="" onChange={pick(setRank)}>
          <option value="" disabled>更多筛选</option>
          {RANKS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="相关性">排序：相关性</option>
          <option value="论文">排序：论文</option>
          <option value="临床试验">排序：临床试验</option>
          <option value="研究团队">排序：研究团队</option>
        </select>
      </section>
      <div className="scholar-meta">
        <div className="scholar-chips">
          {chips.length > 0 && <span>已选：</span>}
          {chips.map(([key, label]) => <button key={key} type="button" onClick={() => clearChip(key)}>{label}<X size={12} /></button>)}
          {chips.length > 0 && <button type="button" className="scholar-clear" onClick={() => { setShowcase(false); setDirection(''); setRegion(''); setOrg(''); setRole(''); setRank(''); setKeyword(''); setQuery(''); setPage(1); }}>清除全部</button>}
        </div>
        <b>共 {total.toLocaleString('zh-CN')} 位研究者</b>
      </div>
      <div className="scholar-list">
        {visible.map((person) => (
          <article key={person.id} className="scholar-card">
            <img src={person.photo} alt="" />
            <div>
              <header>
                <h2>{person.name}</h2>
                <em className={person.level === '高相关' ? 'hot' : ''}>{person.level}</em>
              </header>
              <p className="scholar-org">{person.org}　{person.rank}</p>
              <p>{person.summary}</p>
              <div className="scholar-tags">{person.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <p className="scholar-team">当前主要研究团队　<button type="button" onClick={(event) => { event.stopPropagation(); window.location.assign(`/pages/t02/?team=${person.teamId}`); }}>{teamLine(person)}</button></p>
            </div>
            <aside>
              <div className="scholar-nums">
                <p><b>{person.papers}</b><small>论文</small></p>
                <p><b>{person.trials}</b><small>临床试验</small></p>
                <p><b>{person.teamId ? 1 : 0}</b><small>研究团队</small></p>
              </div>
              <button type="button" onClick={(event) => { event.stopPropagation(); openResearcher(person.id); }}>查看详情<ChevronRight size={14} /></button>
            </aside>
          </article>
        ))}
        {visible.length === 0 && <p className="scholar-empty">{page > 1 ? '当前示例只列出第 1 页。' : '没有符合条件的研究者。'}</p>}
      </div>
      <footer className="scholar-page">
        <span>共 {total.toLocaleString('zh-CN')} 条</span>
        <div>
          {[1, 2, 3].filter((item) => item <= pageCount).map((item) => <button key={item} type="button" className={page === item ? 'on' : ''} onClick={() => setPage(item)}>{item}</button>)}
          {pageCount > 4 && <em>...</em>}
          {pageCount > 3 && <button type="button" className={page === pageCount ? 'on' : ''} onClick={() => setPage(pageCount)}>{pageCount}</button>}
        </div>
        <label>10 条/页</label>
        <label>前往<input value={page} onChange={(event) => setPage(Math.min(pageCount, Math.max(1, Number(event.target.value) || 1)))} /></label>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
