import React, { useEffect, useRef, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { hubVisibleRequest, publicationHref } from '../../../src/hub-source-api.js';
import './real-evidence.css';
import EvidenceFilterSkeleton from './EvidenceFilterSkeleton.jsx';
import {normalizePublicationFilters,appliedFilterChips,facetChoices} from '../../../src/publication-filters.js';

const initial=()=>{try{const params=new URLSearchParams(window.location.search);return {query:(params.get('q')??'').slice(0,100),filters:normalizePublicationFilters(params.get('filters')??{})};}catch{return {query:'',filters:normalizePublicationFilters()};}};
function PaperTags({item}){const values=item.classification?.values??{};const tags=['types','designs','people','methods','diseases'].flatMap(key=>(values[key]??[]).map(value=>({key,value,label:facetChoices(key).find(([v])=>v===value)?.[1]})));return <div className="paper-tags" aria-label="文章分类标签">{tags.length?tags.map(t=><em key={t.key+t.value}>{t.label}</em>):<span>分类未识别</span>}</div>;}
function ClassificationEvidence({item}){const claims=item.classification?.claims??[];return <><p>系统按原题名、摘要或来源元数据提取；不是人工证据评级。未识别不表示没有，综述中的试验不作为本篇研究设计。</p><PaperTags item={item}/>{claims.map((claim,index)=><details key={index} className="paper-classification-evidence"><summary>{facetChoices(claim.facet).find(([v])=>v===claim.value)?.[1]} · {({title:'题名',abstract:'摘要',metadata:'原始元数据'})[claim.field]}</summary><p className="real-preview-reading">{claim.quote}</p></details>)}{!claims.length&&<p>当前获准内容中没有足够明确的分类依据。</p>}</>;}
export function QueryPlanHint({plan}){return !plan?.originalQuery&&plan?.mode!=='mapped'?null:<details className="real-evidence-source-state" aria-label="本次检索规则"><summary>{plan.mode==='mapped'?'已按中英文关键词检索':plan.mode==='identifier'?'已按文章标识精确检索':'按原文检索，未作英文扩展'}</summary><p>实际词形：{plan.appliedTerms?.join('、')}。词表版本：{plan.dictionaryVersion}。</p><p>{plan.warning||'同概念词形取“或”，不同概念取“且”；检索映射不是医学等价关系。'}</p></details>;}

export function RealEvidence() {
  const [start]=useState(initial);
  const [draft, setDraft] = useState(start.query);
  const [query, setQuery] = useState(start.query);
  const [draftFilters,setDraftFilters]=useState(start.filters),[filters,setFilters]=useState(start.filters),[facets,setFacets]=useState(null),[filterError,setFilterError]=useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [counts, setCounts] = useState(null);
  const [queryPlan,setQueryPlan]=useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedId,setSelectedId]=useState(null),[tab,setTab]=useState('摘要'),[view,setView]=useState('列表');
  const generation = useRef(0);
  const identityPending=useRef(false);
  useEffect(() => {
    const refresh = () => { if (!document.hidden&&!identityPending.current) setReload(value => value + 1); };
    const identity=event=>{generation.current++;setItems([]);setCounts(null);setQueryPlan(null);setFacets(null);setCursor(null);setSelectedId(null);setLoading(true);
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);if(!identityPending.current)setReload(value=>value+1);};
    window.addEventListener('focus', refresh);
    window.addEventListener('qiyan:user-change',identity);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('qiyan:user-change',identity); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if(identityPending.current)return;
    const controller = new AbortController();
    const current = ++generation.current;
    setLoading(true); setError(''); setItems([]); setCursor(null);setCounts(null);setQueryPlan(null);setFacets(null);
    hubVisibleRequest(`publications?limit=20&q=${encodeURIComponent(query)}&filters=${encodeURIComponent(JSON.stringify(filters))}`, { signal: controller.signal })
      .then(page => { if (generation.current === current) {
        setItems(page.items); setCursor(page.nextCursor);
        setCounts(page.counts);setFacets(page.facets);setQueryPlan(page.queryPlan??null);
      } })
      .catch(cause => { if (generation.current === current && cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (generation.current === current && !controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, filters, reload]);

  function apply(nextQuery,nextFilters,syncDraft=false){
    try{const normalized=normalizePublicationFilters(nextFilters);setFilterError('');setQuery(nextQuery.trim());setFilters(normalized);setSelectedId(null);
      generation.current++;setItems([]);setCursor(null);setCounts(null);setQueryPlan(null);setFacets(null);setLoading(true);if(syncDraft){setDraft(nextQuery.trim());setDraftFilters(normalized);}
      const url=new URL(window.location.href);url.searchParams.delete('q');url.searchParams.delete('filters');if(nextQuery.trim())url.searchParams.set('q',nextQuery.trim());if(JSON.stringify(normalized)!==JSON.stringify(normalizePublicationFilters()))url.searchParams.set('filters',JSON.stringify(normalized));window.history.replaceState(window.history.state,'',url);
    }catch(cause){setFilterError(cause.message);}
  }
  function clear(){const empty=normalizePublicationFilters();setDraft('');setDraftFilters(empty);apply('',empty);}
  function remove(chip){const removeFrom=value=>({...value,[chip.key]:Array.isArray(value[chip.key])?value[chip.key].filter(x=>x!==chip.value):'any',...(chip.key==='year'?{from:'',to:''}:{})});setDraftFilters(removeFrom);apply(query,removeFrom(filters));}

  async function loadMore() {
    if (!cursor || loading) return;
    const current = generation.current;
    setLoading(true); setError('');
    try {
      const page = await hubVisibleRequest(`publications?limit=20&q=${encodeURIComponent(query)}&filters=${encodeURIComponent(JSON.stringify(filters))}&cursor=${encodeURIComponent(cursor)}`);
      if (generation.current === current) {
        setItems(items => [...items, ...page.items]); setCursor(page.nextCursor);
        setCounts(previous => ({ ...page.counts, pmcTenantDisplayRecords: previous?.pmcTenantDisplayRecords }));
        setFacets(page.facets);
      }
    } catch (cause) { if (generation.current === current) setError(cause.message); }
    finally { if (generation.current === current) setLoading(false); }
  }

  const selected=items.find(item=>item.id===selectedId)||items[0];
  const chips=appliedFilterChips(filters);
  const dirty=draft.trim()!==query||JSON.stringify(draftFilters)!==JSON.stringify(filters);
  return <main className="platform-main paper-board real-evidence">
    <div className="paper-work">
      <form className="paper-filters" aria-label="筛选条件" onSubmit={event=>{event.preventDefault();apply(draft,draftFilters,true);}}><div className="paper-filter-scroll"><div className="paper-filter-title"><b>筛选条件</b></div>
        <label htmlFor="real-evidence-search">检索标题、作者、期刊或 DOI</label><div className="paper-find"><Search size={14}/><input id="real-evidence-search" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={100}/></div>
        <p id="evidence-filter-limit">同组多选取“或”，不同组取“且”；点击应用后生效。数量对应已应用条件，未识别不等于没有。</p>
        {filterError&&<p role="alert" className="paper-filter-error">{filterError}</p>}
        <EvidenceFilterSkeleton filters={draftFilters} onChange={setDraftFilters} facets={facets}/>
        <details className="real-evidence-source-state"><summary>来源与审核状态</summary><dl><dt>工作簿暂存原始行</dt><dd>{counts?.stagedRows?.toLocaleString()??'—'}</dd><dt>PMC 暂存候选</dt><dd>{counts?.pmcStagedCandidates??'—'}</dd><dt>工作簿获准展示</dt><dd>{counts?.approvedDisplayRecords??'—'}</dd><dt>PMC 公开展示</dt><dd>{counts?.pmcApprovedDisplayRecords??'—'}</dd><dt>PMC 仅租户内（当前筛选）</dt><dd>{counts?.pmcTenantDisplayRecords??'—'}</dd><dt>工作簿获准 AI 检索</dt><dd>{counts?.approvedAiRecords??'—'}</dd></dl><p>暂存数量不代表获准内容。</p></details>
      </div><footer className="paper-filter-foot"><p>{dirty?'有未应用的筛选修改':query||chips.length?'当前条件已应用':'当前未应用筛选条件'}</p><div><button type="button" onClick={clear}>清空全部</button><button type="submit" className="paper-apply">应用筛选</button></div></footer></form>
      <section className="paper-list" aria-labelledby="real-evidence-title">
        <header><div className="paper-list-bar"><b id="real-evidence-title" aria-live="polite">{loading?'正在读取获准论文':`已加载 ${items.length} / ${counts?.matchedRecords??0} 篇论文${cursor?'（还有更多）':''}`}</b><label>排序<select disabled aria-label="排序（暂不可用）"><option>来源顺序</option></select></label><div className="paper-views">{['列表','图表'].map(label=><button type="button" key={label} className={view===label?'on':''} onClick={()=>setView(label)}>{label}</button>)}</div></div>{(query||chips.length>0)&&<div className="paper-chips">{query&&<button type="button" onClick={()=>{setDraft('');apply('',filters);}}>关键词：{query} ×</button>}{chips.map(chip=><button type="button" key={chip.key+chip.value} aria-label={`移除筛选：${chip.label}`} onClick={()=>remove(chip)}>{chip.label} ×</button>)}</div>}</header>
        {queryPlan&&<QueryPlanHint plan={queryPlan}/>}
        {loading && items.length === 0 && <p className="real-evidence-state" role="status">正在读取已获准来源…</p>}
        {error && <div className="real-evidence-state error" role="alert">来源服务暂不可用：{error}<button type="button" onClick={() => setReload(value => value + 1)}>重试</button></div>}
        {!loading && !error && items.length === 0 && <div className="real-evidence-state" role="status">
          <h3>{query||chips.length?'当前筛选无匹配论文':'暂无已获准文献'}</h3><p>{query||chips.length ? '可移除条件或清空全部；未识别标签不表示文章没有相关内容。' : '来源已隔离入库，等待 Hub 管理员完成权利和内容审核后才会展示。'}</p>
        </div>}
        {view==='列表'?<div className="paper-rows">{items.map((item,index)=><article className={selected?.id===item.id?'on':''} key={item.id}><span className="paper-check" aria-hidden="true"/><span className="paper-index">{index+1}.</span><div><h2 className="ptitle"><button type="button" className="real-paper-select" onClick={()=>{setSelectedId(item.id);setTab('摘要');}}>{item.title}</button></h2><PaperTags item={item}/><p>{[item.authors,item.journal,item.year].filter(Boolean).join(' · ')||'书目信息待补充'}</p><p>来源：{item.sourceName}{item.visibility==='tenant'?' · 仅租户内':''}</p><p className="paper-blurb">{item.abstract||'摘要未获准展示或来源未提供摘要。'}</p><div className="paper-acts"><a href={publicationHref(item.id)}>查看完整详情</a><span>记录版本 {item.canonicalVersion} · 审核决定 {item.reviewVersion}</span></div></div><span className="paper-cite">引用量<br/>未核验</span></article>)}</div>:<div className="paper-chart"><h2>研究图表</h2><p>趋势与引用统计暂不可用；当前列表不代表全域分布。</p></div>}
        {cursor && <button className="real-evidence-more" type="button" onClick={loadMore} disabled={loading}>加载更多获准文献</button>}
      </section>
      <section className="paper-detail" aria-label="选中论文预览"><div className="paper-tabs">{['摘要','研究设计','主要结果','引用网络','相关研究'].map(label=><button type="button" key={label} className={tab===label?'on':''} onClick={()=>setTab(label)}>{label}</button>)}</div><div className="paper-detail-body">{selected?<><h2>{selected.title}</h2><p>{[selected.authors,selected.journal,selected.year].filter(Boolean).join(' · ')}</p>{tab==='摘要'?<p className="real-preview-reading">{selected.abstract||'摘要未获准展示或来源未提供摘要。'}</p>:tab==='研究设计'?<ClassificationEvidence item={selected}/>:<p>当前来源未提供独立核验的{tab}字段；不生成推断结果。</p>}<div className="paper-detail-actions"><a href={publicationHref(selected.id)}>查看完整详情 <ExternalLink size={14}/></a></div></>:<p>{loading?'正在读取…':'选择一篇获准论文后在此预览。'}</p>}</div></section>
    </div>
  </main>;
}
