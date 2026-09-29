import { getPlatformUser } from './platform-user.js';
import './platform-header.css';

const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>';
const bellIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
const chevronIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function updateUser(header, user = getPlatformUser()) {
  header.querySelector('[data-user-avatar]').textContent = user.avatarText || user.displayName?.slice(0, 1) || '访';
  header.querySelector('[data-user-name]').textContent = user.displayName || '未登录';
  header.querySelector('[data-user-role]').textContent = user.roleName || '登录后访问';
  header.querySelector('[data-user-trigger]').dataset.authenticated = String(Boolean(user.authenticated));
}

function createPlatformHeader() {
  const header = document.createElement('header');
  header.className = 'global-platform-header';
  header.dataset.platformHeader = 'true';
  header.innerHTML = `
    <button class="qiyan-header-brand" type="button" aria-label="返回我的科研">
      <img class="qiyan-header-logo" src="/logo/logo.png" alt="岐研 Logo"/>
      <span class="qiyan-header-word"><b>岐研</b></span>
      <span class="qiyan-brand-separator" aria-hidden="true"></span>
      <span class="qiyan-header-subtitle">中医临床研究智能平台</span>
    </button>
    <button class="qiyan-header-search" type="button" aria-label="打开全局搜索">
      ${searchIcon}<span>搜索课题、文献、研究问题或数据...</span>
    </button>
    <button class="qiyan-header-notification" type="button" aria-label="通知中心">
      ${bellIcon}<i aria-hidden="true"></i>
    </button>
    <span class="qiyan-header-separator" aria-hidden="true"></span>
    <button class="qiyan-user-trigger" data-user-trigger type="button" aria-label="打开用户菜单" aria-expanded="false">
      <span class="qiyan-user-avatar" data-user-avatar></span>
      <span class="qiyan-user-copy"><b data-user-name></b><small data-user-role></small></span>
      ${chevronIcon}
    </button>
  `;

  header.querySelector('.qiyan-header-brand').addEventListener('click', () => {
    if (window.location.pathname !== '/pages/p01/') window.location.assign('/pages/p01/');
  });
  header.querySelector('.qiyan-header-search').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('qiyan:search-open'));
  });
  header.querySelector('.qiyan-header-notification').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('qiyan:notifications-open'));
  });
  header.querySelector('.qiyan-user-trigger').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('qiyan:user-menu-open', { detail: getPlatformUser() }));
  });

  updateUser(header);
  return header;
}

function findExistingHeader() {
  return document.querySelector([
    '[data-platform-header-slot]',
    '#root > header',
    '#root > .platform-app > header',
    '#root > div > header.platform-header',
    'header.topbar',
    'header.top',
  ].join(', '));
}

export function mountPlatformHeader(pageId) {
  document.body.dataset.platformPage = pageId || '';
  document.body.dataset.platformHeader = 'true';

  const mounted = document.querySelector('.global-platform-header');
  if (mounted) {
    updateUser(mounted);
    return mounted;
  }

  const header = createPlatformHeader();
  const existing = findExistingHeader();
  if (existing) {
    existing.replaceWith(header);
  } else {
    const host = document.querySelector('#root > .platform-app') || document.getElementById('root');
    host?.prepend(header);
  }

  document.querySelectorAll('.side > .brand').forEach((brand) => brand.remove());
  return header;
}

window.addEventListener('qiyan:user-change', (event) => {
  const header = document.querySelector('.global-platform-header');
  if (header) updateUser(header, event.detail);
});
