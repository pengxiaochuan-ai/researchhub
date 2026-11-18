import {mountFrontendLinks} from './platform-frontend.js';
import { goToNav, goToPage } from './platform-navigation.js';
import { mountPlatformHeader } from './platform-header.js';
import { mountPlatformShell } from './platform-shell.js';
import {realModeRouteState} from './real-mode-route.js';
import {isResearchProjectRoute} from './research-projects-session.js';
import './real-mode-gate.css';
import './hub-source-responsive.css';

const currentPage = window.location.pathname.match(/^\/pages\/([^/]+)/)?.[1];
let explicitDemo=false;try{explicitDemo=sessionStorage.getItem('lingshu-demo-mode')==='true';}catch{}
const realRouteState=realModeRouteState(currentPage,window.location.search,{configured:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG),explicitDemo});
if(realRouteState==='live'&&['g02','e01','e02','h01','h05','c01','c03','h06','t01','t02','r01','r02','g03','g04','g01'].includes(currentPage))document.body.dataset.hubSourceReal='true';
if(realRouteState==='entry')document.body.dataset.realEntry='true';
const realPageGated=realRouteState==='pending';
if(realPageGated){
  document.body.dataset.realPageGated='true';
  const gate=document.createElement('main'),card=document.createElement('section'),title=document.createElement('h1'),detail=document.createElement('p'),links=document.createElement('nav');
  gate.className='qiyan-real-gate';card.className='qiyan-real-gate__card';links.className='qiyan-real-gate__links';links.setAttribute('aria-label','可用入口');
  title.textContent="此页面暂不可用";
  detail.textContent="请从“我的工作台”进入已授权研究，或前往知识资料。当前页面不提供研究数据或AI结果。";
  for(const [label,url] of [['返回我的工作台','/pages/p01/'],['知识资料','/pages/k01/'],['登录或切换账号','/pages/p003/']]){const link=document.createElement('a');link.href=url;link.textContent=label;links.append(link);}
  card.append(title,detail,links);gate.append(card);document.body.append(gate);
}
const linkedNavLabels = [
  '我的工作台', '领域研究', '岐研 AI', '科研资产', '管理与治理',
];

const navSelector = [
  'aside nav a',
  'aside nav button',
  '.side .navitem',
  '.side nav .nav',
  'aside > .nav',
  '.sidebar nav button',
  '.platform-side nav button',
].join(', ');

const legacyTopLevelLabels = [
  '研究证据', '文献检索', '研究机会', '受试者管理', '数据管理',
  '人工审查', '研究分析', '项目管理', '统计分析',
];

const activeNavByPage = {
  k01: '科研资产',
  q02: '我的工作台', s07: '我的工作台', s08: '我的工作台', s09: '我的工作台', s10: '我的工作台', s11: '我的工作台',
  h06: '领域研究', h07: '领域研究', g03: '管理与治理', g04: '管理与治理', g05: '管理与治理',
  p01: '我的工作台',
  h05: '领域研究',
  h01: '领域研究',
  c01: '领域研究',
  c03: '领域研究',
  t01: '领域研究',
  t02: '领域研究',
  r01: '领域研究',
  r02: '领域研究',
  h02: '领域研究',
  h03: '领域研究',
  h04: '领域研究',
  ai01: '岐研 AI',
  a01: '科研资产',
  a02: '科研资产',
  s01: '我的工作台',
  s02: '我的工作台',
  s03: '我的工作台',
  s04: '我的工作台',
  s05: '我的工作台',
  s06: '我的工作台',
  g01: '管理与治理',
  g02: '管理与治理',
};

function exactNavLabel(element, labels) {
  const text = compactText(element);
  return labels.find((label) => text === label) ?? null;
}

function normalizePlatformNavigation() {
  const selected = isResearchProjectRoute(currentPage,location.search)?'我的工作台':activeNavByPage[currentPage] || '领域研究';

  document.querySelectorAll(navSelector).forEach((element) => {
    if (exactNavLabel(element, legacyTopLevelLabels)) {
      element.remove();
      return;
    }

    const label = exactNavLabel(element, linkedNavLabels);
    if (!label) return;
    element.classList.toggle('active', label === selected);
  });
}

const pageRules = {
  p01: [],
  h01: [
    { selector: '.hub-kpi', text: '临床注册研究', page: 'c01' },
    { selector: '.hub-kpi', text: '研究论文', page: 'e01' },
    { selector: '.hub-registry', page: 'c01' },
    { selector: '.hub-evidence', page: 'e01' },
  ],
  c01: [
    { selector: '.reg-open', page: 'c03' },
  ],
  c03: [
    { selector: '.trial-back', page: 'c01' },
  ],
  t01: [
    { selector: '.team-study', page: 'c01' },
  ],
  t02: [
    { selector: '.team-back', page: 't01' },
  ],
  ai01: [
    { selector: '.evidenceHead a', page: 'e01' },
    {
      selector: '.evidenceCards article',
      resolvePage: (element) => {
        const cards = [...element.parentElement.querySelectorAll('article')];
        return cards.indexOf(element) === 0 ? 'e02' : 'e01';
      },
    },
    { selector: '.ability > div', text: '文献智能检索', page: 'e01' },
    { selector: '.ability > div', text: '数据分析与洞察', page: 's06' },
    { selector: '.ability > div', text: '研究设计建议', page: 's02' },
    { selector: '.ability > div', text: '方案与文档评审', page: 'g01' },
  ],
  e01: [
    { selector: '.paper .ptitle', page: 'e02' },
    { selector: '.paper-acts span', text: 'PDF', page: 'e02' },
    { selector: '.paper-acts span', text: 'AI解读', page: 'e03' },
    { selector: '.paper-detail h2', page: 'e02' },
    { selector: '.paper-pdf', page: 'e02' },
    { selector: '.paper-ai', page: 'e03' },
  ],
  e02: [
    { selector: '.paper-back', page: 'e01' },
    { selector: '.paper-trial', page: 'c01' },
  ],
  e03: [
    { selector: 'button.detail', page: 'e02' },
  ],
  s01: [
    { selector: '.study-actions button', text: '编辑', page: 's02' },
    { selector: '.study-tabs button', text: '受试者', page: 's03' },
    { selector: '.study-tabs button', text: '数据管理', page: 's05' },
    { selector: '.study-tabs button', text: '统计分析', page: 's06' },
  ],
  s02: [
    { selector: '.breadcrumb', page: 's01' },
    { selector: '.hero-actions button', text: '提交伦理审查', page: 'g01' },
    { selector: '.stepper > div', text: '研究课题', page: 'q01' },
    { selector: '.stepper > div', text: '结果分析', page: 's06' },
  ],
  s03: [
    { selector: '.ui-tabs button', text: '数据质控', page: 's05' },
    { selector: '.ui-tabs button', text: '统计分析', page: 's06' },
    { selector: '.content > .ui-card:last-child .table-row:not(.table-head)', page: 's04' },
  ],
  s04: [
    { selector: '.breadcrumb', page: 's03' },
  ],
  s05: [
    { selector: '.breadcrumb', page: 's01' },
  ],
  s06: [
    { selector: '.breadcrumb', page: 's01' },
  ],
  q01: [
    {
      selector: '.right-list p',
      resolvePage: (element) => {
        const rows = [...element.parentElement.querySelectorAll('p')];
        return rows.indexOf(element) === 0 ? 'e02' : 'e01';
      },
    },
  ],
  g01: [
    { selector: '.breadcrumb', page: 's01' },
  ],
  g02: [
    { selector: '.g02-actions button', text: '新增研究项目', page: 'q01' },
    { selector: '.g02-actions button', text: '伦理申请管理', page: 'g01' },
    { selector: '.g02-actions button', text: '数据质量检查', page: 's05' },
    { selector: '.g02-actions button', text: '中心管理', page: 's03' },
    { selector: '.g02-middle-row > .ui-card:first-child .table-row:not(.table-head)', page: 's03' },
  ],
  o01: [
    { selector: '.previewActions button', text: '查看机会详情', page: 'o02' },
    { selector: '.previewActions button', text: '形成研究课题', page: 'q01' },
    { selector: '.preview section a', text: '查看支持与相反证据', page: 'e01' },
    { selector: '.flow span', text: '研究证据', page: 'e01' },
    { selector: '.flow span', text: '研究课题', page: 'q01' },
  ],
  o02: [
    { selector: '.breadcrumb', page: 'o01' },
    { selector: '.card-head button', text: '查看更多机会', page: 'o01' },
    { selector: '.key-cards article', page: 'o01' },
  ],
  a01: [
    { selector: '.card-head button', text: '查看详情', page: 'a02' },
  ],
  a02: [
    { selector: '.breadcrumb', page: 'a01' },
  ],
};

function compactText(element) {
  return element.textContent.replace(/\s+/g, ' ').trim();
}

function findNavLabel(element) {
  const text = compactText(element);
  return linkedNavLabels.find((label) => text.includes(label));
}

function findPageRule(target) {
  if(['live','entry'].includes(realRouteState))return null;
  for (const rule of pageRules[currentPage] ?? []) {
    const element = target.closest(rule.selector);
    if (!element) continue;
    if (rule.text && !compactText(element).includes(rule.text)) continue;
    return { element, rule };
  }
  return null;
}

function navigateFromTarget(target, event) {
  const navItem = target.closest(navSelector);
  if (navItem) {
    const label = findNavLabel(navItem);
    if (label) {
      event?.preventDefault();
      goToNav(label);
      return true;
    }
  }

  if (target.closest('.platform-brand, header .brand, .side .brand')) {
    event?.preventDefault();
    goToPage('p01');
    return true;
  }

  if (target.closest('.side-ai, .aihelp, .aicard, .aihelper, .ai-assistant')) {
    event?.preventDefault();
    goToPage('ai01');
    return true;
  }

  const match = findPageRule(target);
  if (!match) return false;

  const pageId = match.rule.resolvePage?.(match.element) ?? match.rule.page;
  if (!pageId) return false;

  event?.preventDefault();
  goToPage(pageId);
  return true;
}

function markAsLinked(element) {
  if (!element || element.dataset.platformLinked === 'true') return;
  element.dataset.platformLinked = 'true';
  element.style.cursor = 'pointer';

  if (!element.matches('a, button, input, select, textarea, [tabindex]')) {
    element.setAttribute('role', 'link');
    element.tabIndex = 0;
  }
}

function decorateLinkedElements() {
  if(realPageGated)return;
  mountPlatformHeader(currentPage);
  mountPlatformShell(currentPage);
  normalizePlatformNavigation();
  mountFrontendLinks();

  document.querySelectorAll(navSelector).forEach((element) => {
    if (findNavLabel(element)) markAsLinked(element);
  });

  document.querySelectorAll('.platform-brand, header .brand, .side .brand, .side-ai, .aihelp, .aicard, .aihelper, .ai-assistant')
    .forEach(markAsLinked);

  for (const rule of pageRules[currentPage] ?? []) {
    document.querySelectorAll(rule.selector).forEach((element) => {
      if (!rule.text || compactText(element).includes(rule.text)) markAsLinked(element);
    });
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof Element) navigateFromTarget(target, event);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (!(target instanceof Element) || target.dataset.platformLinked !== 'true') return;
  if (target.matches('a, button, input, select, textarea')) return;
  navigateFromTarget(target, event);
});

let decorationFrame = 0;

function scheduleDecoration() {
  if (decorationFrame) return;
  decorationFrame = requestAnimationFrame(() => {
    decorationFrame = 0;
    decorateLinkedElements();
  });
}

const rootObserver = new MutationObserver(() => {
  if (!document.querySelector('.global-platform-header') ||
      (currentPage === 'k01' && !document.querySelector('.qiyan-platform-sidebar'))) scheduleDecoration();
});

const root = document.getElementById('root');
if (root) rootObserver.observe(root, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleDecoration, { once: true });
} else {
  scheduleDecoration();
}
