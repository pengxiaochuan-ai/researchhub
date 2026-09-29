import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bookmark, FileText, Link2, Sparkles } from 'lucide-react';
import './style.css';
import { AiPanel } from './ai-panel.jsx';

const TABS = ['概览', '方法与设计', '研究结果', '讨论与局限', '引用与关联'];
const RESULT_TABS = ['HAMD 评分（主要结局）', '缓解率', '反应率', '不良事件'];
const STUDIES = [
  ['Li et al. 2021', '120 / 118', '-0.58 [-0.82, -0.34]', '15.2%', 35.5],
  ['Zhang et al. 2020', '90 / 88', '-0.71 [-1.05, -0.37]', '10.8%', 32.3],
  ['Wang et al. 2019', '86 / 85', '-0.49 [-0.80, -0.18]', '12.1%', 37.8],
  ['Chen et al. 2018', '112 / 110', '-0.62 [-0.91, -0.33]', '13.5%', 34.5],
  ['其他研究 (n=64)', '3,548 / 3,389', '-0.64 [-0.78, -0.50]', '48.4%', 34],
];
const GRADES = [
  ['研究设计', '高', ''],
  ['研究质量', '中等', 'warn'],
  ['一致性', '高', ''],
  ['直接性', '高', ''],
  ['精确性', '中等', 'warn'],
  ['发表偏倚', '低', ''],
];
const MATCHES = [
  ['疾病方向', '抑郁障碍', 'match'],
  ['研究对象', '成人', 'match'],
  ['干预方式', '针灸', 'match'],
  ['结局指标', 'HAMD', 'match'],
  ['研究设计', '系统综述 / Meta分析（纳入 RCT）', 'match'],
  ['随访周期', '部分匹配', 'partial'],
];
const RELATED = {
  临床试验: [
    ['NCT04667890', '进行中', '针灸治疗抑郁障碍的多中心随机对照试验'],
    ['NCT03785754', '已完成', '电针对抑郁症疗效的随机对照研究'],
  ],
  指南: [
    ['指南', '中国抑郁障碍防治指南（2022）', '中华医学会精神医学分会'],
  ],
  论文: [
    ['论文', 'Acupuncture versus Sham Acupuncture for Depression', 'Lancet Psychiatry · 2022'],
    ['论文', 'Electroacupuncture for Major Depression', 'BMJ · 2021'],
  ],
};
const ZH = [
  ['背景（Background）', '抑郁症（MDD）是全球范围内常见且致残的精神障碍。针灸被广泛用于抑郁症的辅助治疗，但其总体疗效和安全性仍存在不确定性。'],
  ['目的（Objective）', '系统评价和 Meta 分析随机对照试验（RCT），评估针灸治疗抑郁障碍的有效性和安全性。'],
  ['方法（Methods）', '检索 PubMed、Embase、Cochrane Library、Web of Science、CNKI 等数据库，纳入针灸治疗抑郁障碍的 RCT。主要结局为抑郁症状改善（HAMD 评分），次要结局包括缓解率、反应率和不良事件。'],
  ['结果（Results）', '共纳入 68 项 RCT，包含 6,528 例患者。Meta 分析显示，针灸较假针灸/常规治疗在降低 HAMD 评分方面有显著优势（SMD = -0.62，95% CI: -0.78 to -0.46，P < 0.001）。针灸组缓解率更高（RR = 1.45，95% CI: 1.20–1.74），不良事件多轻度、短暂。'],
  ['结论（Conclusions）', '针灸在改善抑郁症状方面具有中等强度的证据支持，安全性良好。仍需要更多高质量、多中心、大样本的 RCT 进一步验证。'],
];
const EN = [
  ['Background', 'Major depressive disorder is common and disabling. Acupuncture is widely used as an adjunct, but its overall efficacy and safety remain uncertain.'],
  ['Objective', 'To evaluate the efficacy and safety of acupuncture for depressive disorders through a systematic review and meta-analysis of RCTs.'],
  ['Methods', 'PubMed, Embase, Cochrane Library, Web of Science and CNKI were searched. The primary outcome was change in HAMD score.'],
  ['Results', '68 RCTs with 6,528 participants were included. Acupuncture reduced HAMD scores more than sham or usual care (SMD = -0.62, 95% CI -0.78 to -0.46).'],
  ['Conclusions', 'Evidence of moderate strength supports acupuncture for depressive symptoms, with a favorable safety profile. Larger multicenter trials are still needed.'],
];

function App() {
  const [tab, setTab] = useState('概览');
  const [lang, setLang] = useState('中');
  const [resultTab, setResultTab] = useState(RESULT_TABS[0]);
  const [related, setRelated] = useState('临床试验');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const abstract = lang === '中' ? ZH : EN;

  const copyCite = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="platform-main detail-board">
      <div className="detail-jump">
        <button type="button" className="paper-back">返回列表</button>
        <span>上一篇</span>
        <span>下一篇</span>
      </div>
      <section className="detail-paper">
        <div className="detail-cover"><b>JAMA</b><small>Psychiatry</small></div>
        <div>
          <div className="detail-tags">
            <em>系统综述</em><em>Meta分析</em><em>纳入研究: RCT</em><em className="hot">高相关</em><em className="hot">高质量证据</em>
          </div>
          <h2>针灸治疗抑郁障碍的有效性与安全性：系统综述与Meta分析</h2>
          <p className="detail-en">Efficacy and safety of acupuncture for depressive disorders: a systematic review and meta-analysis of randomized controlled trials</p>
          <p>Li X*, Wang Y*, Zhang L*, Chen H*, Liu M*</p>
          <ol>
            <li>北京中医药大学 针灸推拿学院</li>
            <li>中国中医科学院 针灸研究所</li>
            <li>北京大学第六医院</li>
          </ol>
          <p className="detail-meta">
            <span>JAMA Psychiatry</span><span>2023-09</span><span>Vol. 80 · Issue 9 · Pages 921–931</span>
            <b>IF 25.1</b><b>Q1</b>
          </p>
          <p className="detail-ids">DOI: 10.1001/jamapsychiatry.2023.0123　PMID: 36812345　PMCID: PMC3988776</p>
          <p className="detail-source">来源：PubMed · Crossref · 期刊官网　查看来源与版本 (3)</p>
        </div>
        <div className="detail-actions">
          <button type="button"><FileText size={14} />查看原文</button>
          <button type="button" onClick={copyCite}><Link2 size={14} />{copied ? '已复制' : '引用'}</button>
          <button type="button" onClick={() => setSaved((value) => !value)}><Bookmark size={14} />{saved ? '已收藏' : '收藏'}</button>
          <button type="button" className="paper-ai" onClick={() => setAiOpen(true)}><Sparkles size={14} />岐研 AI 解读</button>
        </div>
      </section>
      <div className="detail-split">
        <section className="detail-read">
          <div className="detail-tabs">
            {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
          </div>
          {tab === '概览' && (
            <>
              <article className="detail-abstract">
                <header><b>摘要</b><div><button type="button" className={lang === '中' ? 'on' : ''} onClick={() => setLang('中')}>中</button><button type="button" className={lang === '英' ? 'on' : ''} onClick={() => setLang('英')}>英</button></div></header>
                {abstract.map(([title, text]) => <p key={title}><b>{title}</b>{text}</p>)}
                <h3>关键词</h3>
                <div className="detail-keywords">
                  {['Acupuncture', 'Major Depressive Disorder', 'Systematic Review', 'Meta-analysis', 'Randomized Controlled Trial'].map((word) => <span key={word}>{word}</span>)}
                  <span>+3</span>
                </div>
              </article>
              <Results resultTab={resultTab} onChange={setResultTab} />
            </>
          )}
          {tab === '方法与设计' && <article className="detail-abstract"><p><b>方法（Methods）</b>{ZH[2][1]}</p><p>对照包括假针灸和常规治疗。结局为 HAMD 评分、缓解率、反应率和不良事件。</p></article>}
          {tab === '研究结果' && <Results resultTab={resultTab} onChange={setResultTab} />}
          {tab === '讨论与局限' && (
            <article className="detail-abstract">
              <p><b>结论（Conclusions）</b>{ZH[4][1]}</p>
              <p><b>主要局限</b>纳入研究存在一定的异质性（针灸方案、对照方式、疗程）。部分研究方法学质量一般。长期疗效及不同人群亚组证据仍不充分。</p>
            </article>
          )}
          {tab === '引用与关联' && (
            <article className="detail-abstract">
              <p>DOI: 10.1001/jamapsychiatry.2023.0123</p>
              <p>PMID: 36812345　PMCID: PMC3988776</p>
              <p>来源：PubMed · Crossref · 期刊官网</p>
            </article>
          )}
        </section>
        <aside className="detail-side">
          <section>
            <header><b><Sparkles size={14} />研究价值摘要</b><button type="button" className="paper-ai" onClick={() => setAiOpen(true)}>AI 解读</button></header>
            <p>本研究纳入 68 项 RCT，系统评估了针灸治疗抑郁障碍的有效性与安全性。结果显示，针灸在降低抑郁症状（HAMD 评分）方面具有显著优势（SMD = -0.62），并提高缓解率（RR = 1.45），不良事件发生率低，多为轻度、短暂。总体提示针灸对抑郁障碍具有临床意义，尤其适用于不耐受药物或希望减少药物剂量的患者。</p>
          </section>
          <section>
            <header><b>证据质量与局限</b><span>GRADE 评级: Moderate（中等）</span></header>
            <div className="detail-grades">
              {GRADES.map(([label, value, tone]) => <div key={label}><small>{label}</small><b className={tone}>{value}</b></div>)}
            </div>
            <h3>主要局限</h3>
            <ul>
              <li>纳入研究存在一定的异质性（针灸方案、对照方式、疗程）</li>
              <li>部分研究方法学质量一般</li>
              <li>长期疗效及不同人群亚组证据仍不充分</li>
            </ul>
          </section>
          <section>
            <header><b>与当前 Hub 的相关性</b><span>研究上的匹配度 5 / 6</span></header>
            <div className="detail-match">
              {MATCHES.map(([label, value, tone]) => <p key={label}><small>{label}</small><span className={tone}>{value}</span></p>)}
            </div>
          </section>
          <section>
            <header><b>关联内容</b><span>查看全部</span></header>
            <div className="detail-related-tabs">
              {[['临床试验', '相关临床试验 (12)'], ['指南', '相关指南 (6)'], ['论文', '相关研究论文 (28)']].map(([key, label]) => (
                <button key={key} type="button" className={related === key ? 'on' : ''} onClick={() => setRelated(key)}>{label}</button>
              ))}
            </div>
            <ul className="detail-related">
              {RELATED[related].map(([kind, status, title]) => (
                <li key={status}>
                  {kind === 'NCT04667890' || kind === 'NCT03785754' ? <button type="button" className="paper-trial">{kind}</button> : <b>{kind}</b>}
                  <em>{status}</em>
                  <span>{title}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}
    </main>
  );
}

function Results({ resultTab, onChange }) {
  return (
    <section className="detail-results">
      <header><b>主要结果</b><span>查看全部图表</span></header>
      <div className="detail-result-tabs">
        {RESULT_TABS.map((item) => <button key={item} type="button" className={resultTab === item ? 'on' : ''} onClick={() => onChange(item)}>{item}</button>)}
      </div>
      <div className="detail-forest">
        <table>
          <thead><tr><th>研究/亚组</th><th>样本量（针灸/对照）</th><th>SMD (95% CI)</th><th>权重</th></tr></thead>
          <tbody>
            {STUDIES.map(([name, sample, effect, weight]) => <tr key={name}><td>{name}</td><td>{sample}</td><td>{effect}</td><td>{weight}</td></tr>)}
            <tr className="total"><td>总体效应</td><td>3,956 / 3,790</td><td>-0.62 [-0.78, -0.46]</td><td>100%</td></tr>
          </tbody>
        </table>
        <div className="detail-plot" aria-hidden="true">
          <i />
          {STUDIES.map(([name, , , , left]) => <b key={name} style={{ left: `${left}%` }} />)}
          <em style={{ left: '34.5%' }} />
          <small>有利于针灸　　0　　有利于对照</small>
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
