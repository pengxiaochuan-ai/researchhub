import React,{useEffect,useState} from 'react';
import {pmcTableRows} from '../../src/pmc-table-spans.js';
import {pmcContentInventory} from '../../src/pmc-review-content.js';
import {hubSourceRequest} from '../../src/hub-source-api.js';
import {Button} from './Components.jsx';
import PmcArticleReading,{PmcReadingTable,articleAnchor,jumpToArticle,readingBacklinks} from './PmcArticleReading.jsx';

function PreviewImage({asset,figure}) {
  const [failed,setFailed]=useState(false);
  return <figure className="hub-pmc-figure">
    {!failed?<img src={`/api/hub-sources/pmc-review-images/${asset.id}`} alt={`${figure?.label||'原文图片'}：${figure?.caption||asset.componentRef}`}
      loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<p role="status">图片暂时无法读取，请核对原件或稍后重试。</p>}
    <figcaption><strong>{figure?.label||'原文未标注图号'}</strong>{figure?.caption&&` · ${figure.caption}`}</figcaption>
    {!failed&&<a href={`/api/hub-sources/pmc-review-images/${asset.id}`} target="_blank" rel="noopener noreferrer">原尺寸查看图片</a>}
  </figure>;
}

export default function PmcReviewPreview({item,onRestricted,onStale}) {
  const [article,setArticle]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setArticle(null);setLoading(true);setError('');
    if(!item.versionId){setLoading(false);return()=>controller.abort();}
    hubSourceRequest('pmc-review-articles/'+encodeURIComponent(item.versionId),{signal:controller.signal}).then(result=>{
      if(!controller.signal.aborted){if(result.article.rawSha256!==item.rawSha256){onStale?.();return;}setArticle(result.article);}
    }).catch(cause=>{if(controller.signal.aborted)return;
      if([401,403].includes(cause.status)){onRestricted?.();return;}if(cause.status===409){onStale?.();return;}setError(cause.message);
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[item.versionId,item.rawSha256,retry,onRestricted,onStale]);
  const inventory=pmcContentInventory(item,article),backlinks=readingBacklinks(article);
  const figures=article?.media.map(x=>({...x,ref_id:x.refId}))||item.mediaRefs?.filter(ref=>ref.kind==='image')||[];
  const figureFor=asset=>figures.find(ref=>String(ref.href||'').split('/').at(-1)===asset.componentRef);
  const ordered=[...(item.assets||[])].sort((a,b)=>{
    const order=asset=>{const index=figures.indexOf(figureFor(asset));return index<0?10000:index;};
    return order(a)-order(b)||a.componentRef.localeCompare(b.componentRef);
  });
  const imageEntry=asset=>{
    const figure=figureFor(asset),target=article?.targets[figure?.ref_id];
    return <div className="hub-review-asset" key={asset.id} id={target?articleAnchor(item.versionId,target):undefined} tabIndex={-1}>
      <PreviewImage asset={asset} figure={figure}/>
      {figure&&backlinks[figure.ref_id]&&<p><a href={'#'+articleAnchor(item.versionId,backlinks[figure.ref_id])} onClick={event=>jumpToArticle(event,articleAnchor(item.versionId,backlinks[figure.ref_id]))}>返回正文引用位置</a></p>}
    </div>;
  };
  return <div className="hub-pmc-review">
    <p>{[item.pmcid,item.journal,item.year,item.doi].filter(Boolean).join(' · ')}</p>
    {!item.versionId?<p role="status">尚未取得可核验正文，请先补齐内容。</p>:<>
      <dl className="hub-pmc-inventory" aria-label="当前文章内容完整性">
        {Object.entries({摘要:inventory.abstract,正文:inventory.body,表格:inventory.tables,图片:inventory.figures,作者附录:inventory.supplementStatus,PDF:inventory.pdf}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.label}</dd></div>)}
      </dl>
      {!!inventory.missing.length&&<p className="hub-review-content-state">待补齐：{inventory.missing.map(x=>x.name).join('、')}。仅覆盖已取得内容，文件缺失不等于正文缺失。</p>}
      <a href={`https://pmc.ncbi.nlm.nih.gov/articles/${item.pmcid}/`} target="_blank" rel="noopener noreferrer">打开 PMC 原始文章核对</a>
      <details className="hub-pmc-reading" open><summary>摘要与正文</summary>
        <h4>摘要</h4><p>{item.abstract||'原文未提供摘要'}</p>
        <details><summary>展开正文</summary>
          {loading?<p role="status">正在核对原件并读取章节…</p>:article?<PmcArticleReading article={article} versionId={item.versionId}/>:<>
            <p className="hub-source-error" role="alert">结构化阅读未就绪：{error||'原文不可用'}。下方仅为已有纯文本，章节与引用定位暂不可用。</p>
            <Button onClick={()=>setRetry(x=>x+1)}>重试读取章节</Button><p className="hub-pmc-body">{item.body||'正文尚未解析'}</p>
          </>}
        </details>
      </details>
      {(article?.tables||item.tables)?.length?<details className="hub-pmc-reading"><summary>表格（{(article?.tables||item.tables).length}）</summary>
        {article?.tables.length?article.tables.map(table=><PmcReadingTable key={table.id} table={table} versionId={item.versionId} targets={article.targets} returnId={backlinks[table.refId]}/>):item.tables.map((table,index)=><div key={`${table.ref_id}-${index}`} className="hub-pmc-table">
          <h4>{table.label||`表格 ${index+1}`} · {table.caption||'无题注'}</h4>
          <div className="hub-pmc-table-scroll"><table><tbody>{pmcTableRows(table).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci} rowSpan={cell.rowSpan} colSpan={cell.colSpan}>{cell.text}</td>)}</tr>)}</tbody></table></div>
          {table.footnote&&<p>{table.footnote}</p>}</div>)}
      </details>:<p className="hub-review-help">{inventory.tables.label}。</p>}
      {!!inventory.images.length&&<details className="hub-pmc-reading"><summary>图片（{inventory.images.length}）</summary>{ordered.filter(x=>x.assetKind==='image').map(imageEntry)}</details>}
      {!!inventory.supplements.length&&<details className="hub-pmc-reading"><summary>作者附录（{inventory.supplements.length}）</summary>
        {inventory.supplements.map(asset=><div className="hub-review-asset" key={asset.id}><p>{asset.componentRef}</p>
          <a href={asset.officialUrl} target="_blank" rel="noopener noreferrer">打开作者附录原件</a></div>)}
      </details>}
      <details className="hub-review-technical"><summary>原始文件与追溯（{inventory.technical.length}）</summary>
        <p>XML/JATS/TXT是文章的机器格式副本，不是作者附录。已存原始文件 {item.stagedAssetCount}/{item.expectedAssetCount}，不是内容完整率。</p>
        {inventory.technical.map(asset=><div className="hub-review-asset" key={asset.id}>
          <p>{inventory.formats.includes(asset)?'机器格式副本':'用途待核对的源文件'} · {asset.componentRef} · {asset.byteCount.toLocaleString()} 字节</p>
          <a href={asset.officialUrl} target="_blank" rel="noopener noreferrer">打开官方对象地址</a>
          <details><summary>组件追溯信息</summary><p>SHA-256：{asset.sha256}</p></details>
        </div>)}
      </details>
      <details className="hub-review-technical"><summary>版本、许可及审核记录</summary>
        <p>当前文章版本：{item.articleVersion}；许可原值：{item.licenseUri}</p><p>原文 SHA-256：{item.rawSha256}</p>
        {item.articleDecision&&<p>当前按篇决定：{item.articleDecision.visibility} · 版本 {item.articleDecision.version} · {item.articleDecision.createdAt} · 审核人 {item.articleDecision.reviewerId}</p>}
        <p>历史逐项记录 {item.decisions?.length||0} 条，保留原决定。</p>
        <ul>{item.decisions?.map(x=><li key={x.version}>{x.fieldKind} · {x.purpose} · {x.decision} · {x.createdAt}</li>)}</ul>
      </details>
    </>}
  </div>;
}
