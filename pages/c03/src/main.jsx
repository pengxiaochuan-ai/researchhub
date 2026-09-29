import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, FileText,
  KeyRound, Lightbulb, Link2, Sparkles, Users,
} from 'lucide-react';
import './style.css';

const TABS = ['概览', '研究设计', '干预措施', '研究结果', '招募与进展', '研究者与机构', '相关资源'];
const AI_TABS = ['核心解读', '方法学评价', '与其他研究比较', '临床启示', '未来研究方向'];
const FACTS = [
  ['研究状态', '进行中'],
  ['预计完成', '2025-06-30'],
  ['样本量', '450 例'],
  ['研究阶段', 'Phase 3'],
  ['研究类型', '干预性'],
  ['研究设计', '随机对照'],
  ['人群', '中重度抑郁障碍（成人）'],
  ['干预措施', '针灸（标准化方案）'],
  ['对照措施', '常规治疗（药物+心理）'],
  ['主要结局', 'HAMD 评分变化'],
  ['注册来源', 'ClinicalTrials.gov'],
  ['最后更新', '2024-03-10'],
];
const DESIGN = [
  ['研究类型', '干预性研究（随机对照试验）', '研究阶段', 'Phase 3'],
  ['研究设计', '多中心、随机、对照、评价者盲', '试验目的', '治疗'],
  ['对照方式', '常规治疗（药物、心理治疗）', '试验人群', '中重度抑郁障碍成人'],
  ['样本量', '450 例（计划）', '试验地点', '中国 6 个中心'],
  ['主要结局指标', 'HAMD 评分变化（第 8 周）', '次要结局指标', '缓解率、复发率、生活质量量表（SF-36）'],
];
const PEOPLE = [
  ['主要研究者', '王某某 教授', '北京中医药大学东直门医院', '中国'],
  ['研究者', '李某某 教授', '上海中医药大学附属岳阳医院', '中国'],
  ['研究者', '张某某 教授', '广州中医药大学第一附属医院', '中国'],
  ['研究者', '陈某某 教授', '成都中医药大学附属医院', '中国'],
];
const LINE = [
  ['首次注册', '2020-07-15'],
  ['首例入组', '2021-03-01'],
  ['招募中', '2021-03 ~ 2024-12'],
  ['预计完成', '2025-06-30'],
  ['结果公布', '预计 2025-12'],
];
const POINTS = [
  ['研究背景与目的', '本研究针对中重度抑郁障碍，评估针灸联合常规治疗的疗效和安全性。'],
  ['研究设计优势', '多中心、随机、评价者盲设计，有助于减少偏倚，提高证据质量。'],
  ['关键结局指标', '主要结局为 HAMD 评分变化，同时评估缓解率、复发率和生活质量。'],
  ['当前进展', '目前处于招募阶段，预计 2025 年 6 月完成，结果尚待持续关注。'],
];
const MEANING = [
  '如果结果阳性，可能为针灸作为中重度抑郁障碍的辅助治疗提供更高质量的证据。',
  '可能支持针灸在综合治疗方案中的更广泛应用。',
  '有助于明确针灸的长期疗效和安全性，为指南推荐提供依据。',
  '对不耐受或疗效有限的药物治疗患者提供新的治疗选择。',
];
const WATCH = [
  '研究的盲法实施情况及其有效性。',
  '对照组的治疗方案是否充分，是否为目前的标准治疗。',
  '不同中心之间的干预一致性和质量控制。',
  '长期随访数据的完整性和患者依从性。',
];
const RELATED = [
  ['相关研究论文', '12'],
  ['相关指南', '3'],
  ['相关注册', '8'],
  ['相关研究团队', '4'],
];

function App() {
  const [tab, setTab] = useState('概览');
  const [aiTab, setAiTab] = useState(AI_TABS[0]);
  const [saved, setSaved] = useState(false);
  const [report, setReport] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <main className="platform-main trial-board">
      <div className="trial-jump">
        <button type="button" className="trial-back"><ChevronLeft size={14} />返回列表</button>
        <span>上一篇</span>
        <span>下一篇</span>
      </div>
      <section className="trial-head">
        <div className="trial-tags">
          <em className="live">进行中</em><em>干预性研究</em><em>随机对照</em><em>多中心</em><em>高度证据</em>
        </div>
        <div className="trial-actions">
          <button type="button"><FileText size={14} />查看原始记录</button>
          <button type="button" onClick={() => setSaved((value) => !value)}><Bookmark size={14} />{saved ? '已收藏' : '收藏'}</button>
          <button type="button" className="trial-ai" onClick={() => document.querySelector('.trial-ai-panel')?.scrollIntoView({ block: 'nearest' })}><Sparkles size={14} />岐研 AI 解读</button>
        </div>
        <h2>针灸治疗中重度抑郁障碍的多中心随机对照试验</h2>
        <p>A multicenter randomized controlled trial of acupuncture for moderate to severe major depressive disorder</p>
        <p className="trial-ids"><b>NCT04567890</b><span>注册时间 2020-07-15</span><span>最后更新 2024-03-10</span><span>ClinicalTrials.gov</span></p>
        <p>申办方　北京中医药大学东直门医院</p>
        <p>主要研究者　王某某 教授　|　合作机构　5 家机构　|　研究阶段　Phase 3</p>
      </section>
      <div className="trial-tabs">
        {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="trial-split">
        <div className="trial-main">
          {tab === '概览' && <Overview onPeople={() => setTab('研究者与机构')} />}
          {tab === '研究设计' && <section className="trial-card"><h3>研究设计</h3><DesignTable /></section>}
          {tab === '干预措施' && <section className="trial-card"><h3>干预措施</h3><p>针灸采用标准化方案。对照为常规治疗，包括药物和心理治疗。评价者对分组保持盲态。</p></section>}
          {tab === '研究结果' && <section className="trial-card"><h3>研究结果</h3><p>试验仍在招募。主要结局为第 8 周 HAMD 评分变化，结果预计 2025 年 12 月公布。</p></section>}
          {tab === '招募与进展' && <section className="trial-card"><h3><Clock size={16} />招募与进展</h3><Timeline /></section>}
          {tab === '研究者与机构' && <section className="trial-card"><h3><Users size={16} />研究者与机构</h3><PeopleTable /></section>}
          {tab === '相关资源' && (
            <section className="trial-card">
              <h3><Link2 size={16} />相关资源</h3>
              <ul className="trial-related">
                {RELATED.map(([label, count]) => <li key={label}><span>{label}</span><b>{count}</b></li>)}
              </ul>
            </section>
          )}
        </div>
        <aside className="trial-facts">
          <section className="trial-card">
            <h3><KeyRound size={16} />关键信息</h3>
            {FACTS.map(([label, value]) => <p key={label}><small>{label}</small><b className={value === '进行中' ? 'live' : ''}>{value}</b></p>)}
          </section>
          <section className="trial-card">
            <h3><Lightbulb size={16} />研究价值与意义</h3>
            <p className="trial-note">本研究是目前国内规模较大的针灸治疗抑郁障碍多中心随机对照试验之一，有望为针灸在中重度抑郁障碍中的应用提供高质量证据，并观察长期疗效与安全性。</p>
          </section>
          <section className="trial-card">
            <h3>与当前 Hub 的相关性</h3>
            <p><small>疾病方向</small><span><CheckCircle2 size={14} />抑郁障碍</span></p>
            <p><small>研究设计</small><span><CheckCircle2 size={14} />RCT</span></p>
            <p><small>干预方式</small><span><CheckCircle2 size={14} />针刺</span></p>
            <p><small>研究阶段</small><span><CheckCircle2 size={14} />Phase 3</span></p>
          </section>
          <section className="trial-card">
            <h3><Link2 size={16} />相关内容</h3>
            {RELATED.map(([label, count]) => (
              <button key={label} type="button" onClick={() => setTab('相关资源')}>{label} ({count})<ChevronRight size={14} /></button>
            ))}
          </section>
        </aside>
        <aside className="trial-ai-panel">
          <header><b><Sparkles size={16} />岐研 AI 解读</b><small>基于当前临床试验，提供结构化的分析、解读与临床启示</small></header>
          <div className="trial-ai-tabs">
            {AI_TABS.map((item) => <button key={item} type="button" className={aiTab === item ? 'on' : ''} onClick={() => setAiTab(item)}>{item}</button>)}
          </div>
          <div className="trial-ai-body">
            {aiTab === '核心解读' && (
              <>
                <section className="trial-conclusion">
                  <header><b>一句话结论</b><button type="button" onClick={() => setReport(true)}>{report ? '已生成' : '生成完整报告'}</button></header>
                  <p>这是一项正在进行的多中心随机对照试验，旨在评估针灸在中重度抑郁障碍患者中的有效性和安全性，具有重要的临床价值和意义。</p>
                </section>
                <section>
                  <h3>核心要点</h3>
                  <ol>{POINTS.map(([title, text], index) => <li key={title}><i>{index + 1}</i><div><b>{title}</b><span>{text}</span></div></li>)}</ol>
                </section>
                <section>
                  <h3>潜在的临床意义</h3>
                  <ul>{MEANING.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section>
                  <h3>需要关注的问题</h3>
                  <ul>{WATCH.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              </>
            )}
            {aiTab !== '核心解读' && (
              <section>
                <h3>{aiTab}</h3>
                <p>{aiTab === '方法学评价' && '多中心、随机、评价者盲，计划样本量 450 例。对照为常规治疗。主要结局是第 8 周 HAMD 评分变化。'}</p>
                <p>{aiTab === '与其他研究比较' && '相对已完成的单中心注册，这项试验的中心数和样本量更大，并计划观察到 2025 年。'}</p>
                <p>{aiTab === '临床启示' && MEANING[0]}</p>
                <p>{aiTab === '未来研究方向' && '结果公布后，还可以按中心、严重程度和是否合并用药，继续看疗效是否稳定。'}</p>
              </section>
            )}
          </div>
          <footer>
            <span>以上内容由岐研 AI 基于公开注册信息生成，仅供参考，不替代专业判断。</span>
            <button type="button" onClick={() => setCopied(true)}><Copy size={14} />{copied ? '已复制' : '复制内容'}</button>
          </footer>
        </aside>
      </div>
    </main>
  );
}

function Overview({ onPeople }) {
  return (
    <>
      <section className="trial-card">
        <h3><FileText size={16} />研究摘要</h3>
        <p>本研究旨在评估针灸治疗在中重度抑郁障碍成人患者中的有效性与安全性。该研究为多中心、随机、对照、评价者盲的临床试验，计划纳入 450 例受试者，比较针灸联合常规治疗与常规治疗在抑郁症状改善方面的差异。</p>
      </section>
      <section className="trial-card">
        <h3>研究设计</h3>
        <DesignTable />
      </section>
      <section className="trial-card">
        <h3><Clock size={16} />研究时间线</h3>
        <Timeline />
      </section>
      <section className="trial-card">
        <h3><Users size={16} />主要研究者与机构</h3>
        <PeopleTable />
        <button type="button" className="trial-more" onClick={onPeople}>查看全部研究者与机构（6 家）<ChevronRight size={14} /></button>
      </section>
    </>
  );
}

function DesignTable() {
  const pairs = DESIGN.flatMap((row) => [[row[0], row[1]], [row[2], row[3]]]);
  return (
    <table className="trial-design">
      <tbody>
        {pairs.map(([label, value]) => (
          <tr key={label}><th>{label}</th><td>{value}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Timeline() {
  return (
    <ol className="trial-line">
      {LINE.map(([label, date]) => (
        <li key={label} className={label === '招募中' ? 'on' : ''}>
          <i />
          <b>{label}</b>
          <small>{date}</small>
        </li>
      ))}
    </ol>
  );
}

function PeopleTable() {
  return (
    <table className="trial-people">
      <thead><tr><th>角色</th><th>姓名 / 职称</th><th>机构</th><th>国家 / 地区</th></tr></thead>
      <tbody>
        {PEOPLE.map((row) => (
          <tr key={row[1]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

createRoot(document.getElementById('root')).render(<App />);
