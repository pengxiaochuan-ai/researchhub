import {buildPageRoute,readContext} from './route-context.js';
import pageManifest from '../platform-pages.json';

export const pageRoutes = Object.freeze(
  Object.fromEntries(pageManifest.pages.map((page) => [page.id, page.route])),
);

const navRoutes = Object.freeze({
  我的科研: 'p01',
  领域研究: 'h01',
  '岐研 AI': 'ai01',
  科研资产: 'a01',
  管理与治理: 'g02',
});

export function goToPage(pageId, context = {}) {
  const route = buildPageRoute(pageRoutes, pageId, {...readContext(window.location.search), ...context});
  if (window.location.pathname + window.location.search === route) return;
  window.location.assign(route);
}

export function goToNav(label) {
  const pageId = navRoutes[label];
  if (pageId) goToPage(pageId);
}
