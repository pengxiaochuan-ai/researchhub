import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark, BookOpen, Box, ChevronDown, ChevronRight, FileText, Folder,
  MoreHorizontal, Plus, Search, Users,
} from 'lucide-react';
import { goToPage } from '../../src/platform-navigation.js';
import './hub-home.css';

const hubs = [
  { id: 'emotion', name: '针灸治疗情志病', key: true, status: '活跃', relation: 'owner', followed: true, domain: '情志病', summary: '聚焦针灸在焦虑、抑郁、失眠等情志病中的临床疗效与作用机制研究。', direction: '焦虑、抑郁、失眠等情志病的临床疗效与作用机制研究', owner: '王教授', org: '北京中医药大学', members: 12, studies: 8, papers: 320, assets: 56, updated: '2024-07-18', page: 'h01' },
  { id: 'sleep', name: '针灸治疗失眠', status: '活跃', relation: 'member', followed: true, domain: '失眠', summary: '围绕针灸改善睡眠障碍的临床研究…', direction: '睡眠障碍的临床研究与基础机制', owner: '李教授', org: '上海中医药大学', members: 12, studies: 6, papers: 280, updated: '2024-07-12', page: 'h01' },
  { id: 'anxiety', name: '针灸治疗焦虑障碍', status: '参与中', relation: 'member', followed: true, domain: '焦虑', summary: '聚焦针灸干预焦虑障碍的临床研究…', direction: '焦虑障碍的临床研究与神经机制', owner: '陈教授', org: '广州中医药大学', members: 15, studies: 4, papers: 160, updated: '2024-07-08', page: 'h01' },
  { id: 'axis', name: '针灸与脑-肠轴调节', status: '活跃', relation: 'owner', followed: true, domain: '脑-肠轴', summary: '探索针灸调节脑-肠轴的基础与临床研究。', direction: '针灸调节脑-肠轴的基础与临床研究', owner: '王教授', org: '北京中医药大学', members: 8, studies: 5, papers: 210, assets: 28, updated: '2024-07-16', page: 'h01' },
  { id: 'depression', name: '针灸治疗抑郁障碍', status: '参与中', relation: 'member', followed: true, domain: '抑郁', summary: '围绕针灸治疗抑郁障碍的临床疗效…', direction: '抑郁障碍的临床疗效与随访研究', owner: '周教授', org: '成都中医药大学', members: 10, studies: 5, papers: 190, updated: '2024-07-05', page: 'h01' },
  { id: 'combine', name: '针药结合治疗抑郁症', status: '参与中', relation: 'member', followed: true, domain: '抑郁', summary: '比较针药结合与单用药物对抑郁症的临床研究。', direction: '针药结合与药物治疗的比较研究', owner: '赵教授', org: '南京中医药大学', members: 9, studies: 3, papers: 96, updated: '2024-06-28', page: 'h01' },
  { id: 'evidence', name: '中医情志病循证评价', status: '活跃', relation: 'member', followed: true, domain: '情志病', summary: '汇总情志病中医与针灸证据，形成可复用的评价框架。', direction: '情志病证据评价与方法学研究', owner: '孙教授', org: '天津中医药大学', members: 11, studies: 4, papers: 140, updated: '2024-06-20', page: 'h01' },
  { id: 'stroke', name: '针灸治疗中风后抑郁', status: '活跃', relation: 'catalog', followed: true, domain: '抑郁', summary: '关注中风后抑郁的针灸干预与康复路径。', direction: '中风后抑郁的临床康复研究', owner: '吴教授', org: '浙江中医药大学', members: 14, studies: 5, papers: 176, updated: '2024-06-18', page: 'h01' },
  { id: 'patch', name: '穴位贴敷与情志调节', status: '活跃', relation: 'catalog', followed: false, domain: '情志病', summary: '探索穴位贴敷对情志症状的辅助干预。', direction: '穴位贴敷的情志调节作用', owner: '郑教授', org: '山东中医药大学', members: 7, studies: 2, papers: 64, updated: '2024-06-11', page: 'h01' },
  { id: 'meno', name: '围绝经期情绪障碍', status: '参与中', relation: 'catalog', followed: false, domain: '情志病', summary: '围绕围绝经期情绪障碍的针灸临床观察。', direction: '围绝经期情绪障碍的临床观察', owner: '何教授', org: '湖南中医药大学', members: 13, studies: 3, papers: 88, updated: '2024-06-02', page: 'h01' },
  { id: 'pain', name: '针灸镇痛与情绪共病', status: '活跃', relation: 'catalog', followed: false, domain: '疼痛', summary: '研究慢性疼痛与情绪共病中的针灸干预。', direction: '慢性疼痛与情绪共病', owner: '冯教授', org: '辽宁中医药大学', members: 16, studies: 6, papers: 204, updated: '2024-05-26', page: 'h01' },
  { id: 'child', name: '儿童抽动与情志调摄', status: '活跃', relation: 'catalog', followed: false, domain: '儿科', summary: '整理儿童抽动障碍中针灸与情志调摄的证据。', direction: '儿童抽动与情志调摄', owner: '韩教授', org: '河南中医药大学', members: 6, studies: 2, papers: 42, updated: '2024-05-14', page: 'h01' },
];

const domains = ['所有研究领域', ...new Set(hubs.map((hub) => hub.domain))];
const statuses = ['所有状态', '活跃', '参与中'];
const sorts = ['默认排序', '最近更新', '成员数', '文献数'];

function matchesQuery(hub, query) {
  const text = `${hub.name}${hub.summary}${hub.direction}${hub.domain}${hub.owner}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

function Status({ value }) {
  return <span className={value === '活跃' ? 'badge ok' : 'badge mid'}>{value}</span>;
}

function Cover({ name }) {
  return <span className={`cover cover-${name.length % 4}`} aria-hidden="true"><BookOpen size={16} /></span>;
}

export function HubHome() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState(domains[0]);
  const [status, setStatus] = useState(statuses[0]);
  const [sort, setSort] = useState(sorts[0]);
  const [scope, setScope] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const [followed, setFollowed] = useState(() => new Set(hubs.filter((hub) => hub.followed).map((hub) => hub.id)));
  const [expanded, setExpanded] = useState({ owner: false, member: false, table: false });

  useEffect(() => {
    const close = () => setOpenMenu('');
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const filtered = useMemo(() => {
    const list = hubs.filter((hub) => {
      if (query && !matchesQuery(hub, query)) return false;
      if (domain !== domains[0] && hub.domain !== domain) return false;
      if (status !== statuses[0] && hub.status !== status) return false;
      if (scope === 'owner' && hub.relation !== 'owner') return false;
      if (scope === 'member' && hub.relation !== 'member') return false;
      if (scope === 'followed' && !followed.has(hub.id)) return false;
      return true;
    });
    const ranked = [...list];
    if (sort === '最近更新') ranked.sort((a, b) => b.updated.localeCompare(a.updated));
    if (sort === '成员数') ranked.sort((a, b) => b.members - a.members);
    if (sort === '文献数') ranked.sort((a, b) => b.papers - a.papers);
    return ranked;
  }, [query, domain, status, sort, scope, followed]);

  const owned = filtered.filter((hub) => hub.relation === 'owner');
  const joined = filtered.filter((hub) => hub.relation === 'member');
  const ownedShown = expanded.owner ? owned : owned.slice(0, 2);
  const joinedShown = expanded.member ? joined : joined.slice(0, 3);
  const tableShown = expanded.table ? filtered : filtered.slice(0, 3);
  const counts = {
    owner: hubs.filter((hub) => hub.relation === 'owner').length,
    member: hubs.filter((hub) => hub.relation === 'member').length,
    followed: followed.size,
  };

  const toggleScope = (next) => setScope((current) => (current === next ? '' : next));
  const toggleFollow = (id) => setFollowed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <main className="platform-main">
    <div className="content hub-home">
      <div className="hub-stats">
        <button type="button" className={scope === 'owner' ? 'stat on' : 'stat'} onClick={() => toggleScope('owner')}><Box size={18} /><span><b>{counts.owner}</b><small>我负责的 Hub</small></span><ChevronRight size={16} /></button>
        <button type="button" className={scope === 'member' ? 'stat on' : 'stat'} onClick={() => toggleScope('member')}><Users size={18} /><span><b>{counts.member}</b><small>我参与的 Hub</small></span><ChevronRight size={16} /></button>
        <button type="button" className={scope === 'followed' ? 'stat on' : 'stat'} onClick={() => toggleScope('followed')}><Bookmark size={18} /><span><b>{counts.followed}</b><small>关注的 Hub</small></span><ChevronRight size={16} /></button>
        <button type="button" className="create-hub" onClick={() => goToPage('h02')}><Plus size={16} /> 创建 Research Hub</button>
      </div>

      <div className="hub-toolbar">
        <label className="hub-search"><Search size={16} /><input value={query} placeholder="搜索 Research Hub（如：情志病、失眠、焦虑、穴位机制...）" onChange={(event) => setQuery(event.target.value)} /></label>
        <Select label={domain} options={domains} onPick={setDomain} />
        <Select label={status} options={statuses} onPick={setStatus} />
        <Select label={sort} options={sorts} onPick={setSort} />
      </div>

      {scope !== 'member' && <Section title="我负责的 Research Hub" count={owned.length} expanded={expanded.owner} onToggle={() => { setScope('owner'); setExpanded((current) => ({ ...current, table: true })); }} canToggle>
        <div className="card-grid two">{ownedShown.map((hub) => <HubCard key={hub.id} hub={hub} followed={followed.has(hub.id)} menu={openMenu} setMenu={setOpenMenu} onFollow={toggleFollow} showAssets />)}</div>
        {owned.length === 0 && <p className="hub-empty">没有符合条件的负责 Hub。</p>}
      </Section>}

      {scope !== 'owner' && <Section title="我参与的 Research Hub" count={joined.length} expanded={expanded.member} onToggle={() => setExpanded((current) => ({ ...current, member: !current.member }))} canToggle={joined.length > 3}>
        <div className="card-grid three">{joinedShown.map((hub) => <HubCard key={hub.id} hub={hub} followed={followed.has(hub.id)} menu={openMenu} setMenu={setOpenMenu} onFollow={toggleFollow} />)}</div>
        {joined.length === 0 && <p className="hub-empty">没有符合条件的参与 Hub。</p>}
      </Section>}

      <section className="hub-block">
        <header><h2>全部 Research Hub（{filtered.length}）</h2>{filtered.length > 3 && <button type="button" className="text-link" onClick={() => setExpanded((current) => ({ ...current, table: !current.table }))}>{expanded.table ? '收起' : '查看全部'}</button>}</header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>领域名称</th><th>研究方向</th><th>负责人</th><th>成员数</th><th>研究数</th><th>文献数</th><th>更新日期</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {tableShown.map((hub) => <tr key={hub.id}>
                <td><button type="button" className="name-btn" onClick={() => goToPage(hub.page)}><Cover name={hub.name} /><span><b>{hub.name}</b>{hub.key && <em>重点领域</em>}</span></button></td>
                <td>{hub.direction}</td>
                <td><span className="person"><i>{hub.owner.slice(0, 1)}</i><span><b>{hub.owner}</b><small>{hub.org}</small></span></span></td>
                <td>{hub.members}</td>
                <td>{hub.studies}</td>
                <td>{hub.papers}</td>
                <td>{hub.updated}</td>
                <td><Status value={hub.status} /></td>
                <td className="ops"><button type="button" className="enter" onClick={() => goToPage(hub.page)}>进入</button><MenuButton id={hub.id} open={openMenu} setOpen={setOpenMenu} followed={followed.has(hub.id)} onFollow={toggleFollow} onOpen={() => goToPage(hub.page)} /></td>
              </tr>)}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="hub-empty">没有符合条件的 Research Hub。</p>}
        </div>
      </section>
    </div>
  </main>;
}

function Section({ title, count, expanded, onToggle, canToggle, children }) {
  return <section className="hub-block">
    <header><h2>{title}（{count}）</h2>{canToggle && <button type="button" className="text-link" onClick={onToggle}>{expanded ? '收起' : '查看全部'}</button>}</header>
    {children}
  </section>;
}

function Select({ label, options, onPick }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return <div className="hub-select">
    <button type="button" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>{label} <ChevronDown size={16} /></button>
    {open && <ul>{options.map((option) => <li key={option}><button type="button" className={option === label ? 'on' : ''} onClick={() => { onPick(option); setOpen(false); }}>{option}</button></li>)}</ul>}
  </div>;
}

function HubCard({ hub, followed, menu, setMenu, onFollow, showAssets }) {
  return <article className="hub-card">
    <button type="button" className="card-main" onClick={() => goToPage(hub.page)}>
      <Cover name={hub.name} />
      <span>
        <b>{hub.name} {hub.key && <em>重点领域</em>}</b>
        <small>{hub.summary}</small>
      </span>
    </button>
    <div className="card-side">
      <Status value={hub.status} />
      <MenuButton id={hub.id} open={menu} setOpen={setMenu} followed={followed} onFollow={onFollow} onOpen={() => goToPage(hub.page)} />
    </div>
    <div className="card-meta">
      <span><Users size={14} /> 成员 {hub.members}</span>
      <span><BookOpen size={14} /> 研究 {hub.studies}</span>
      <span><FileText size={14} /> 文献 {hub.papers}</span>
      {showAssets && <span><Folder size={14} /> 资产 {hub.assets}</span>}
    </div>
    <button type="button" className="card-go" aria-label={`进入${hub.name}`} onClick={() => goToPage(hub.page)}><ChevronRight size={16} /></button>
  </article>;
}

function MenuButton({ id, open, setOpen, followed, onFollow, onOpen }) {
  return <span className="menu-wrap">
    <button type="button" className="icon-btn" aria-label="更多操作" onClick={(event) => { event.stopPropagation(); setOpen(open === id ? '' : id); }}><MoreHorizontal size={16} /></button>
    {open === id && <ul onClick={(event) => event.stopPropagation()}>
      <li><button type="button" onClick={onOpen}>进入 Hub</button></li>
      <li><button type="button" onClick={() => { onFollow(id); setOpen(''); }}>{followed ? '取消关注' : '关注'}</button></li>
    </ul>}
  </span>;
}
