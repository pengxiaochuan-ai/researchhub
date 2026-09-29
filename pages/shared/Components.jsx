import React, { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, Circle,
  Clock3, Database, Download, FileText, Filter, MoreHorizontal, Search,
  ShieldCheck, Sparkles, Star, TrendingUp, Upload, UsersRound,
} from 'lucide-react';

export function Button({ children, primary, danger, onClick, className = '' }) {
  return <button className={`ui-button ${primary ? 'primary' : ''} ${danger ? 'danger' : ''} ${className}`} onClick={onClick}>{children}</button>;
}

export function Tabs({ items, initial = 0, onChange }) {
  const [active, setActive] = useState(initial);
  return <div className="ui-tabs">{items.map((item, i) => <button key={item} className={i === active ? 'active' : ''} onClick={() => { setActive(i); onChange?.(i); }}>{item}</button>)}</div>;
}

export function Card({ title, action, children, className = '' }) {
  return <section className={`ui-card ${className}`}>
    {title && <header className="card-head"><h2>{title}</h2>{action && <button>{action} <ArrowRight/></button>}</header>}
    {children}
  </section>;
}

export function Stats({ items }) {
  return <div className={`stats-row stats-${items.length}`}>{items.map((item, index) => {
    const Icon = item.icon ?? [Database, FileText, UsersRound, ShieldCheck, TrendingUp][index % 5];
    return <article className="stat-card" key={item.label}>
      <span className={`stat-icon tone-${index % 5}`}><Icon/></span>
      <div><small>{item.label}</small><strong>{item.value}</strong>{item.note && <p className={item.good ? 'good' : item.bad ? 'bad' : ''}>{item.note}</p>}</div>
    </article>;
  })}</div>;
}

export function Toolbar({ search = '搜索名称、关键词、负责人...', filters = ['全部类型', '全部领域', '全部状态'], split = false }) {
  return <div className={`toolbar${split ? ' toolbar-split' : ''}`}>
    <label className="searchbox"><Search/><span>{search}</span></label>
    {filters.map((filter) => {
      if (!split) return <button key={filter}>{filter}<ChevronDown/></button>;
      const cut = filter.lastIndexOf(' ');
      const label = cut > 0 ? filter.slice(0, cut) : filter;
      const value = cut > 0 ? filter.slice(cut + 1) : '';
      return <button key={filter} className="split-filter"><span>{label}</span><b>{value}</b><ChevronDown/></button>;
    })}
    <button className="filter"><Filter/>高级筛选</button>
  </div>;
}

export function DataTable({ columns, rows, onRow, selected = -1, compact = false }) {
  return <div className={`data-table ${compact ? 'compact' : ''}`}>
    <div className="table-row table-head" style={{gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' ')}}>
      {columns.map((column) => <span key={column.label}>{column.label}</span>)}
    </div>
    {rows.map((row, ri) => <button key={ri} className={`table-row ${selected === ri ? 'selected' : ''}`} style={{gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' ')}} onClick={() => onRow?.(ri)}>
      {columns.map((column, ci) => <span key={ci} className={row[ci]?.className || ''}>{row[ci]?.value ?? row[ci]}</span>)}
    </button>)}
  </div>;
}

export function Donut({ value = 92, label = '高度匹配', color = '#0aa38f' }) {
  return <div className="donut" style={{'--value': `${value * 3.6}deg`, '--donut': color}}><span><b>{value}%</b><small>{label}</small></span></div>;
}

export function MiniBars({ values = [24, 38, 46, 62, 74, 88], labels = ['4月','5月','6月','7月','8月','9月'] }) {
  return <div className="mini-bars">{values.map((value, i) => <span key={i}><i style={{height: `${value}%`}}/><small>{labels[i]}</small></span>)}</div>;
}

export function SimpleLine({ lines = 3, bars = false }) {
  const paths = ['M10 116 L80 94 L150 78 L220 84 L290 65 L360 68 L430 46 L500 34', 'M10 128 L80 118 L150 108 L220 100 L290 92 L360 80 L430 75 L500 58', 'M10 138 L80 135 L150 124 L220 118 L290 110 L360 96 L430 89 L500 86'];
  return <svg className="simple-chart" viewBox="0 0 520 155" preserveAspectRatio="none">
    {[30,60,90,120].map(y => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="#e6ebf5"/>) }
    {bars && [45,70,52,90,76,104,87,98].map((v,i)=><rect key={i} x={i*62+14} y={150-v} width="24" height={v} fill="#d9ddff"/>)}
    {paths.slice(0, lines).map((path,i)=><path key={i} d={path} fill="none" stroke={['#3f4df4','#0aa38f','#f5a522'][i]} strokeWidth="2.2"/>)}
  </svg>;
}

export function AIPanel({ title = '岐研 AI 助手', children, action = '查看详细分析' }) {
  return <Card className="ai-panel" title={<><Sparkles/> {title} <em>Beta</em></>}>
    <div className="ai-content">{children}</div>
    <button className="ai-link">{action} <ArrowRight/></button>
  </Card>;
}

export function CheckList({ items, warn = false }) {
  return <ul className="check-list">{items.map((item, i) => <li key={i}>{warn && i < 2 ? <AlertTriangle/> : <CheckCircle2/>}<span>{item}</span></li>)}</ul>;
}

export function Stepper({ steps, active = 0 }) {
  return <div className="stepper">{steps.map((step, index) => <React.Fragment key={step}><div className={index < active ? 'done' : index === active ? 'active' : ''}><span>{index < active ? <Check/> : index + 1}</span><b>{step}</b></div>{index < steps.length - 1 && <i/>}</React.Fragment>)}</div>;
}

export function Timeline({ items }) {
  return <div className="timeline-list">{items.map((item, i) => <div key={i} className={item.current ? 'current' : item.done ? 'done' : ''}><i>{item.done ? <Check/> : <Circle/>}</i><span><b>{item.title}</b><small>{item.note}</small></span><time>{item.time}</time></div>)}</div>;
}

export function DocumentPreview({ title = '针灸联合常规治疗对中度抑郁症的疗效：多中心随机对照试验', version = 'v3.0' }) {
  return <div className="document-preview">
    <div className="document-tools"><button>⊞</button><button>‹</button><span>1 / 56</span><i/><span>100%</span><Search/><Download/></div>
    <article><h3>{title}<br/>研究方案<br/><small>（版本 {version}）</small></h3><h4>目录</h4>
      {['研究背景','研究目的','研究设计','研究人群','干预措施','评价指标','样本量估计','统计分析计划','伦理与安全性','研究进度与管理','参考文献'].map((item,i)=><p key={item}><span>{i+1}. {item}</span><i/><b>{[1,3,5,8,12,16,22,28,34,40,52][i]}</b></p>)}
    </article>
  </div>;
}

export const icons = { AlertTriangle, Clock3, Database, Download, FileText, MoreHorizontal, ShieldCheck, Star, Upload, UsersRound };
