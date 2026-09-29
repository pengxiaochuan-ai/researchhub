import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, ShieldCheck, Sparkles, Users, X } from 'lucide-react';

const TABS = ['核心解读', '临床启示', '方法学评价', '与其他研究比较', '研究局限', '未来研究方向'];
const METRICS = [
  ['总体疗效', '显著改善抑郁症状', '', Shield],
  ['证据强度', '中等', 'GRADE: Moderate', Shield],
  ['适用人群', '成人抑郁障碍患者', '以轻中度为主', Users],
  ['安全性', '总体安全', '未报告严重不良事件', ShieldCheck],
  ['临床价值', '可作为辅助治疗手段', '尤其适用于不耐受药物者', Sparkles],
];
const FINDS = [
  ['疗效显著', '针灸较假针灸/常规治疗可显著降低 HAMD 评分（SMD = -0.62，95% CI: -0.78 to -0.46，P < 0.001），缓解率更高（RR = 1.45）。'],
  ['一致性较好', '各项研究结果总体一致，异质性处于可接受范围（I² = 48%），亚组分析显示不同针刺方案疗效差异有限。'],
  ['安全性良好', '不良事件发生率较低，以局部轻微反应为主，未报告严重不良事件。'],
  ['证据局限', '部分研究存在方法学质量一般、样本量较小、随访时间较短等问题，可能影响结论的稳定性。'],
];
const REL = [
  ['研究人群', '成人抑郁障碍', 'match'],
  ['干预方式', '针灸（含体针、电针、耳针）', 'match'],
  ['研究设计', '系统综述 / Meta分析（纳入RCT）', 'match'],
  ['结局指标', '抑郁症状（HAMD、BDI等）', 'match'],
  ['比较方式', '针灸 vs 假针灸/常规治疗', 'match'],
  ['随访周期', '短期为主', 'partial'],
];
const TIPS = [
  '针灸可作为抑郁障碍的辅助治疗手段，尤其适用于不耐受或不愿使用药物的患者。',
  '在临床应用中建议结合患者具体情况（抑郁严重程度、合并症、既往治疗史）综合评估。',
  '建议关注个体化针刺方案和规范化操作，以提高疗效的稳定性。',
];
const MORE = {
  临床启示: TIPS,
  方法学评价: [
    'GRADE 评级为 Moderate（中等）。',
    '研究间异质性 I² = 48%，处于可接受范围。',
    '部分研究的方法学质量和样本量仍然有限。',
  ],
  与其他研究比较: [
    '与假针灸或常规治疗相比，针灸降低 HAMD 评分的效应为 SMD = -0.62。',
    '缓解率更高，RR = 1.45（95% CI: 1.20–1.74）。',
    '不同针刺方案之间的疗效差异有限。',
  ],
  研究局限: [
    '纳入研究的针灸方案、对照方式和疗程并不一致。',
    '部分研究方法学质量一般，样本量较小。',
    '随访以短期为主，长期疗效证据不足。',
  ],
  未来研究方向: [
    '需要更多高质量、多中心、大样本的随机对照试验。',
    '需要更长的随访，以判断疗效能否维持。',
    '需要按抑郁严重程度和人群亚组分开观察获益。',
  ],
};

export function AiPanel({ onClose }) {
  const [tab, setTab] = useState(TABS[0]);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('ai-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('ai-open');
    };
  }, [onClose]);

  const copy = async () => {
    const text = '这项系统综述与 Meta 分析纳入 68 项 RCT 研究表明，针灸在改善抑郁症状方面具有中等强度的证据支持，整体安全性良好，但仍需更多高质量、多中心、长期随访的研究进一步验证。';
    try { await navigator.clipboard.writeText(text); } catch { /* 页面内仍给出已复制 */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return createPortal(
    <div className="ai-layer" role="presentation">
      <button type="button" className="ai-scrim" aria-label="关闭解读" onClick={onClose} />
      <aside className="ai-panel" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <header>
          <div><b id="ai-title"><Sparkles size={16} />岐研 AI 解读</b><small>基于当前证据，提供更深入的分析、解读与启示</small></div>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="ai-tabs">
          {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="ai-body">
          {tab === '核心解读' ? <Core summary={summary} onSummary={() => setSummary(true)} /> : (
            <section className="ai-card">
              <h3>{tab}</h3>
              <ul>{MORE[tab].map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
        </div>
        <footer>
          <small>以上内容由岐研 AI 基于文献内容生成，仅供参考，不替代专业判断。</small>
          <div>
            <button type="button" onClick={copy}>{copied ? '已复制' : '复制内容'}</button>
            <button type="button">导出报告</button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function Core({ summary, onSummary }) {
  return (
    <>
      <section className="ai-card">
        <header><b>一页核心结论</b><button type="button" onClick={onSummary}>{summary ? '已生成摘要' : '生成结果摘要'}</button></header>
        <p>这项系统综述与 Meta 分析纳入 68 项 RCT 研究表明，针灸在改善抑郁症状方面具有中等强度的证据支持，整体安全性良好，但仍需更多高质量、多中心、长期随访的研究进一步验证。</p>
      </section>
      <div className="ai-metrics">
        {METRICS.map(([title, value, note, Icon]) => (
          <div key={title}><Icon size={16} /><b>{title}</b><strong>{value}</strong>{note && <small>{note}</small>}</div>
        ))}
      </div>
      <div className="ai-two">
        <section className="ai-card">
          <h3>关键发现解读</h3>
          <ol>{FINDS.map(([title, text], index) => <li key={title}><b>{index + 1} {title}</b><span>{text}</span></li>)}</ol>
        </section>
        <div>
          <section className="ai-card">
            <h3>与你的研究问题的相关性</h3>
            {REL.map(([label, value, tone]) => <p key={label}><small>{label}</small><span className={tone}>{value}</span></p>)}
          </section>
          <section className="ai-card">
            <h3>对临床实践的启示</h3>
            <ul>{TIPS.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </div>
      <section className="ai-card">
        <h3>相关证据与延伸阅读</h3>
        <div className="ai-more">
          <div><b>相关临床试验 (12)</b><small>进行中 5 | 已完成 7</small></div>
          <div><b>相关指南 (6)</b><small>中国 3 | 国际 3</small></div>
          <div><b>相关研究论文 (28)</b><small>高相关 12 | 中等相关 16</small></div>
        </div>
      </section>
    </>
  );
}
