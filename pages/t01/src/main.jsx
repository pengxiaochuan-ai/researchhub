import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronRight, LayoutList, Map, Search, X } from 'lucide-react';
import china from '../../h01/src/china.json';
import photo1 from './photos/team-1.png';
import photo2 from './photos/team-2.png';
import photo3 from './photos/team-3.png';
import photo4 from './photos/team-4.png';
import photo5 from './photos/team-5.png';
import './style.css';

const TEAMS = [
  {
    id: 'bucm',
    name: '北京中医药大学 针灸推拿学院抑郁障碍研究团队',
    org: '北京中医药大学',
    city: '北京',
    lead: '王某教授',
    orgType: '高校',
    teamType: '机制研究',
    level: '高相关',
    photo: photo1,
    summary: '专注于针灸治疗抑郁障碍的机制研究与临床转化，开展多中心随机对照试验、真实世界研究及神经生物学机制研究，探索针灸的个体化治疗方案。',
    tags: ['抑郁障碍', '针灸治疗', '临床试验', '机制研究', '中医病理化方'],
    papers: 286,
    trials: 12,
    members: 28,
    works: ['针灸治疗抑郁障碍的多中心随机对照试验（2023）', '针灸调节前额叶-边缘系统功能的机制研究（2022）'],
    geo: [116.4, 39.9],
  },
  {
    id: 'sjtu',
    name: '上海交通大学医学院附属精神卫生中心抑郁障碍研究团队',
    org: '上海交通大学医学院',
    city: '上海',
    lead: '李某教授',
    orgType: '医院',
    teamType: '临床研究',
    level: '高相关',
    photo: photo2,
    summary: '聚焦抑郁障碍的临床研究与转化医学，开展药物、心理治疗及物理治疗的多模式联合干预研究，建立临床队列和多中心研究网络。',
    tags: ['抑郁障碍', '心理治疗', '药物治疗', '临床队列', '转化医学'],
    papers: 342,
    trials: 19,
    members: 35,
    works: ['抑郁障碍多模态联合干预的真实世界研究（2023）', '生物标志物指导的个体化治疗研究（2022）'],
    geo: [121.47, 31.23],
  },
  {
    id: 'xiangya',
    name: '中南大学湘雅二医院情绪障碍研究团队',
    org: '中南大学',
    city: '长沙',
    lead: '张某教授',
    orgType: '医院',
    teamType: '临床研究',
    level: '相关',
    photo: photo3,
    summary: '专注于抑郁障碍和焦虑障碍的临床与基础研究，开展神经影像、生物标志物及临床干预研究，建立大样本临床数据库。',
    tags: ['抑郁障碍', '焦虑障碍', '神经影像', '生物标志物', '临床数据库'],
    papers: 318,
    trials: 16,
    members: 42,
    works: ['抑郁障碍脑影像标志物的多中心研究（2023）', '基于机器学习的抑郁症预测模型（2022）'],
    geo: [112.94, 28.23],
  },
  {
    id: 'huaxi',
    name: '四川大学华西医院心理卫生中心研究团队',
    org: '四川大学华西医院',
    city: '成都',
    lead: '刘某教授',
    orgType: '医院',
    teamType: '临床研究',
    level: '相关',
    photo: photo4,
    summary: '开展抑郁障碍的临床流行病学、干预研究及机制研究，关注青少年抑郁、难治性抑郁和共病问题，建立区域性多中心研究网络。',
    tags: ['抑郁障碍', '青少年心理健康', '临床干预', '流行病学', '共病研究'],
    papers: 274,
    trials: 14,
    members: 38,
    works: ['青少年抑郁障碍的纵向队列研究（2023）', '难治性抑郁的联合治疗策略研究（2022）'],
    geo: [104.07, 30.57],
  },
  {
    id: 'tongji',
    name: '华中科技大学同济医学院附属同济医院精神医学研究团队',
    org: '华中科技大学同济医学院',
    city: '武汉',
    lead: '陈某教授',
    orgType: '医院',
    teamType: '转化研究',
    level: '相关',
    photo: photo5,
    summary: '聚焦抑郁障碍的临床诊疗与神经机制研究，开展脑功能成像、神经调控及数字医疗研究，推动临床应用转化。',
    tags: ['抑郁障碍', '神经调控', '脑功能成像', '数字医疗', '临床应用'],
    papers: 195,
    trials: 8,
    members: 26,
    works: ['经颅磁刺激治疗抑郁障碍的多中心研究（2023）', '数字化干预在抑郁障碍中的应用研究（2022）'],
    geo: [114.31, 30.59],
  },
];

const DIRECTIONS = ['抑郁障碍', '焦虑障碍', '针灸治疗', '心理治疗', '神经影像', '神经调控'];
const REGIONS = ['北京', '上海', '长沙', '成都', '武汉'];
const ORG_TYPES = ['高校', '医院'];
const TEAM_TYPES = ['机制研究', '临床研究', '转化研究'];
const FRAME = { minLon: 73.4, maxLon: 135.2, minLat: 17.8, maxLat: 53.7 };
const BOX = { x: 16, y: 8, w: 640, h: 460 };

function openTeam(id) {
  window.location.assign(`/pages/t02/?team=${id}`);
}

function project(lon, lat) {
  return [
    BOX.x + ((lon - FRAME.minLon) / (FRAME.maxLon - FRAME.minLon)) * BOX.w,
    BOX.y + ((FRAME.maxLat - lat) / (FRAME.maxLat - FRAME.minLat)) * BOX.h,
  ];
}

function landPath() {
  return china.features.map((feature) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.map((polygon) => polygon.map((ring) => {
      if (ring.reduce((max, point) => Math.max(max, point[1]), -90) < 17.6) return '';
      return `${ring.map(([lon, lat], index) => {
        const [x, y] = project(lon, lat);
        return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join('')}Z`;
    }).join('')).join('');
  }).join('');
}

function App() {
  const [showcase, setShowcase] = useState(true);
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [direction, setDirection] = useState('');
  const [region, setRegion] = useState('');
  const [orgType, setOrgType] = useState('');
  const [teamType, setTeamType] = useState('');
  const [sort, setSort] = useState('相关性');
  const [view, setView] = useState('列表');
  const [page, setPage] = useState(1);
  const shape = useMemo(() => landPath(), []);

  const chips = showcase
    ? [['direction', '抑郁障碍'], ['region', '北京']]
    : [
      direction && ['direction', direction],
      region && ['region', region],
      orgType && ['orgType', orgType],
      teamType && ['teamType', teamType],
    ].filter(Boolean);

  const rows = useMemo(() => {
    const matched = showcase ? TEAMS : TEAMS.filter((team) => {
      const text = `${team.name}${team.org}${team.lead}${team.tags.join('')}`;
      if (keyword && !text.includes(keyword.trim())) return false;
      if (direction && !team.tags.includes(direction) && team.summary.indexOf(direction) < 0) return false;
      if (region && team.city !== region) return false;
      if (orgType && team.orgType !== orgType) return false;
      if (teamType && team.teamType !== teamType) return false;
      return true;
    });
    return [...matched].sort((a, b) => {
      if (sort === '论文数') return b.papers - a.papers;
      if (sort === '临床试验') return b.trials - a.trials;
      if (sort === '团队成员') return b.members - a.members;
      if (a.level !== b.level) return a.level === '高相关' ? -1 : 1;
      return 0;
    });
  }, [showcase, keyword, direction, region, orgType, teamType, sort]);

  const total = showcase ? 128 : rows.length;
  const pageCount = showcase ? 13 : Math.max(1, Math.ceil(rows.length / 10));
  const visible = showcase || page === 1 ? rows : [];

  const clearChip = (key) => {
    setShowcase(false);
    setPage(1);
    if (key === 'direction') setDirection('');
    if (key === 'region') setRegion('');
    if (key === 'orgType') setOrgType('');
    if (key === 'teamType') setTeamType('');
    if (showcase && key === 'direction') setRegion('北京');
    if (showcase && key === 'region') setDirection('抑郁障碍');
  };

  const clearAll = () => {
    setShowcase(false);
    setDirection('');
    setRegion('');
    setOrgType('');
    setTeamType('');
    setKeyword('');
    setQuery('');
    setPage(1);
  };

  const pick = (setter) => (event) => {
    setShowcase(false);
    setPage(1);
    setter(event.target.value);
  };

  return (
    <main className="platform-main team-board">
      <section className="team-filters">
        <label className="team-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索团队名称、机构、负责人、研究方向..." onKeyDown={(event) => { if (event.key === 'Enter') { setKeyword(query); setShowcase(false); setPage(1); } }} />
        </label>
        <button type="button" className="team-go" onClick={() => { setKeyword(query); setShowcase(false); setPage(1); }}>搜索</button>
        <select aria-label="研究方向" value="" onChange={pick(setDirection)}>
          <option value="" disabled>研究方向</option>
          {DIRECTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="地区" value="" onChange={pick(setRegion)}>
          <option value="" disabled>地区</option>
          {REGIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="机构类型" value="" onChange={pick(setOrgType)}>
          <option value="" disabled>机构类型</option>
          {ORG_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="团队类型" value="" onChange={pick(setTeamType)}>
          <option value="" disabled>团队类型</option>
          {TEAM_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="相关性">排序：相关性</option>
          <option value="论文数">排序：论文数</option>
          <option value="临床试验">排序：临床试验</option>
          <option value="团队成员">排序：团队成员</option>
        </select>
      </section>
      <div className="team-meta">
        <div className="team-chips">
          {chips.length > 0 && <span>已选：</span>}
          {chips.map(([key, label]) => (
            <button key={key} type="button" onClick={() => clearChip(key)}>{label}<X size={12} /></button>
          ))}
          {chips.length > 0 && <button type="button" className="team-clear" onClick={clearAll}>清除全部</button>}
        </div>
        <div className="team-view">
          <b>共 {total} 个研究团队</b>
          <button type="button" className={view === '列表' ? 'on' : ''} onClick={() => setView('列表')}><LayoutList size={14} />列表</button>
          <button type="button" className={view === '地图' ? 'on' : ''} onClick={() => setView('地图')}><Map size={14} />地图</button>
        </div>
      </div>
      {view === '列表' && (
        <div className="team-list">
          {visible.map((team, index) => (
            <article key={team.id} className="team-card">
              <i>{index + 1}</i>
              <img src={team.photo} alt="" />
              <div>
                <header>
                  <h2>{team.name}</h2>
                  <em className={team.level === '高相关' ? 'hot' : ''}>{team.level}</em>
                </header>
                <p className="team-org">{team.org}　{team.city}　执行负责人：{team.lead}</p>
                <p>{team.summary}</p>
                <div className="team-tags">{team.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </div>
              <aside>
                <div className="team-nums">
                  <p><b>{team.papers}</b><small>论文</small></p>
                  <p><b>{team.trials}</b><small>临床试验</small></p>
                  <p><b>{team.members}</b><small>团队成员</small></p>
                </div>
                <h3>近期代表成果</h3>
                <ul>{team.works.map((work) => <li key={work}>{work}</li>)}</ul>
                <button type="button" onClick={(event) => { event.stopPropagation(); openTeam(team.id); }}>查看详情<ChevronRight size={14} /></button>
              </aside>
            </article>
          ))}
          {visible.length === 0 && <p className="team-empty">{page > 1 ? '当前示例只列出第 1 页。' : '没有符合条件的团队。'}</p>}
        </div>
      )}
      {view === '地图' && <TeamMap teams={visible.length ? visible : rows} shape={shape} />}
      <footer className="team-page">
        <span>共 {total} 条</span>
        <div>
          {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((item) => (
            <button key={item} type="button" className={page === item ? 'on' : ''} onClick={() => setPage(item)}>{item}</button>
          ))}
          {pageCount > 5 && <em>...</em>}
          {pageCount > 5 && <button type="button" className={page === pageCount ? 'on' : ''} onClick={() => setPage(pageCount)}>{pageCount}</button>}
        </div>
        <label>10 条/页</label>
        <label>前往<input value={page} onChange={(event) => setPage(Math.min(pageCount, Math.max(1, Number(event.target.value) || 1)))} /></label>
      </footer>
    </main>
  );
}

function TeamMap({ teams, shape }) {
  const places = [];
  teams.forEach((team) => {
    const found = places.find((item) => item.city === team.city);
    if (found) found.count += 1;
    else places.push({ city: team.city, geo: team.geo, count: 1 });
  });
  return (
    <section className="team-map">
      <svg viewBox="0 0 680 500" role="img" aria-label="研究团队分布">
        <path d={shape} />
        {places.map((place) => {
          const [x, y] = project(place.geo[0], place.geo[1]);
          return (
            <g key={place.city}>
              <circle cx={x} cy={y} r={6} />
              <text x={x + 10} y={y + 4}>{place.city} {place.count}</text>
            </g>
          );
        })}
      </svg>
      <ul>
        {teams.map((team) => <li key={team.id}><b>{team.city}</b><button type="button" onClick={() => openTeam(team.id)}>{team.name}</button></li>)}
      </ul>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
