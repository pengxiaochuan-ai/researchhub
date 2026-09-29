import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Edit3,
  FileChartColumnIncreasing,
  FileText,
  HelpCircle,
  Home,
  MoreHorizontal,
  PackageCheck,
  PanelLeftClose,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './style.css';
import '../../shared/layout-practice.css';
import './layout-fix.css';

const lineData = [
  { month: '2024-01', plan: 0, actual: 0 },
  { month: '2024-02', plan: 18, actual: 10 },
  { month: '2024-03', plan: 32, actual: 17 },
  { month: '2024-04', plan: 45, actual: 22 },
  { month: '2024-05', plan: 56, actual: 27 },
  { month: '2024-06', plan: 69, actual: 24 },
  { month: '2024-07', plan: 80, actual: 29 },
  { month: '2024-08', plan: 90, actual: 34 },
  { month: '2024-09', plan: 100, actual: 38 },
  { month: '2024-10', plan: 110, actual: 42 },
  { month: '2024-11', plan: 120, actual: 42 },
];

const centerData = [
  { name: '中心 01', plan: 35, actual: 32, total: '28 / 30', percent: '93%', status: 'good' },
  { name: '中心 02', plan: 25, actual: 14, total: '8 / 30', percent: '27%', status: 'bad' },
  { name: '中心 03', plan: 20, actual: 11, total: '4 / 20', percent: '20%', status: 'bad' },
  { name: '中心 04', plan: 30, actual: 22, total: '12 / 20', percent: '60%', status: 'good' },
  { name: '中心 05', plan: 25, actual: 19, total: '10 / 20', percent: '50%', status: 'warn' },
];

const centers = [
  ['中心 01（北京中医医院）', '张教授', '30', '28', '93%', '正常'],
  ['中心 02（上海中医药大学附属医院）', '李教授', '30', '8', '27%', '滞后'],
  ['中心 03（广州中医医院）', '陈教授', '20', '4', '20%', '滞后'],
  ['中心 04（成都中医医院）', '刘教授', '20', '12', '60%', '正常'],
  ['中心 05（西安中医医院）', '王教授', '20', '10', '50%', '关注'],
];

const tabs = ['概览', '受试者', '数据管理', '统计分析', '文档管理', '研究团队', '进展与里程碑', '安全性', '讨论与决策'];

function Header() {
  return <header className="topbar">
    <div className="brand">
      <div className="brand-mark">岐</div>
      <div className="brand-name"><b>岐研</b><small>Qiyan Research Intelligence</small></div>
      <span>中医临床研究智能平台</span>
    </div>
    <div className="global-search"><Search size={17}/><span>搜索课题、文献、研究问题或数据...</span></div>
    <button className="icon-button notification" aria-label="通知"><Bell size={20}/><i/></button>
    <div className="header-divider"/>
    <div className="avatar">王</div>
    <div className="user"><b>王教授</b><span>课题负责人</span></div>
    <ChevronDown size={18} className="user-chevron"/>
  </header>;
}

function Sidebar() {
  const nav = [
    ['我的科研', Home],
    ['领域研究', BookOpen],
    ['岐研 AI', BrainCircuit],
    ['科研资产', PackageCheck],
    ['管理与治理', Building2],
  ];
  return <aside className="sidebar">
    <nav>{nav.map(([label, Icon], index) => <button className={index === 0 ? 'active' : ''} key={label}><Icon/><span>{label}</span></button>)}</nav>
    <div className="sidebar-bottom">
      <button><HelpCircle/><span>帮助中心</span></button>
      <button><PanelLeftClose/><span>收起菜单</span></button>
      <div className="ai-assistant"><div className="assistant-icon"><Bot/></div><div><b>岐研 AI 助手</b><span>随时为您的研究工作<br/>提供支持</span></div><ChevronRight/></div>
    </div>
  </aside>;
}

function StudyHeader({ activeTab, onTabChange }) {
  const meta = [
    [UserRound, '课题负责人：王教授'],
    [CalendarDays, '启动时间：2024-01-15'],
    [FileText, '预计完成：2026-12-31'],
    [ShieldCheck, '研究类型：多中心 RCT'],
    [UsersRound, '研究中心：5 个中心'],
    [ClipboardList, '注册号：ChiCTR2300087654'],
  ];
  return <>
    <section className="study-head">
      <div className="breadcrumb">我的科研 <ChevronRight/> 课题详情</div>
      <div className="study-title-row">
        <div><h1>针刺抑郁多中心研究 <em>执行中</em></h1><p>针刺治疗中度抑郁症的有效性与安全性：一项多中心、随机、对照研究</p></div>
        <div className="study-actions"><button><Share2/>分享</button><button><Edit3/>编辑</button><button aria-label="更多"><MoreHorizontal/></button></div>
        <div className="motto">以研究为本<br/>让更多患者受益。</div>
      </div>
      <div className="study-meta">{meta.map(([Icon, text]) => <div key={text}><Icon/><span>{text}</span></div>)}</div>
    </section>
    <div className="study-tabs">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => onTabChange(tab)} key={tab}>{tab}</button>)}</div>
  </>;
}

function MetricCard({ title, value, unit, percent, color, note, trend, wider }) {
  return <section className={`metric-card ${wider ? 'wider' : ''}`}>
    <span className="metric-title">{title}</span>
    <div className="metric-value">{value} {unit && <small>{unit}</small>}</div>
    <div className="metric-progress"><progress max="100" value={percent}/><span>{percent}%</span></div>
    <p className={color}>{trend && <b>{trend}</b>}{note}</p>
  </section>;
}

function EnrollmentChart() {
  return <section className="card chart-card enrollment-card">
    <div className="card-title"><h2>入组趋势</h2><button>按月 <ChevronDown/></button></div>
    <div className="chart-legend"><span><i className="plan"/>计划入组</span><span><i className="actual"/>实际入组</span></div>
    <div className="line-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineData} margin={{ top: 6, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#dfe6f4" vertical={false}/>
          <XAxis dataKey="month" tick={{ fill: '#5c6ea3', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cfd8ea' }} interval={2}/>
          <YAxis ticks={[0, 30, 60, 90, 120]} domain={[0, 125]} tick={{ fill: '#5c6ea3', fontSize: 12 }} tickLine={false} axisLine={false}/>
          <Tooltip/>
          <Line type="monotone" dataKey="plan" stroke="#bdc0ff" strokeWidth={2} dot={{ r: 2, fill: '#bdc0ff' }}/>
          <Line type="monotone" dataKey="actual" stroke="#4f46ff" strokeWidth={2} dot={{ r: 2.5, fill: '#4f46ff' }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-summary"><p><i className="plan"/>计划 <b>120</b></p><p><i className="actual"/>实际 <b>42</b></p></div>
  </section>;
}

function CenterChart() {
  return <section className="card chart-card center-chart-card">
    <div className="card-title"><h2>各中心入组情况</h2><div className="chart-legend inline"><span><i className="plan"/>计划</span><span><i className="actual"/>实际</span></div></div>
    <div className="bar-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={centerData} margin={{ top: 5, right: 8, left: -14, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#dfe6f4" vertical={false}/>
          <XAxis dataKey="name" tick={{ fill: '#5c6ea3', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#cfd8ea' }}/>
          <YAxis ticks={[0, 10, 20, 30, 40]} domain={[0, 40]} tick={{ fill: '#5c6ea3', fontSize: 12 }} tickLine={false} axisLine={false}/>
          <Tooltip/>
          <Bar dataKey="plan" fill="#d8d5ff" radius={[2, 2, 0, 0]}/>
          <Bar dataKey="actual" fill="#4f46ef" radius={[2, 2, 0, 0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="center-totals">{centerData.map((item) => <div key={item.name}><b>{item.total}</b><span className={item.status}>{item.percent}</span></div>)}</div>
  </section>;
}

function CentersTable() {
  return <section className="card center-list">
    <div className="card-title"><h2>研究中心列表</h2><a>查看全部中心 <ChevronRight/></a></div>
    <table><thead><tr><th>中心名称</th><th>主要研究者</th><th>计划入组</th><th>已入组</th><th>完成率</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>{centers.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td className={row[4] === '27%' || row[4] === '20%' ? 'danger-text' : ''}>{row[4]}</td><td><span className={`status status-${row[5]}`}>{row[5]}</span></td><td><a>查看</a></td></tr>)}</tbody>
    </table>
  </section>;
}

function AiAnalysis() {
  return <section className="card ai-analysis">
    <div className="card-title"><h2><Sparkles/>岐研 AI 分析 <em>AI</em><small>基于 8 条证据</small></h2><a>查看详情 <ChevronRight/></a></div>
    <div className="analysis-block"><AlertTriangle/><div><b>主要判断</b><p>近期入组速度低于计划，主要由中心 02 和中心 03 的筛选转化率下降导致。</p></div></div>
    <div className="analysis-block"><CircleDot/><div><b>可能原因</b><ul><li>中心 02 筛选失败率由 18% 上升至 35%。</li><li>中心 03 受试者流失率上升，访视依从性下降。</li><li>近期节假日可能对入组节奏产生影响。</li></ul></div></div>
    <div className="analysis-block"><HelpCircle/><div><b>尚不能确定</b><p>中心 05 当前样本量较小，暂不能判断是否属于持续性趋势。</p></div></div>
    <div className="analysis-block"><Stethoscope/><div><b>建议</b><ol><li>关注中心 02 和 03 的筛选流程，必要时提供额外支持。</li><li>考虑调整入组策略或延长入组窗口。</li></ol></div></div>
    <div className="analysis-actions"><button onClick={() => window.location.assign('/pages/ai01/')}>进入课题判断 <ChevronRight/></button><button onClick={() => window.location.assign('/pages/ai01/')}>与 AI 进一步讨论</button></div>
  </section>;
}

const updateItems = [
  ['doc', '中心 02 新增 2 例受试者', '1 小时前'],
  ['doc', '中心 03 更新访视数据（5 例）', '3 小时前'],
  ['warn', '1 例丢失不良事件报告', '6 小时前'],
  ['alert', '数据质量已解决（1 条）', '昨天 17:20'],
  ['doc', '研究方案 v2.1 已发布', '2024-09-15'],
];
const documentItems = [
  ['red', '研究方案 v2.1', 'v2.1', '2024-09-15'],
  ['red', '知情同意书模板', 'v1.3', '2024-08-20'],
  ['blue', '病例报告表（CRF）', 'v1.0', '2024-07-12'],
  ['blue', '统计分析计划（SAP）', 'v1.0', '2024-06-30'],
  ['orange', '研究者手册', 'v1.2', '2024-05-18'],
];
const discussionItems = [
  ['关于中心 02 入组滞后的应对策略', '解决中', '2 小时前'],
  ['是否调整纳入标准以提高筛选转化率', '待讨论', '1 天前'],
  ['中心 03 受试者流失问题', '待领取', '2 天前'],
  ['统计分析计划的修改建议', '已完成', '3 天前'],
  ['下一阶段入组策略讨论', '讨论', '5 天前'],
];

function MiniListCard({ title, type }) {
  const data = type === 'updates' ? updateItems : type === 'documents' ? documentItems : discussionItems;
  return <section className={`card mini-list ${type}`}><div className="card-title"><h2>{title}</h2><a>查看全部 <ChevronRight/></a></div>
    <div>{data.map((item) => <p key={type === 'discussions' ? item[0] : item[1]}>{type === 'updates' ? <FileText className={item[0]}/> : type === 'documents' ? <FileText className={item[0]}/> : <ClipboardList/>}<span>{type === 'discussions' ? item[0] : item[1]}</span>{type === 'documents' && <em>{item[2]}</em>}{type === 'discussions' && <em className={`discussion-${item[1]}`}>{item[1]}</em>}<time>{type === 'updates' ? item[2] : type === 'documents' ? item[3] : item[2]}</time></p>)}</div>
  </section>;
}

function ResearchInfo() {
  const rows = [
    ['研究类型', '多中心、随机、对照研究'],
    ['适应症', '中度抑郁症（MDD）'],
    ['干预措施', '针刺治疗（标准化方案）'],
    ['对照组', '假针刺'],
    ['主要终点', 'HAMD 评分变化'],
    ['次要终点', '睡眠质量、生活质量、不良事件'],
    ['研究人群', '18–65 岁，符合 DSM-5 诊断标准'],
    ['研究中心', '5 个（北京、上海、广州、成都、西安）'],
  ];
  return <section className="card research-info"><div className="card-title"><h2>研究信息</h2><a>编辑</a></div>{rows.map(([key, value]) => <div className="info-row" key={key}><b>{key}</b><span>{value}</span></div>)}</section>;
}

function Milestones() {
  const items = [
    ['done', '方案启动', '2024-01-15'],
    ['done', '伦理批准', '2024-02-20'],
    ['current', '受试者入组（进行中）', '2024-01 ~ 2026-06'],
    ['future', '主要终点数据锁定', '2026-10-31'],
    ['future', '研究完成', '2026-12-31'],
  ];
  return <section className="card milestones"><div className="card-title"><h2>里程碑</h2><a>查看全部 <ChevronRight/></a></div><div className="timeline">{items.map(([state, title, date]) => <div className={state} key={title}><i>{state === 'done' ? <Check/> : state === 'current' ? <CircleDot/> : null}</i><p><b>{title}</b>{state === 'current' && <span>42 / 120（35%）</span>}</p><time>{date}</time></div>)}</div></section>;
}

function AttentionCard() {
  return <section className="card attention-card"><div className="card-title"><h2><AlertTriangle/>需要您判断</h2><a>查看全部 <ChevronRight/></a></div><strong>2 <small>项</small></strong><p><FileText/><span>中心 02 入组滞后应对方案</span><em>高优先级</em><time>2 小时前</time></p><p><FileText/><span>是否调整纳入标准</span><em>中优先级</em><time>1 天前</time></p></section>;
}

function App() {
  const [activeTab, setActiveTab] = useState('概览');
  return <><Header/><Sidebar/><main className="page platform-main"><StudyHeader activeTab={activeTab} onTabChange={setActiveTab}/><div className="dashboard-grid">
    <div className="left-dashboard">
      <div className="metrics-row">
        <MetricCard title="入组进度" value="42 / 120" percent={35} note="较计划少 8 人（−67%）" trend="↓ " color="red" wider/>
        <MetricCard title="研究中心进度" value="3 / 5" percent={60} note="2 个中心低于计划" color="muted" wider/>
        <MetricCard title="数据完整率" value="92%" percent={92} note="较上周 +2% ↑" color="green"/>
        <MetricCard title="方案偏离" value="3" unit="例" percent={2.4} note="较上月 −1.1% ↓" color="green"/>
        <MetricCard title="不良事件" value="5" unit="例" percent={3.9} note="均为轻度，已处理" color="muted"/>
      </div>
      <div className="charts-row"><EnrollmentChart/><CenterChart/></div>
      <div className="details-row"><CentersTable/><AiAnalysis/></div>
      <div className="bottom-row"><MiniListCard title="最近数据更新" type="updates"/><MiniListCard title="相关文档" type="documents"/><MiniListCard title="讨论与决策" type="discussions"/></div>
    </div>
    <aside className="right-dashboard"><ResearchInfo/><Milestones/><AttentionCard/></aside>
  </div></main></>;
}

createRoot(document.getElementById('root')).render(<App/>);
