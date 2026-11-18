import React from 'react';
import {FileText} from 'lucide-react';

const cards=[
  ['registrations','临床注册研究','项','当前Hub已公开收录'],
  ['publications','研究论文','篇','当前Hub已公开收录'],
  ['guides','指南与教材','份','已公开指南及研究标准'],
  ['institutions','研究机构','家','当前Hub已公开机构档案'],
  ['researchers','研究者 / 学者','位','当前Hub已公开研究者档案'],
];
export default function HubMetrics({metrics,loading=false,error=false}){
  return <section className="hub-kpis" aria-label="领域规模" aria-busy={loading}>
    {cards.map(([key,label,unit,caption])=>{
      const metric=metrics?.[key];
      const ready=!loading&&!error&&metric?.status==='approved_public_indexed'&&metric.scope==='CURRENT_HUB_APPROVED_PUBLIC_INDEXED'&&Number.isSafeInteger(metric.value)&&metric.value>=0;
      const paperCaption=Number.isSafeInteger(metric?.pendingVisibleCount)&&metric.pendingVisibleCount>0?`规则纳入 · 待核验${metric.pendingVisibleCount}项`:'按已确认领域规则纳入';
      const reason=loading?'正在读取统计…':error?'读取失败，请重试。':ready?(key==='publications'?paperCaption:caption):metric?.status==='unverified_scope_or_entity'?(key==='publications'?'论文去重与领域纳入待核验':'此项统计口径待核验'):'统计暂不可用';
      return <article className="hub-kpi" key={key}><header><span><FileText size={16}/></span><small>{label}</small></header><b>{ready?<>{metric.value}<em>{unit}</em></>:'—'}</b><p><span>{reason}</span></p></article>;
    })}
  </section>;
}
