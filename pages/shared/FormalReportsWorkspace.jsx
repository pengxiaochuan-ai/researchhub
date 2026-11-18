import {useReportAssetRegistration} from './ReportAssetRegistration.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown.tsx';
import useFormalReports from './useFormalReports.js';
import {readReportsRoute,reportsUrl,reportsNavUrl,reportStatus,reportJobStatus,canReportAction,canDownloadReportWord,splitReportMarkdown} from '../../src/formal-reports-session.js';
import {methodsUrl} from '../../src/formal-methods-session.js';
import {analysisUrl} from '../../src/formal-analysis-session.js';
import './workflow-pages.css';
import './formal-reports.css';
import {splitFullStudyReportMarkdown} from '../../src/full-study-reports-session.js';
const date=v=>new Date(v).toLocaleString('zh-CN');
const decisions={approved:'通过审核',changes_requested:'需修改分析来源'};
const labels={create:['保存此报告预览？','确认保存报告'],review:['保存报告审核结论？','确认保存审核'],release:['发布此固定报告？','确认发布报告']};
function LegacyFormalReportsWorkspace(){
 let route,invalid;try{route=readReportsRoute(location.search);}catch(e){invalid=e.message;}
 const session=useFormalReports(route);return <FormalReportsView route={route} invalid={invalid} session={session}/>;
}
function FullStudyReportsWorkspace({route}){const session=useFormalReports(route,{fullStudy:true});return <FormalReportsView route={route} session={session} fullStudy/>;}
export default function FormalReportsWorkspace(){let route;try{route=readReportsRoute(location.search);}catch{}return route?.runGroupId?<FullStudyReportsWorkspace route={route}/>:<LegacyFormalReportsWorkspace/>;}
export function FormalReportsView({route,invalid,session,fullStudy=false}){
 const host=useRef(null),allowLeave=useRef(false),[leave,setLeave]=useState(null),[confirm,setConfirm]=useState(null),[title,setTitle]=useState(''),[decision,setDecision]=useState('approved'),[reviewReason,setReviewReason]=useState(''),[releaseReason,setReleaseReason]=useState(''),[issue,setIssue]=useState('');
 const view=session.view,report=view?.report,run=view?.run,job=view?.job;
 const assetRegistration=useReportAssetRegistration({user:session.user,studyId:route?.studyId,scopeKey:route?.artifactId??route?.runId??route?.runGroupId,report,disabled:session.blocked});
 const sourceUrl=id=>fullStudy||report?.runGroupId?analysisUrl(route.studyId,{runGroupId:id}):methodsUrl(route.studyId,{runId:id});
 const signature=JSON.stringify([session.actor,session.revision,session.verified,view?.sourceCurrent,view?.capabilities,view?.docxExportStatus,report?.artifactId,report?.contentHash,report?.status,view?.preview?.previewHash,run?.id,run?.status,run?.reviewStatus,job?.jobId,job?.status]);
 useEffect(()=>{document.title='科研产出｜岐研';},[]);
 useEffect(()=>{setTitle('');setDecision('approved');setReviewReason('');setReleaseReason('');setConfirm(null);setIssue('');},[session.actor,session.revision]);
 useEffect(()=>{setConfirm(null);},[signature]);
 useEffect(()=>{
  const dirty=()=>!!title||!!reviewReason||!!releaseReason||!!session.pending;
  function go(url,trigger=document.activeElement){if(!url){setIssue('当前研究尚无可用的科研资产入口，请先完成本研究报告。');return;}if(new URL(url,location.href).href===location.href)return;if(dirty())setLeave({url,trigger});else location.assign(url);}
  const nav=e=>{if(e.detail?.pageId!=='s10')return;const label=e.detail.label;if(e.type==='qiyan:page-action'&&label!=='返回研究概览')return;go(reportsNavUrl(label==='返回研究概览'?'概览':label,route?.studyId));};
  const click=e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const link=e.target.closest?.('a[href],button[data-page],.qiyan-context-breadcrumb button,.qiyan-header-brand');if(!link||link.target==='_blank'||link.href?.startsWith('blob:'))return;const crumb=!!link.closest('.qiyan-context-breadcrumb');let url=link.href;if(crumb)url=link.textContent==='研究概览'&&route?reportsNavUrl('概览',route.studyId):'/pages/p01/';else if(link.dataset.page)url='/pages/'+link.dataset.page+'/';else if(link.matches('.qiyan-header-brand'))url='/pages/p002/';if(!url)return;const next=new URL(url,location.href);if(next.href===location.href||next.origin===location.origin&&next.pathname===location.pathname&&next.search===location.search&&next.hash)return;if(crumb||dirty()){e.preventDefault();e.stopPropagation();go(next.href,link);}};
  const unload=e=>{if(!allowLeave.current&&dirty()){e.preventDefault();e.returnValue='';}};
  window.addEventListener('qiyan:context-nav',nav);window.addEventListener('qiyan:page-action',nav);document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);
  return()=>{window.removeEventListener('qiyan:context-nav',nav);window.removeEventListener('qiyan:page-action',nav);document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);};
 },[title,reviewReason,releaseReason,session.pending,route?.studyId]);
 if(!route)return <main className="platform-main rh-formal-reports"><div className="wf-content"><section className="wf-panel"><p role="alert">{invalid}</p><a href="/pages/p01/">返回我的工作台</a></section></div></main>;
 function open(kind){setIssue('');setConfirm({kind,signature,trigger:document.activeElement,body:kind==='create'?(title.trim()?{title:title.trim()}:{}):kind==='review'?{decision,reason:reviewReason.trim()}:kind==='release'?{reason:releaseReason.trim()}:{}});}
 function enact(){const c=confirm;setConfirm(null);if(!c||c.signature!==signature||session.blocked||!canReportAction(c.kind,view)){setIssue('报告、权限或来源已变化，请重新核对后确认；未保存理由仍保留。');void session.load();return;}void session.send(c.kind,c.body);}
 const content=report??view?.preview,parts=content?(content.runGroupId?splitFullStudyReportMarkdown(content.contentMd):splitReportMarkdown(content.contentMd)):null,canCreate=canReportAction('create',view),canReview=canReportAction('review',view),canRelease=canReportAction('release',view),canDownloadWord=canDownloadReportWord(view);
 const reportBody=parts&&<section className="fr-section" aria-label={report?'固定报告正文':'报告预览正文'}>{parts.body&&<div className="fr-markdown"><Markdown allowImages={false} headingOffset={2}>{parts.body}</Markdown></div>}{parts.appendix&&<details className="fr-appendix"><summary>{parts.legacy?'固定正文与来源':'查看可复核附录'}</summary><div className="fr-markdown"><Markdown allowImages={false} headingOffset={2}>{parts.appendix}</Markdown></div></details>}</section>;
 return <main ref={host} tabIndex={-1} className="platform-main rh-formal-reports" aria-busy={session.busy}><div className="wf-content">
  {session.error&&<p role="alert" className="wf-error">{session.error}</p>}{session.notice&&<p role="status" className="wf-notice">{session.notice}</p>}{session.preparingWord&&!report&&<p role="status">{session.wordPhase}</p>}{issue&&<p role="alert" className="wf-error">{issue}</p>}
  <section className="wf-panel" aria-labelledby="reports-panel-title">
   <div className="fr-summary"><div><h2 id="reports-panel-title">{report?.title||(run?'报告预览':'科研产出')}</h2>{session.verified&&view?.studyTitle&&<p className="fr-study-context">当前课题：{view.studyTitle}</p>}<p>{report?'固定第1版 · '+reportStatus[report.status]:run?'本次分析已确认 · 预览尚未保存' :'从本研究已确认的分析生成报告，或打开下方已有报告。'}</p>{report&&<p>创建于{date(report.createdAt)}</p>}</div><Button disabled={session.busy} onClick={()=>void session.load()}>重新核对报告与来源</Button></div>
   {(!session.verified||session.pending)&&<div className="fr-actions">{!session.verified&&<p>当前状态尚未核对，正文与文件暂不展示。</p>}{session.pending&&<><p>上次操作尚待核对，请先确认原操作结果。</p><Button disabled={session.busy||!session.verified&&session.pending.action!=='export'} onClick={()=>void session.recover()}>核对上次操作结果</Button></>}</div>}
   {view?.sourceError&&<p role="alert">{view.sourceError} 请重新核对当前来源。</p>}
   {run&&<section className="fr-section" aria-labelledby="report-create-title"><h3 id="report-create-title">{view.preview.title}</h3><p>尚未保存。请核对正文与来源；保存后进入报告审核。</p><label className="wf-field">报告标题（可选）<input aria-label="报告标题（可选）" maxLength={200} value={title} disabled={session.blocked||!canCreate} placeholder="留空使用本次分析的默认标题" onChange={e=>setTitle(e.target.value)}/></label>{!view.capabilities.canCreate&&<p>当前账号可以查看此来源，尚无生成报告权限。</p>}<Button primary disabled={session.blocked||!canCreate} onClick={()=>open('create')}>保存固定报告</Button><p><a href={sourceUrl(run.id)}>查看本次分析与人工确认</a></p>{reportBody}</section>}
   {report&&<>
    {reportBody}
    {(canReview||reviewReason)&&<section className="fr-section" aria-labelledby="report-review-title"><h3 id="report-review-title">审核固定报告</h3><label className="wf-field">报告审核结论<select aria-label="报告审核结论" value={decision} disabled={session.blocked||!canReview} onChange={e=>setDecision(e.target.value)}>{Object.entries(decisions).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="wf-field">报告审核理由<textarea aria-label="报告审核理由" rows={3} maxLength={5000} value={reviewReason} disabled={session.blocked} readOnly={!canReview} onChange={e=>setReviewReason(e.target.value)}/></label><Button primary disabled={session.blocked||!canReview||!reviewReason.trim()} onClick={()=>open('review')}>保存审核结论</Button></section>}
    {report.status==='changes_requested'&&<p>请依据审核理由返回分析来源核对。需要重新分析时，请使用新分析生成新的固定报告。</p>}
    {(canRelease||releaseReason)&&<section className="fr-section" aria-labelledby="report-release-title"><h3 id="report-release-title">发布固定报告</h3><p>发布本研究当前固定版，保留审核与责任记录。</p><label className="wf-field">报告发布理由<textarea aria-label="报告发布理由" rows={3} maxLength={5000} value={releaseReason} disabled={session.blocked} readOnly={!canRelease} onChange={e=>setReleaseReason(e.target.value)}/></label><Button primary disabled={session.blocked||!canRelease||!releaseReason.trim()} onClick={()=>open('release')}>发布固定报告</Button></section>}
    <section className="fr-section" aria-labelledby="report-version-title"><h3 id="report-version-title">版本与审核记录</h3><p>固定第1版 · {reportStatus[report.status]}</p>{report.reviews.length?<ol className="fr-history">{report.reviews.map(r=><li key={r.id}><strong>{decisions[r.decision]}</strong> · {r.reviewerName} · {date(r.createdAt)}<p>{r.reason}</p></li>)}</ol>:<p>尚无审核记录。</p>}</section>
    <section className="fr-section" aria-labelledby="report-download-title"><h3 id="report-download-title">Word文件</h3>{report.status!=='released'?<p>本报告发布固定版后可下载Word。</p>:!view.capabilities.canExport?<p>当前账号可阅读报告，尚无文件交付权限。</p>:view.docxExportStatus!=='available'?<p>Word文件服务当前不可用，请稍后重新核对。</p>:<>
     {view.jobError&&<p role="alert">{view.jobError} 请从原报告入口核对文件任务。</p>}{job&&!session.preparingWord&&<p role="status">Word文件：{reportJobStatus[job.status]}</p>}{job?.status==='failed'&&<p>本次准备失败，未下载；核对来源后可重新准备。</p>}{job?.status==='ready'&&<p>{job.file.filename} · {(job.file.sizeBytes/1024).toFixed(1)} KB</p>}<Button primary disabled={session.blocked||!canDownloadWord} onClick={()=>void session.downloadWord()}>{session.preparingWord?session.wordPhase:'下载Word'}</Button><p>按已发布固定版准备并下载，包含可复核附录；文件仅在当前授权下交付。</p>
    </>}</section>
    <section className="fr-section"><h3>来源与后续操作</h3><div className="fr-actions"><a href={sourceUrl(report.runGroupId??report.runId)}>查看此报告的分析来源</a><a href={analysisUrl(route.studyId)}>查看本研究分析数据</a>{assetRegistration.button}</div>{report.status==='released'&&<p>已发布本研究固定版；公开共享与资产沉淀需另行办理。</p>}<details><summary>查看固定版本摘要</summary><p className="fr-hash">正文摘要：{report.contentHash}</p></details></section>
   </>}
   {!run&&!report&&session.verified&&<p>尚未选择可阅读的报告。生成新报告请先打开本研究已确认的分析。</p>}
   <section className="fr-section" id="recent-reports"><h3>近期报告</h3><p>显示当前研究最近最多50份报告；来源受限时仅保留状态。</p>{view?.list.items.length?<ul className="wf-list fr-list">{view.list.items.map(item=><li key={item.artifactId}><div><a href={reportsUrl(route.studyId,{artifactId:item.artifactId})}>{item.title}</a><p>第1版 · {reportStatus[item.status]} · {date(item.createdAt)}</p>{item.analysisState==='blocked'&&<p>来源或使用条件已变化，当前不可使用。</p>}</div></li>)}</ul>:<p>当前没有可展示的报告。</p>}</section>
   <div className="fr-actions"><a href={route.runId||route.runGroupId?sourceUrl(route.runGroupId??route.runId):fullStudy?analysisUrl(route.studyId):methodsUrl(route.studyId)}>{route.runId||route.runGroupId?'返回本次分析':'选择已确认的分析'}</a><a href={reportsNavUrl('概览',route.studyId)}>返回本研究概览</a></div>
  </section>
  {assetRegistration.dialogs}
  {confirm&&<ConfirmDialog title={labels[confirm.kind][0]} confirmLabel={labels[confirm.kind][1]} danger={false} returnFocus={confirm.trigger} fallbackFocus={host.current} onCancel={()=>setConfirm(null)} onConfirm={enact}><p>{confirm.kind==='create'?'将保存当前预览为固定第1版并进入待审核，保留实际统计与可复核来源。':confirm.kind==='review'?'将保存您对当前固定版的审核结论与理由。':'将发布当前已审核的固定第1版，供本研究受控交付。此操作不会公开共享或沉淀为资产。'}</p>{confirm.kind==='create'&&confirm.body.title&&<p>{confirm.body.title}</p>}{confirm.kind==='review'&&<><p>{decisions[confirm.body.decision]}</p><p>{confirm.body.reason}</p></>}{confirm.kind==='release'&&<p>{confirm.body.reason}</p>}</ConfirmDialog>}
  {leave&&<ConfirmDialog title={session.pending?'上次操作仍待核对':'离开前保留修改'} confirmLabel="离开此页" danger={false} returnFocus={leave.trigger} fallbackFocus={host.current} onCancel={()=>setLeave(null)} onConfirm={()=>{allowLeave.current=true;location.assign(leave.url);}}><p>{session.pending?'原操作核对标记仍保留，返回后请先核对结果。':'未保存标题或理由只在当前页保留，离开将丢失。'}</p></ConfirmDialog>}
 </div></main>;
}
