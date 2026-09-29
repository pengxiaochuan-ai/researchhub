import React, { useMemo, useState } from 'react';
import { Building2, ClipboardList, Info, Users } from 'lucide-react';
import china from '../../h01/src/china.json';
import { STUDIES, matchStudy } from '../../c01/src/chrome.jsx';

const TOP = [
  ['北京', 42, 26, 28],
  ['上海', 38, 24, 18],
  ['广州', 29, 20, 16],
  ['成都', 24, 16, 12],
  ['杭州', 21, 14, 12],
];

const DETAIL = {
  北京: [['北京中医药大学东直门医院', 12], ['中国中医科学院广安门医院', 8], ['北京中医药大学', 6], ['首都医科大学附属北京中医医院', 5], ['北京大学第六医院', 4]],
  上海: [['上海中医药大学附属龙华医院', 8], ['上海中医药大学附属曙光医院', 6], ['复旦大学附属华山医院', 5], ['上海交通大学医学院附属瑞金医院', 4], ['上海市中医医院', 4]],
  广州: [['广州中医药大学第一附属医院', 8], ['广东省中医院', 6], ['中山大学附属第一医院', 4], ['广州医科大学附属脑科医院', 3], ['广东省第二中医院', 2]],
  成都: [['成都中医药大学附属医院', 7], ['四川省中医院', 5], ['四川大学华西医院', 4], ['成都市中西医结合医院', 3], ['四川省人民医院', 2]],
  杭州: [['浙江省中医院', 6], ['浙江中医药大学附属第一医院', 5], ['浙江大学医学院附属第一医院', 3], ['杭州市中医院', 3], ['浙江省立同德医院', 2]],
};

const PLACES = [
  ['北京', 116.4, 39.9, 'both', 42], ['天津', 117.2, 39.13, 'org', 12], ['上海', 121.47, 31.23, 'both', 38],
  ['杭州', 120.16, 30.27, 'both', 21], ['南京', 118.8, 32.06, 'recruit', 18], ['广州', 113.26, 23.13, 'both', 29],
  ['成都', 104.07, 30.57, 'both', 24], ['武汉', 114.31, 30.59, 'org', 16], ['西安', 108.94, 34.34, 'org', 15],
  ['长沙', 112.94, 28.23, 'recruit', 12], ['重庆', 106.55, 29.56, 'org', 8], ['济南', 117, 36.65, 'org', 6],
  ['郑州', 113.62, 34.75, 'recruit', 5], ['沈阳', 123.43, 41.8, 'org', 4], ['哈尔滨', 126.53, 45.8, 'org', 4],
  ['昆明', 102.83, 25.04, 'recruit', 3], ['合肥', 117.28, 31.86, 'org', 6], ['福州', 119.3, 26.08, 'org', 4],
  ['乌鲁木齐', 87.62, 43.83, 'org', 2], ['兰州', 103.83, 36.06, 'org', 2], ['南宁', 108.37, 22.82, 'recruit', 3],
];

const REGIONS = [
  ['北京', '北京', 28, 42, 26, '2026-09-28'],
  ['上海', '上海', 18, 38, 24, '2026-09-28'],
  ['广东', '广州', 16, 29, 20, '2026-09-27'],
  ['四川', '成都', 12, 24, 16, '2026-09-26'],
  ['浙江', '杭州', 12, 21, 14, '2026-09-27'],
];

const RECENT = [
  ['针刺联合认知行为疗法治疗广泛性焦虑障碍的随机研究', 'ChiCTR2600098765', '北京', '上海市中医医院', '2026-09-28'],
  ['电针治疗抑郁障碍的多中心随机对照研究', 'ChiCTR2600098123', '北京', '北京中医药大学东直门医院', '2026-09-28'],
  ['针刺联合常规治疗改善卒中后抑郁的随机研究', 'ChiCTR2600098012', '广州', '广州中医药大学第一附属医院', '2026-09-27'],
  ['耳针治疗焦虑障碍的有效性与安全性研究', 'ChiCTR2600097988', '成都', '四川省中医院', '2026-09-27'],
  ['针灸治疗失眠伴焦虑的多中心临床研究', 'ChiCTR2600097721', '杭州', '浙江中医药大学第一附属医院', '2026-09-26'],
];

const FRAME = { minLon: 73.4, maxLon: 135.2, minLat: 17.8, maxLat: 53.7 };
const BOX = { x: 36, y: 8, w: 500, h: 390 };
const INSET = { x: 430, y: 318, w: 78, h: 86 };

function project(lon, lat, box = BOX, frame = FRAME) {
  return [
    box.x + ((lon - frame.minLon) / (frame.maxLon - frame.minLon)) * box.w,
    box.y + ((frame.maxLat - lat) / (frame.maxLat - frame.minLat)) * box.h,
  ];
}

function ringsOf(feature) {
  return feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

function toPath(rings, box, frame) {
  return rings.map((ring) => `${ring.map(([lon, lat], index) => {
    const [x, y] = project(lon, lat, box, frame);
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join('')}Z`).join('');
}

function land() {
  const main = [];
  const south = [];
  china.features.forEach((feature) => ringsOf(feature).forEach((polygon) => polygon.forEach((ring) => {
    const maxLat = ring.reduce((max, point) => Math.max(max, point[1]), -90);
    (maxLat < 17.6 ? south : main).push(ring);
  })));
  return { main: toPath(main, BOX, FRAME), south: toPath(south, INSET, { minLon: 108, maxLon: 118, minLat: 3, maxLat: 22 }) };
}

function provinceMarks() {
  return china.features.flatMap((feature) => {
    const name = feature.properties?.name || '';
    const short = name.replace(/(维吾尔|壮族|回族)自治区|特别行政区|自治区|省|市/g, '');
    if (!short || ['北京', '上海', '天津', '重庆', '香港', '澳门', '南海诸岛'].includes(short)) return [];
    const ring = ringsOf(feature).flat().filter((item) => item.reduce((max, point) => Math.max(max, point[1]), -90) >= 17.6).sort((a, b) => b.length - a.length)[0];
    if (!ring || ring.length < 12) return [];
    const lon = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    return [[short, ...project(lon, lat)]];
  });
}

const LAND = land();
const PROVINCES = provinceMarks();

export function MapView({ registry, onMore }) {
  const [mode, setMode] = useState('叠加查看');
  const [city, setCity] = useState('上海');
  const selected = TOP.find(([name]) => name === city) || TOP[1];
  const orgs = DETAIL[selected[0]] || [];
  const recent = useMemo(() => {
    const filtering = registry.query.trim() || Object.values(registry.filters).some((value) => value !== '全部');
    if (!filtering) return RECENT;
    const cities = new Set(STUDIES.filter((item) => matchStudy(item, registry.query, registry.filters)).map((item) => item.city));
    return RECENT.filter((item) => cities.has(item[2]) || item[0].includes(registry.query.trim()));
  }, [registry.query, registry.filters]);

  return (
    <>
      <div className="map-top">
        <section className="map-card">
          <header><i /><b>国内研究与招募点分布</b><Info size={14} aria-hidden="true" /></header>
          <div className="map-modes">
            {['叠加查看', '研究机构', '招募点'].map((name) => (
              <button key={name} type="button" className={mode === name ? 'on' : ''} onClick={() => setMode(name)}>{name}</button>
            ))}
          </div>
          <svg viewBox="0 0 540 430" role="img" aria-label="国内研究与招募点分布">
            <path className="land" d={LAND.main} />
            {PROVINCES.map(([name, x, y]) => <text key={name} className="province" x={x} y={y}>{name}</text>)}
            {PLACES.filter(([, , , kind]) => mode === '叠加查看' || (mode === '研究机构' ? kind !== 'recruit' : kind !== 'org')).map(([name, lon, lat, kind, count]) => {
              const [x, y] = project(lon, lat);
              return (
                <g key={name} className={kind} onClick={() => TOP.some(([item]) => item === name) && setCity(name)}>
                  <circle cx={x} cy={y} r={3 + Math.sqrt(count) * 0.7} />
                  {['北京', '天津', '上海', '广州', '成都', '西安'].includes(name) && <text textAnchor={name === '成都' || name === '西安' ? 'end' : 'start'} x={x + (name === '成都' || name === '西安' ? -8 : 8)} y={y + (name === '天津' ? 16 : -4)}>{name}</text>}
                </g>
              );
            })}
            <rect className="inset" x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="4" />
            <path className="land" d={LAND.south} />
            <text className="inset-label" x={INSET.x + 16} y={INSET.y + INSET.h - 8}>南海诸岛</text>
          </svg>
          <div className="map-legend">
            <span><i className="org" />研究机构 / 注册研究地点</span>
            <span><i className="recruit" />招募中研究点</span>
            <span><i className="both" />研究机构 + 招募点（重叠）</span>
          </div>
        </section>
        <div className="map-side">
          <section>
            <header><i /><b>TOP 5 城市（临床注册研究）</b></header>
            <ol className="map-rank">
              {TOP.map(([name, count], index) => (
                <li key={name} className={city === name ? 'on' : ''}>
                  <button type="button" onClick={() => setCity(name)}>
                    <em>{index + 1}</em><span>{name}</span><b style={{ width: `${(count / 42) * 100}%` }} /><strong>{count}</strong>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <header><i /><b>当前选中：{selected[0]}</b></header>
            <div className="map-metrics">
              <div><ClipboardList size={16} aria-hidden="true" /><span>注册研究</span><b>{selected[1]}</b></div>
              <div><Users size={16} aria-hidden="true" /><span>招募中研究</span><b>{selected[2]}</b></div>
              <div><Building2 size={16} aria-hidden="true" /><span>研究机构</span><b>{selected[3]}</b></div>
            </div>
            <p>{selected[0]}市主要研究机构（Top 5）<span>相关研究数</span></p>
            <ol className="map-orgs">
              {orgs.map(([name, count], index) => <li key={name}><em>{index + 1}</em><span>{name}</span><b>{count}</b></li>)}
            </ol>
          </section>
        </div>
      </div>
      <div className="map-bottom">
        <section>
          <header><i /><b>地区分布明细</b></header>
          <table>
            <thead><tr><th>省份 / 城市</th><th>研究机构数</th><th>注册研究数</th><th>招募中研究</th><th>最近更新</th></tr></thead>
            <tbody>
              {REGIONS.map(([label, target, orgsCount, studies, recruiting, updated]) => (
                <tr key={label} className={city === target ? 'on' : ''} onClick={() => setCity(target)}>
                  <td>{label}</td><td>{orgsCount}</td><td>{studies}</td><td>{recruiting}</td><td>{updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <header><i /><b>最近新增招募研究</b><button type="button" onClick={onMore}>查看更多</button></header>
          <table>
            <thead><tr><th>研究题目</th><th>注册号</th><th>地区 / 城市</th><th>研究机构</th><th>招募状态</th><th>更新时间</th></tr></thead>
            <tbody>
              {recent.map(([title, code, place, org, updated]) => (
                <tr key={code}>
                  <td title={title}><span>{title}</span></td><td>{code}</td><td>{place}</td><td>{org}</td><td><em className="status 招募中">招募中</em></td><td>{updated}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={6}>没有符合当前条件的新增招募研究。</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
