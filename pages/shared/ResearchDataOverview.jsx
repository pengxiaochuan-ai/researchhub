import React,{useEffect,useRef,useState} from 'react';import {Button} from './Components.jsx';import {acceptResearchDataAnalysis} from '../../src/research-data-analysis-session.js';
export function useResearchDataOverview({client,identity,sessionId,item,enabled}){
 const key=[identity,sessionId,item?.id,item?.version,item?.hash,enabled].join(':'),current=useRef(key);current.current=key;const epoch=useRef(0),[state,setState]=useState({key:'',item:null,error:'',loading:false});
 const active=enabled&&item?.state==='committed';
 async function refresh(){if(!active)return;const requestKey=key,turn=++epoch.current;setState({key,item:null,error:'',loading:true});try{const p=acceptResearchDataAnalysis(await client.get(`/sessions/${sessionId}/research-data-imports/${item.id}/analysis`),{sessionId,planId:item.id,studyId:item.study.id});if(current.current===requestKey&&epoch.current===turn)setState({key,item:p,error:'',loading:false});}catch(e){if(current.current===requestKey&&epoch.current===turn)setState({key,item:null,error:e.message,loading:false});}}
 useEffect(()=>{++epoch.current;setState({key,item:null,error:'',loading:false});if(active)void refresh();return()=>{++epoch.current;};},[client,key]);
 return{...(current.current===state.key&&active?state:{item:null,error:'',loading:false}),ready:Boolean(active&&state.key===key&&state.item),refresh,enabled};
}
const quality={ 'checks-passed':'已检查规则未发现异常','needs-review':'有项目需要核对','not-evaluated':'尚无访视数据可评估'};
const number=x=>x===null?'—':new Intl.NumberFormat('zh-CN',{maximumSignificantDigits:12}).format(x);
export default function ResearchDataOverview({data}){
 if(!data?.enabled)return null;const p=data.item;
 return <details className="research-data-overview"><summary>数据概览与质控{p?' · '+quality[p.quality.status]:''}</summary>
  {data.loading&&<p role="status">正在核对本批数据…</p>}{data.error&&<p role="alert">{data.error} <Button onClick={data.refresh}>重新获取概览</Button></p>}
  {p&&<><p>{p.counts.subjects}名被试 · {p.counts.visits}条访视 · {p.counts.responses}份固定表单；已完成访视{p.counts.completedVisits}条。</p>
   <div className="research-data-table"><table><caption>本批字段概览；空值不补零，数值由程序计算</caption><thead><tr><th scope="col">字段</th><th scope="col">缺失／异常</th><th scope="col">已记录值概览</th></tr></thead><tbody>{p.fields.map(f=><tr key={f.key}><th scope="row">{f.label}{f.unit?`（${f.unit}）`:''}</th><td>{f.missing}／{f.invalid}</td><td>{f.numeric?`有效${f.numeric.count}；最小${number(f.numeric.min)}，最大${number(f.numeric.max)}，均值${number(f.numeric.mean)}；零值${f.numeric.zeroCount}`:f.boolean?`是${f.boolean.trueCount}；否${f.boolean.falseCount}`:`有效${f.total-f.missing-f.invalid}`}</td></tr>)}</tbody></table></div>
   <p>{p.quality.scope}。未评估：{p.quality.notEvaluated.join('、')}。</p><p>表单“已完成”是原始字段，不代表访视已完成；仅含基线时不能推断随访或疗效。</p>
  </>}
 </details>;
}
