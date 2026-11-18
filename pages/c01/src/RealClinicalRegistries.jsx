import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clinicalRegistryHref, hubVisibleRequest } from '../../../src/hub-source-api.js';
import {clinicalRegistryOptions,filterClinicalRegistries,reconcileClinicalFilters,emptyClinicalFilters,clinicalFilterIdentity} from '../../../src/clinical-registry-filters.js';
import './real-clinical.css';

const safeSource = url => typeof url === 'string' && /^https:\/\/[^\s/]+(?:\/|$)/i.test(url) ? url : null;

export function ClinicalRegistryFilters({query,onQuery,filters,options,onFilter,onReset,disabled}) {
  return <><label className="reg-search">搜索当前获准来源<input type="search" value={query} onChange={event=>onQuery(event.target.value)} placeholder="输入题名、注册号或疾病"/></label>
    {[['studyType','研究类型'],['disease','疾病'],['intervention','干预方式']].map(([key,label])=><label key={key}>{label}<select
      aria-label={label} value={filters[key]} disabled={disabled} style={{width:65}} title={filters[key]||'全部'} onChange={event=>onFilter(key,event.target.value)}>
      <option value="">全部</option>{options[key].map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}
    <label>研究状态<select disabled aria-label="研究状态（暂不可用）"><option>全部</option></select></label>
    <button type="button" onClick={onReset}>重置</button></>;
}

export function ClinicalRegistryRow({item}) {
  const summary=item.studySummaryStatus==='approved'?item.studySummary:null;
  return <tr><td className="reg-title"><a href={clinicalRegistryHref(item.documentId)}>{item.title}</a></td>
    <td>{item.externalKey||'未提供'}</td><td>{summary?.studyType?.value||'未提供'}</td>
    <td>{item.sourceTargetCondition||'未提供'}</td>
    <td>{summary?.interventions?.some(x=>x.intervention?.value)?summary.interventions.map((x,i)=><React.Fragment key={x.id}>{i>0&&<br/>}{x.intervention?.value||'原快照未填写'}</React.Fragment>):'未提供'}</td>
    <td title={summary?.leadInstitution?.value?'登记的研究实施负责（组长）单位，并非全部研究中心':undefined}>{summary?.leadInstitution?.value||'未提供'}</td>
    {['city','status'].map(key=><td key={key}>未提供</td>)}
    <td><span>注册：{summary?.registeredOn?.value||'未提供'}</span><br/><span title="所存来源快照的最近更新日期，不是本平台入库时间">来源更新：{item.sourceUpdatedOn||'未提供'}</span></td>
    <td>{item.sourceName||'未提供'}</td><td className="reg-ops"><a href={clinicalRegistryHref(item.documentId)}>查看方案</a>{safeSource(item.sourceUrl)&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">来源网站</a>}</td></tr>;
}

export function RealClinicalRegistries() {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [query, setQuery] = useState('');
  const [filters,setFilters]=useState(emptyClinicalFilters);
  const active = useRef(null);
  const identityPending=useRef(false);
  const identityKey=useRef(null);
  const load = () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'loading', items: [] });
    hubVisibleRequest('clinical-registries', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) {
        const items=result.items??[];
        setFilters(current=>reconcileClinicalFilters(current,clinicalRegistryOptions(items)));
        setState({status:'ready',items});
      } })
      .catch(error => { if (!controller.signal.aborted) setState({ status: 'error', message: error.message, items: [] }); });
    return () => controller.abort();
  };
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible'&&!identityPending.current) load(); };
    const identity=event=>{active.current?.abort();setState({status:'loading',items:[]});
      const key=clinicalFilterIdentity(event.detail);
      if(key!==null){
        if(identityKey.current!==null&&identityKey.current!==key)setFilters(emptyClinicalFilters());
        identityKey.current=key;
      }
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);if(!identityPending.current)load();};
    window.addEventListener('focus', refresh);
    window.addEventListener('qiyan:user-change',identity);
    document.addEventListener('visibilitychange', refresh);
    return () => { active.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('qiyan:user-change',identity); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const options=useMemo(()=>clinicalRegistryOptions(state.items),[state.items]);
  const filtered=useMemo(()=>filterClinicalRegistries(state.items,{query,...filters}),[state.items,query,filters]);

  return <main className="platform-main reg-board real-registry" aria-busy={state.status === 'loading'}>
    <div className="real-registry__content">
    <div className="reg-view-row"><div className="reg-views"><button type="button" className="on">研究列表</button></div></div>
    <section className="reg-filters"><div className="reg-bar"><ClinicalRegistryFilters query={query} onQuery={setQuery} filters={filters} options={options}
      onFilter={(key,value)=>setFilters(current=>({...current,[key]:value}))} onReset={()=>{setQuery('');setFilters(emptyClinicalFilters());}} disabled={state.status!=='ready'}/></div>
      <div className="reg-meta"><p>当前可见 {state.status==='ready'?filtered.length:'—'} 条注册来源；研究状态筛选暂不可用。</p></div></section>
    {state.status === 'loading' && <section className="real-registry__state" role="status">正在读取已审核注册来源…</section>}
    {state.status === 'error' && <section className="real-registry__state" role="alert">
      <h3>暂时无法读取注册来源</h3><p>{state.message}</p><button type="button" onClick={load}>重试</button>
    </section>}
    <section className="reg-panel"><div className="reg-table-wrap"><table><thead><tr>{['研究题目','注册号','研究类型','主要疾病','干预方式','牵头机构','城市','研究状态','注册日期 / 来源更新','来源','操作'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(item=><ClinicalRegistryRow key={item.documentId} item={item}/>)}</tbody></table></div><div className="reg-pager"><span>{state.status==='ready'?`当前 ${filtered.length} 条获准来源`:'正在核验来源'}</span><button disabled>上一页</button><button disabled>下一页</button></div>
      {state.status==='ready'&&(state.items.length === 0 ? <section className="real-registry__state"><h3>暂无已审核注册来源</h3><p>来源入库不等于获准公开。待管理员完成权利核验和展示审核后，记录会出现在这里。</p></section>
        : filtered.length === 0 ? <section className="real-registry__state"><h3>没有符合条件的来源</h3><p>请调整筛选条件或搜索词，或点击重置。</p></section>
        : null)}</section>
      <p className="real-registry__disclaimer">日期来自所存来源快照，不代表官网当前状态；缺失字段保持未提供。登记详情与原始位置可从“查看方案”进入，不代表结果已完成。</p>
    </div>
  </main>;
}
