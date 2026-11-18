import React from 'react';
import './registry-structured.css';

function SourceField({ field }) {
  const source = field.source;
  return <div className="registry-field">
    <span className="registry-field__label">{field.label}</span>
    <p className={field.value ? 'registry-field__value' : 'registry-field__missing'}>{field.value || '原快照未填写'}</p>
    <details className="registry-field__source">
      <summary aria-label={`${field.label}：核对原始位置`}>核对原始位置</summary>
      <p>原标签：{source.sourceLabel}</p>
      <p>解码 HTML · 表 {source.tableIndex} / 行 {source.rowIndex} / 单元格 {source.cellIndex}；第 {source.line} 行，第 {source.column} 列</p>
      <blockquote>{source.quote || '（原单元格为空）'}</blockquote>
    </details>
  </div>;
}

export default function RegistryStructuredDetails({ details, section }) {
  const repeated = details.outcomes.some((item, index, all) => all.findIndex(value => value.name.value === item.name.value) !== index);
  return <div className="registry-structured">
    <aside className="registry-structured__provenance" aria-label="结构化字段来源">
      <p>以下是注册时的研究计划，不代表已经取得的研究结果。空白项保持缺失，不根据标题或常识补填。</p>
      <details><summary>快照版本与定位说明</summary>
        <dl><div><dt>原始文件</dt><dd>{details.fileName}</dd></div>
          <div><dt>保存时间（快照头）</dt><dd>{details.snapshotDate}</dd></div>
          <div><dt>原件 SHA-256</dt><dd>{details.sourceSha256}</dd></div>
          <div><dt>提取版本 / 展示审核</dt><dd>{details.extractionVersion} / {details.reviewVersion || '待审核'}</dd></div>
          <div><dt>提取 SHA-256</dt><dd>{details.payloadSha256}</dd></div></dl>
        <p>表按文档顺序编号，行及单元格按所属表编号；行列定位于 MIME 解码后的 HTML，不是 MHTML 文件行号。来源网站可能已更新，本页忠实于此快照。</p>
        {details.registration&&<><p>实施负责单位为登记的组长单位，并非全部研究中心。注册号状态不等于研究进度；原快照未报告实际招募或完成状态，不根据计划日期推断。</p>
          <div className="registry-structured__design">{details.registration.map(field=><SourceField key={field.key} field={field}/>)}</div></>}
      </details>
    </aside>
    {(!section||section==='design')&&<section aria-label="研究设计" className="registry-structured__section"><h3>研究设计</h3>
      <div className="registry-structured__design">{details.design.map(field => <SourceField key={field.key} field={field} />)}</div>
    </section>}
    {(!section||section==='arms')&&<section aria-label="分组与干预" className="registry-structured__section"><h3>分组与干预 <span>{details.arms.length} 组</span></h3>
      <p className="registry-structured__note">样本量为各组登记原文，不计算总样本量；治疗方案详述未填写时，不推断剂量或疗程。</p>
      <div className="registry-structured__arms">{details.arms.map((arm, index) => <article key={arm.id} aria-label={`第 ${index + 1} 组`}>
        <h4>第 {index + 1} 组</h4>{['name', 'sampleSize', 'intervention'].map(key => <SourceField key={key} field={arm[key]} />)}
      </article>)}</div>
    </section>}
    {(!section||section==='outcomes')&&<section aria-label="登记结局" className="registry-structured__section"><h3>登记结局 <span>{details.outcomes.length} 项</span></h3>
      {repeated && <p className="registry-structured__notice">来源含中文同名结局，但英文表述不同。以下分别保留原条目，请结合英文及指标类型核对，不按中文名称去重。</p>}
      <p className="registry-structured__note">当前快照的结局测量时间点及测量方法均未填写；这里不代表该研究没有相应设计。</p>
      <ol className="registry-structured__outcomes">{details.outcomes.map((outcome, index) => <li key={outcome.id}>
        <article aria-label={`第 ${index + 1} 项登记结局`}><h4>结局 {index + 1} · {outcome.type.value || '类型未填写'}</h4>
          <div className="registry-structured__outcome-name"><SourceField field={outcome.name} /><SourceField field={outcome.englishName} /></div>
          <div className="registry-structured__measurement">{['type', 'timepoint', 'method'].map(key => <SourceField key={key} field={outcome[key]} />)}</div>
        </article>
      </li>)}</ol>
    </section>}
  </div>;
}
