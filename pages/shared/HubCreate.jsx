import React, { useEffect, useState } from 'react';
import {
  Check, ChevronDown, CircleHelp, FileText, Info, Lightbulb, Plus, Search, Sparkles, Users, X,
} from 'lucide-react';
import './hub-create.css';

const STEP_PAGE = { 1: 'h02', 2: 'h03', 3: 'h04' };
const STORAGE_KEY = 'qiyan-hub-draft';

const steps = [
  ['基本信息', '填写Hub的基本信息'],
  ['研究范围', '定义研究领域与关键词'],
  ['AI 检查与确认', '检查相似Hub并完成创建'],
];

const defaultDraft = {
  name: '针灸治疗情志病',
  nameEn: 'Acupuncture for Affective Disorders',
  summary: '探索针灸在抑郁、焦虑等情志疾病中的临床价值，构建高质量循证证据体系。',
  domains: ['针灸治疗'],
  diseases: ['抑郁症', '焦虑障碍', '情志病'],
  keywords: ['针灸', '情志病', '抑郁', '焦虑', 'RCT', '循证医学'],
  owners: ['王教授'],
  collaborators: [],
  question: '评估针灸对抑郁、焦虑等情志类疾病的疗效、安全性及作用机制，构建循证证据体系。',
  types: ['临床研究', '系统评价', '真实世界研究'],
  age: '成人（18-65岁）',
  gender: '不限',
  populationNote: '',
  interventions: ['针灸', '电针', '艾灸', '穴位贴敷', '中西医结合'],
  controls: ['常规治疗', '药物治疗', '假针灸', '无治疗'],
  outcomes: ['抑郁量表（HAMD）', '焦虑量表（HAMA）', '生活质量（SF-36）', '不良事件'],
  designs: ['随机对照试验（RCT）', '队列研究', '病例对照研究', '横断面研究'],
  start: '',
  end: '',
  created: false,
};

const domainOptions = ['针灸治疗', '情志病', '中医内科', '精神心理', '康复医学'];
const diseaseOptions = ['抑郁症', '焦虑障碍', '情志病', '失眠', '双相情感障碍'];
const typeOptions = ['临床研究', '系统评价', '真实世界研究', '基础研究', '机制研究', '其他'];
const ageOptions = ['成人（18-65岁）', '青少年（12-17岁）', '老年（65岁以上）', '不限'];
const genderOptions = ['不限', '男', '女'];
const people = [
  ['李医生', '北京中医医院'],
  ['张教授', '上海中医药大学'],
  ['陈博士', '广州中医药大学'],
];
const suggestKeywords = ['情志病', '中医证候', '随机对照试验', 'Meta 分析', '疗效评价', '安全性', '长期疗效', '复发预防'];
const referenceHubs = [
  ['针灸治疗抑郁症', '91%', '研究项目 12 | 成员 28'],
  ['针灸治疗焦虑障碍', '76%', '研究项目 8 | 成员 18'],
  ['中医治疗失眠', '62%', '研究项目 15 | 成员 32'],
  ['针药结合治疗抑郁症', '58%', '研究项目 6 | 成员 14'],
  ['中医情志病循证评价', '54%', '研究项目 9 | 成员 21'],
];
const similarHubs = [
  ['针灸治疗抑郁症', '探索针灸在抑郁症治疗中的临床价值与机制研究。', ['抑郁症', '针灸', 'RCT', '临床疗效'], '91%', 'high', '该 Hub 已积累多中心临床研究与 HAMD 结局数据，适合作为设计参考或申请加入。'],
  ['针灸治疗焦虑障碍', '研究针灸对焦虑障碍的疗效、安全性及作用机制。', ['焦虑障碍', '针灸', '系统评价', '真实世界研究'], '76%', 'mid', '研究方法与当前范围接近，可复用其系统评价与真实世界研究资产。'],
  ['中医治疗失眠', '中医与针灸在失眠证据中的临床证据与机制研究。', ['失眠', '针灸', '生活质量', '循证医学'], '62%', 'low', '结局指标包含生活质量，可作为补充结局的参考 Hub。'],
];

function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? { ...defaultDraft, ...saved } : defaultDraft;
  } catch {
    return defaultDraft;
  }
}

function addUnique(list, value) {
  const next = value.trim();
  if (!next || list.includes(next)) return list;
  return [...list, next];
}

function openPage(step) {
  window.location.href = `/pages/${STEP_PAGE[step]}/`;
}

function Counter({ value, max }) {
  return <span className="count">{value.length}/{max}</span>;
}

function Chips({ items, onRemove }) {
  return items.map((item) => (
    <span className="chip" key={item}>{item}<button type="button" aria-label={`移除${item}`} onClick={() => onRemove(item)}><X size={12} /></button></span>
  ));
}

function Menu({ options, selected, onPick }) {
  return <ul className="menu">{options.map((item) => (
    <li key={item}><button type="button" className={selected.includes(item) ? 'on' : ''} onClick={() => onPick(item)}>{item}</button></li>
  ))}</ul>;
}

function Stepper({ step, onJump }) {
  return <ol className="hub-steps">{steps.map(([title, note], index) => {
    const number = index + 1;
    const state = number < step ? 'done' : number === step ? 'current' : '';
    return <li key={title} className={state}>
      <button type="button" onClick={() => onJump(number)}>
        <span className="mark">{state === 'done' ? <Check size={16} /> : number}</span>
        <span className="step-copy"><b>{title}</b><small>{note}</small></span>
      </button>
    </li>;
  })}</ol>;
}

function StepBasic({ draft, setDraft, errors, menu, setMenu }) {
  const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));
  return <>
    <h2>基本信息</h2>
    <p className="hub-lead">请填写 Research Hub 的基本信息，便于其他研究者了解和参与。</p>
    <div className="field-row">
      <label>Hub 名称 <em>*</em></label>
      <div className="field-box">
        <input value={draft.name} maxLength={50} onChange={(event) => patch({ name: event.target.value })} />
        <Counter value={draft.name} max={50} />
        {errors.name && <p className="hub-error">{errors.name}</p>}
      </div>
    </div>
    <div className="field-row">
      <label>英文名称（可选）</label>
      <div className="field-box">
        <input value={draft.nameEn} maxLength={100} onChange={(event) => patch({ nameEn: event.target.value })} />
        <Counter value={draft.nameEn} max={100} />
      </div>
    </div>
    <div className="field-row">
      <label>简介 <em>*</em></label>
      <div className="field-box">
        <textarea value={draft.summary} maxLength={500} onChange={(event) => patch({ summary: event.target.value })} />
        <Counter value={draft.summary} max={500} />
        {errors.summary && <p className="hub-error">{errors.summary}</p>}
      </div>
    </div>
    <div className="field-row">
      <label>研究领域 <em>*</em></label>
      <div className="field-box">
        <div className="chip-box">
          <Chips items={draft.domains} onRemove={(item) => patch({ domains: draft.domains.filter((value) => value !== item) })} />
          <button type="button" className="choice plain" onClick={() => setMenu(menu === 'domain' ? '' : 'domain')}>搜索或选择领域 <ChevronDown size={16} /></button>
        </div>
        {menu === 'domain' && <Menu options={domainOptions} selected={draft.domains} onPick={(item) => { patch({ domains: addUnique(draft.domains, item) }); setMenu(''); }} />}
        {errors.domains && <p className="hub-error">{errors.domains}</p>}
      </div>
    </div>
    <div className="field-row">
      <label>疾病/健康问题 <em>*</em></label>
      <div className="field-box">
        <div className="chip-box">
          <Chips items={draft.diseases} onRemove={(item) => patch({ diseases: draft.diseases.filter((value) => value !== item) })} />
          <button type="button" className="choice plain" onClick={() => setMenu(menu === 'disease' ? '' : 'disease')}>搜索或选择疾病 <ChevronDown size={16} /></button>
        </div>
        {menu === 'disease' && <Menu options={diseaseOptions} selected={draft.diseases} onPick={(item) => { patch({ diseases: addUnique(draft.diseases, item) }); setMenu(''); }} />}
        {errors.diseases && <p className="hub-error">{errors.diseases}</p>}
      </div>
    </div>
    <div className="field-row">
      <label>关键词（可选）</label>
      <KeywordInput items={draft.keywords} onChange={(keywords) => patch({ keywords })} />
    </div>
    <div className="field-row">
      <label>负责人 <em>*</em></label>
      <OwnerField owners={draft.owners} error={errors.owners} onChange={(owners) => patch({ owners })} />
    </div>
    <div className="field-row">
      <label>合作研究者（可选）</label>
      <CollaboratorField items={draft.collaborators} onChange={(collaborators) => patch({ collaborators })} />
    </div>
  </>;
}

function KeywordInput({ items, onChange }) {
  const [text, setText] = useState('');
  const add = () => { onChange(addUnique(items, text)); setText(''); };
  return <div className="chip-box">
    <Chips items={items} onRemove={(item) => onChange(items.filter((value) => value !== item))} />
    <input className="keyword-input" value={text} placeholder="输入关键词后按回车添加" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
  </div>;
}

function OwnerField({ owners, error, onChange }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const add = () => { onChange(addUnique(owners, text)); setText(''); setAdding(false); };
  return <div className="field-box">
    <div className="chips">
      {owners.map((owner) => <span className="person" key={owner}><span className="avatar-sm">{owner.slice(0, 1)}</span>{owner}<button type="button" aria-label={`移除${owner}`} onClick={() => onChange(owners.filter((item) => item !== owner))}><X size={12} /></button></span>)}
      {adding ? <span className="adder"><input value={text} placeholder="姓名" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} /><button type="button" className="add" onClick={add}>添加</button></span> : <button type="button" className="add" onClick={() => setAdding(true)}><Plus size={14} /> 添加负责人</button>}
    </div>
    {error && <p className="hub-error">{error}</p>}
  </div>;
}

function CollaboratorField({ items, onChange }) {
  const [query, setQuery] = useState('');
  const matches = people.filter(([name, org]) => query && `${name}${org}`.includes(query) && !items.includes(name));
  return <div className="field-box">
    <div className="chips" style={{ marginBottom: items.length ? 8 : 0 }}>
      <Chips items={items} onRemove={(item) => onChange(items.filter((value) => value !== item))} />
    </div>
    <div className="search-line"><Search size={16} /><input value={query} placeholder="搜索研究者姓名、机构或邮箱" onChange={(event) => setQuery(event.target.value)} /></div>
    {matches.length > 0 && <ul className="menu">{matches.map(([name, org]) => <li key={name}><button type="button" onClick={() => { onChange(addUnique(items, name)); setQuery(''); }}>{name} · {org}</button></li>)}</ul>}
  </div>;
}

function TagAdder({ label, items, onChange }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const add = () => { onChange(addUnique(items, text)); setText(''); setAdding(false); };
  return <div className="chips">
    <Chips items={items} onRemove={(item) => onChange(items.filter((value) => value !== item))} />
    {adding ? <span className="adder"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} /><button type="button" className="add" onClick={add}>添加</button></span> : <button type="button" className="add" onClick={() => setAdding(true)}><Plus size={14} /> {label}</button>}
  </div>;
}

function StepScope({ draft, setDraft, errors, menu, setMenu }) {
  const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));
  const toggleType = (type) => patch({ types: draft.types.includes(type) ? draft.types.filter((item) => item !== type) : [...draft.types, type] });
  return <>
    <h2>研究范围</h2>
    <p className="hub-lead">请详细定义研究的范围，有助于更精准地匹配文献、研究项目和合作研究者。</p>
    <div className="field-row">
      <label>研究问题/研究目标 <em>*</em></label>
      <div className="field-box">
        <textarea value={draft.question} maxLength={500} onChange={(event) => patch({ question: event.target.value })} />
        <Counter value={draft.question} max={500} />
        {errors.question && <p className="hub-error">{errors.question}</p>}
      </div>
    </div>
    <div className="field-row">
      <label>研究类型（可多选）</label>
      <div className="checks">{typeOptions.map((type) => {
        const on = draft.types.includes(type);
        return <button type="button" key={type} className={on ? 'tick on' : 'tick'} onClick={() => toggleType(type)}><i>{on && <Check size={12} />}</i>{type}</button>;
      })}</div>
    </div>
    <div className="field-row">
      <span className="field-label">人群特征 <button type="button" className="icon-btn" aria-label="人群特征说明" onClick={() => setMenu(menu === 'population' ? '' : 'population')}><CircleHelp size={14} /></button></span>
      <div>
        <div className="inline-fields">
          <div className="picker"><small>年龄范围</small><button type="button" className="choice" onClick={() => setMenu(menu === 'age' ? '' : 'age')}>{draft.age} <ChevronDown size={16} /></button>{menu === 'age' && <Menu options={ageOptions} selected={[draft.age]} onPick={(item) => { patch({ age: item }); setMenu(''); }} />}</div>
          <div className="picker"><small>性别</small><button type="button" className="choice" onClick={() => setMenu(menu === 'gender' ? '' : 'gender')}>{draft.gender} <ChevronDown size={16} /></button>{menu === 'gender' && <Menu options={genderOptions} selected={[draft.gender]} onPick={(item) => { patch({ gender: item }); setMenu(''); }} />}</div>
          <div><small>其他特征（可选）</small><input value={draft.populationNote} placeholder="如：特定人群、合并病等" onChange={(event) => patch({ populationNote: event.target.value })} /></div>
        </div>
        {menu === 'population' && <p className="hub-note">可按年龄、性别和合并病缩小人群，便于后续匹配文献与合作者。</p>}
      </div>
    </div>
    <div className="field-row"><label>干预措施</label><TagAdder label="添加干预措施" items={draft.interventions} onChange={(interventions) => patch({ interventions })} /></div>
    <div className="field-row"><label>对照措施</label><TagAdder label="添加对照措施" items={draft.controls} onChange={(controls) => patch({ controls })} /></div>
    <div className="field-row"><label>结局指标</label><TagAdder label="添加结局指标" items={draft.outcomes} onChange={(outcomes) => patch({ outcomes })} /></div>
    <div className="field-row"><label>研究设计</label><TagAdder label="添加研究设计" items={draft.designs} onChange={(designs) => patch({ designs })} /></div>
    <div className="field-row">
      <label>研究时限（可选）</label>
      <div className="date-range">
        <div><small>开始时间</small><input type="date" value={draft.start} onChange={(event) => patch({ start: event.target.value })} /></div>
        <i>至</i>
        <div><small>结束时间</small><input type="date" value={draft.end} onChange={(event) => patch({ end: event.target.value })} /></div>
      </div>
    </div>
  </>;
}

const moreHubs = [
  ['针药结合治疗抑郁症', '比较针药结合与单用药物治疗抑郁症的临床研究。', ['抑郁症', '针药结合', 'RCT'], '58%', 'low', '与当前 Hub 有部分人群重叠，但干预策略不同。'],
];

function StepCheck({ draft, openDetail, setOpenDetail, more, setMore }) {
  const hubs = more ? [...similarHubs, ...moreHubs] : similarHubs;
  return <>
    <div className="result-head"><Sparkles size={18} /><h2>AI 检查结果</h2></div>
    <p className="hub-lead">基于您填写的信息，我们对研究方向的重复性、完整性和可行性进行了智能检查。</p>
    <div className="result-banner"><Check size={18} /><div><strong>未发现完全重复的 Research Hub</strong><p>当前研究方向具有一定的独特性，可以创建新的 Research Hub。</p></div></div>
    <div className="result-head"><h3>相关 Research Hub（相似度较高） <Info size={14} /></h3><button type="button" className="text-btn" onClick={() => setMore(!more)}>{more ? '收起' : '查看更多 →'}</button></div>
    <p className="hub-lead">以下已有 Research Hub 与您的研究方向较为相关，建议参考或考虑加入。</p>
    {hubs.map(([title, desc, tags, score, tone, detail]) => <article className="hub-row" key={title}>
      <FileText size={16} />
      <div><b>{title}</b><p>{desc}</p><div className="chips">{tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>{openDetail === title && <p className="detail-more">{detail}</p>}</div>
      <span>相似度 <b className={`score ${tone}`}>{score}</b></span>
      <button type="button" className="text-btn" onClick={() => setOpenDetail(openDetail === title ? '' : title)}>{openDetail === title ? '收起详情' : '查看详情'}</button>
    </article>)}
    {more && <p className="hub-lead">当前草稿「{draft.name}」与以上 Hub 均非完全重复。</p>}
  </>;
}

function Rail({ step, draft, onAddKeyword }) {
  const [help, setHelp] = useState(false);
  const [more, setMore] = useState(false);
  if (step === 1) return <aside className="hub-rail">
    <section><div className="scene"><Users size={36} /></div><b>Research Hub</b><p>汇聚同一研究领域的证据、项目、数据与研究者，推动更有影响力的临床研究。</p></section>
    <section><h3>创建后您可以：</h3><ul>{['管理该领域的研究课题与证据', '邀请研究者加入，共同开展研究', '整合相关文献、数据与科研资产', '使用岐研 AI 获取领域洞察与研究机会', '持续跟踪研究进展，形成研究成果'].map((item) => <li key={item}><Check size={16} className="ok" />{item}</li>)}</ul></section>
    <section><h3><Lightbulb size={16} className="warn" /> 小提示</h3><ul className="dots">{['建议使用清晰、具体的名称，便于他人理解研究方向', '定义合理的研究范围，避免与已有 Hub 高度重复', '创建后可随时在设置中修改基本信息', '前期无需审批，您可以监察创建，后续根据实际情况再引入审核机制'].map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><div className="rail-head"><h3><CircleHelp size={16} /> 遇到问题？</h3><button type="button" className="text-btn" onClick={() => setHelp(!help)}>查看帮助文档 →</button></div>{help && <div className="help-box">Hub 名称、简介、研究领域、疾病/健康问题和负责人为必填。关键词和合作研究者可以创建后再补充。</div>}</section>
  </aside>;
  if (step === 2) return <aside className="hub-rail">
    <section><div className="scene"><Search size={36} /></div><b>精准定义研究范围</b><p>清晰的研究范围，帮助 AI 更准确地匹配相关文献、项目、数据和合作者。</p></section>
    <section><h3><Sparkles size={16} /> AI 智能建议</h3><p>基于您填写的内容，推荐并补充关键词：</p><div className="chips" style={{ marginTop: 8 }}>{suggestKeywords.map((item) => <button type="button" key={item} className={draft.keywords.includes(item) ? 'suggest on' : 'suggest'} onClick={() => onAddKeyword(item)}>{draft.keywords.includes(item) ? <Check size={14} /> : <Plus size={14} />} {item}</button>)}</div></section>
    <section>
      <div className="rail-head"><h3>相关 Research Hub 参考</h3><button type="button" className="text-btn" onClick={() => setMore(!more)}>{more ? '收起' : '查看更多 →'}</button></div>
      {(more ? referenceHubs : referenceHubs.slice(0, 3)).map(([title, score, meta]) => <article className="ref" key={title}><FileText size={16} /><div><b>{title}</b><small>相似度 {score}　{meta}</small></div></article>)}
    </section>
    <section><div className="rail-head"><h3><CircleHelp size={16} /> 需要帮助？</h3><button type="button" className="text-btn" onClick={() => setHelp(!help)}>查看帮助文档 →</button></div><p>查看创建指南，了解如何定义研究范围。</p>{help && <div className="help-box">研究问题需要说明人群、干预、对照和结局。研究类型可多选，干预、对照、结局和设计都可以增删。</div>}</section>
  </aside>;
  const checks = [
    ['研究问题明确', Boolean(draft.question.trim())],
    ['研究类型与方法合理', draft.types.length > 0],
    ['人群特征清晰', Boolean(draft.age && draft.gender)],
    ['干预措施已定义', draft.interventions.length > 0],
    ['结局指标设置合理', draft.outcomes.length > 0],
    ['研究时间范围合理', !draft.start || !draft.end || draft.start <= draft.end],
  ];
  return <aside className="hub-rail">
    <section><h3><Check size={16} className="ok" /> 研究范围完整性检查</h3><ul className="check-list">{checks.map(([label, pass]) => <li key={label}>{pass ? <Check size={16} className="ok" /> : <X size={16} />}<span>{label}</span></li>)}</ul></section>
    <section><h3><Lightbulb size={16} className="warn" /> AI 优化建议</h3><div className="advice">
      <article><span className="tag-soft suggest">建议</span><p>可以考虑补充「长期疗效」「复发预防」相关关键词，以更全面地覆盖研究范围。</p></article>
      <article><span className="tag-soft optional">可选</span><p>可以增加「生活质量」「安全性」作为结局指标，提升研究的完整性。</p></article>
      <article><span className="tag-soft ref">参考</span><p>建议参考「针灸治疗抑郁症」Hub 中的研究设计与数据资产。</p></article>
    </div></section>
    <section><h3>创建后包含的内容</h3><div className="created-grid">{[['研究课题空间', '管理该领域的研究课题与证据'], ['研究团队', '邀请研究者加入，共同开展研究'], ['科研资产库', '整合相关文献、方案、数据与量表'], ['研究机会与合作', '发现潜在的研究机会，促进合作']].map(([title, note]) => <article key={title}><FileText size={16} /><div><b>{title}</b><small>{note}</small></div></article>)}</div></section>
  </aside>;
}

export function HubCreate({ step }) {
  const [draft, setDraft] = useState(loadDraft);
  const [errors, setErrors] = useState({});
  const [menu, setMenu] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [openDetail, setOpenDetail] = useState('');
  const [more, setMore] = useState(false);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); }, [draft]);

  const stepErrors = (target) => {
    const next = {};
    if (target >= 1) {
      if (!draft.name.trim()) next.name = '请填写 Hub 名称';
      if (!draft.summary.trim()) next.summary = '请填写简介';
      if (!draft.domains.length) next.domains = '请至少选择一个研究领域';
      if (!draft.diseases.length) next.diseases = '请至少选择一个疾病/健康问题';
      if (!draft.owners.length) next.owners = '请指定负责人';
    }
    if (target >= 2 && !draft.question.trim()) next.question = '请填写研究问题 / 研究目标';
    return next;
  };

  const jump = (target) => {
    if (target === step) return;
    if (target > step) {
      const next = stepErrors(step);
      setErrors(next);
      if (Object.keys(next).length) return;
    }
    openPage(target);
  };

  return <main className="platform-main">
    <div className="content hub-create">
      <Stepper step={step} onJump={jump} />
      <div className="hub-grid">
        <section className="hub-card">
          {step === 1 && <StepBasic draft={draft} setDraft={setDraft} errors={errors} menu={menu} setMenu={setMenu} />}
          {step === 2 && <StepScope draft={draft} setDraft={setDraft} errors={errors} menu={menu} setMenu={setMenu} />}
          {step === 3 && <StepCheck draft={draft} openDetail={openDetail} setOpenDetail={setOpenDetail} more={more} setMore={setMore} />}
          {draft.created && <div className="success-box"><span>Research Hub「{draft.name}」已创建。</span><button type="button" className="primary" onClick={() => { window.location.href = '/pages/h01/'; }}>进入领域研究</button></div>}
          {leaving && <div className="confirm-box"><span>将返回领域研究。已填写内容会保留在本机，下次可以继续。</span><span><button type="button" className="ghost" onClick={() => setLeaving(false)}>继续填写</button> <button type="button" className="primary" onClick={() => { window.location.href = '/pages/h01/'; }}>仍要离开</button></span></div>}
          <div className="hub-actions">
            {step > 1 && <button type="button" className="ghost left" onClick={() => openPage(step - 1)}>← 上一步</button>}
            {step === 1 && <button type="button" className="ghost" onClick={() => setLeaving(true)}>取消</button>}
            {step === 2 && <button type="button" className="primary" onClick={() => jump(3)}>下一步：AI 检查与确认 →</button>}
            {step === 1 && <button type="button" className="primary" onClick={() => jump(2)}>下一步：研究范围 →</button>}
            {step === 3 && <>
              <button type="button" className="ghost" onClick={() => setLeaving(true)}>取消</button>
              <button type="button" className="primary" disabled={draft.created} onClick={() => setDraft((current) => ({ ...current, created: true }))}>{draft.created ? '已创建' : '创建 Research Hub →'}</button>
            </>}
          </div>
        </section>
        <Rail step={step} draft={draft} onAddKeyword={(item) => setDraft((current) => ({ ...current, keywords: addUnique(current.keywords, item) }))} />
      </div>
    </div>
  </main>;
}
