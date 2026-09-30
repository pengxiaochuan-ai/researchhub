import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brain, Building2, ChevronRight, FileText, FlaskConical, MoreHorizontal, Network, Sparkles, Star, Stethoscope, Users } from 'lucide-react';
import photo1 from '../../t01/src/photos/team-1.png';
import photo2 from '../../t01/src/photos/team-2.png';
import photo3 from '../../t01/src/photos/team-3.png';
import photo4 from '../../t01/src/photos/team-4.png';
import photo5 from '../../t01/src/photos/team-5.png';
import './style.css';

const TABS = ['概览', '研究者', '研究方向', '研究成果', '临床试验', '指南与贡献', '合作网络'];

const BUCM = {
  id: 'bucm',
  name: '北京中医药大学 针灸推拿学院抑郁障碍研究团队',
  en: 'Acupuncture and Mental Health Research Team, BUCM',
  org: '北京中医药大学',
  city: '北京',
  lead: '王某教授',
  level: '高相关',
  photo: photo1,
  members: 28,
  papers: 286,
  trials: 12,
  partners: 18,
  summary: '专注于针灸治疗抑郁障碍的机制研究与临床转化，开展多中心随机对照试验、真实世界研究及神经生物学机制研究，探索针灸的个体化治疗方案。',
  intro: '团队围绕抑郁障碍的中西医结合机制与临床干预进行系统研究，重点开展针灸干预的多中心随机对照试验（RCT）、神经影像与生物标志物研究，建立基于循证证据的个体化针灸治疗方案，致力于推动针灸在情志障碍领域的临床应用与机制阐释。',
  tags: ['抑郁障碍', '针灸治疗', '临床试验', '机制研究', '中医现代化', '神经影像', '个体化治疗'],
  relevance: [
    '在抑郁障碍领域持续开展针灸干预研究',
    '发表多篇针灸治疗抑郁障碍的高质量论文',
    '承担国家级/省部级相关课题',
    '开展多中心临床试验并纳入神经影像研究',
  ],
  directions: [
    ['抑郁障碍的针灸干预', '临床疗效、个体化治疗方案', Stethoscope],
    ['神经机制研究', '脑功能影像、神经递质、神经可塑性', Brain],
    ['临床试验与真实世界研究', '多中心RCT、真实世界研究、疗效与安全性评价', FlaskConical],
    ['中医现代化', '针灸标准化、循证评价、临床转化', Sparkles],
  ],
  running: [
    ['针灸联合常规治疗抑郁障碍的多中心随机对照试验', 'ChiCTR2300071234', '多中心 RCT', '北京中医药大学等 6家中心', '王某教授', '招募中'],
    ['电针调节前额叶功能的神经影像研究', 'ChiCTR2200067890', '单中心 RCT', '北京中医药大学', '李某教授', '招募中'],
    ['针灸治疗青少年抑郁障碍的真实世界研究', 'ChiCTR2300083456', '前瞻性观察', '北京中医药大学等 4家中心', '张某教授', '招募中/进行中'],
  ],
  papersList: [
    ['Acupuncture for moderate-to-severe depression: a multicenter randomized controlled trial', 'Wang XX, Li XX, Zhang XX, et al.', 'JAMA Psychiatry', '2022', '被引 152'],
    ['Neural mechanisms of acupuncture in depression: evidence from resting-state fMRI', 'Li XX, Wang XX, et al.', 'NeuroImage', '2022', '被引 98'],
    ['Individualized acupuncture treatment for depression based on machine learning', 'Zhang XX, Wang XX, et al.', 'Brain Stimulation', '2021', '被引 76'],
  ],
  trialPubs: [
    ['针灸联合常规治疗抑郁障碍的多中心随机对照试验', 'ChiCTR2300071234', '多中心 RCT', '2023'],
    ['电针调节前额叶功能的神经影像研究', 'ChiCTR2200067890', '单中心 RCT', '2022'],
  ],
  guides: [
    '抑郁障碍针灸干预临床路径（草案）',
    '针灸治疗抑郁障碍证据综述',
    '情志病针灸临床试验报告规范',
    '抑郁障碍中西医结合诊疗共识要点',
    '针灸个体化方案制定建议',
    '多中心针灸试验质量控制要点',
  ],
  people: [
    ['王某教授', '团队负责人', '北京中医药大学 针灸推拿学院', '抑郁障碍、针灸治疗、神经机制', true, 'wang'],
    ['李某教授', '临床负责人', '北京中医药大学', '临床试验、抑郁障碍', false],
    ['张某教授', '方法学负责人', '北京中医药大学', '流行病学、循证医学', false],
    ['刘某教授', '基础研究负责人', '北京中医药大学', '神经影像、分子机制', false],
    ['陈某副教授', '核心研究者', '北京中医药大学', '针灸机制、动物实验', false],
    ['赵某副教授', '核心研究者', '北京中医药大学', '个体化治疗、机器学习', false],
  ],
  orgs: [
    ['上海交通大学医学院附属精神卫生中心', '联合临床试验 4 项，合著论文 12 篇'],
    ['华中科技大学同济医学院附属同济医院', '联合临床试验 3 项，合著论文 8 篇'],
    ['四川大学华西医院', '联合临床试验 3 项，合著论文 7 篇'],
    ['广州中医药大学第一附属医院', '联合临床试验 2 项，合著论文 5 篇'],
    ['上海中医药大学附属岳阳医院', '联合临床试验 2 项，合著论文 4 篇'],
    ['成都中医药大学附属医院', '联合临床试验 2 项，合著论文 4 篇'],
    ['中国中医科学院广安门医院', '联合临床试验 1 项，合著论文 3 篇'],
    ['南京中医药大学附属医院', '联合临床试验 1 项，合著论文 3 篇'],
  ],
};

const LIST = [
  ['sjtu', '上海交通大学医学院附属精神卫生中心抑郁障碍研究团队', '上海交通大学医学院', '上海', '李某教授', '高相关', photo2, 35, 342, 19, 12, '聚焦抑郁障碍的临床研究与转化医学，开展药物、心理治疗及物理治疗的多模式联合干预研究，建立临床队列和多中心研究网络。', ['抑郁障碍', '心理治疗', '药物治疗', '临床队列', '转化医学'], ['抑郁障碍多模态联合干预的真实世界研究（2023）', '生物标志物指导的个体化治疗研究（2022）']],
  ['xiangya', '中南大学湘雅二医院情绪障碍研究团队', '中南大学', '长沙', '张某教授', '相关', photo3, 42, 318, 16, 8, '专注于抑郁障碍和焦虑障碍的临床与基础研究，开展神经影像、生物标志物及临床干预研究，建立大样本临床数据库。', ['抑郁障碍', '焦虑障碍', '神经影像', '生物标志物', '临床数据库'], ['抑郁障碍脑影像标志物的多中心研究（2023）', '基于机器学习的抑郁症预测模型（2022）']],
  ['huaxi', '四川大学华西医院心理卫生中心研究团队', '四川大学华西医院', '成都', '刘某教授', '相关', photo4, 38, 274, 14, 7, '开展抑郁障碍的临床流行病学、干预研究及机制研究，关注青少年抑郁、难治性抑郁和共病问题，建立区域性多中心研究网络。', ['抑郁障碍', '青少年心理健康', '临床干预', '流行病学', '共病研究'], ['青少年抑郁障碍的纵向队列研究（2023）', '难治性抑郁的联合治疗策略研究（2022）']],
  ['tongji', '华中科技大学同济医学院附属同济医院精神医学研究团队', '华中科技大学同济医学院', '武汉', '陈某教授', '相关', photo5, 26, 195, 8, 6, '聚焦抑郁障碍的临床诊疗与神经机制研究，开展脑功能成像、神经调控及数字医疗研究，推动临床应用转化。', ['抑郁障碍', '神经调控', '脑功能成像', '数字医疗', '临床应用'], ['经颅磁刺激治疗抑郁障碍的多中心研究（2023）', '数字化干预在抑郁障碍中的应用研究（2022）']],
];

function fromList(row) {
  const [id, name, org, city, lead, level, photo, members, papers, trials, partners, summary, tags, works] = row;
  const leadId = { sjtu: 'li', xiangya: 'zhang', huaxi: 'liu', tongji: 'chen' }[id];
  return {
    id, name, en: '', org, city, lead, level, photo, members, papers, trials, partners, summary,
    intro: summary,
    tags,
    relevance: ['研究方向与针灸治疗情志病有交叉', '代表成果来自团队公开论文与注册信息', '查看合作网络不会加入课题，也不会开放数据'],
    directions: tags.slice(0, 4).map((tag) => [tag, summary.slice(0, 24), Sparkles]),
    running: [],
    papersList: works.map((work) => [work, lead, org, '2023', '']),
    trialPubs: [],
    guides: [],
    people: [[lead, '团队负责人', org, tags.slice(0, 2).join('、'), true, leadId]],
    orgs: [['北京中医药大学 针灸推拿学院抑郁障碍研究团队', '领域内可公开的合作线索']],
  };
}

const PROFILES = { bucm: BUCM, ...Object.fromEntries(LIST.map((row) => [row[0], fromList(row)])) };

function App() {
  const id = new URLSearchParams(window.location.search).get('team') || 'bucm';
  const team = PROFILES[id] || BUCM;
  const [tab, setTab] = useState('概览');
  const [resultTab, setResultTab] = useState('论文');
  const [followed, setFollowed] = useState(false);
  const [menu, setMenu] = useState(false);
  const core = team.people.filter((person) => !person[4]);

  return (
    <main className="platform-main unit-board">
      <section className="unit-hero">
        <img src={team.photo} alt="" />
        <div>
          <header>
            <h2>{team.name}</h2>
            <em className={team.level === '高相关' ? 'hot' : ''}>{team.level}</em>
            <div>
              <button type="button" onClick={() => setFollowed((value) => !value)}><Star size={14} />{followed ? '已关注' : '关注团队'}</button>
              <button type="button" className="unit-more" aria-label="更多" onClick={() => setMenu((value) => !value)}><MoreHorizontal size={16} /></button>
              {menu && <button type="button" className="team-back">返回研究团队</button>}
            </div>
          </header>
          {team.en && <p className="unit-en">{team.en}</p>}
          <p className="unit-meta">{team.org}　{team.city}　团队负责人：{team.lead}</p>
          <p>{team.summary}</p>
          <div className="unit-tags">{team.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="unit-stats">
          <p><Users size={16} /><b>{team.members}</b><small>团队成员</small></p>
          <p><FileText size={16} /><b>{team.papers}</b><small>研究论文</small></p>
          <p><FlaskConical size={16} /><b>{team.trials}</b><small>临床试验</small></p>
          <p><Network size={16} /><b>{team.partners}</b><small>合作机构</small></p>
        </div>
      </section>
      <div className="unit-tabs">
        {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="unit-split">
        <div className="unit-main">
          {tab === '概览' && <Overview team={team} resultTab={resultTab} setResultTab={setResultTab} onTrials={() => setTab('临床试验')} onResults={() => setTab('研究成果')} />}
          {tab === '研究者' && <People people={team.people} />}
          {tab === '研究方向' && <Directions items={team.directions} />}
          {tab === '研究成果' && <Results team={team} resultTab={resultTab} setResultTab={setResultTab} />}
          {tab === '临床试验' && <Trials rows={team.running} />}
          {tab === '指南与贡献' && <Guides items={team.guides} />}
          {tab === '合作网络' && <Orgs items={team.orgs} />}
        </div>
        <aside className="unit-side">
          <section>
            <h3>团队负责人</h3>
            <Person person={team.people[0]} />
          </section>
          <section>
            <header><h3>核心成员（{core.length}）</h3><button type="button" onClick={() => setTab('研究者')}>查看全部<ChevronRight size={14} /></button></header>
            {core.map((person) => <Person key={person[0]} person={person} />)}
          </section>
          <section>
            <header><h3>主要合作机构（{team.orgs.length}）</h3><button type="button" onClick={() => setTab('合作网络')}>查看全部<ChevronRight size={14} /></button></header>
            {team.orgs.slice(0, 3).map(([name, note]) => (
              <p key={name} className="unit-org"><Building2 size={16} /><span><b>{name}</b><small>{note}</small></span></p>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Overview({ team, resultTab, setResultTab, onTrials, onResults }) {
  return (
    <>
      <div className="unit-intro">
        <section>
          <h3>团队简介</h3>
          <p>{team.intro}</p>
        </section>
        <section className="unit-fit">
          <h3>与本研究领域的相关性</h3>
          <ul>{team.relevance.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      <section>
        <h3>核心研究方向</h3>
        <Directions items={team.directions} />
      </section>
      <section>
        <header><h3>正在开展的临床试验（{team.running.length} 项）</h3><button type="button" onClick={onTrials}>查看更多<ChevronRight size={14} /></button></header>
        <Trials rows={team.running} />
      </section>
      <section>
        <header><h3>代表性研究成果</h3><button type="button" onClick={onResults}>查看更多<ChevronRight size={14} /></button></header>
        <Results team={team} resultTab={resultTab} setResultTab={setResultTab} />
      </section>
    </>
  );
}

function Directions({ items }) {
  return (
    <div className="unit-dirs">
      {items.map(([title, text, Icon]) => (
        <article key={title}><Icon size={16} /><b>{title}</b><span>{text}</span></article>
      ))}
    </div>
  );
}

function Trials({ rows }) {
  if (!rows.length) return <p className="unit-empty">暂无公开的进行中试验。</p>;
  return (
    <table>
      <thead><tr><th>试验名称</th><th>注册号</th><th>研究设计</th><th>主要研究中心</th><th>负责人</th><th>招募状态</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[1]}>
            <td>{row[0]}<em>进行中</em></td>
            {row.slice(1, 5).map((cell) => <td key={cell}>{cell}</td>)}
            <td className="unit-recruit">{row[5]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Results({ team, resultTab, setResultTab }) {
  return (
    <>
      <div className="unit-result-tabs">
        {[['论文', team.papers], ['临床试验', team.trials], ['指南/共识', team.guides.length]].map(([label, count]) => (
          <button key={label} type="button" className={resultTab === label ? 'on' : ''} onClick={() => setResultTab(label)}>{label}（{count}）</button>
        ))}
      </div>
      {resultTab === '指南/共识' && <Guides items={team.guides} />}
      {resultTab === '论文' && <PaperList rows={team.papersList} />}
      {resultTab === '临床试验' && (
        team.trialPubs.length
          ? <ul className="unit-guides">{team.trialPubs.map((row) => <li key={row[0]}>{row[0]}　{row[1]}　{row[2]}</li>)}</ul>
          : <p className="unit-empty">暂无单独列出的试验发表。</p>
      )}
    </>
  );
}

function PaperList({ rows }) {
  if (!rows.length) return <p className="unit-empty">暂无公开论文。</p>;
  return (
    <ul className="unit-papers">
      {rows.map((row) => (
        <li key={row[0]}>
          <b>{row[0]}</b>
          <span>{row[1]}　{row[2]} {row[3]} {row[4]}</span>
        </li>
      ))}
    </ul>
  );
}

function Guides({ items }) {
  if (!items.length) return <p className="unit-empty">暂无公开指南或共识。</p>;
  return <ul className="unit-guides">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function People({ people }) {
  return <div className="unit-people">{people.map((person) => <Person key={person[0]} person={person} />)}</div>;
}

function Orgs({ items }) {
  return (
    <div className="unit-orgs">
      {items.map(([name, note]) => <p key={name} className="unit-org"><Building2 size={16} /><span><b>{name}</b><small>{note}</small></span></p>)}
    </div>
  );
}

function Person({ person }) {
  const [name, role, org, focus, , researcherId] = person;
  return (
    <article className="unit-person">
      <i>{name.slice(0, 1)}</i>
      <span>
        {researcherId
          ? <button type="button" onClick={(event) => { event.stopPropagation(); window.location.assign(`/pages/r02/?id=${researcherId}`); }}>{name}</button>
          : <b>{name}</b>}
        <em>{role}</em>
        <small>{org}</small>
        <small>研究方向：{focus}</small>
      </span>
    </article>
  );
}

createRoot(document.getElementById('root')).render(<App />);
