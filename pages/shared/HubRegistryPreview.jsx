import React from 'react';
import {clinicalRegistryHref} from '../../src/hub-source-api.js';

export default function HubRegistryPreview({items,error=false}){
 return <article className="hub-card"><header><h2>最新临床注册研究</h2><a href="/pages/c01/">查看全部</a></header>
  <div className="real-hub-table"><table className="hub-studies"><thead><tr>{['研究题目','注册号','注册时间','实施机构','状态'].map(label=><th key={label}>{label}</th>)}</tr></thead>
   <tbody>{items?.map(item=>{
    const summary=item.registrationSummaryStatus==='approved'?item.registrationSummary:null;
    return <tr key={item.documentId}><td><a href={clinicalRegistryHref(item.documentId)}>{item.title}</a></td><td>{item.externalKey||'未提供'}</td>
     <td>{summary?.registeredOn.value||'未提供'}</td><td title={summary?'原登记的研究实施负责（组长）单位，非全部中心名单':undefined}>{summary?.leadInstitution.value||'未提供'}</td>
     <td title={summary?'原快照未报告研究进度；注册号状态请在详情中核对。':undefined}>{summary?'未报告':'未提供'}</td></tr>;
   })}</tbody></table></div>
  <p className="real-hub-muted">{error?'注册来源暂不可用，请重试。':'仅当前获准注册快照，按来源顺序展示；研究进度未报告，不根据注册号状态或计划日期推断。'}</p>
 </article>;
}
