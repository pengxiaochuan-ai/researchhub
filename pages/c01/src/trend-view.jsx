import React, { useState } from 'react';
import { Info, Sparkles } from 'lucide-react';

const YEARS = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const NEW_STUDIES = [6, 8, 10, 14, 18, 26, 34, 48, 72, 55];
const RANGES = { 近3年: 7, 近5年: 4, 近10年: 0 };

const DISEASES = [
  ['抑郁障碍', '#3b82f6', [4, 5, 6, 7, 8, 12, 16, 20, 26, 28]],
  ['焦虑障碍', '#0ba981', [2, 3, 4, 5, 6, 8, 10, 14, 16, 18]],
  ['睡眠障碍', '#8b5cf6', [1, 2, 2, 3, 4, 5, 7, 8, 10, 12]],
  ['情志共病', '#f59e0b', [1, 1, 1, 2, 2, 3, 3, 4, 5, 6]],
  ['其他', '#94a3b8', [1, 1, 1, 1, 2, 2, 2, 3, 3, 4]],
];
const METHODS = [
  ['电针', '#3b82f6', [3, 4, 5, 6, 7, 9, 12, 16, 20, 22]],
  ['针刺', '#0ba981', [4, 5, 6, 7, 8, 10, 12, 14, 18, 20]],
  ['艾灸', '#f59e0b', [1, 2, 2, 3, 3, 4, 5, 6, 8, 10]],
  ['耳针', '#8b5cf6', [1, 1, 2, 2, 3, 4, 4, 6, 7, 8]],
  ['其他', '#94a3b8', [1, 1, 1, 2, 2, 3, 4, 5, 6, 8]],
];
const DESIGNS = [
  ['多中心 RCT', '#3b82f6'],
  ['单中心 RCT', '#34d399'],
  ['其他 RCT', '#fbbf24'],
  ['观察性研究', '#fb923c'],
  ['真实世界研究', '#c4b5fd'],
];
const DESIGN_SHARE = [
  [4, 14, 10, 48, 24], [5, 15, 10, 46, 24], [6, 16, 10, 44, 24], [7, 17, 10, 42, 24], [8, 18, 9, 42, 23],
  [12, 18, 10, 38, 22], [16, 18, 10, 36, 20], [20, 17, 10, 34, 19], [26, 16, 10, 30, 18], [28, 16, 10, 28, 18],
];
const MEDIAN = [48, 52, 55, 58, 60, 78, 95, 115, 132, 150];

function sliceAt(range) {
  return RANGES[range];
}
function yearLabel(year) {
  return year === '2025' ? '2025（至今）' : year;
}

function ComboChart({ years, values }) {
  const w = 620;
  const h = 220;
  const left = 32;
  const right = 36;
  const top = 8;
  const bottom = 36;
  const innerW = w - left - right;
  const innerH = h - top - bottom;
  const cumulative = values.reduce((list, value) => list.concat((list.at(-1) || 0) + value), []);
  const x = (index) => left + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW);
  const yNew = (value) => top + innerH - (value / 80) * innerH;
  const yTotal = (value) => top + innerH - (value / 300) * innerH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="左轴是新注册研究数，右轴是累计研究数">
      {[0, 20, 40, 60, 80].map((value) => <line key={`g${value}`} x1={left} x2={w - right} y1={yNew(value)} y2={yNew(value)} stroke="#eef2f6" />)}
      {[0, 20, 40, 60, 80].map((value) => <text key={`l${value}`} x="2" y={yNew(value) + 3}>{value}</text>)}
      {[100, 200, 300].map((value) => <text key={`r${value}`} x={w - 4} y={yTotal(value) + 3} textAnchor="end">{value}</text>)}
      {values.map((value, index) => <rect key={years[index]} x={x(index) - 9} y={yNew(value)} width="18" height={yNew(0) - yNew(value)} rx="2" fill="#3b82f6" />)}
      <path d={cumulative.map((value, index) => `${index ? 'L' : 'M'}${x(index)} ${yTotal(value)}`).join(' ')} fill="none" stroke="#0ba981" strokeWidth="2" />
      {cumulative.map((value, index) => <circle key={years[index]} cx={x(index)} cy={yTotal(value)} r="3.5" fill="#fff" stroke="#0ba981" strokeWidth="2" />)}
      {years.map((year, index) => <text key={year} x={x(index)} y={h - 6} textAnchor={index === years.length - 1 ? 'end' : 'middle'}>{yearLabel(year)}</text>)}
    </svg>
  );
}

function LineChart({ years, series, max }) {
  const w = 620;
  const h = 200;
  const left = 28;
  const right = 28;
  const top = 8;
  const bottom = 32;
  const innerW = w - left - right;
  const innerH = h - top - bottom;
  const x = (index) => left + (years.length === 1 ? innerW / 2 : (index / (years.length - 1)) * innerW);
  const y = (value) => top + innerH - (value / max) * innerH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="研究数量变化">
      {[0, max / 4, max / 2, (max * 3) / 4, max].map((value) => <text key={value} x="2" y={y(value) + 3}>{value}</text>)}
      {series.map(([name, color, values]) => (
        <g key={name}>
          <path d={values.map((value, index) => `${index ? 'L' : 'M'}${x(index)} ${y(value)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" />
          {values.map((value, index) => <circle key={years[index]} cx={x(index)} cy={y(value)} r="3" fill={color} />)}
        </g>
      ))}
      {years.map((year, index) => <text key={year} x={x(index)} y={h - 6} textAnchor={index === years.length - 1 ? 'end' : 'middle'}>{yearLabel(year)}</text>)}
    </svg>
  );
}

function StackChart({ years, rows }) {
  const w = 280;
  const h = 180;
  const left = 32;
  const bottom = 24;
  const innerW = w - left - 8;
  const innerH = h - 8 - bottom;
  const gap = innerW / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="研究设计占比">
      {[0, 25, 50, 75, 100].map((value) => <text key={value} x="0" y={8 + innerH - (value / 100) * innerH + 3}>{value}%</text>)}
      {rows.map((shares, index) => {
        let used = 0;
        return shares.map((share, shareIndex) => {
          const height = (share / 100) * innerH;
          const y = 8 + innerH - used - height;
          used += height;
          return <rect key={`${years[index]}-${shareIndex}`} x={left + index * gap + 6} y={y} width={Math.max(gap - 12, 8)} height={height} fill={DESIGNS[shareIndex][1]} />;
        });
      })}
      {years.map((year, index) => <text key={year} x={left + index * gap + gap / 2} y={h - 6} textAnchor="middle">{year.slice(2)}</text>)}
    </svg>
  );
}

function MedianChart({ years, values }) {
  const w = 280;
  const h = 180;
  const left = 28;
  const bottom = 24;
  const innerW = w - left - 8;
  const innerH = h - 8 - bottom;
  const x = (index) => left + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW);
  const y = (value) => 8 + innerH - (value / 250) * innerH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="研究样本量中位数">
      {[0, 50, 100, 150, 200, 250].map((value) => <text key={value} x="0" y={y(value) + 3}>{value}</text>)}
      <path d={values.map((value, index) => `${index ? 'L' : 'M'}${x(index)} ${y(value)}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {values.map((value, index) => <circle key={years[index]} cx={x(index)} cy={y(value)} r="3" fill="#3b82f6" />)}
      {years.map((year, index) => <text key={year} x={x(index)} y={h - 6} textAnchor="middle">{year.slice(2)}</text>)}
    </svg>
  );
}

function Notes({ title, items }) {
  return (
    <aside className="trend-side">
      <h3><Sparkles size={16} aria-hidden="true" />{title}</h3>
      <ol>
        {items.map(([heading, body], index) => (
          <li key={heading}><em>{index + 1}</em><div><b>{heading}</b><span>{body}</span></div></li>
        ))}
      </ol>
    </aside>
  );
}

export function TrendView() {
  const [range, setRange] = useState('近5年');
  const [direction, setDirection] = useState('疾病方向');
  const start = sliceAt(range);
  const years = YEARS.slice(start);
  const values = NEW_STUDIES.slice(start);
  const series = (direction === '疾病方向' ? DISEASES : METHODS).map(([name, color, data]) => [name, color, data.slice(start)]);
  const latest = series.map(([name, color, data]) => [name, color, data.at(-1)]).sort((a, b) => b[2] - a[2]);
  const total = latest.reduce((sum, item) => sum + item[2], 0);
  const quantityNote = range === '近5年'
    ? ['近 5 年研究数量持续上升', '2020 年新增 18 项，2024 年增至 72 项，年均增长约 32%。']
    : [`${range}新注册研究数变化`, `${years[0]} 年新增 ${values[0]} 项，2024 年增至 72 项。`];

  return (
    <div className="trend-board">
      <section className="trend-card">
        <div>
          <header>
            <div><b>临床研究发展趋势</b><Info size={14} aria-hidden="true" /><small>展示近年该领域新注册研究数量及累计研究数量的变化趋势。</small></div>
            <div className="trend-ranges" role="tablist">
              {Object.keys(RANGES).map((name) => <button key={name} type="button" className={range === name ? 'on' : ''} onClick={() => setRange(name)}>{name}</button>)}
            </div>
          </header>
          <div className="trend-legend"><i className="bar" />新注册研究数（左轴）<i className="line" />累计研究数（右轴）</div>
          <ComboChart years={years} values={values} />
        </div>
        <Notes title="趋势要点" items={[
          quantityNote,
          ['RCT 研究占比逐步提高', '近 5 年 RCT 研究从 35% 上升至 52%，显示研究设计日趋规范。'],
          ['多中心研究明显增加', '2020 年多中心研究占 8%，2024 年提升至 26%，合作研究趋势增强。'],
        ]} />
      </section>

      <section className="trend-card">
        <div>
          <header>
            <div><b>研究方向变化</b><Info size={14} aria-hidden="true" /><small>展示不同疾病方向或干预方式的研究数量变化趋势。</small></div>
            <div className="trend-ranges" role="tablist">
              {['疾病方向', '干预方式'].map((name) => <button key={name} type="button" className={direction === name ? 'on' : ''} onClick={() => setDirection(name)}>{name}</button>)}
            </div>
          </header>
          <div className="trend-legend">
            {series.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}
          </div>
          <LineChart years={years} series={series} max={direction === '疾病方向' ? 40 : 40} />
        </div>
        <aside className="trend-side trend-dist">
          <header><b>2025 年{direction}分布（前 5）</b></header>
          <ol>
            {latest.map(([name, color, count]) => (
              <li key={name}>
                <span>{name}</span>
                <b><i style={{ width: `${(count / latest[0][2]) * 100}%`, background: color }} /></b>
                <em>{count}（{Math.round((count / total) * 100)}%）</em>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="trend-card trend-design">
        <div>
          <header>
            <div><b>研究设计演进</b><Info size={14} aria-hidden="true" /><small>展示不同研究设计类型的占比变化，以及研究样本量的变化趋势。</small></div>
          </header>
          <div className="trend-split">
            <div>
              <div className="trend-legend">{DESIGNS.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div>
              <StackChart years={years} rows={DESIGN_SHARE.slice(start)} />
            </div>
            <div>
              <div className="trend-caption"><p>研究样本量中位数变化</p><small>样本量（例）</small></div>
              <MedianChart years={years} values={MEDIAN.slice(start)} />
            </div>
          </div>
        </div>
        <Notes title="研究设计要点" items={[
          ['RCT 研究占比持续提升', '2020 年为 35%，2024 年提升至 52%。'],
          ['多中心研究增长明显', '2020 年占 8%，2024 年提升至 26%。'],
          ['研究样本量逐步扩大', '样本量中位数从 60 例增至 150 例。'],
        ]} />
      </section>
    </div>
  );
}
