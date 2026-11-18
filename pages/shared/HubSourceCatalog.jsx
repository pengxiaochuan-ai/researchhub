import React from 'react';
import {publicationHref} from '../../src/hub-source-api.js';

export default function HubSourceCatalog({sources,recordCount,error=false}){
  return <article className="hub-card real-hub-publications" data-scroll-preview={sources?.length?true:undefined}><header><h2>领域动态</h2><a href="/pages/e01/">研究论文</a></header><p className="real-hub-muted">以下为获准论文来源目录，非已确认领域纳入；共 {recordCount ?? '—'} 条来源记录。资讯与活动请查看学术动态。</p>
    {sources===null ? <p role="status" className="real-hub-state">{error?'来源目录暂不可用，请重试。':'正在读取来源目录…'}</p>
      : sources.length ? <ul className="real-hub-sources" tabIndex={0} aria-label="获准论文来源预览">{sources.map(item=>{
        const metadata=[item.authors,item.journal,item.year].filter(Boolean).join(' · ');
        const provenance=`来源：${item.sourceName} · 审核版本 ${item.reviewVersion}`;
        return <li key={item.id}><a href={publicationHref(item.id)} title={item.title}>{item.title}</a><div className="real-hub-source-summary" title={[metadata,provenance].filter(Boolean).join(' · ')}><small>{metadata}</small><span>{metadata?' · ':''}{provenance}</span></div></li>;
      })}</ul>
      : <p role="status" className="real-hub-state">暂无已审核公开书目。暂存资料不会展示或进入 AI 检索。</p>}
  </article>;
}
