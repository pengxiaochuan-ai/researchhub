import React, {useEffect,useState,useId} from 'react';
import {clinicalRegistryHref} from '../../src/hub-source-api.js';

const dimensions=[['研究数量','year'],['疾病','disease'],['研究设计','design'],['干预','intervention']];
export default function HubRegistryStatistics({statistics,loading=false,error=false,onRetry}){
 const panelId=useId();
 const [dimension,setDimension]=useState('year'),[selected,setSelected]=useState(null);
 useEffect(()=>setSelected(null),[statistics,dimension]);
 const value=statistics?.dimensions?.[dimension],groups=value?.groups??[];
 const activeSelection=groups.includes(selected)?selected:null;
 const sources=activeSelection?statistics?.records?.filter(record=>activeSelection.recordIds.includes(record.documentId))??[]:[];
 const largest=Math.max(1,...groups.map(group=>group.count));
 return <article className="hub-card hub-registry-statistics">
  <header><h2>临床注册趋势</h2><div className="hub-switch" role="tablist" aria-label="趋势维度">{dimensions.map(([label,key])=><button role="tab" type="button" key={key} aria-selected={dimension===key} aria-controls={panelId} id={panelId+'-'+key} tabIndex={dimension===key?0:-1} onKeyDown={event=>{const index=dimensions.findIndex(([,value])=>value===dimension);const next=event.key==='ArrowRight'?(index+1)%4:event.key==='ArrowLeft'?(index+3)%4:event.key==='Home'?0:event.key==='End'?3:null;if(next!==null){event.preventDefault();setDimension(dimensions[next][1]);document.getElementById(panelId+'-'+dimensions[next][1])?.focus();}}} className={dimension===key?'on':''} onClick={()=>setDimension(key)}>{label}</button>)}</div></header>
  <div id={panelId} role="tabpanel" aria-labelledby={panelId+'-'+dimension} className="hub-trend-body" aria-label="本Hub已收录临床注册统计" aria-busy={loading}>
   {loading?<p className="real-hub-state" role="status">正在读取注册统计…</p>:error||!statistics||!value?<div className="real-hub-state" role="alert">注册统计暂不可用。<button type="button" className="text-link" onClick={onRetry}>重试</button></div>:<>
    <p className="hub-registry-scope">本Hub已收录 {statistics.total} 项 · 非全领域总量</p>
    {statistics.total===0?<p role="status">暂无获准展示的临床注册。</p>:<>
     <p className="hub-registry-method">{dimension==='year'?'按注册年份统计；累计仅含当前收录记录。':dimension==='intervention'?'按原登记各组干预分组，含对照组；一项研究可归入多个干预。':'按原登记字段分组，尚未合并为标准分类。'}</p>
     {groups.length>0?<ul className="hub-registry-groups" aria-label={dimensions.find(([,key])=>key===dimension)[0]+'统计'}>{groups.map(group=><li key={group.label}>
      <button type="button" className="hub-registry-group" aria-expanded={selected===group} onClick={()=>setSelected(current=>current===group?null:group)}>
       <span className="hub-registry-group-label">{group.label}</span><span className="hub-registry-bar" aria-hidden="true"><i style={{width:(group.count/largest*100)+'%'}}/></span><span>{group.count} 项{dimension==='year'&&Number.isSafeInteger(group.cumulative)?` · 累计 ${group.cumulative} 项`:''}</span>
      </button>
     </li>)}</ul>:<p role="status">当前收录记录尚无可统计的{dimension==='year'?'注册时间':'分类字段'}。</p>}
     <p className="hub-registry-missing">未提供或待核对：{value.missing} 项。选择统计项可回看来源。</p>
     {activeSelection&&<section className="hub-registry-sources" aria-label="统计来源"><h3>{activeSelection.label} · 来源记录</h3><ul>{sources.map(record=><li key={record.documentId}><a href={clinicalRegistryHref(record.documentId)}>{record.title}</a><span>{record.externalKey} · 目录审核版本 {record.reviewVersion??'待核对'}</span></li>)}</ul></section>}
    </>}
   </>}
  </div>
 </article>;
}
