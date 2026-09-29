import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3, Bell, BookOpen, Building2, ClipboardList, Eye, FileText, Lightbulb, MapPin, UserRound, Users,
} from 'lucide-react';
import china from './china.json';
import './style.css';

const KPIS = [
  ['临床注册研究', '286', '项', '+18', '近 12 个月', '较上年 +6.7%', ClipboardList],
  ['研究论文', '3,268', '篇', '+328', '近 12 个月', '较上年 +11.2%', FileText],
  ['指南与教材', '42', '部', '+2', '近 12 个月', '较上年 +5.0%', BookOpen],
  ['研究机构', '63', '家', '+4', '近 12 个月', '较上年 +6.8%', Building2],
  ['研究者 / 学者', '186', '位', '+11', '近 12 个月', '较上年 +6.3%', Users],
];

const TRENDS = {
  研究数量: [
    ['2020', 18, 18],
    ['2021', 22, 40],
    ['2022', 31, 71],
    ['2023', 42, 113],
    ['2024', 50, 163],
    ['2025', 123, 286],
  ],
  疾病方向: [['抑郁', 128], ['焦虑', 74], ['睡眠共病', 46], ['其他情志病', 38]],
  研究设计: [['随机对照', 156], ['队列观察', 68], ['真实世界', 41], ['其他', 21]],
  干预方式: [['针刺', 142], ['电针', 71], ['针灸联合', 48], ['其他', 25]],
};

const TOP_CITIES = [
  ['北京', 42, 116.40, 39.90],
  ['上海', 38, 121.47, 31.23],
  ['广州', 29, 113.26, 23.13],
  ['成都', 24, 104.07, 30.57],
  ['杭州', 21, 120.16, 30.27],
];
const MORE_CITIES = [
  [117.2, 39.13, 16], [118.80, 32.06, 14], [114.31, 30.59, 12], [108.94, 34.34, 11],
  [106.55, 29.56, 10], [112.94, 28.23, 9], [113.63, 34.75, 8], [117.00, 36.65, 7],
  [123.43, 41.80, 6], [126.63, 45.75, 5], [102.71, 25.04, 8], [119.30, 26.08, 6],
  [117.28, 31.86, 7], [115.89, 28.68, 4], [112.55, 37.87, 5], [114.51, 38.04, 6],
  [108.37, 22.82, 4], [106.63, 26.65, 3], [103.83, 36.06, 3], [87.62, 43.83, 4],
  [111.75, 40.84, 3], [125.32, 43.88, 4], [110.35, 20.02, 2], [91.11, 29.65, 2],
  [121.56, 25.03, 6], [114.17, 22.32, 5],
];
const MAP_FRAME = { minLon: 73.4, maxLon: 135.2, minLat: 17.8, maxLat: 53.7 };
const INSET_FRAME = { minLon: 107.5, maxLon: 122.5, minLat: 3.2, maxLat: 17.6 };
const MAP_BOX = { x: 6, y: 4, w: 250, h: 220 };
const INSET_BOX = { x: 252, y: 168, w: 60, h: 72 };

function project(lon, lat, frame, box) {
  return [
    box.x + ((lon - frame.minLon) / (frame.maxLon - frame.minLon)) * box.w,
    box.y + ((frame.maxLat - lat) / (frame.maxLat - frame.minLat)) * box.h,
  ];
}

function ringPath(ring, frame, box) {
  return `${ring.map(([lon, lat], index) => {
    const [x, y] = project(lon, lat, frame, box);
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join('')}Z`;
}

function mapPaths() {
  const main = [];
  const inset = [];
  china.features.forEach((feature) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    polygons.forEach((polygon) => polygon.forEach((ring) => {
      const maxLat = ring.reduce((max, point) => Math.max(max, point[1]), -90);
      if (maxLat < 17.6) inset.push(ringPath(ring, INSET_FRAME, INSET_BOX));
      else main.push(ringPath(ring, MAP_FRAME, MAP_BOX));
    }));
  });
  return { main: main.join(''), inset: inset.join('') };
}

const CHINA = mapPaths();

const NEWS = [
  ['新增临床注册研究 6 项', '主要涉及抑郁症、焦虑与干预等', '今天', 'reg', ClipboardList],
  ['新增研究论文 23 篇', '涉及穴位机制、神经调控等方向', '2025-08-18', 'paper', FileText],
  ['新增指南 / 共识 2 项', '中国针灸学会发布相关专家共识', '2025-08-12', 'guide', BookOpen],
  ['新增研究者 4 位', '来自北京中医药大学、成都中医药大学等', '2025-08-05', 'people', UserRound],
];

const STUDIES = [
  ['针灸联合认知行为疗法治疗抑郁症的随机对照研究', 'ChiCTR2400081234', '2025-08-12', '北京中医药大学东直门医院', '进行中'],
  ['电针调节脑肠轴治疗抑郁障碍的随机对照研究', 'ChiCTR2500080911', '2025-08-05', '上海中医药大学附属岳阳医院', '招募中'],
  ['针灸治疗失眠障碍的多中心随机对照研究', 'ChiCTR2500087654', '2025-07-20', '广州中医药大学第一附属医院', '尚未招募'],
  ['针灸联合抗抑郁药治疗中度抑郁症的临床研究', 'ChiCTR2500088654', '2025-07-20', '四川省中医院', '已完成'],
  ['耳针联合常规治疗改善焦虑症状的临床观察', 'ChiCTR2500088543', '2025-07-15', '浙江中医药大学附属医院', '进行中'],
  ['针刺「百会-神门」对抑郁障碍的疗效观察', 'ChiCTR2500083111', '2025-07-10', '成都中医药大学附属医院', '招募中'],
];

const PEOPLE = [
  ['张某某', '教授', '北京中医药大学 · 针灸推拿学院', ['抑郁症', '电针'], 12, 86],
  ['李某某', '教授', '上海中医药大学 · 针灸学院', ['焦虑障碍', '穴位机制'], 15, 72],
  ['王某某', '教授', '广州中医药大学 · 第一附属医院', ['情志共病', '综合治疗'], 12, 65],
  ['陈某某', '教授', '成都中医药大学 · 针灸推拿学院', ['睡眠障碍', '针灸机制'], 11, 54],
  ['刘某某', '教授', '浙江中医药大学 · 针灸学院', ['情志病', '针刺'], 9, 48],
];

const NOTES = [
  ['多中心临床研究持续增加', '近两年针灸治疗抑郁相关注册研究中，多中心设计的占比持续提高，同时长期随访设计开始增加。', '12 项相关注册', '8 篇相关研究'],
  ['研究热点向「睡眠共病」延伸', '最新研究中，抑郁伴失眠、焦虑伴睡眠障碍等共病人群的针灸干预研究数量显著增加。', '6 项临床注册', '23 篇相关研究'],
];

function TrendChart({ rows }) {
  const width = 560;
  const height = 196;
  const left = 36;
  const right = 36;
  const top = 28;
  const bottom = 28;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const xAt = (index) => left + (innerW * index) / (rows.length - 1);
  const yAdded = (value) => top + innerH - (value / 150) * innerH;
  const yTotal = (value) => top + innerH - (value / 500) * innerH;
  const line = rows.map((row, index) => `${xAt(index)},${yTotal(row[2])}`).join(' ');
  const last = rows[rows.length - 1];
  return (
    <svg className="hub-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="2020 到 2025 年临床注册趋势，2025 年新增 123 项，累计 286 项">
      {[0, 50, 100, 150].map((tick) => (
        <g key={tick}>
          <line x1={left} x2={width - right} y1={yAdded(tick)} y2={yAdded(tick)} />
          <text x={left - 8} y={yAdded(tick) + 4} textAnchor="end">{tick}</text>
        </g>
      ))}
      {[0, 250, 500].map((tick) => (
        <text key={tick} x={width - right + 8} y={yTotal(tick) + 4}>{tick}</text>
      ))}
      {rows.map((row, index) => (
        <rect key={row[0]} x={xAt(index) - 10} y={yAdded(row[1])} width="20" height={yAdded(0) - yAdded(row[1])} rx="3" />
      ))}
      <polyline points={line} />
      {rows.map((row, index) => <circle key={row[0]} cx={xAt(index)} cy={yTotal(row[2])} r="3.5" />)}
      {rows.map((row, index) => <text key={`${row[0]}-label`} className="axis" x={xAt(index)} y={height - 8} textAnchor="middle">{row[0]}</text>)}
      <g className="hub-callout" transform={`translate(${xAt(rows.length - 1) - 108}, ${yAdded(last[1]) - 46})`}>
        <rect width="104" height="40" rx="6" />
        <text x="8" y="16">2025 新增 {last[1]} 项</text>
        <text x="8" y="32">累计 {last[2]} 项</text>
      </g>
    </svg>
  );
}

function SplitChart({ rows }) {
  const max = Math.max(...rows.map((row) => row[1]));
  return (
    <div className="hub-split">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <i><b style={{ width: `${(value / max) * 100}%` }} /></i>
          <em>{value}</em>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [trend, setTrend] = useState('研究数量');
  const rows = TRENDS[trend];
  return (
    <main className="platform-main hub-board">
      <section className="hub-kpis" aria-label="领域规模">
        {KPIS.map(([label, value, unit, delta, window, compare, Icon]) => (
          <article key={label} className="hub-kpi">
            <header><span><Icon size={16} /></span><small>{label}</small></header>
            <b>{value}<em>{unit}</em></b>
            <p><span><strong>{delta}</strong> {window}</span><span>{compare}</span></p>
          </article>
        ))}
      </section>
      <section className="hub-grid">
        <article className="hub-card">
          <header>
            <h2><BarChart3 size={16} aria-hidden="true" />临床注册趋势</h2>
            <div className="hub-switch" role="tablist" aria-label="趋势维度">
              {Object.keys(TRENDS).map((name) => (
                <button key={name} type="button" role="tab" aria-selected={trend === name} className={trend === name ? 'on' : ''} onClick={() => setTrend(name)}>{name}</button>
              ))}
            </div>
          </header>
          <div className="hub-trend-body">
            {trend === '研究数量' ? <TrendChart rows={rows} /> : <SplitChart rows={rows} />}
            {trend === '研究数量' && (
              <p className="hub-legend"><i />新增研究（项）<b />累计研究（项）<span>近 5 年</span></p>
            )}
          </div>
        </article>
        <article className="hub-card">
          <header>
            <h2><MapPin size={16} aria-hidden="true" />研究机构分布</h2>
            <button type="button">查看详情</button>
          </header>
          <p className="hub-note">基于临床注册研究实施机构统计</p>
          <div className="hub-map">
            <svg viewBox="2 0 258 228" role="img" aria-label="中国地图，研究机构主要分布在北京、上海、广州、成都和杭州">
              <path className="land" d={CHINA.main} />
              {MORE_CITIES.map(([lon, lat, count]) => {
                const [x, y] = project(lon, lat, MAP_FRAME, MAP_BOX);
                return <circle key={`${lon}-${lat}`} cx={x} cy={y} r={2.4} data-count={count} />;
              })}
              {TOP_CITIES.map(([name, count, lon, lat]) => {
                const [x, y] = project(lon, lat, MAP_FRAME, MAP_BOX);
                return <circle key={name} cx={x} cy={y} r="3.5" data-count={count}><title>{`${name} ${count}`}</title></circle>;
              })}
            </svg>
            <p className="hub-scale"><i />≥20 <i />10–19 <i />5–9 <i />1–4</p>
            <div className="hub-rank">
              <b>TOP 5 城市</b>
              <small>研究机构数</small>
              <ol>
                {TOP_CITIES.map(([name, count], index) => (
                  <li key={name}><em>{index + 1}</em>{name}<strong>{count}</strong></li>
                ))}
              </ol>
            </div>
          </div>
        </article>
        <article className="hub-card">
          <header>
            <h2><Bell size={16} aria-hidden="true" />领域动态</h2>
            <button type="button">查看全部</button>
          </header>
          <ul className="hub-news">
            {NEWS.map(([title, detail, time, kind, Icon]) => (
              <li key={title} className={kind}>
                <Icon size={16} aria-hidden="true" />
                <div>
                  <b>{title}</b>
                  <span>{detail}</span>
                </div>
                <time>{time}</time>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="hub-grid hub-lower">
        <article className="hub-card">
          <header>
            <h2><ClipboardList size={16} aria-hidden="true" />最新临床注册研究</h2>
            <button type="button" className="hub-registry">查看全部</button>
          </header>
          <table className="hub-studies">
            <thead>
              <tr><th>研究题目</th><th>注册号</th><th>注册时间</th><th>实施机构</th><th>状态</th></tr>
            </thead>
            <tbody>
              {STUDIES.map(([title, code, date, org, status]) => (
                <tr key={code}>
                  <td title={title}>{title}</td>
                  <td>{code}</td>
                  <td>{date}</td>
                  <td title={org}>{org}</td>
                  <td><span className={`status ${status}`}>{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="hub-card">
          <header>
            <h2><Users size={16} aria-hidden="true" />活跃研究者 / 学者</h2>
            <button type="button">查看全部</button>
          </header>
          <ul className="hub-people">
            {PEOPLE.map(([name, title, org, tags, studies, papers]) => (
              <li key={name}>
                <span aria-hidden="true">{name.slice(0, 1)}</span>
                <div>
                  <b>{name} {title}</b>
                  <small>{org}</small>
                  <p>{tags.map((tag) => <em key={tag}>{tag}</em>)}</p>
                </div>
                <strong>临床研究 {studies}<br />论文 {papers}</strong>
              </li>
            ))}
          </ul>
        </article>
        <article className="hub-card">
          <header><h2><Eye size={16} aria-hidden="true" />领域观察</h2></header>
          {NOTES.map(([title, body, regs, papers]) => (
            <section key={title} className="hub-note-card">
              <h3><Lightbulb size={16} aria-hidden="true" />{title}</h3>
              <p>{body}</p>
              <footer><span>{regs}</span><span>{papers}</span><button type="button" className="hub-evidence">查看依据</button></footer>
            </section>
          ))}
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
