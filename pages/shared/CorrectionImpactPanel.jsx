import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {captureUrl,sameValue} from '../../src/formal-capture-session.js';
import {analysisUrl} from '../../src/formal-analysis-session.js';
import {reportsUrl} from '../../src/formal-reports-session.js';
import {correctionImpactPath,validCorrectionImpact} from '../../src/correction-impact.js';

export function CorrectionImpactContents({route,pages,busy,onMore}){
 const base=pages.analysis,visit=base.visit,formsReady=base.locked&&base.review==='review_approved',currentAnalysis=base.items.some(item=>!item.sourceChanged&&item.runCount>0),currentRelease=pages.report.items.filter(item=>!item.sourceChanged&&item.status==='released').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 return <div className="correction-impact-content">
  <h4>更正后按此顺序继续</h4>
  <ol>
   <li>{formsReady?'当前修订已审阅并锁定。':'当前修订仍需审阅与锁定，请按本研究的审阅分工办理。'} <a href={captureUrl('s09',route.studyId,{visitId:visit.visitId})+'#visit-review'}>核对本次访视表单</a></li>
   <li>{visit.status==='completed'&&visit.completionIntegrity==='current'?'访视完成依据已核定。':visit.status==='completed'?'访视完成依据需重新核定，原完成日期保留。':'本次访视尚未完成，请先核对必采清单。'} <a href={captureUrl('s09',route.studyId,{visitId:visit.visitId})}>核对访视完成依据</a></li>
   <li>{currentAnalysis?'已有引用当前修订的分析，先核对其当前依据。':'如尚无可用的新结果，按原计划核对最新数据，明确放行并重新分析；结果仍须审核。'}</li>
   <li>{currentRelease?<span>已有引用当前修订的发布记录，先<a href={reportsUrl(route.studyId,{artifactId:currentRelease.artifactId})}>核对现有交付</a>的有效性；来源不可用时再按提示重新交付。</span>:'如尚无有效的新交付，从新确认结果预览并保存新报告，审核、发布后下载；旧报告与历史保留。'}</li>
  </ol>
  <p>以下按固定来源列出引用此表单的记录；仍引用当前修订的记录，其它来源与权限也须在原入口重新核对。</p>
  {['analysis','report'].map(kind=>{const page=pages[kind];return <section key={kind} aria-label={kind==='analysis'?'引用此表单的分析':'引用此表单的报告'}>
   <h4>{kind==='analysis'?'引用此表单的分析':'引用此表单的报告'}</h4>
   {page.restricted?<p>当前账号无权查看此类记录，请由有权人员核对。</p>:<>
    <ul className="fc-visit-list">{page.items.map(item=><li key={kind==='analysis'?item.snapshotId:item.artifactId}>
     <strong>{kind==='analysis'?(item.branch==='full'?'整课题分析依据':'描述统计分析依据'):item.title}</strong>
     <p>固定于{new Date(item.createdAt).toLocaleString('zh-CN')}{kind==='analysis'?' · 运行记录 '+item.runCount+' 项':' · 第'+item.versionNo+'版'}</p>
     <p>{item.sourceChanged?(kind==='report'&&item.status==='released'?'旧交付已失效，历史保留；请从新确认结果重新交付。':'原固定来源已变化，请重新核对；历史保留。'):'仍引用当前修订，继续操作前仍须核对其它来源与权限。'}</p>
     {kind==='report'&&<div className="ep-actions"><a href={reportsUrl(route.studyId,{artifactId:item.artifactId})}>核对原报告状态</a></div>}
    </li>)}</ul>
    {kind==='analysis'&&<div className="ep-actions">{[...new Set(page.items.map(item=>item.planId))].map((planId,index,all)=><a key={planId} href={analysisUrl(route.studyId,{planId})}>核对此分析计划{all.length>1?'（'+(index+1)+'）':''}</a>)}</div>}
    {!page.items.length&&<p>当前授权范围内未查到引用此表单的此类固定记录。</p>}
    {page.nextCursor&&<Button disabled={busy} onClick={()=>onMore(kind)}>{kind==='analysis'?'读取更多分析依据':'读取更多报告'}</Button>}
   </>}
  </section>;})}
 </div>;
}

export default function CorrectionImpactPanel({route,session,open,onOpenChange}){
 const capture=session.view.capture,response=capture.response,scope={studyId:route.studyId,assignmentId:capture.assignment.id,visitId:capture.assignment.subjectVisitId,ref:response.ref,responseVersion:response.version},scopeKey=JSON.stringify([session.actor,session.authVersion,scope]),epoch=useRef(0),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const available=session.verified&&!session.pending,visible=data?.scopeKey===scopeKey&&available?data.pages:null;
 async function load(kind){
  if(!available||session.blocked)return;const token=++epoch.current;setBusy(true);setError('');
  try{
   const kinds=kind?[kind]:['analysis','report'],pages=kind?{...visible}:{};
   await Promise.all(kinds.map(async key=>{const cursor=kind?visible?.[key].nextCursor:null;if(kind&&!cursor)throw Error('请先重新核对更正影响。');const value=await session.request(correctionImpactPath(scope,key,cursor));if(!validCorrectionImpact(value,{...scope,kind:key}))throw Error('更正影响与当前修订不一致，请重新核对。');pages[key]=kind?{...value,items:[...visible[key].items,...value.items]}:value;}));
   if(token!==epoch.current)return;
   if(!sameValue(pages.analysis.ref,pages.report.ref)||!sameValue(pages.analysis.visit,pages.report.visit)||!sameValue(pages.analysis.capabilities,pages.report.capabilities))throw Error('核对期间来源或权限已有变化，请重新核对。');
   for(const key of ['analysis','report']){const field=key==='analysis'?'snapshotId':'artifactId';if(new Set(pages[key].items.map(i=>i[field])).size!==pages[key].items.length)throw Error('影响清单重复，请重新核对。');}
   setData({scopeKey,pages});
  }catch(e){if(token===epoch.current&&!e.stale){setData(null);setError(e.message);}}finally{if(token===epoch.current)setBusy(false);}
 }
 useEffect(()=>{epoch.current++;setData(null);setError('');if(open&&available&&!session.blocked)void load();return()=>{epoch.current++;};},[scopeKey,open,available,session.blocked]);
 return <section onFocusCapture={event=>{const node=event.target,top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-topbar'))||0;if(node.getBoundingClientRect().top<top+12)node.scrollIntoView({block:'center',inline:'nearest'});}} className="fc-review" aria-label="更正影响与重新交付">
  <Button disabled={!available||session.blocked} aria-expanded={open} onClick={()=>onOpenChange(!open)}>更正影响与重新交付</Button>
  {open&&<div aria-busy={busy}>{busy&&<p role="status">正在核对引用记录…</p>}{error&&<p role="alert">{error} 已有记录保留，未执行审阅或重新交付。</p>}{!busy&&<Button disabled={!available||session.blocked} onClick={()=>void load()}>重新核对更正影响</Button>}{visible&&<CorrectionImpactContents route={route} pages={visible} busy={busy} onMore={kind=>void load(kind)}/>}</div>}
 </section>;
}
