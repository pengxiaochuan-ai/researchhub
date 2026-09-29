
import React, {useState} from "react";
import { createRoot } from "react-dom/client";
import {
  Home, Compass, Sparkles, Box, BookOpen, Network, Settings, Search, Bell,
  ChevronRight, ChevronDown, Star, Bookmark, SlidersHorizontal, TrendingUp,
  Target, Users, FlaskConical, Lightbulb, FileSearch, ShieldCheck, CircleDollarSign,
  CheckCircle2, AlertTriangle, ArrowRight, BrainCircuit, History, Eye, Layers3
} from "lucide-react";
import "./style.css";
import "../../shared/layout-practice.css";

const opportunities = [
  {
    id:"OP-2026-017", flag:"重点关注", title:"针灸治疗抑郁症的长期疗效与复发预防仍存在证据缺口",
    statement:"值得进一步研究的不是「针灸是否有效」，而是针灸的长期疗效、复发预防及维持治疗能否得到可靠验证。",
    tags:["长期疗效","复发预防","多中心"], support:8, contrary:2, potential:"高", relevance:92,
    source:"近期系统评价 + Hub 研究证据", update:"2小时前",
    gap:"缺少以复发/缓解维持为核心结局、随访 ≥6个月的多中心前瞻性研究。"
  },
  {
    id:"OP-2026-012", flag:"值得探索", title:"电针与手针在抑郁症不同症状维度上的疗效差异值得进一步验证",
    statement:"值得验证电针与手针是否在睡眠、焦虑共病等特定症状维度存在具有临床意义的差异。",
    tags:["电针","手针","症状分层"], support:6, contrary:3, potential:"中-高", relevance:86,
    source:"亚组分析 + 2项相关研究", update:"昨天",
    gap:"缺少预设亚组、统一针刺参数和患者分层的直接比较研究。"
  },
  {
    id:"OP-2026-009", flag:"持续观察", title:"针灸联合数字化随访可能改善抑郁症治疗依从性，但临床增量价值尚未确定",
    statement:"值得研究数字化随访是否能在针灸治疗之外产生可验证的依从性与长期管理增量价值。",
    tags:["数字随访","依从性","真实世界"], support:4, contrary:2, potential:"中", relevance:78,
    source:"真实世界数据 + 领域动态", update:"3天前",
    gap:"缺少对照设计验证数字化随访本身的增量价值。"
  },
  {
    id:"OP-2026-006", flag:"新发现", title:"针灸治疗伴失眠抑郁患者的个体化方案存在可验证的研究空间",
    statement:"不同睡眠表型可能对应不同针刺方案与获益模式，值得形成可验证的分层研究。",
    tags:["失眠","个体化","分层治疗"], support:7, contrary:4, potential:"中-高", relevance:81,
    source:"Hub 数据 + 外部证据", update:"5天前",
    gap:"尚缺少稳定表型定义与前瞻性分层验证。"
  },
  {
    id:"OP-2026-004", flag:"持续观察", title:"针灸对抑郁症认知症状的改善是否独立于情绪改善仍不清楚",
    statement:"认知功能可能是被忽略的临床结局，现有研究尚不足以区分其独立治疗效应。",
    tags:["认知功能","结局指标","机制"], support:5, contrary:3, potential:"中", relevance:74,
    source:"文献聚合 + AI 证据研判", update:"1周前",
    gap:"缺少以认知结局为预设终点且控制情绪改善影响的研究。"
  }
];

function Nav(){
 const items=[[Home,"我的科研"],[Compass,"领域研究"],[Sparkles,"岐研 AI"],[Box,"科研资产"],[Settings,"管理与治理"]];
 return <aside className="side">
   <div className="brand"><div className="brandmark">岐</div><div className="brandText"><b>岐研</b><span>中医临床研究智能平台</span></div></div>
   <nav>{items.map(([I,t])=><div className={"nav "+(t==="领域研究"?"active":"")} key={t}><I size={18}/><span>{t}</span></div>)}</nav>
   <div className="sideBottom">
    <div>帮助中心</div><div>← 收起菜单</div>
    <div className="aihelper"><Sparkles size={24}/><div><b>岐研 AI 助手</b><small>随时为您的研究工作提供支持</small></div><ChevronRight size={17}/></div>
   </div>
 </aside>
}

function Top(){
 return <header className="top">
  <div></div><div className="globalsearch"><Search size={17}/><span>搜索课题、文献、研究问题或数据...</span></div>
  <Bell size={18}/><div className="avatar">王</div><div className="prof"><b>王教授</b><small>课题负责人</small></div><ChevronDown size={16}/>
 </header>
}

function Stat({icon:I,label,note,value,tone}){
 return <div className="stat"><div className={"statIcon "+tone}><I size={22}/></div><div><small>{label}</small><strong>{value}</strong><span>{note}</span></div></div>
}

function Trend(){
 return <div className="trend"><div><b>机会趋势</b><strong>+28%</strong><small>较上月</small></div><div className="bars">{[25,36,45,57,69,82].map((h,i)=><i key={i} style={{height:h+"%"}}/> )}</div></div>
}

function OpportunityRow({o,selected,onClick}){
 return <div className={"oppRow "+(selected?"selected":"")} onClick={onClick}>
  <div className="check"></div>
  <div className="oppMain">
   <div className="rowTitle"><span className={"flag "+(o.flag==="重点关注"?"hot":"")}>{o.flag}</span><b>{o.title}</b></div>
   <div className="rowTags">{o.tags.map(x=><span key={x}>{x}</span>)}</div>
   <div className="statement"><small>研究机会陈述</small>{o.statement}</div>
  </div>
  <div className="evidence"><span><CheckCircle2 size={14}/> {o.support} 支持</span><span><AlertTriangle size={14}/> {o.contrary} 限制</span></div>
  <div className="potential"><small>研究潜力</small><b>{o.potential}</b></div>
  <div className="match"><small>相关度</small><strong>{o.relevance}%</strong></div>
  <Bookmark size={17} className="bookmark"/>
 </div>
}

function Preview({o}){
 return <aside className="preview">
  <div className="previewTop"><span className="rec">推荐</span><span className="new">候选研究机会</span><button><Bookmark size={15}/> 保存</button></div>
  <h2>{o.title}</h2>
  <div className="previewTabs"><b>机会概览</b><span>证据</span><span>研究缺口</span><span>AI 研判</span></div>
  <section className="why"><small>为什么现在值得关注</small><p>近期证据显示短期疗效信号较稳定，但长期随访与复发预防证据明显不足，与当前研究方向高度相关。</p></section>
  <section className="metrics">
   <div><strong>{o.support}</strong><small>支持证据</small></div>
   <div><strong>{o.contrary}</strong><small>限制证据</small></div>
   <div><strong>{o.potential}</strong><small>研究潜力</small></div>
   <div><strong>{o.relevance}%</strong><small>相关度</small></div>
  </section>
  <section><h3>研究缺口</h3><p>{o.gap}</p><a>查看支持与相反证据 <ArrowRight size={14}/></a></section>
  <section className="fit">
   <h3>与我的研究方向匹配度</h3>
   <div className="fitline"><div className="ring"><b>{o.relevance}%</b><small>高度匹配</small></div>
    <ul><li>研究主题高度相关</li><li>研究方法与现有能力匹配</li><li>可复用 Hub 既有研究基础</li><li>具备形成研究课题的条件</li></ul>
   </div>
  </section>
  <section className="aiBox"><div className="aiTitle"><Sparkles size={17}/><b>岐研 AI 研判</b><span>基于当前研究上下文</span></div>
   <p>现有证据足以支持把它作为候选研究机会进一步讨论，但不足以直接形成正式研究结论或自动创建研究。</p>
   <div className="uncertain"><ShieldCheck size={15}/><span><b>尚不能确定：</b>长期结局定义与针刺方案异质性仍较高。</span></div>
  </section>
  <section className="history"><h3>相关研究基础</h3><div><b>3</b><span>Hub 内研究</span><b>18</b><span>科研资产</span><b>10</b><span>相关证据</span></div></section>
  <div className="previewActions"><button className="primary">查看机会详情 <ArrowRight size={16}/></button><button>形成研究课题</button></div>
 </aside>
}

function App(){
 const [sel,setSel]=useState(0); const o=opportunities[sel];
 return <><Top/><Nav/><main className="platform-main">
  <div className="crumb">领域研究 <ChevronRight/> 针灸治疗情志病研究中心 <ChevronRight/> 研究机会</div>
  <div className="titleRow"><div><h1>研究机会</h1><p>从领域变化与研究证据中发现、筛选和比较值得进一步形成研究课题的方向。</p></div>
   <div className="titleBtns"><button>我的关注</button><button className="primary">+ 订阅机会</button></div></div>
  <div className="stats">
   <Stat icon={Target} label="潜在研究机会" value="12" note="本月 +3" tone="purple"/>
   <Stat icon={Lightbulb} label="高研究潜力" value="4" note="优先判断" tone="orange"/>
   <Stat icon={Layers3} label="与我的研究高度相关" value="5" note="匹配当前课题" tone="blue"/>
   <Stat icon={BrainCircuit} label="待教授判断" value="2" note="需要决策" tone="pink"/>
   <Trend/>
  </div>
  <div className="hubStrip"><div><small>研究中心</small><b>针灸治疗情志病</b><span>基于研究证据、研究基础和当前课题上下文识别潜在研究机会。</span></div>
   <div className="flow"><span>研究证据</span><ChevronRight/><span>研究缺口</span><ChevronRight/><b>研究机会</b><ChevronRight/><span>研究课题</span></div></div>
  <div className="workspace">
   <section className="listPanel">
    <div className="tabs"><b>机会列表</b><span>我关注的</span><span>最近更新</span></div>
    <div className="filters"><div className="search"><Search size={16}/>搜索研究机会、研究缺口或证据...</div><button><SlidersHorizontal size={15}/>研究方向⌄</button><button>研究潜力⌄</button><button>相关度⌄</button><span className="found">发现 <b>12</b> 个潜在研究机会</span></div>
    <div className="tableHead"><span>研究机会</span><span>证据</span><span>研究潜力</span><span>相关度</span></div>
    {opportunities.map((x,i)=><OpportunityRow key={x.id} o={x} selected={i===sel} onClick={()=>setSel(i)}/>)}
    <div className="pagination"><span>共 12 条</span><div>‹ <b>1</b> 2 3 ›</div><button>10 条/页⌄</button></div>
   </section>
   <Preview o={o}/>
  </div>
 </main></>
}
createRoot(document.getElementById("root")).render(<App/>);
