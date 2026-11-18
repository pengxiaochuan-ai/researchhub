import React from 'react';
import './guidance-clauses.css';

export default function GuidanceClauseDetails({ details }) {
  return <section className="guidance-clauses" aria-label="关键条款与原始页码">
    <p className="guidance-clauses__notice">{details.editionNotice}</p>
    <p>以下为局部原文摘录，不代替完整原件、专业判断或最新证据核验；未摘录部分不表示不存在。</p>
    <details className="guidance-clauses__version"><summary>核对原件与提取版本</summary>
      <dl><div><dt>原文件</dt><dd>{details.fileName} · {details.pageCount} 页</dd></div>
        <div><dt>原件 SHA-256</dt><dd>{details.sourceSha256}</dd></div>
        <div><dt>提取版本 / 展示审核版本</dt><dd>{details.extractionVersion} / {details.reviewVersion || '待审核'}</dd></div>
        <div><dt>提取 SHA-256</dt><dd>{details.payloadSha256}</dd></div></dl>
      <p>{details.transcriptionMethod}</p>
      <p>PDF物理页从文件第1页计数，印刷页码以原页页脚为准；二者不可混用。原件不提供公开下载。</p>
    </details>
    <ol className="guidance-clauses__list">{details.clauses.map(clause => <li key={clause.id}>
      <h4>{clause.heading}</h4>
      <p className="guidance-clauses__page">PDF 第 {clause.pdfPage} / {details.pageCount} 页 · 印刷第 {clause.printedPage} 页</p>
      <blockquote className="guidance-clauses__quote">{clause.quote}</blockquote>
      <details><summary aria-label={`${clause.heading}：核对原始页码`}>核对原始页码</summary>
        <p>原文件：{details.fileName}</p><p>原文位置：{clause.anchor}</p>
        <p>PDF物理第 {clause.pdfPage} 页；原印刷第 {clause.printedPage} 页。请按原件章节核对，不将本条摘录当作全文。</p>
      </details>
    </li>)}</ol>
  </section>;
}
