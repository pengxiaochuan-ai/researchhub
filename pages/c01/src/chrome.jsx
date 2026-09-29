import React, { useState } from 'react';
import { Bookmark, Download, RotateCcw, Search, Settings2 } from 'lucide-react';

export const CATALOG = { deduped: 286, recent: 18, filtered: 64, synced: '2026-09-28 09:30' };

export const EMPTY_FILTERS = {
  disease: '全部', method: '全部', status: '全部', recruit: '全部', region: '全部', source: '全部', time: '全部',
};

export const FILTERS = [
  ['disease', '疾病方向', ['全部', '广泛性焦虑症', '抑郁症', '失眠障碍', '焦虑症', '抑郁障碍', '产后抑郁', '躯体症状障碍', '创伤后应激障碍']],
  ['method', '干预方式', ['全部', '针刺', '电针', '耳针', '艾灸', '推拿', '认知行为疗法', '常规治疗']],
  ['status', '研究状态', ['全部', '进行中', '已完成']],
  ['recruit', '招募状态', ['全部', '招募中', '尚未招募', '已完成']],
  ['region', '机构地区', ['全部', '北京', '上海', '广州', '成都', '杭州', '南京', '天津']],
  ['source', '来源平台', ['全部', 'ChiCTR', 'ITMCTR']],
  ['time', '时间范围', ['全部', '近30天', '近1年', '近3年']],
];

export const COLUMNS = [
  ['title', '研究题目'],
  ['code', '注册号'],
  ['type', '研究类型'],
  ['disease', '主要疾病'],
  ['method', '干预方式'],
  ['org', '牵头机构'],
  ['city', '城市'],
  ['status', '研究状态'],
  ['recruit', '招募状态'],
  ['dates', '首次公示 / 更新时间'],
  ['source', '来源'],
];

export const STUDIES = [
  { title: '针刺联合认知行为疗法治疗广泛性焦虑的多中心随机研究', code: 'ChiCTR2400081234', type: '多中心 RCT', disease: '广泛性焦虑症', methods: ['针刺', '认知行为疗法'], org: '北京中医药大学东直门医院', city: '北京', status: '进行中', recruit: '招募中', published: '2024-05-12', updated: '2024-08-20', sources: ['ChiCTR'] },
  { title: '电针对抑郁症睡眠障碍的干预研究', code: 'ChiCTR2400060987', type: '随机对照', disease: '抑郁症', methods: ['电针', '常规治疗'], org: '上海中医药大学附属曙光医院', city: '上海', status: '进行中', recruit: '招募中', published: '2024-04-16', updated: '2024-08-10', sources: ['ChiCTR'] },
  { title: '针灸治疗失眠障碍的多中心临床研究', code: 'ChiCTR2400080765', type: '多中心 RCT', disease: '失眠障碍', methods: ['针刺', '耳针'], org: '广州中医药大学第一附属医院', city: '广州', status: '进行中', recruit: '尚未招募', published: '2024-03-28', updated: '2024-07-30', sources: ['ChiCTR', 'ITMCTR'] },
  { title: '耳针联合常规治疗改善焦虑症状的随机研究', code: 'ChiCTR2400080643', type: '随机对照', disease: '焦虑症', methods: ['耳针', '常规治疗'], org: '四川省中医院', city: '成都', status: '进行中', recruit: '招募中', published: '2024-03-15', updated: '2024-07-18', sources: ['ChiCTR'] },
  { title: '针刺「百会-神门」对抑郁障碍的疗效与安全性研究', code: 'ChiCTR2400080512', type: '单中心 RCT', disease: '抑郁障碍', methods: ['针刺', '假针刺'], org: '浙江省中医院', city: '杭州', status: '进行中', recruit: '招募中', published: '2024-02-28', updated: '2024-07-05', sources: ['ChiCTR'] },
  { title: '艾灸联合经络推拿治疗产后抑郁的随机对照研究', code: 'ChiCTR2400080431', type: '随机对照', disease: '产后抑郁', methods: ['艾灸', '推拿'], org: '南京中医药大学附属医院', city: '南京', status: '进行中', recruit: '尚未招募', published: '2024-02-05', updated: '2024-06-28', sources: ['ChiCTR'] },
  { title: '电针治疗躯体症状障碍伴焦虑抑郁的随机对照研究', code: 'ChiCTR2400080316', type: '随机对照', disease: '躯体症状障碍', methods: ['电针', '常规治疗'], org: '天津中医药大学第一附属医院', city: '天津', status: '已完成', recruit: '已完成', published: '2024-01-18', updated: '2024-05-20', sources: ['ChiCTR'] },
  { title: '中医针刺治疗创伤后应激障碍的临床研究', code: 'ChiCTR2400080178', type: '多中心 RCT', disease: '创伤后应激障碍', methods: ['针刺', '常规治疗'], org: '中国中医科学院广安门医院', city: '北京', status: '进行中', recruit: '招募中', published: '2023-12-20', updated: '2024-05-10', sources: ['ChiCTR'] },
];

const DISEASE_TONE = { 广泛性焦虑症: 'purple', 抑郁症: 'blue', 失眠障碍: 'purple', 焦虑症: 'purple', 抑郁障碍: 'blue', 产后抑郁: 'pink', 躯体症状障碍: 'cyan', 创伤后应激障碍: 'purple' };
const METHOD_TONE = { 针刺: 'blue', 电针: 'blue', 耳针: 'purple', 艾灸: 'orange', 推拿: 'green', 认知行为疗法: 'green', 常规治疗: 'gray', 假针刺: 'gray' };

export function diseaseTone(name) { return DISEASE_TONE[name] || 'blue'; }
export function methodTone(name) { return METHOD_TONE[name] || 'gray'; }

export function matchStudy(item, query, filters) {
  const text = `${item.title}${item.code}${item.org}${item.city}${item.disease}`;
  if (query && !text.toLowerCase().includes(query.trim().toLowerCase())) return false;
  if (filters.disease !== '全部' && item.disease !== filters.disease) return false;
  if (filters.method !== '全部' && !item.methods.includes(filters.method)) return false;
  if (filters.status !== '全部' && item.status !== filters.status) return false;
  if (filters.recruit !== '全部' && item.recruit !== filters.recruit) return false;
  if (filters.region !== '全部' && item.city !== filters.region) return false;
  if (filters.source !== '全部' && !item.sources.includes(filters.source)) return false;
  if (filters.time === '近30天') return item.updated >= '2026-08-29';
  if (filters.time === '近1年') return item.updated >= '2025-09-28';
  if (filters.time === '近3年') return item.updated >= '2023-09-28';
  return true;
}

export function ViewTabs({ view, onChange }) {
  return (
    <div className="reg-views" role="tablist" aria-label="临床注册视图">
      {[['list', '研究列表'], ['map', '研究分布地图'], ['trend', '趋势分析']].map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

export function FilterBar({
  query, setQuery, filters, setFilter, sort, setSort, onReset, saved, onSave, hidden, toggleColumn, resultCount,
}) {
  const [fieldsOpen, setFieldsOpen] = useState(false);
  return (
    <section className="reg-filters">
      <form className="reg-bar" onSubmit={(event) => event.preventDefault()}>
        <label className="reg-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索研究题目 / 注册号 / 机构 / 研究者" />
        </label>
        {FILTERS.map(([key, label, options]) => (
          <select key={key} aria-label={label} value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}>
            {options.map((option) => <option key={option} value={option}>{option === '全部' ? label : option}</option>)}
          </select>
        ))}
        <select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option>综合排序</option>
          <option>更新时间</option>
          <option>注册号</option>
        </select>
        <button type="button" className="text" onClick={onReset}><RotateCcw size={14} aria-hidden="true" />重置</button>
      </form>
      <div className="reg-meta">
        <p>
          <span>已去重研究 <b>{CATALOG.deduped}</b> 项</span>
          <span>近 30 天新增 <b>{CATALOG.recent}</b> 项</span>
          <span>当前筛选结果 <b>{resultCount}</b> 项</span>
          <span>数据来源 ChiCTR / ITMCTR</span>
          <span>最近同步 {CATALOG.synced}</span>
        </p>
        <div className="reg-meta-actions">
          <button type="button"><Download size={14} aria-hidden="true" />导出</button>
          <div className="reg-field-wrap">
            <button type="button" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((value) => !value)}><Settings2 size={14} aria-hidden="true" />字段设置</button>
            {fieldsOpen && (
              <div className="reg-field-menu" role="group" aria-label="显示字段">
                {COLUMNS.map(([key, label]) => (
                  <label key={key}><input type="checkbox" checked={!hidden.has(key)} onChange={() => toggleColumn(key)} />{label}</label>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onSave}><Bookmark size={14} aria-hidden="true" />{saved ? '已保存筛选' : '保存筛选'}</button>
        </div>
      </div>
    </section>
  );
}

export function useRegistryState() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('综合排序');
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(() => new Set());
  const setFilter = (key, value) => {
    setSaved(false);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const onReset = () => {
    setQuery('');
    setFilters(EMPTY_FILTERS);
    setSort('综合排序');
    setSaved(false);
  };
  const toggleColumn = (key) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return { query, setQuery, filters, setFilter, sort, setSort, saved, onSave: () => setSaved(true), hidden, toggleColumn, onReset };
}
