import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, FileText, Link2, Search, Sparkles, Star } from 'lucide-react';
import './style.css';

const PAPERS = [
  {
    id: 'jama',
    title: 'Efficacy of Acupuncture for Major Depressive Disorder: A Systematic Review and Meta-analysis of Randomized Controlled Trials',
    tags: [['系统综述', ''], ['Meta分析', ''], ['高相关', 'hot']],
    authors: 'Li X, Zhang Y, Wang L, et al.',
    journal: 'JAMA Psychiatry',
    date: '2023-09',
    vol: 'Vol. 80 (9)',
    pages: 'Pages 921–931',
    impact: 'IF 25.1',
    quartile: 'Q1',
    cites: 328,
    full: true,
    blurb: 'Background: Acupuncture has been increasingly used for major depressive disorder (MDD)...',
  },
  {
    id: 'zh',
    title: '针灸治疗抑郁症的随机对照试验系统评价',
    tags: [['系统综述', ''], ['Meta分析', '']],
    authors: '王芳, 李明, 陈晓, 等',
    journal: '中华中医药杂志',
    date: '2023-05',
    extra: '北大核心',
    cites: 126,
    full: true,
    blurb: '针灸治疗抑郁症的随机对照试验与系统评价摘要信息...',
  },
  {
    id: 'lancet',
    title: 'Acupuncture versus Sham Acupuncture for Depression: A Randomized Clinical Trial',
    tags: [['RCT', '']],
    authors: 'Zhang Y, Chen H, Liu M, et al.',
    journal: 'The Lancet Regional Health – Western Pacific',
    date: '2022-11',
    vol: 'Vol. 12',
    impact: 'IF 11.6',
    quartile: 'Q1',
    cites: 215,
    full: true,
  },
  {
    id: 'front',
    title: 'Electroacupuncture for Depression: A Systematic Review of Randomized Controlled Trials',
    tags: [['系统综述', ''], ['Meta分析', '']],
    authors: 'Chen Q, Liu J, Xu K, et al.',
    journal: 'Frontiers in Psychiatry',
    date: '2022-08',
    vol: 'Vol. 13',
    impact: 'IF 5.4',
    cites: 98,
    full: true,
  },
  {
    id: 'bmc',
    title: 'The Long-term Effects of Acupuncture on Depressive Symptoms: A 12-Month Follow-up RCT',
    tags: [['RCT', '']],
    authors: 'Wang H, Zhao L, Sun Y, et al.',
    journal: 'BMC Complementary Medicine',
    date: '2021-06',
    vol: 'Vol. 21',
    impact: 'IF 4.2',
    cites: 76,
    full: false,
  },
];

const YEARS = [['不限', '12,345'], ['近 1 年', '523'], ['近 3 年', '1,320'], ['近 5 年', '2,856'], ['自定义范围', '']];
const TYPES = [['原创研究', '6,231'], ['系统综述 / Meta分析', '2,156'], ['综述', '1,032'], ['方法学研究', '486'], ['编辑评论', '328'], ['其他', '240']];
const DESIGNS = [['RCT', '3,456'], ['非随机对照', '892'], ['队列研究', '1,203'], ['病例对照研究', '654'], ['横断面研究', '486'], ['真实世界研究', '721'], ['其他', '328']];
const DISEASES = [['抑郁障碍', '3,456'], ['焦虑障碍', '1,203'], ['其他情志病', '892']];
const PEOPLE = [['成人', '2,341'], ['儿童与青少年', '420'], ['老年人', '695']];
const METHODS = [['针灸', '2,104'], ['针刺', '1,856'], ['电针', '942'], ['艾灸', '386'], ['耳穴', '214']];
const TABS = ['摘要', '研究设计', '主要结果', '引用网络', '相关研究'];
const TOPICS = ['针灸治疗', '抑郁症', '中医情志病', '随机对照试验', '有效性', '安全性'];

const EMPTY = { year: '不限', types: [], designs: [], diseases: [], people: [], methods: [] };
const APPLIED_PRESET = {
  year: '近 3 年',
  types: ['系统综述 / Meta分析'],
  designs: ['RCT'],
  diseases: ['抑郁障碍'],
  people: [],
  methods: ['针灸'],
};
const CHIP_LABEL = {
  '系统综述 / Meta分析': 'Meta分析',
  '近 1 年': '近1年',
  '近 3 年': '近3年',
  '近 5 年': '近5年',
};
const LIST_KEYS = ['diseases', 'methods', 'types', 'designs', 'people'];

function cloneFilters(filters) {
  return {
    year: filters.year,
    types: [...filters.types],
    designs: [...filters.designs],
    diseases: [...filters.diseases],
    people: [...filters.people],
    methods: [...filters.methods],
  };
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function listDiff(left, right) {
  const taken = new Set(right);
  let count = 0;
  left.forEach((item) => { if (!taken.has(item)) count += 1; });
  right.forEach((item) => { if (!left.includes(item)) count += 1; });
  return count;
}

function diffCount(draft, applied) {
  return (draft.year === applied.year ? 0 : 1) + LIST_KEYS.reduce((sum, key) => sum + listDiff(draft[key], applied[key]), 0);
}

function chipsOf(filters) {
  const chips = [];
  LIST_KEYS.forEach((key) => {
    filters[key].forEach((value) => chips.push({ key, value, label: CHIP_LABEL[value] || value }));
  });
  if (filters.year !== '不限') chips.push({ key: 'year', value: filters.year, label: CHIP_LABEL[filters.year] || filters.year });
  return chips;
}

function withoutChip(filters, chip) {
  const next = cloneFilters(filters);
  if (chip.key === 'year') next.year = '不限';
  else next[chip.key] = next[chip.key].filter((item) => item !== chip.value);
  return next;
}

function resultTotal(filters) {
  const chips = chipsOf(filters);
  if (chips.length === 0) return 3456;
  const signature = chips.map((chip) => `${chip.key}:${chip.value}`).join('|');
  const preset = chipsOf(APPLIED_PRESET).map((chip) => `${chip.key}:${chip.value}`).join('|');
  if (signature === preset) return 428;
  return chips.reduce((total, chip, index) => Math.max(36, Math.round(total * (0.62 - index * 0.03))), 3456);
}

function App() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(() => cloneFilters(APPLIED_PRESET));
  const [applied, setApplied] = useState(() => cloneFilters(APPLIED_PRESET));
  const [open, setOpen] = useState({ people: false, method: true, more: false });
  const [sort, setSort] = useState('相关性');
  const [view, setView] = useState('列表');
  const [selectedId, setSelectedId] = useState('jama');
  const [tab, setTab] = useState('摘要');
  const [lang, setLang] = useState('中文');
  const [saved, setSaved] = useState({});
  const [copied, setCopied] = useState(false);
  const [abstractOpen, setAbstractOpen] = useState(false);

  const rows = useMemo(() => {
    const text = query.trim();
    const matched = PAPERS.filter((paper) => !text || `${paper.title}${paper.authors}${paper.journal}`.includes(text));
    const sorted = [...matched];
    if (sort === '被引次数') sorted.sort((a, b) => b.cites - a.cites);
    if (sort === '发表时间') sorted.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [query, sort]);

  const selected = rows.find((paper) => paper.id === selectedId) || rows[0] || PAPERS[0];
  const changed = diffCount(draft, applied);
  const chips = chipsOf(applied);
  const total = resultTotal(applied);
  const setDraftList = (key, value) => setDraft((current) => ({ ...current, [key]: toggle(current[key], value) }));
  const removeChip = (chip) => {
    setApplied((current) => withoutChip(current, chip));
    setDraft((current) => withoutChip(current, chip));
  };

  const copyCite = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="platform-main paper-board">
      <div className="paper-work">
        <aside className="paper-filters">
          <div className="paper-filter-scroll">
            <div className="paper-filter-title"><b>筛选条件</b></div>
            <label className="paper-find">
              <Search size={14} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在结果中搜索标题、作者、期刊、关键词..." />
            </label>
            <FilterRadio title="发表年份" value={draft.year} rows={YEARS} onChange={(year) => setDraft((current) => ({ ...current, year }))} />
            <div className="paper-dates"><span>开始日期</span><span>结束日期</span></div>
            <FilterCheck title="文献类型" rows={TYPES} picked={draft.types} onToggle={(value) => setDraftList('types', value)} />
            <FilterCheck title="研究设计" rows={DESIGNS} picked={draft.designs} onToggle={(value) => setDraftList('designs', value)} />
            <Fold title="研究对象（人群）" expanded={open.people} onToggle={() => setOpen((current) => ({ ...current, people: !current.people }))}>
              <FilterCheck rows={PEOPLE} picked={draft.people} onToggle={(value) => setDraftList('people', value)} />
            </Fold>
            <Fold title="干预方式" expanded={open.method} onToggle={() => setOpen((current) => ({ ...current, method: !current.method }))}>
              <FilterCheck rows={METHODS} picked={draft.methods} onToggle={(value) => setDraftList('methods', value)} />
            </Fold>
            <FilterCheck title="疾病/研究领域" rows={DISEASES} picked={draft.diseases} onToggle={(value) => setDraftList('diseases', value)} />
            <Fold title="更多筛选" expanded={open.more} onToggle={() => setOpen((current) => ({ ...current, more: !current.more }))}>
              <p className="paper-more">全文可获取、语言和期刊分区可在这一组继续收窄。</p>
            </Fold>
          </div>
          <footer className="paper-filter-foot">
            {changed > 0 ? (
              <>
                <p>已修改 {changed} 项筛选条件</p>
                <div>
                  <button type="button" onClick={() => setDraft(cloneFilters(applied))}>重置</button>
                  <button type="button" className="paper-apply" onClick={() => setApplied(cloneFilters(draft))}>应用筛选</button>
                </div>
              </>
            ) : (
              <>
                <p>当前已应用 {chips.length} 项条件</p>
                <div>
                  <button type="button" onClick={() => { setDraft(cloneFilters(EMPTY)); setApplied(cloneFilters(EMPTY)); }} disabled={chips.length === 0}>清空全部</button>
                </div>
              </>
            )}
          </footer>
        </aside>
        <section className="paper-list">
          <header>
            <div className="paper-list-bar">
            <b>找到 {total.toLocaleString('en-US')} 篇论文</b>
            <label>排序
              <select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option>相关性</option>
                <option>被引次数</option>
                <option>发表时间</option>
              </select>
            </label>
            <div className="paper-views">
              <button type="button" className={view === '列表' ? 'on' : ''} onClick={() => setView('列表')}>列表</button>
              <button type="button" className={view === '图表' ? 'on' : ''} onClick={() => setView('图表')}>图表</button>
            </div>
            </div>
            {chips.length > 0 && (
              <div className="paper-chips">
                {chips.map((chip) => (
                  <button key={`${chip.key}:${chip.value}`} type="button" onClick={() => removeChip(chip)}>{chip.label} ×</button>
                ))}
              </div>
            )}
          </header>
          {view === '列表' ? (
            <div className="paper-rows">
              {rows.map((paper, index) => (
                <article key={paper.id} className={selected?.id === paper.id ? 'on' : ''} onClick={() => { setSelectedId(paper.id); setTab('摘要'); }}>
                  <span className="paper-check" aria-hidden="true" />
                  <b className="paper-index">{index + 1}.</b>
                  <div>
                    <h2 className="ptitle">{paper.title}{paper.tags.map(([label, kind]) => <em key={label} className={kind}>{label}</em>)}</h2>
                    <p>{paper.authors}</p>
                    <p className="paper-meta">
                      <span>{paper.journal}</span>
                      <span>{paper.date}</span>
                      {paper.vol && <span>{paper.vol}</span>}
                      {paper.pages && <span>{paper.pages}</span>}
                      {paper.impact && <span className="brand">{paper.impact}</span>}
                      {paper.quartile && <span className="brand">{paper.quartile}</span>}
                      {paper.extra && <span>{paper.extra}</span>}
                    </p>
                    {paper.blurb && <p className="paper-blurb">{paper.blurb}</p>}
                    <div className="paper-acts">
                      <span><FileText size={12} />PDF</span>
                      <span><Link2 size={12} />引用 {paper.cites}</span>
                      <span>相关文献</span>
                      <span><Sparkles size={12} />AI解读</span>
                    </div>
                  </div>
                  <div className="paper-cite">
                    <Star size={14} />
                    <span>被引 {paper.cites}</span>
                    {paper.full && <small>全文可获取</small>}
                  </div>
                </article>
              ))}
              {rows.length === 0 && <p className="paper-empty">没有符合条件的论文。</p>}
            </div>
          ) : (
            <div className="paper-chart">
              <h2>发表年份</h2>
              {YEARS.filter(([, count]) => count).map(([label, count]) => (
                <p key={label}><span>{label}</span><i style={{ width: `${Math.max(8, Number(count.replace(/,/g, '')) / 123.45)}%` }} /><em>{count}</em></p>
              ))}
              <h2>文献类型</h2>
              {TYPES.map(([label, count]) => (
                <p key={label}><span>{label}</span><i style={{ width: `${Math.max(8, Number(count.replace(/,/g, '')) / 62.31)}%` }} /><em>{count}</em></p>
              ))}
            </div>
          )}
        </section>
        {selected && (
          <aside className="paper-detail">
            <div className="paper-tabs">
              {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
            </div>
            <div className="paper-detail-body">
              <div className="paper-detail-head">
                <div>
                  <h2>{selected.title}</h2>
                  <div className="paper-tags">
                    {selected.tags.map(([label, kind]) => <em key={label} className={kind}>{label}</em>)}
                    {selected.id === 'jama' && <em>高质量证据</em>}
                  </div>
                  <p>{selected.authors}</p>
                  <p className="paper-meta">
                    <span>{selected.journal}</span>
                    <span>{selected.date}</span>
                    {selected.vol && <span>{selected.vol}</span>}
                    {selected.impact && <span className="brand">{selected.impact}</span>}
                    {selected.quartile && <span className="brand">{selected.quartile}</span>}
                  </p>
                </div>
                <div className="journal-mark"><b>JAMA</b><small>Psychiatry</small></div>
              </div>
              <div className="paper-detail-actions">
                <button type="button" className="paper-pdf"><FileText size={14} />PDF全文</button>
                <button type="button" onClick={copyCite}><Link2 size={14} />{copied ? '已复制' : '引用'}</button>
                <button type="button" onClick={() => setSaved((current) => ({ ...current, [selected.id]: !current[selected.id] }))}><Star size={14} />{saved[selected.id] ? '已收藏' : '收藏'}</button>
                <button type="button" className="paper-ai"><Sparkles size={14} />AI解读</button>
              </div>
              {tab === '摘要' && (
                <>
                  <div className="paper-abs-head">
                    <h3>摘要</h3>
                    <div><button type="button" className={lang === '中文' ? 'on' : ''} onClick={() => setLang('中文')}>中文</button><button type="button" className={lang === '英文' ? 'on' : ''} onClick={() => setLang('英文')}>英文</button></div>
                  </div>
                  {lang === '中文' ? (
                    <div className="paper-abs">
                      <b>背景</b>
                      <p>抑郁症（MDD）是全球范围内常见且致残的精神障碍。针灸被广泛用于抑郁症的辅助治疗，但其总体疗效仍存在不确定性。</p>
                      <b>目的</b>
                      <p>系统评价和 Meta 分析随机对照试验（RCT），评估针灸治疗抑郁症的有效性和安全性。</p>
                      <b>方法</b>
                      <p>检索 PubMed、Embase、Cochrane Library、Web of Science 等数据库，纳入针灸治疗抑郁症的 RCT。研究结局包括缓解率、反应率和不良事件。</p>
                      {abstractOpen && <p>结果与结论以全文为准。当前页只展示可公开摘要，不替代原文。</p>}
                    </div>
                  ) : (
                    <div className="paper-abs">
                      <b>Background</b>
                      <p>Major depressive disorder (MDD) is a common and disabling mental disorder. Acupuncture is widely used as an adjunctive treatment, but its overall efficacy remains uncertain.</p>
                      <b>Objective</b>
                      <p>To evaluate the efficacy and safety of acupuncture for depression through a systematic review and meta-analysis of randomized controlled trials.</p>
                      <b>Methods</b>
                      <p>PubMed, Embase, Cochrane Library, and Web of Science were searched. Outcomes included remission, response, and adverse events.</p>
                    </div>
                  )}
                  <button type="button" className="paper-expand" onClick={() => setAbstractOpen((value) => !value)}>{abstractOpen ? '收起' : '展开全部'}</button>
                  <h3>关键词</h3>
                  <div className="paper-keywords"><span>Acupuncture</span><span>Major Depressive Disorder</span><span>Randomized Controlled Trial</span><span>Meta-analysis</span><span>TCM</span><span>Depression</span></div>
                  <h3>来源与评价</h3>
                  <div className="paper-metrics">
                    <div><small>被引次数</small><b>328</b></div>
                    <div><small>影响因子</small><b className="brand">25.1</b></div>
                    <div><small>JCR 分区</small><b className="brand">Q1</b><small>Psychiatry</small></div>
                    <div><small>学科排名</small><b>Top 1%</b><small>精神病学</small></div>
                  </div>
                  <p className="paper-metric-note">Web of Science (2025) · Journal Citation Reports</p>
                  <div className="paper-source"><span>数据来源说明</span><span>机构已订阅</span><span>全文可获取</span></div>
                  <h3>相关主题</h3>
                  <div className="paper-keywords">{TOPICS.map((topic) => <span key={topic}>{topic}</span>)}</div>
                </>
              )}
              {tab === '研究设计' && <p className="paper-abs">系统综述与 Meta 分析。纳入针灸对照假针灸、常规治疗或空白对照的随机对照试验，检索 PubMed、Embase、Cochrane Library 和 Web of Science。</p>}
              {tab === '主要结果' && <p className="paper-abs">摘要报告针灸在改善抑郁症状方面优于对照，并同时记录缓解率、反应率和不良事件。效应量以全文为准。</p>}
              {tab === '引用网络' && <p className="paper-abs">这篇论文被引 {selected.cites} 次，引用来源集中在精神病学和补充替代医学期刊。</p>}
              {tab === '相关研究' && (
                <ul className="paper-related">
                  {PAPERS.filter((paper) => paper.id !== selected.id).map((paper) => (
                    <li key={paper.id}><button type="button" onClick={() => { setSelectedId(paper.id); setTab('摘要'); }}>{paper.title}</button></li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

function FilterRadio({ title, rows, value, onChange }) {
  return (
    <section>
      <h3>{title}</h3>
      {rows.map(([label]) => (
        <button key={label} type="button" className="paper-option" onClick={() => onChange(label)}>
          <i className={value === label ? 'radio on' : 'radio'} />
          <span>{label}</span>
        </button>
      ))}
    </section>
  );
}

function FilterCheck({ title, rows, picked, onToggle }) {
  return (
    <section>
      {title && <h3>{title}</h3>}
      {rows.map(([label]) => (
        <button key={label} type="button" className="paper-option" onClick={() => onToggle(label)}>
          <i className={picked.includes(label) ? 'box on' : 'box'}>{picked.includes(label) ? '✓' : ''}</i>
          <span>{label}</span>
        </button>
      ))}
    </section>
  );
}

function Fold({ title, expanded, onToggle, children }) {
  return (
    <section className="paper-fold">
      <button type="button" onClick={onToggle}><span>{title}</span><ChevronDown size={14} className={expanded ? 'up' : ''} /></button>
      {expanded && children}
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
