import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Shell, go } from './Shell.jsx';
import { AIPanel, Button, Card, CheckList, Stepper } from './Components.jsx';
import './q01-project.css';

const PROJECT_NAME = '针灸维持治疗对抑郁症患者长期疗效及复发预防作用的多中心随机对照研究';
const CORE_QUESTION = '针灸维持治疗是否能够降低抑郁症患者 12 个月复发率？';

export function Q01() {
  const [name, setName] = useState(PROJECT_NAME);
  const [question, setQuestion] = useState(CORE_QUESTION);
  const [pico, setPico] = useState({
    p: '抑郁症缓解期患者',
    i: '针灸维持治疗',
    c: '常规随访/标准治疗',
    o: '12 个月复发率',
  });
  const [saved, setSaved] = useState(false);

  const checks = [
    ['课题名称已形成', name.trim().length > 0],
    ['核心问题是可回答的问句', /[？?]$/.test(question.trim())],
    ['P — 人群已界定', pico.p.trim().length > 0],
    ['I — 干预已界定', pico.i.trim().length > 0],
    ['C — 对照已界定', pico.c.trim().length > 0],
    ['O — 结局与时间已界定', pico.o.trim().length > 0],
  ];
  const ready = checks.every(([, ok]) => ok);

  useEffect(() => {
    const onAction = (event) => {
      if (event.detail?.label === '保存草稿') setSaved(true);
    };
    window.addEventListener('qiyan:page-action', onAction);
    return () => window.removeEventListener('qiyan:page-action', onAction);
  }, []);

  const setField = (key) => (event) => {
    setSaved(false);
    setPico((current) => ({ ...current, [key]: event.target.value }));
  };

  return <Shell active="领域研究" hero={{
    breadcrumb: '研究机会 › 研究课题',
    title: '研究课题',
    en: 'Research Project',
    subtitle: '从临床问题与研究机会出发，形成明确、可验证、可执行的研究课题。',
    actions: [{ label: '保存草稿', icon: <Save /> }, { label: '生成研究方案', primary: true }],
  }}>
    <div className="content stack q01-project">
      <Stepper steps={['形成研究课题', '明确核心研究问题', 'AI 检查', '生成研究方案']} active={1} />
      <div className="main-grid">
        <div className="stack">
          <Card className="form-block">
            <div className="q01-kicker"><h2>研究课题</h2><em>Research Project</em></div>
            <p>决定「我要研究什么」。课题从临床问题与研究机会形成，确认后再进入研究方案。</p>
            <label className="q01-field">研究课题名称
              <textarea className="textarea" value={name} onChange={(event) => { setSaved(false); setName(event.target.value); }} />
            </label>
            <div className="detail-list">
              <p><span>来源</span><b>研究机会 OP-2026-017</b></p>
              <p><span>所属领域</span><b>针灸治疗情志病</b></p>
              <p><span>研究类型</span><b>多中心随机对照研究</b></p>
            </div>
            {saved && <div className="notice">草稿已保存。课题名称和核心研究问题会一起进入研究方案。</div>}
          </Card>
          <Card className="form-block" id="q01-question">
            <div className="q01-kicker"><h2>核心研究问题</h2><em>Research Question</em></div>
            <p>明确「这个课题具体要回答什么」。它是课题内部的方法学对象，不单独作为平台一级对象。</p>
            <label className="q01-field">核心研究问题
              <textarea className="textarea" value={question} onChange={(event) => { setSaved(false); setQuestion(event.target.value); }} />
            </label>
            <h3>PICO</h3>
            <div className="q01-pico">
              {[
                ['p', 'P', '人群', pico.p],
                ['i', 'I', '干预', pico.i],
                ['c', 'C', '对照', pico.c],
                ['o', 'O', '结局', pico.o],
              ].map(([key, mark, label, value]) => (
                <label key={key}><b>{mark}</b> {label}
                  <input value={value} onChange={setField(key)} />
                </label>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <AIPanel title="核心研究问题是否明确" action="查看检查依据">
            <p>岐研 AI 检查这个问题是否明确、可验证。它不代替研究者确定课题，也不自动生成研究方案。</p>
            {checks.some(([, ok]) => ok) && <CheckList items={checks.filter(([, ok]) => ok).map(([label]) => label)} />}
            <div className="notice">{ready ? '核心研究问题已经明确，可以生成研究方案。' : `${checks.filter(([, ok]) => !ok).map(([label]) => label).join('、')}，仍需研究者确认。`}</div>
          </AIPanel>
          <Card title="来自研究机会" className="form-block">
            <p>针灸治疗抑郁症的长期疗效与复发预防仍存在证据缺口。</p>
            <p className="muted">研究机会说明什么值得研究。形成课题后，才决定具体要回答的核心问题。</p>
            <Button onClick={() => go('o02')}>查看 OP-2026-017</Button>
          </Card>
        </div>
      </div>
      <div className="q01-actions">
        <Button onClick={() => go('o02')}>取消</Button>
        <div>
          <Button onClick={() => setSaved(true)}>保存草稿</Button>
          <Button primary onClick={() => go('s02')}>下一步：生成研究方案 →</Button>
        </div>
      </div>
    </div>
  </Shell>;
}
