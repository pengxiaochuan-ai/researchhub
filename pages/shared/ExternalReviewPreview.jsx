import React from 'react';
import RegistryStructuredDetails from './RegistryStructuredDetails.jsx';
import GuidanceClauseDetails from './GuidanceClauseDetails.jsx';
const names={clinical_registry:'临床注册',research_standard:'研究标准',clinical_guideline:'临床指南'};
export default function ExternalReviewPreview({item}) {
  return <div className="hub-review-external">
    <dl className="hub-review-metadata">
      <div><dt>来源类型</dt><dd>{names[item.documentType]||'外部来源'}</dd></div>
      <div><dt>来源编号</dt><dd>{item.externalKey}</dd></div>
      <div><dt>原始目标疾病</dt><dd>{item.sourceTargetCondition||'原件未注明'}</dd></div>
      <div><dt>来源</dt><dd>{item.sourceName}</dd></div>
      <div><dt>原件</dt><dd>{item.fileName}</dd></div>
    </dl>
    {item.sourceUrl?.startsWith('https://')?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">打开来源网站核对</a>
      :<p>请结合原文件核对当前提取内容。</p>}
    <p className="hub-review-content-state">本次范围：书目信息{item.structuredExtraction?'及已核验的注册详情':item.guidanceExtraction?'及已核验的指南／标准局部条款':''}。
      整本全文与未提取内容不在本次可用范围。</p>
    {item.structuredExtraction&&<RegistryStructuredDetails details={{...item.structuredExtraction.payload,...item.structuredExtraction}}/>}
    {item.guidanceExtraction&&<GuidanceClauseDetails details={{...item.guidanceExtraction.payload,...item.guidanceExtraction}}/>}
    <details className="hub-review-technical"><summary>版本与历史字段决定</summary>
      <p>当前 v{item.versionNumber} · {item.sourceUpdatedOn||'日期未注明'}；SHA-256：{item.sha256}</p>
      <ul>{item.decisions.map(x=><li key={x.fieldKind+':'+x.purpose}>{x.fieldKind} · {x.purpose} · {x.decision} · {x.audience} · {x.createdAt}
        <br/>审核人：{x.reviewerId}；记录引用：{x.evidenceRef}</li>)}</ul>
    </details>
  </div>;
}
