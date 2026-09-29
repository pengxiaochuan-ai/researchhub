import React from 'react';
import {
  BookOpen, Bot, Box, ChevronDown, ChevronLeft,
  FolderKanban, HelpCircle, Home, Sparkles,
} from 'lucide-react';

const routes = {
  我的科研: 'p01', 领域研究: 'h01', '岐研 AI': 'ai01', 科研资产: 'a01',
  管理与治理: 'g02',
};

const platformNav = [
  ['我的科研', Home], ['领域研究', Box], ['岐研 AI', Sparkles], ['科研资产', FolderKanban],
  ['管理与治理', BookOpen],
];

const activeSection = {
  文献检索: '领域研究', 研究证据: '领域研究', 研究机会: '领域研究',
  受试者管理: '我的科研', 数据管理: '我的科研', 研究分析: '我的科研',
  项目管理: '我的科研', 统计分析: '我的科研', 人工审查: '管理与治理',
};

export function go(page) {
  window.location.href = `/pages/${page}/`;
}

export function Header() {
  return <div data-platform-header-slot/>;
}

export function Sidebar({ active }) {
  const selected = activeSection[active] || active;
  return <aside className="platform-side">
    <nav>{platformNav.map(([label, Icon]) => <button key={label} className={selected === label ? 'active' : ''} onClick={() => routes[label] && go(routes[label])}>
      <Icon/><span>{label}</span>
    </button>)}</nav>
    <div className="side-tools">
      <button><HelpCircle/><span>帮助中心</span></button>
      <button><ChevronLeft/><span>收起菜单</span></button>
    </div>
    <button className="side-ai" onClick={() => go('ai01')}><span><Bot/></span><b>岐研 AI 助手</b><small>随时为您的研究工作<br/>提供支持</small><ChevronDown/></button>
  </aside>;
}

export function Hero({ breadcrumb, title, en, subtitle, actions, slogan, compact = false }) {
  return <section className={`platform-hero ${compact ? 'compact' : ''}`}>
    <div className="hero-copy">
      <div className="breadcrumb">我的科研 <b>›</b> {breadcrumb}</div>
      <h1>{title} {en && <em>{en}</em>}</h1>
      <p>{subtitle}</p>
    </div>
    <div className="mountain" aria-hidden="true"><i/><i/><i/></div>
    {slogan && <div className="hero-slogan">{slogan.map((line) => <span key={line}>{line}</span>)}</div>}
    {actions && <div className="hero-actions">{actions.map((action, index) => <button key={action.label} className={action.primary ? 'primary' : ''} onClick={action.onClick}>{action.icon}{action.label}</button>)}</div>}
  </section>;
}

export function Shell({ active, hero, children, className = '' }) {
  return <div className={`platform-app ${className}`}>
    <Header placeholder={hero.placeholder}/>
    <Sidebar active={active}/>
    <main className="platform-main"><Hero {...hero}/>{children}</main>
  </div>;
}
