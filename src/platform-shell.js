import { goToPage } from './platform-navigation.js';
import './design-tokens.css';
import './platform-shell.css';

const WORKSPACES = [
  ['我的科研', 'p01'],
  ['领域研究', 'h01'],
  ['岐研 AI', 'ai01'],
  ['科研资产', 'a01'],
  ['管理与治理', 'g02'],
];

const WORKSPACE_ICONS = {
  我的科研: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>',
  领域研究: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>',
  '岐研 AI': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>',
  科研资产: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M8 10v4"></path><path d="M12 10v2"></path><path d="M16 10v6"></path></svg>',
  管理与治理: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>',
};

const HUB_NAV = [
  ['总览', 'h01'],
  ['临床注册', 'c01'],
  ['研究论文', 'e01'],
  ['指南与教材'],
  ['研究团队', 't01'],
  ['研究者', 'r01'],
  ['研究机会', 'o01'],
  ['科研资产', 'a01'],
  ['相关研究'],
];

const STUDY_NAV = [
  ['概览', 's01'], ['研究设计', 's02'], ['研究执行', 's03'], ['数据与质量', 's05'],
  ['研究分析', 's06'], ['科研产出'], ['科研资产', 'a01'], ['团队与设置'],
];

const GOVERNANCE_NAV = [
  ['总览', 'g02'], ['伦理合规', 'g01'], ['数据治理'], ['研究质量'],
  ['用户与权限'], ['多中心管理'], ['审计日志'], ['系统配置'],
];

const AI_NAV = [
  ['对话'], ['研究设计'], ['文献检索', 'e01'], ['数据分析', 's06'],
  ['方案评审', 'g01'], ['写作助手'],
];

const pageContexts = {
  h05: {
    workspace: '领域研究',
    crumbs: [['领域研究']],
    title: '领域研究',
    concept: 'Research Hub',
    description: '发现、参与和建设专业的研究领域，汇聚研究者、文献、数据与 AI 能力，共同推动中医临床研究的发展。',
  },
  h01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病']],
    title: '针灸治疗情志病', concept: 'Research Hub', tags: ['重点领域'],
    description: '汇聚针灸治疗情志病领域的临床注册、研究论文、指南教材、研究机构与研究者，持续呈现领域研究进展、研究网络与证据变化，支持研究者发现研究机会、开展研究、沉淀科研资产。',
    actions: [['已关注'], ['分享']],
    nav: HUB_NAV, active: '总览',
    hide: ['.crumb', '.hero', '.tabs'],
  },
  t02: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究团队', 't01'], ['团队详情']],
    title: '团队详情',
    description: '查看这个研究团队的方向、成员、试验和代表成果，并判断它与针灸治疗情志病的关系。',
    nav: HUB_NAV, active: '研究团队',
    hide: ['.crumb', '.hero'],
  },
  r01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01']],
    title: '研究者',
    description: '发现研究领域内的核心专家，了解其研究方向、代表成果与合作网络。',
    nav: HUB_NAV, active: '研究者',
    hide: ['.crumb', '.hero', '.tabs'],
  },
  r02: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究者', 'r01'], ['研究者详情']],
    title: '研究者详情',
    description: '查看这位研究者在针灸治疗情志病里做了什么、与谁一起做、参与了哪些研究。',
    nav: HUB_NAV, active: '研究者',
    hide: ['.crumb', '.hero'],
  },
  t01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01']],
    title: '研究团队',
    description: '发现当前领域持续开展研究的核心团队，了解他们的研究方向、代表成果与合作网络。',
    nav: HUB_NAV, active: '研究团队',
    hide: ['.crumb', '.hero', '.tabs'],
  },
  c03: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['临床注册', 'c01'], ['试验详情']],
    title: '试验详情',
    description: '查看这项临床注册的设计、进度和研究者，并判断它与针灸治疗情志病的关系。',
    nav: HUB_NAV, active: '临床注册',
    hide: ['.crumb', '.hero'],
  },
  c01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01']],
    title: '临床注册',
    description: '聚焦针灸治疗情志病方向的最新临床注册研究，支持按疾病、干预方式、机构与招募状态进行检索与对比。',
    nav: HUB_NAV, active: '临床注册',
    hide: ['.crumb', '.hero', '.tabs'],
  },
  e01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01']],
    title: '研究论文',
    description: '检索和浏览与本研究领域相关的学术论文，支持多维度筛选、对比和 AI 解读。',
    nav: HUB_NAV, active: '研究论文',
    actions: [['保存检索'], ['检索历史'], ['导出结果']],
    hide: ['.crumb', '.hero', '.side', '.top'],
  },
  e02: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究论文', 'e01'], ['论文详情']],
    title: '论文详情', description: '查看这篇论文的摘要、研究结果和证据质量，并判断它与针灸治疗情志病的关系。',
    nav: HUB_NAV, active: '研究论文',
    hide: ['.crumb', '.pageTitle'],
  },
  e03: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究论文', 'e01'], ['AI 证据解读']],
    title: '研究证据', concept: 'AI Evidence',
    description: '从全球高质量证据中，快速找到与研究问题相关的证据。',
    nav: HUB_NAV, active: '研究论文',
    hide: [':scope > small', ':scope > h1', ':scope > p'],
  },
  o01: {
    workspace: '领域研究', crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究机会']],
    title: '研究机会', description: '从领域变化与研究证据中发现、筛选和比较值得进一步形成研究课题的方向。',
    nav: HUB_NAV, active: '研究机会', actions: [['我的关注'], ['＋ 订阅机会', null, true]],
    hide: ['.crumb', '.titleRow', '.hubStrip'],
  },
  o02: {
    workspace: '领域研究',
    crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究机会', 'o01'], ['OP-2026-017']],
    title: '针灸治疗抑郁症的长期疗效与复发预防仍存在证据缺口',
    description: '研究机会 OP-2026-017　·　基于研究证据识别的高潜力研究方向。',
    nav: HUB_NAV, active: '研究机会', actions: [['分享'], ['导出'], ['形成研究课题', 'q01', true]],
    headerAside: 'opportunityPotential', navActions: true,
    hide: ['.platform-hero'],
  },
  q01: {
    workspace: '领域研究',
    crumbs: [['领域研究', 'h05'], ['针灸治疗情志病', 'h01'], ['研究机会', 'o01'], ['研究课题']],
    title: '研究课题', concept: 'Research Project',
    description: '从临床问题与研究机会出发，形成明确、可验证、可执行的研究课题。',
    meta: '来源：OP-2026-017', nav: HUB_NAV, active: '研究机会',
    actions: [['保存草稿'], ['生成研究方案', 's02', true]], hide: ['.platform-hero'],
  },
  ai01: {
    workspace: '岐研 AI', crumbs: [['岐研 AI']], title: '岐研 AI',
    description: '基于领域知识与您的研究上下文，提供证据化的分析、建议与研究设计支持。',
    nav: AI_NAV, active: '对话', actions: [['＋ 新建对话', null, true]],
    hide: ['.aiHeader', '.tabs'],
  },
  a01: {
    workspace: '科研资产', crumbs: [['科研资产', 'a01']], title: '科研资产',
    description: '积累、沉淀、共享高质量的研究资产，促进检索、复用与持续创新。',
    actions: [['上传资产', null, true]], hide: ['.platform-hero'],
  },
  a02: {
    workspace: '科研资产', crumbs: [['科研资产', 'a01'], ['AS-2026-018']],
    title: '针灸治疗抑郁症研究方案模板', concept: 'Asset Detail',
    description: '高质量研究方案资产，支持共享、引用和复用。',
    meta: '来源：针刺抑郁多中心研究　·　Derived From：Analysis Result AR-2026-009',
    actions: [['引用'], ['分享'], ['下载'], ['复用此资产', null, true]], hide: ['.platform-hero'],
  },
  s01: {
    workspace: '我的科研', crumbs: [['我的科研', 'p01'], ['针刺抑郁多中心研究']],
    title: '针刺抑郁多中心研究', description: '针刺治疗中度抑郁症的有效性与安全性：一项多中心、随机、对照研究。',
    meta: 'ChiCTR2300087654　·　进行中', nav: STUDY_NAV, active: '概览',
    actions: [['分享'], ['编辑', 's02', true]], hide: ['.study-head', '.study-tabs'],
  },
  s02: studyContext('研究设计', '研究设计详情', [['我的科研', 'p01'], ['针刺抑郁多中心研究', 's01'], ['研究设计']]),
  s03: studyContext('研究执行', '受试者管理', [['我的科研', 'p01'], ['针刺抑郁多中心研究', 's01'], ['研究执行'], ['受试者管理']]),
  s04: studyContext('研究执行', '受试者详情', [['我的科研', 'p01'], ['针刺抑郁多中心研究', 's01'], ['研究执行'], ['受试者详情']]),
  s05: studyContext('数据与质量', '数据质量详情', [['我的科研', 'p01'], ['针刺抑郁多中心研究', 's01'], ['数据与质量'], ['数据质量详情']]),
  s06: studyContext('研究分析', '分析结果详情', [['我的科研', 'p01'], ['针刺抑郁多中心研究', 's01'], ['研究分析'], ['分析结果详情']]),
  g01: {
    workspace: '管理与治理', crumbs: [['管理与治理', 'g02'], ['伦理合规'], ['人工审查与审批']],
    title: '人工审查与审批', description: '多角色协同审查与审批，确保研究方案、数据变更和重要文档合规、可追溯。',
    nav: GOVERNANCE_NAV, active: '伦理合规', actions: [['导出记录'], ['下一步审批', null, true]],
    hide: ['.platform-hero'],
  },
  g02: {
    workspace: '管理与治理', crumbs: [['管理与治理', 'g02']], title: '管理与治理',
    description: '保障研究合规、数据安全、质量可控，促进多中心协作与科研价值的可持续发展。',
    nav: GOVERNANCE_NAV, active: '总览', actions: [['下载治理报告'], ['2024-01-01 ～ 2024-12-31']],
    hide: ['.platform-hero', '.g02-content > .ui-tabs'],
  },
  h02: hubCreateContext(),
  h03: hubCreateContext(),
  h04: hubCreateContext(),
};

function hubCreateContext() {
  return {
    workspace: '领域研究',
    crumbs: [['领域研究', 'h05'], ['创建 Research Hub']],
    title: '创建 Research Hub',
    description: '构建专注的研究空间，汇聚证据、项目、数据与团队，推动高质量的临床研究。',
  };
}

function studyContext(active, currentPage, crumbs) {
  return {
    workspace: '我的科研', crumbs, title: '针刺抑郁多中心研究',
    description: '针刺治疗中度抑郁症的有效性与安全性：一项多中心、随机、对照研究。',
    meta: `ChiCTR2300087654　·　进行中　·　当前页面：${currentPage}`,
    nav: STUDY_NAV, active, actions: [['返回概览', 's01']], hide: ['.platform-hero'],
  };
}

function findLegacySidebar() {
  return document.querySelector([
    '[data-platform-sidebar-slot]',
    '#root > .platform-app > aside.platform-side',
    '#root > aside:not(.contextRail)',
    '#root > .side',
    '#root > main + aside',
  ].join(', '));
}

function createSidebar(pageId) {
  const selected = pageContexts[pageId]?.workspace || (pageId === 'p01' ? '我的科研' : '领域研究');
  const aside = document.createElement('aside');
  aside.className = 'qiyan-platform-sidebar';
  aside.dataset.platformSidebar = 'true';
  const items = WORKSPACES.map(([label, page]) => `
    <button class="qiyan-nav-item${selected === label ? ' active' : ''}" type="button" data-page="${page}">
      ${WORKSPACE_ICONS[label]}<span>${label}</span>
    </button>`).join('');
  aside.innerHTML = `<nav aria-label="平台主导航">${items}</nav>
    <div class="qiyan-sidebar-tools">
      <button type="button" data-shell-action="help">帮助中心</button>
      <button type="button" data-shell-action="collapse">‹　收起菜单</button>
    </div>
    <button class="qiyan-sidebar-ai" type="button" data-page="ai01"><b>岐研 AI 助手</b><small>随时为您的研究工作提供支持</small><span>›</span></button>`;
  aside.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => goToPage(button.dataset.page)));
  aside.querySelectorAll('[data-shell-action]').forEach((button) => button.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent(`qiyan:${button.dataset.shellAction}`));
  }));
  return aside;
}

function mountSidebar(pageId) {
  const mounted = document.querySelector('.qiyan-platform-sidebar');
  if (mounted) return mounted;
  const legacy = findLegacySidebar();
  const sidebar = createSidebar(pageId);
  if (legacy) legacy.replaceWith(sidebar);
  else document.getElementById('root')?.prepend(sidebar);
  return sidebar;
}

function createBreadcrumb(crumbs) {
  const row = document.createElement('nav');
  row.className = 'qiyan-context-breadcrumb';
  row.setAttribute('aria-label', '面包屑导航');
  crumbs.forEach(([label, page], index) => {
    const node = document.createElement(page ? 'button' : 'span');
    node.textContent = label;
    if (page) node.addEventListener('click', () => goToPage(page));
    if (index === crumbs.length - 1) node.setAttribute('aria-current', 'page');
    row.append(node);
    if (index < crumbs.length - 1) row.insertAdjacentHTML('beforeend', '<i aria-hidden="true">›</i>');
  });
  return row;
}

function createContextHeader(config, pageId) {
  const section = document.createElement('section');
  section.className = 'qiyan-page-context';
  section.dataset.pageContext = pageId;
  section.append(createBreadcrumb(config.crumbs));

  const header = document.createElement('div');
  header.className = 'qiyan-page-heading';
  header.innerHTML = `<div class="qiyan-page-heading-copy">
      <div class="qiyan-page-title-row"><h1>${config.title}</h1>${config.concept ? `<span>${config.concept}</span>` : ''}${(config.tags || []).map((tag) => `<span class="qiyan-page-tag">${tag}</span>`).join('')}</div>
      <p>${config.description || ''}</p>
      ${config.meta ? `<small>${config.meta}</small>` : ''}
    </div><div class="qiyan-page-actions"></div>`;
  const actions = header.querySelector('.qiyan-page-actions');
  if (config.headerAside === 'opportunityPotential') {
    actions.classList.add('qiyan-opportunity-potential');
    actions.innerHTML = `<small>研究潜力</small><strong>高</strong><span>值得进一步形成研究课题</span>
      <button type="button" data-opportunity-save><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>保存机会</button>`;
    actions.querySelector('[data-opportunity-save]').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('qiyan:page-action', { detail: { pageId, label: '保存机会' } }));
    });
  } else {
    (config.actions || []).forEach(([label, targetPage, primary]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = primary ? 'primary' : '';
      button.textContent = label;
      button.addEventListener('click', () => {
        if (targetPage) goToPage(targetPage);
        else window.dispatchEvent(new CustomEvent('qiyan:page-action', { detail: { pageId, label } }));
      });
      actions.append(button);
    });
  }
  section.append(header);

  if (config.nav?.length) {
    const nav = document.createElement('nav');
    nav.className = 'qiyan-context-nav';
    nav.setAttribute('aria-label', `${config.workspace}上下文导航`);
    config.nav.forEach(([label, targetPage]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = config.active === label ? 'active' : '';
      if (config.active === label) button.setAttribute('aria-current', 'page');
      button.textContent = label;
      button.addEventListener('click', () => {
        if (targetPage) goToPage(targetPage);
        else window.dispatchEvent(new CustomEvent('qiyan:context-nav', { detail: { pageId, label } }));
      });
      nav.append(button);
    });
    if (config.navActions) {
      const navActions = document.createElement('div');
      navActions.className = 'qiyan-context-actions';
      (config.actions || []).forEach(([label, targetPage, primary]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = primary ? 'primary' : '';
        button.textContent = label;
        button.addEventListener('click', () => {
          if (targetPage) goToPage(targetPage);
          else window.dispatchEvent(new CustomEvent('qiyan:page-action', { detail: { pageId, label } }));
        });
        navActions.append(button);
      });
      nav.append(navActions);
    } else if (config.workspace === '领域研究') {
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'qiyan-context-primary';
      create.textContent = '＋ 新建研究';
      create.addEventListener('click', () => goToPage('q01'));
      nav.append(create);
    }
    section.append(nav);
  }
  return section;
}

function hideLegacyContext(main, selectors) {
  selectors.forEach((selector) => {
    try {
      main.querySelectorAll(selector).forEach((element) => element.classList.add('qiyan-legacy-context-hidden'));
    } catch {
      // A malformed third-party selector must not block the shared shell.
    }
  });
}

function mountContextHeader(pageId) {
  if (pageId === 'p01') return null;
  const config = pageContexts[pageId];
  const main = document.querySelector('#root > main, #root > .platform-app > main, main');
  if (!config || !main) return null;
  const mounted = main.querySelector(':scope > .qiyan-page-context');
  if (mounted) return mounted;
  hideLegacyContext(main, config.hide || []);
  const context = createContextHeader(config, pageId);
  main.prepend(context);
  return context;
}

function mountO02RightRail(pageId) {
  if (pageId !== 'o02') return null;
  const rail = document.querySelector('html[data-page="o02"] .content > .main-grid > .stack:last-child');
  if (!rail || rail.dataset.opportunityRail === 'true') return rail;
  const originalTopRight = document.querySelector('html[data-page="o02"] .content > .two-col:first-child > .ui-card:last-child');
  if (originalTopRight) originalTopRight.replaceWith(rail);
  rail.className = 'o02-opportunity-rail';
  rail.dataset.opportunityRail = 'true';
  rail.innerHTML = `<section class="o02-ai-judgement">
    <header class="o02-ai-title">
      <span class="o02-ai-icon">${WORKSPACE_ICONS['岐研 AI']}</span>
      <div><b>岐研 AI · 研究机会研判</b><small>基于研究中心、课题与证据上下文 · 可追溯</small></div>
    </header>
    <div class="o02-ai-reason key"><small>AI 综合研判</small>
      <h3>为什么它已经是「研究机会」，但还不是「研究课题」？</h3>
      <p>现有证据足以确认「长期疗效与复发预防」存在值得研究的证据缺口；但课题范围、核心研究问题、人群、干预、对照和结局仍需要研究者确定。</p>
    </div>
    <div class="o02-ai-reason"><small>为什么这个缺口重要</small>
      <p>如果长期获益不能得到验证，短期疗效很难直接转化为稳定的临床治疗策略。</p>
    </div>
    <div class="o02-ai-reason"><small>可研究性判断</small>
      <div class="o02-ai-score"><div><b>高</b><span>临床价值</span></div><div><b>中-高</b><span>研究可行性</span></div><div><b>高</b><span>缺口清晰度</span></div></div>
    </div>
    <div class="o02-ai-boundary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
      <p><b>AI 边界</b><br>这是候选研究机会，不是研究结论，也不是正式课题。岐研 AI 不会自动形成研究课题，也不会自动确定核心研究问题。</p>
    </div>
  </section>`;
  return rail;
}

export function mountPlatformShell(pageId) {
  mountSidebar(pageId);
  mountContextHeader(pageId);
  mountO02RightRail(pageId);
}
