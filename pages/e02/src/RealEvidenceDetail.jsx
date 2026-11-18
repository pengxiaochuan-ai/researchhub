import React, { useEffect, useRef, useState } from 'react';
import { hubVisibleRequest } from '../../../src/hub-source-api.js';
import { pmcTableRows } from '../../../src/pmc-table-spans.js';
import {Button} from '../../shared/Components.jsx';
import {articleAiHref,readArticleLocation,articleRawRange,validArticleBinding} from '../../../src/article-ai-session.js';
import './real-evidence-detail.css';

const recordId = new URLSearchParams(globalThis.location?.search??'').get('recordId');
const validRecordId = typeof recordId === 'string' && /^(rhsr-[a-f0-9]{40}|pmc-PMC[1-9][0-9]{0,10})$/.test(recordId);
const safeSourceLink = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
};
const citation = item => [item.authors, item.title, item.journal, item.year,
  item.doi && `DOI: ${item.doi}`].filter(Boolean).join('. ');
let articleLocation=null,locationError='';
try{articleLocation=readArticleLocation(globalThis.location?.search??'');}catch(e){locationError=e.message;}
export function ArticleFieldText({text,field,location}){
  const range=location?.field===field?articleRawRange(text,location.offset,location.length):null;
  return range?<>{text.slice(0,range.start)}<mark className="article-evidence-mark" tabIndex={-1}>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</>:<>{text}</>;
}

function ApprovedPmcImage({ asset }) {
  const [failed, setFailed] = useState(false);
  const prefix = asset.visibility === 'tenant' ? 'tenant-pmc' : 'pmc';
  return <figure className="real-evidence-figure">
    {!failed ? <img src={`/api/hub-sources/${prefix}-images/${asset.id}`}
      alt={asset.label ? `${asset.label}：${asset.caption || '原文图片'}` : `原文附加图片 ${asset.componentRef}`}
      loading="lazy" decoding="async" onError={() => setFailed(true)} />
      : <p role="status">该图片当前无法读取，未从外部站点回退加载。</p>}
    <figcaption><strong>{asset.label || '原文附加图片（未在 JATS 图序中引用）'}</strong>
      {asset.caption && <span> · {asset.caption}</span>}</figcaption>
    <p><a href={`/api/hub-sources/${prefix}-images/${asset.id}`} target="_blank" rel="noopener noreferrer">原尺寸查看图片</a>
      {' · '}<a href={`/api/hub-sources/${prefix}-assets/${asset.id}`}>下载已获准原件</a></p>
  </figure>;
}

export function EvidenceDetailSkeleton(){return <article className="real-evidence-skeleton" aria-label="论文详情待核验布局"><section className="detail-paper"><div className="detail-cover">原刊封面<br/>待核验</div><div><h2>暂无可交付的文献内容</h2><p>来源与书目信息以本次授权核验结果为准。</p></div><div className="detail-actions"><button disabled>来源与原文状态</button><button disabled>复制书目信息</button><button disabled>收藏</button><button disabled>岐研 AI 解读</button></div></section><div className="detail-split"><section className="detail-read"><div className="detail-tabs">{['概览','方法与设计','研究结果','讨论与局限','引用与关联'].map(label=><button key={label} disabled>{label}</button>)}</div><p className="detail-abstract">当前内容无法交付，请核对来源状态。</p></section><aside className="detail-side">{['研究价值','证据质量','Hub相关性','相关内容','来源与追溯'].map(label=><section key={label}><h3>{label}</h3><p>未核验</p></section>)}</aside></div></article>;}

export function RealEvidenceDetail() {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(validRecordId);
  const [error, setError] = useState(validRecordId ? '' : '来源记录标识无效。');
  const [copyState, setCopyState] = useState('');
  const [reload, setReload] = useState(0);
  const [tab,setTab]=useState('概览');
  const active=useRef(null);
  const identityPending=useRef(false);
  useEffect(() => {
    const refresh = () => { if (!document.hidden&&!identityPending.current) setReload(value => value + 1); };
    const identity=event=>{active.current?.abort();setItem(null);setCopyState('');setLoading(true);
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);if(!identityPending.current)setReload(value=>value+1);};
    window.addEventListener('focus', refresh);
    window.addEventListener('qiyan:user-change',identity);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('qiyan:user-change',identity); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if (!validRecordId) return;
    if(locationError){setError(locationError);setLoading(false);return;}
    const controller = new AbortController();
    active.current=controller;
    setLoading(true); setError(''); setItem(null);
    hubVisibleRequest(`publications/${recordId}`, { signal: controller.signal })
      .then(data => {if(controller.signal.aborted)return;
        if(articleLocation){const b=articleLocation.binding,current={recordId:data.item.id,articleVersion:data.item.articleVersion,rawSha256:data.item.rawSha256,reviewVersion:data.item.reviewVersion};
          if(!validArticleBinding(current)||Object.keys(b).some(k=>b[k]!==current[k]))throw new Error('文章版本或审核决定已变化，不能用新版冒充本次引用。请返回论文列表重新核对。');
          if(['body','abstract'].includes(articleLocation.field)&&!articleRawRange(data.item[articleLocation.field],articleLocation.offset,articleLocation.length))throw new Error('原文位置无法核对，不提供可能错位的片段。');
        }setItem(data.item);})
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause.status === 404
        ? '该资料未获准展示、已撤回，或不属于当前 Hub。' : cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(()=>{if(!item||!articleLocation?.field)return;setTab('概览');const frame=requestAnimationFrame(()=>{
    const target=document.querySelector('.article-evidence-mark')??document.getElementById('article-evidence-'+articleLocation.field);target?.scrollIntoView({block:'center'});target?.focus?.({preventScroll:true});
  });return()=>cancelAnimationFrame(frame);},[item]);

  async function copyCitation() {
    if (!item) return;
    try { await navigator.clipboard.writeText(citation(item)); setCopyState('已复制当前获准书目信息；使用前仍请核对原始来源。'); }
    catch { setCopyState('复制失败，请手动选择页面中的书目信息。'); }
  }

  return <main className="platform-main detail-board real-evidence-detail">
    <nav className="detail-jump" aria-label="文献导航"><a href="/pages/e01/">← 返回论文列表</a><span>上一篇／下一篇暂不可用</span></nav>
    {loading && <p className="real-evidence-detail-state" role="status">正在核对当前来源授权…</p>}
    {error && <div className="real-evidence-detail-state error" role="alert"><h2>暂不可查看此文献</h2><p>{error}</p>
      {validRecordId && <button type="button" onClick={() => setReload(value => value + 1)}>重新核对</button>}</div>}
    {!item&&<EvidenceDetailSkeleton/>}
    {item && <article>
      <header className="detail-paper"><div className="detail-cover">期刊封面<br/>未提供</div><div><p>已获准{item.visibility === 'tenant' ? '仅租户内' : '公开'}的来源文献 · 记录版本 {item.canonicalVersion} · 审核决定 {item.reviewVersion}</p>
        <h2>{item.title}</h2>
        <p>{item.authors || '作者未提供'}</p>
        <p>{[item.journal, item.year].filter(Boolean).join(' · ') || '期刊与年份未提供'}</p>
        {item.doi && <p>DOI：{item.doi}</p>}
        {copyState && <p role="status">{copyState}</p>}</div><div className="detail-actions"><button type="button" onClick={()=>document.getElementById('real-evidence-source-title')?.scrollIntoView({block:'nearest'})}>来源与原文状态</button><button type="button" onClick={copyCitation}>复制获准书目信息</button><button type="button" disabled>收藏（暂不可用）</button><Button className="paper-ai" disabled={!item.articleVersion||!item.body} onClick={()=>location.assign(articleAiHref(item.id))}>岐研 AI 解读</Button>{(!item.articleVersion||!item.body)&&<p className="article-ai-unavailable">本篇暂无获准正文，不能进行单篇解读。</p>}</div></header>
      <div className="detail-split real-evidence-detail-grid"><section className="detail-read" aria-label="论文内容">
        <div className="detail-tabs">{['概览','方法与设计','研究结果','讨论与局限','引用与关联'].map(label=><button type="button" key={label} className={tab===label?'on':''} onClick={()=>setTab(label)}>{label}</button>)}</div>
        {tab!=='概览'&&<div className="detail-abstract"><h2>{tab}</h2>{tab==='引用与关联'?<p>{citation(item)} · 当前版本来源见右栏。</p>:<p>当前没有已独立核验的{tab}结构化字段。获准原文保留在“概览”中，不推断科学数值或评级。</p>}</div>}
        <div className="detail-abstract detail-reading" hidden={tab!=='概览'}>
        <h2 id="article-evidence-abstract" tabIndex={-1}>摘要</h2>
        <p><ArticleFieldText text={item.abstract || '摘要未获准展示，或来源未提供摘要。'} field="abstract" location={articleLocation}/></p>
        <h2>方法、结果与证据评级</h2><p>当前来源未提供已独立核验的结构化方法、结果或评级，不生成推断数值。</p>
        <h2>全文状态</h2><p>{item.articleVersion
          ? '下方展示本篇当前已暂存并获准的正文、表格和附件；缺失组件不会补造。'
          : '此批工作簿不含已核验全文，全文暂不可用。'}</p>
        {item.body && <section><h2 id="article-evidence-body" tabIndex={-1}>已获准正文</h2><p className="real-evidence-approved-body"><ArticleFieldText text={item.body} field="body" location={articleLocation}/></p></section>}
        {item.tables?.length > 0 && <section><h2 id="article-evidence-table" tabIndex={-1}>已获准表格文字</h2>{articleLocation?.field==='table'&&<p role="status">本次引用定位到表格字段；序列化字符位置不等于表格行列或页码，请对照 AI01 中的原文片段核对下方表格。</p>}{item.tables.map((table, index) =>
          <div key={`${table.ref_id || index}`} className="real-evidence-approved-table"><h3>{table.label || `表格 ${index + 1}`} · {table.caption || ''}</h3>
            <div className="real-evidence-table-scroll"><table><tbody>{pmcTableRows(table).map((row, rowIndex) =>
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} rowSpan={cell.rowSpan} colSpan={cell.colSpan}>{cell.text}</td>)}</tr>)}</tbody></table></div>
            {table.footnote && <p>{table.footnote}</p>}</div>)}</section>}
        {item.assets?.length > 0 && <section><h2>已获准原文图片与附件</h2>
          {item.assets.filter(asset => asset.assetKind === 'image').map(asset =>
            <ApprovedPmcImage key={asset.id} asset={asset} />)}
          {item.assets.some(asset => asset.assetKind === 'supplement') && <ul>{item.assets
            .filter(asset => asset.assetKind === 'supplement').map(asset =>
              <li key={asset.id}>补充材料 · {asset.componentRef} · SHA-256 {asset.sha256}
                {' '}<a href={`/api/hub-sources/${item.visibility === 'tenant' ? 'tenant-pmc' : 'pmc'}-assets/${asset.id}`}>下载已获准原件</a></li>)}</ul>}
        </section>}
        </div>
      </section><aside className="detail-side" aria-label="研究价值与来源">
        {['研究价值','证据质量','Hub相关性','相关内容'].map(title=><section key={title}><h3>{title}</h3><p>当前没有独立核验的{title}结果。</p></section>)}
        <section aria-labelledby="real-evidence-source-title">
        <h2 id="real-evidence-source-title">来源与追溯</h2>
        <dl><div><dt>来源目录</dt><dd>{item.sourceName}</dd></div>
          {item.articleVersion ? <><div><dt>文章版本</dt><dd>{item.articleVersion}</dd></div>
            <div><dt>原文 SHA-256</dt><dd className="hash">{item.rawSha256}</dd></div></>
            : <><div><dt>导入批次</dt><dd>{item.fileName} / {item.sheetName}</dd></div>
              <div><dt>原始行号</dt><dd>{item.rowNumber}</dd></div>
              <div><dt>行 SHA-256</dt><dd className="hash">{item.rowSha256}</dd></div></>}</dl>
        {safeSourceLink(item.sourceUrl) ? <a href={safeSourceLink(item.sourceUrl)} target="_blank" rel="noreferrer">打开来源链接</a>
          : <p>暂无可安全打开的来源链接。</p>}
        <p>展示授权按每次读取重新核对；被撤回后无法继续从此页面读取。</p>
        </section>
      </aside></div>
    </article>}
  </main>;
}
