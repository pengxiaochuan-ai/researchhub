import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronRight, Search, ShieldCheck, X } from 'lucide-react';
import './home.css';

const NAV = [
  ['产品能力', 'workflow'],
  ['科研场景', 'audiences'],
  ['研究领域', 'hub'],
  ['案例与成果', 'value'],
  ['资源与指南', 'guides'],
  ['关于我们', 'about'],
];

const LOOP = [
  ['临床实践', '真实世界里的问题与需求'],
  ['发现问题', '从实践和证据中看见缺口'],
  ['开展研究', '把缺口做成可执行的研究'],
  ['形成证据', '论文、方案、方法与数据'],
  ['沉淀资产', '变成下一次研究的基础'],
  ['反哺临床', '让下一次实践更有依据'],
];

const FLOW = [
  ['临床问题', '来自真实世界的研究需求', 'q01', '从临床观察写出要回答的问题，再进入课题。', '/home/flow-question.jpg'],
  ['Research Hub', '在领域知识中汇聚证据与团队', 'h05', '进入研究中心，查看领域里已经积累的证据、课题和研究者。', '/home/flow-hub.jpg'],
  ['研究机会', '发现值得研究的问题与方向', 'o01', '先判断什么值得研究，再决定要不要形成课题。', '/home/flow-opportunity.jpg'],
  ['研究课题', '形成明确、可执行的研究课题', 'q01', '确定「我要研究什么」，并写下核心研究问题与 PICO。', '/home/flow-project.jpg'],
  ['研究方案', '基于证据的科学设计与研究方法', 's02', '决定怎么研究：设计、人群、干预、结局与统计。', '/home/flow-protocol.jpg'],
  ['研究执行', '多中心协作、数据采集与质量管理', 's03', '进入受试者、访视和多中心协作。', '/home/flow-execution.jpg'],
  ['数据与质量', '数据管理、统计分析与质量控制', 's05', '核对数据是否完整、可信，能否支撑结论。', '/home/flow-quality.jpg'],
  ['研究成果', '论文、报告、指南与科研资产沉淀', 'a01', '成果不停留在一篇论文，而进入可复用的科研资产。', '/home/flow-result.jpg'],
];

const GUIDES = [
  ['研究证据', '从高质量证据进入研究', 'e01'],
  ['研究机会', '看见什么值得研究', 'o01'],
  ['研究课题', '形成可执行的课题', 'q01'],
  ['研究方案', '把课题做成研究设计', 's02'],
  ['科研资产', '复用已沉淀的方案与数据', 'a01'],
  ['领域研究', '进入 Research Hub', 'h05'],
];

const AUDIENCES = [
  ['临床医生', '从临床问题出发，开展临床研究', '把门诊和病房里的问题，变成可验证的课题。', '/home/audience-doctor.jpg'],
  ['科研人员', '高效获取证据，设计高质量研究', '先看证据和机会，再确定课题与方案。', '/home/audience-scientist.jpg'],
  ['青年研究者', '探索研究方向，快速成长', '顺着领域里已经积累的证据和资产起步。', '/home/audience-youth.jpg'],
  ['多中心研究团队', '支持多中心协作与数据管理', '同一课题下对齐方案、执行和质量。', '/home/audience-team.jpg'],
  ['医疗机构 / 高校 / 科研院所', '构建科研能力，沉淀机构资产', '研究结束后，能力留在机构的 Research Hub。', '/home/audience-campus.jpg'],
];

const STORY = [
  ['岐研是什么？', 'AI 原生的临床科研全生命周期平台。从临床问题出发，连接证据、研究课题、研究方案与科研资产沉淀，帮助个人、团队和机构形成持续增长的科研能力。'],
  ['它帮我做什么？', '从一个临床问题走到一项可信研究：Research Hub、研究机会、研究课题、研究方案、执行、数据质量，直到研究成果。'],
  ['为什么一次研究不是终点？', '成果会变成证据、数据、方案、方法和经验。这些资产进入 Research Hub，成为这个领域下一次研究的基础。'],
  ['最终带来什么？', '个人、团队和机构的科研能力会留下来。AI 负责理解、分析、建议与起草；专家负责判断、确认和关键决策。'],
];

function go(page) {
  window.location.href = `/pages/${page}/`;
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function App() {
  const [section, setSection] = useState('hero');
  const [loop, setLoop] = useState(0);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [guides, setGuides] = useState(false);
  const [modal, setModal] = useState(null);
  const [story, setStory] = useState(0);
  const [audience, setAudience] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const nodes = [...document.querySelectorAll('[data-section]')];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setSection(visible.target.dataset.section);
    }, { threshold: [0.35, 0.6] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => setLoop((current) => (current + 1) % LOOP.length), 2400);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setModal(null);
        setGuides(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo(() => {
    const text = query.trim();
    return GUIDES.filter((item) => !text || item.join('').includes(text));
  }, [query]);

  const openNav = (id) => {
    setGuides(false);
    setSearchOpen(false);
    if (id === 'guides') {
      setGuides(true);
      return;
    }
    scrollToId(id);
  };

  return (
    <div className="home">
      <header className="top">
        <a className="brand" href="#hero" onClick={(event) => { event.preventDefault(); scrollToId('hero'); }}>
          <img src="/logo/logo.png" alt="" />
          <b>岐研</b>
          <span>中医临床研究智能平台</span>
        </a>
        <nav>
          {NAV.map(([label, id]) => (
            <button key={id} type="button" className={section === id ? 'on' : ''} onClick={() => openNav(id)}>{label}</button>
          ))}
        </nav>
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            placeholder="搜索研究课题、证据、研究方案..."
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
          />
          {searchOpen && (
            <div className="search-pop">
              {hits.length === 0 && <p>没有匹配的入口</p>}
              {hits.map(([title, note, page]) => (
                <button key={page} type="button" onClick={() => go(page)}>
                  <b>{title}</b><span>{note}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => go('p01')}>登录</button>
          <button type="button" className="solid" onClick={() => { setNotice(''); setModal('register'); }}>免费注册</button>
        </div>
      </header>

      <main>
        <section id="hero" className="hero" data-section="hero">
          <img className="hero-photo" src="/home/hero-clinician.jpg" alt="" />
          <div className="hero-copy">
            <p className="eyebrow">传承中医智慧 · 赋能临床科研</p>
            <h1>AI 原生的<br />临床科研全生命周期平台</h1>
            <p>从临床问题出发，连接<mark>证据</mark>、<mark>研究课题</mark>、<mark>研究方案</mark>与<mark>科研资产沉淀</mark>，帮助个人、团队和机构形成<mark>持续增长的科研能力</mark>。</p>
            <div className="hero-actions">
              <button type="button" className="solid" onClick={() => { setNotice(''); setModal('register'); }}>免费注册，开启科研之旅</button>
              <button type="button" className="ghost" onClick={() => { setStory(0); setModal('story'); }}>观看 2 分钟产品介绍</button>
            </div>
            <div className="trust">
              <span><ShieldCheck size={16} /> 循证为本</span>
              <span>AI 增强</span>
              <span>专家协同</span>
              <span>资产沉淀</span>
            </div>
            <dl className="stats">
              <div><b>10,000+</b><span>研究者正在使用</span></div>
              <div><b>500+</b><span>科研团队与机构</span></div>
              <div><b>200万+</b><span>中医及相关文献</span></div>
              <div><b>98%</b><span>用户推荐意愿</span></div>
            </dl>
          </div>
          <div className="hero-wheel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <p>为什么科研能力能够持续增长？</p>
            <div className="wheel">
              <i className="orbit" />
              <div className="core"><b>岐研</b><span>Research Hub</span><small>能力在这里积累</small></div>
              {LOOP.map(([title], index) => (
                <button
                  key={title}
                  type="button"
                  className={index === loop ? 'on' : ''}
                  style={{ '--i': index }}
                  onMouseEnter={() => setLoop(index)}
                  onClick={() => setLoop(index)}
                >
                  <strong>{title}</strong>
                </button>
              ))}
            </div>
            <p className="caption"><b>{LOOP[loop][0]}</b> {LOOP[loop][1]}</p>
            <p className="caption trail">临床实践 → 发现问题 → 开展研究 → 形成证据 → 沉淀资产 → 反哺临床</p>
          </div>
        </section>

        <section id="workflow" className="block" data-section="workflow">
          <div className="block-head">
            <div>
              <h2>从一个临床问题，到一项可信研究</h2>
              <p>岐研连接研究发现、设计、执行、数据质量与成果沉淀，形成完整科研工作流。</p>
            </div>
            <button type="button" onClick={() => { setStory(1); setModal('story'); }}>了解完整流程 <ChevronRight size={16} /></button>
          </div>
          <div className="flow-stage" onMouseLeave={() => setStep(null)}>
            <div className="flow-path">
              {[0, 4].map((offset) => (
                <div key={offset}>
                  {offset === 4 && <div className="flow-turn" aria-hidden="true"><i /></div>}
                  <div className="flow-row">
                    {FLOW.slice(offset, offset + 4).flatMap((item, index) => {
                      const stepIndex = offset + index;
                      const card = (
                        <div key={item[0]} className={`flow-card${step === stepIndex ? ' on' : ''}`} onMouseEnter={() => setStep(stepIndex)}>
                          <img src={item[4]} alt="" />
                          <em>{String(stepIndex + 1).padStart(2, '0')}</em>
                          <b>{item[0]}</b>
                          {step === stepIndex && (
                            <div className="flow-tip">
                              <p>{item[1]}</p>
                              <p>{item[3]}</p>
                              <button type="button" className="solid" onClick={() => go(item[2])}>进入这一步</button>
                            </div>
                          )}
                        </div>
                      );
                      if (index === 0) return [card];
                      return [<i key={`${item[0]}-joint`} className="joint" aria-hidden="true" />, card];
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="value" className="block" data-section="value">
          <div className="block-head">
            <div>
              <h2>研究结束，不代表价值结束</h2>
              <p>让每一次研究都沉淀为可复用的科研资产，持续推动新的研究与临床实践。</p>
            </div>
            <button type="button" onClick={() => go('a01')}>了解科研资产 <ChevronRight size={16} /></button>
          </div>
          <div className="values">
            <article>
              <div className="value-visual">
                <img src="/home/value-evidence.jpg" alt="" />
                <div className="value-keys"><em>文献</em><em>临床实践</em><em>研究数据</em></div>
              </div>
              <div className="value-copy">
                <h3><span>01</span>研究形成可信证据</h3>
                <p>文献、临床实践、研究数据和领域知识持续进入研究过程。</p>
              </div>
            </article>
            <i className="value-arrow" aria-hidden="true" />
            <article>
              <div className="value-visual">
                <img src="/home/value-assets.jpg" alt="" />
                <div className="value-keys"><em>数据</em><em>证据</em><em>方案</em><em>成果</em><em>经验</em></div>
              </div>
              <div className="value-copy">
                <h3><span>02</span>成果沉淀为科研资产</h3>
                <p>研究数据、方案、证据、成果、方法和经验成为可复用资产。</p>
              </div>
            </article>
            <i className="value-arrow" aria-hidden="true" />
            <article id="hub" data-section="hub">
              <div className="value-visual">
                <img src="/home/value-hub.jpg" alt="" />
                <div className="value-keys"><em>知识</em><em>证据</em><em>研究</em><em>科研资产</em><em>研究者网络</em></div>
              </div>
              <div className="value-copy">
                <h3><span>03</span>资产进入 Research Hub</h3>
                <p>Research Hub 是围绕科研领域，持续积累知识、证据、研究、科研资产与研究者网络的科研空间。</p>
              </div>
            </article>
          </div>
        </section>

        <section id="moat" className="block" data-section="moat">
          <div className="block-head">
            <div>
              <h2>岐研如何形成持续增长的科研能力</h2>
              <p>以科研生命周期为引擎，以科研资产为沉淀，以 AI 与专家协同为加速器。</p>
            </div>
            <button type="button" onClick={() => { setStory(3); setModal('story'); }}>了解更多 <ChevronRight size={16} /></button>
          </div>
          <div className="moat">
            <article>
              <img src="/home/moat-cycle.jpg" alt="" />
              <span>科研生命周期</span>
              <h3>让研究从发现问题到形成成果完整闭环。</h3>
              <ul><li>临床问题驱动</li><li>全流程支持</li><li>成果反哺临床</li></ul>
            </article>
            <article>
              <img src="/home/moat-chart.jpg" alt="" />
              <span>科研资产积累</span>
              <h3>让一次研究产生的数据、证据、方案、成果和经验成为下一次研究的基础。</h3>
              <ul><li>多源资产统一管理</li><li>经验与证据可复用</li><li>形成领域知识体系</li></ul>
            </article>
            <article>
              <img src="/home/moat-ai.jpg" alt="" />
              <span>AI × 专家协同</span>
              <h3>AI 负责理解、分析、建议与起草；专家负责判断、确认和关键决策。</h3>
              <ul><li>多源证据理解与整合</li><li>可解释的 AI 建议</li><li>专家评审与确认</li></ul>
            </article>
          </div>
        </section>

        <section id="audiences" className="block" data-section="audiences">
          <div className="block-head">
            <div>
              <h2>适合这样的你</h2>
              <p>无论您是个人研究者，还是科研团队或机构，岐研都能为您提供合适的支持。</p>
            </div>
          </div>
          <div className="people">
            {AUDIENCES.map(([title, note, more, photo], index) => (
              <button key={title} type="button" className={audience === index ? 'on' : ''} onMouseEnter={() => setAudience(index)} onClick={() => setAudience(index)}>
                <img src={photo} alt="" />
                <b>{title}</b>
                <span>{audience === index ? more : note}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="join" className="join" data-section="join">
          <div>
            <h2>加入岐研，开启更有价值的研究</h2>
            <p>与 10,000+ 研究者一起，让中医智慧惠及更多患者</p>
            <div className="hero-actions">
              <button type="button" className="solid light" onClick={() => { setNotice(''); setModal('register'); }}>免费注册</button>
              <button type="button" className="ghost light" onClick={() => { setNotice(''); setModal('demo'); }}>预约演示</button>
            </div>
          </div>
          <ul>
            <li><b>专业可信</b><span>基于循证医学与学术标准</span></li>
            <li><b>高效智能</b><span>AI 助力科研全流程</span></li>
            <li><b>开放协作</b><span>连接研究者与机构</span></li>
          </ul>
          <p className="join-mark">更好的研究<br />更健康的未来</p>
        </section>
      </main>

      <footer id="about" data-section="about">
        <div>
          <b>岐研</b>
          <span>中医临床研究智能平台</span>
        </div>
        <p>此页固化 2026-09-24 的开放性首页。现行首页仍从站点根地址进入。</p>
        <button type="button" onClick={() => go('p01')}>进入平台</button>
      </footer>

      <aside className={`rail${section === 'audiences' || section === 'join' || section === 'about' ? ' quiet' : ''}`} aria-label="页面层次">
        {[['hero', '是什么'], ['workflow', '怎么做'], ['value', '价值'], ['moat', '能力']].map(([id, label]) => (
          <button key={id} type="button" className={section === id || (id === 'value' && section === 'hub') ? 'on' : ''} onClick={() => scrollToId(id)}>
            <i />{label}
          </button>
        ))}
      </aside>

      {guides && (
        <div className="sheet" onClick={() => setGuides(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <header><h3>资源与指南</h3><button type="button" onClick={() => setGuides(false)} aria-label="关闭"><X size={18} /></button></header>
            {GUIDES.map(([title, note, page]) => (
              <button key={page} type="button" onClick={() => go(page)}><b>{title}</b><span>{note}</span><ChevronRight size={16} /></button>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="sheet" onClick={() => setModal(null)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{modal === 'register' ? '免费注册' : modal === 'demo' ? '预约演示' : '产品介绍'}</h3>
              <button type="button" onClick={() => setModal(null)} aria-label="关闭"><X size={18} /></button>
            </header>
            {modal === 'story' && (
              <div className="story">
                <small>{story + 1} / {STORY.length}</small>
                <h4>{STORY[story][0]}</h4>
                <p>{STORY[story][1]}</p>
                <div className="hero-actions">
                  <button type="button" disabled={story === 0} onClick={() => setStory((current) => current - 1)}>上一层</button>
                  {story < STORY.length - 1
                    ? <button type="button" className="solid" onClick={() => setStory((current) => current + 1)}>下一层</button>
                    : <button type="button" className="solid" onClick={() => go('p01')}>进入平台</button>}
                </div>
              </div>
            )}
            {modal === 'register' && <LeadForm kind="register" notice={notice} onDone={setNotice} />}
            {modal === 'demo' && <LeadForm kind="demo" notice={notice} onDone={setNotice} />}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadForm({ kind, notice, onDone }) {
  const [form, setForm] = useState({ name: '', org: '', role: AUDIENCES[0][0], mail: '', when: '本周三下午' });
  const set = (key) => (event) => {
    onDone('');
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.org.trim() || !/^\S+@\S+\.\S+$/.test(form.mail)) {
      onDone('请填写姓名、机构和有效邮箱。');
      return;
    }
    const saved = JSON.parse(sessionStorage.getItem('qiyan-open-home') || '[]');
    saved.push({ kind, ...form, at: new Date().toISOString() });
    sessionStorage.setItem('qiyan-open-home', JSON.stringify(saved));
    onDone(kind === 'register' ? '登记已保存在本机。可以先进入平台体验。' : '演示预约已记录。我们按你留下的时间安排讲解。');
  };
  if (notice.startsWith('登记') || notice.startsWith('演示')) {
    return (
      <div className="story">
        <p>{notice}</p>
        <button type="button" className="solid" onClick={() => go('p01')}>进入平台</button>
      </div>
    );
  }
  return (
    <form className="lead" onSubmit={submit}>
      <label>姓名<input value={form.name} onChange={set('name')} /></label>
      <label>机构<input value={form.org} onChange={set('org')} /></label>
      <label>身份
        <select value={form.role} onChange={set('role')}>{AUDIENCES.map(([title]) => <option key={title}>{title}</option>)}</select>
      </label>
      <label>邮箱<input value={form.mail} onChange={set('mail')} placeholder="name@org.cn" /></label>
      {kind === 'demo' && (
        <label>期望时间
          <select value={form.when} onChange={set('when')}>{['本周三下午', '本周五上午', '下周一上午'].map((item) => <option key={item}>{item}</option>)}</select>
        </label>
      )}
      {notice && <p className="warn">{notice}</p>}
      <button type="submit" className="solid">{kind === 'register' ? '提交注册' : '提交预约'}</button>
    </form>
  );
}

createRoot(document.getElementById('root')).render(<App />);
