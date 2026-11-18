import React, { useEffect, useRef, useState } from 'react';
import { hubVisibleRequest } from '../../../src/hub-source-api.js';
import '../../c01/src/real-clinical.css';
import RegistryStructuredDetails from '../../shared/RegistryStructuredDetails.jsx';

const safeSource = url => typeof url === 'string' && /^https:\/\/[^\s/]+(?:\/|$)/i.test(url) ? url : null;
const documentId = new URLSearchParams(globalThis.location?.search??'').get('documentId');

const tabs=['概览','研究设计','干预措施','研究结果','招募与进展','研究者与机构','相关资源'];
const aiTabs=['核心解读','方法学评价','与其他研究比较','临床启示','未来研究方向'];
export function RegistryDetailLayout({item,tab='概览',setTab=()=>{},aiTab='核心解读',setAiTab=()=>{}}){
  const details=item?.structuredDetailsStatus==='approved'?item.structuredDetails:null;
  const section=tab==='研究设计'?'design':tab==='干预措施'?'arms':tab==='研究结果'?'outcomes':undefined;
  return <><section className="trial-head"><div className="trial-tags"><em>登记快照 · 当前获准字段</em></div><div className="trial-actions">{safeSource(item?.sourceUrl)&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看原始记录</a>}<button disabled>收藏（暂不可用）</button><button className="trial-ai" disabled>岐研 AI 解读（暂不可用）</button></div><h2>{item?.title||'暂无可交付的注册来源'}</h2><p className="trial-ids"><b>{item?.externalKey||'注册编号未核验'}</b><span>{item?.sourceName||'来源未核验'}</span></p><p>原始疾病：{item?.sourceTargetCondition||'未提供'}</p></section>
    <div className="trial-tabs">{tabs.map(label=><button type="button" key={label} className={tab===label?'on':''} onClick={()=>setTab(label)}>{label}</button>)}</div>
    <div className="trial-split"><div className="trial-main">
      {tab==='研究结果'&&<section className="trial-card"><h3>研究结果</h3><p>当前只有注册时的研究计划，没有已核验的完成结果。以下登记结局不是实际疗效数据。</p></section>}
      {['概览','研究设计','干预措施','研究结果'].includes(tab)?details?<RegistryStructuredDetails details={details} section={section}/>:<section className="trial-card"><h3>结构化详情尚未获准展示</h3><p>结构化提取尚未获准展示，或来源与版本已变化。</p></section>:<section className="trial-card"><h3>{tab}</h3><p>当前未提供已获准的{tab}结构化信息。</p></section>}
    </div><aside className="trial-facts"><section className="trial-card"><h3>关键信息</h3>{[['注册编号',item?.externalKey],['原始疾病字段',item?.sourceTargetCondition],['来源',item?.sourceName],['展示审核版本',item?.reviewVersion]].map(([label,value])=><p key={label}><small>{label}</small><b>{value||'未提供'}</b></p>)}</section><section className="trial-card"><h3>研究价值与意义</h3><p>暂无独立核验的评价。</p></section><section className="trial-card"><h3>相关资源</h3><a href="/pages/h06/">指南与研究标准</a><p>来源版本及逐字段位置可在左侧展开核对。</p></section></aside>
    <aside className="trial-ai-panel"><header><b>岐研 AI 解读</b><small>当前注册来源未获准 AI 解读，不因恢复布局自动启用。</small></header><div className="trial-ai-tabs">{aiTabs.map(label=><button type="button" key={label} className={aiTab===label?'on':''} onClick={()=>setAiTab(label)}>{label}</button>)}</div><div className="trial-ai-body"><h3>{aiTab}</h3><p>暂无当前来源的真实 AI 结果；这里不显示固定示例或推断结论。</p></div><footer><button disabled>生成完整报告</button><button disabled>复制内容</button></footer></aside></div>
  </>;
}

export function RealClinicalRegistryDetail() {
  const [state, setState] = useState({ status: 'loading' });
  const active = useRef(null);
  const identityPending=useRef(false);
  const [tab,setTab]=useState('概览'),[aiTab,setAiTab]=useState('核心解读');
  const load = () => {
    active.current?.abort();
    if (!/^rhed-[a-f0-9]{40}$/.test(documentId ?? '')) {
      setState({ status: 'not-found' });
      return () => {};
    }
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'loading' });
    hubVisibleRequest(`clinical-registries/${documentId}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ status: 'ready', item: result.item }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: error.status === 404 ? 'not-found' : 'error', message: error.message }); });
    return () => controller.abort();
  };
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible'&&!identityPending.current) load(); };
    const identity=event=>{active.current?.abort();setState({status:'loading'});
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);if(!identityPending.current)load();};
    window.addEventListener('focus', refresh);
    window.addEventListener('qiyan:user-change',identity);
    document.addEventListener('visibilitychange', refresh);
    return () => { active.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('qiyan:user-change',identity); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const item = state.item;
  return <main className="platform-main trial-board real-registry" aria-busy={state.status === 'loading'}>
    <div className="real-registry__content">
    <nav className="trial-jump real-registry__back"><a href="/pages/c01/">← 返回临床注册列表</a><span>上一篇／下一篇暂不可用</span></nav>
    {state.status === 'loading' && <section className="real-registry__state" role="status">正在核对当前展示授权…</section>}
    {state.status === 'not-found' && <section className="real-registry__state" role="status"><h2>该注册来源不可见</h2><p>来源不存在、未获准展示、已撤回或版本已变化。请返回列表查看当前可见来源。</p></section>}
    {state.status === 'error' && <section className="real-registry__state" role="alert"><h2>暂时无法读取来源</h2><p>{state.message}</p><button type="button" onClick={load}>重试</button></section>}
    <>
      <RegistryDetailLayout item={item} tab={tab} setTab={setTab} aiTab={aiTab} setAiTab={setAiTab}/>
      <p className="real-registry__disclaimer">实时招募状态、研究结果、研究者联系方式、全文及 AI 解读不在本次详情展示范围。</p>
    </>
    </div>
  </main>;
}
