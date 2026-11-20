import AssetContentPreview from './AssetContentPreview.jsx';
import AssetDetailAiPanel from './AssetDetailAiPanel.jsx';
import ReportAssetQaPanel from './ReportAssetQaPanel.jsx';
import HubAssetWorkspace from './HubAssetWorkspace.jsx';
import useAssetReuse from './useAssetReuse.jsx';
import useAssetFiles from './useAssetFiles.jsx';
import React,{useState,useRef} from 'react';
import {Card,Button,Tabs,AIPanel} from './Components.jsx';
import {RESEARCH_ASSET_LABELS} from '../../src/research-assets-session.js';
import {makeCatalogAssetUrl} from '../../src/research-assets-catalog-session.js';
import {ASSET_STATE_LABELS} from './ResearchAssetCatalog.jsx';
import {AssetVersionPanel,AssetActivityPanel} from './ResearchAssetDetailPanels.jsx';
import useAssetTags from './useAssetTags.jsx';
import useAssetComments from './useAssetComments.jsx';
import useAssetDetailUsage from './useAssetDetailUsage.jsx';
import {AssetDetailCitations,AssetDetailRecommendations} from './ResearchAssetDetailConnections.jsx';
import './research-assets-detail.css';
const tabs=['内容概览','版本历史','引用与复用','相关研究','评论与讨论','文件附件','变更记录'];
const date=x=>x&&!Number.isNaN(Date.parse(x))?new Date(x).toLocaleString('zh-CN',{hour12:false}):'未提供';
export default function ResearchAssetCatalogDetail({asset,scope,returnTo,user,api,blocked=false,onSaved,onAccessLost,initialTab=0,canProceed}){
 const[tab,setTab]=useState(initialTab),kind=RESEARCH_ASSET_LABELS[asset.kind],href=number=>makeCatalogAssetUrl(scope,asset.id,number,returnTo,tab);
 const operationsBlocked=blocked||asset.compatibilityReadOnly===true;
 const aiPending=useRef(()=>false),reusePending=useRef(()=>false),filePending=useRef(()=>false),commentPending=useRef(()=>false),usagePending=useRef(()=>false),[more,setMore]=useState(null),[usageTick,setUsageTick]=useState(0);
 const tags=useAssetTags({asset,user,scope,api,blocked:operationsBlocked,onSaved,onAccessLost,canProceed,canOpen:()=>!aiPending.current()&&!usagePending.current()&&!commentPending.current()&&!filePending.current()&&!reusePending.current()});
 const usage=useAssetDetailUsage({asset,user,scope,api,blocked:operationsBlocked,canProceed,onAccessLost,onChanged:()=>setUsageTick(x=>x+1),canOpen:()=>!aiPending.current()&&!tags.pending()&&!commentPending.current()&&!filePending.current()&&!reusePending.current()});usagePending.current=usage.pending;
 const comments=useAssetComments({asset,user,scope,api,blocked:operationsBlocked,canProceed,onAccessLost,active:tab===4,pendingRef:commentPending,canOpen:()=>!aiPending.current()&&!tags.pending()&&!usage.pending()&&!filePending.current()&&!reusePending.current()});
 const files=useAssetFiles({asset,user,scope,api,blocked:operationsBlocked,canProceed,onAccessLost,active:tab===5,selectFiles:()=>changeTab(5),canOpen:()=>!aiPending.current()&&!tags.pending()&&!usage.pending()&&!comments.pending()&&!reusePending.current()});filePending.current=files.pending;
 const reuse=useAssetReuse({asset,user,scope,api,blocked:operationsBlocked,canProceed,onAccessLost,canOpen:()=>!aiPending.current()&&!tags.pending()&&!usage.pending()&&!comments.pending()&&!files.pending()});reusePending.current=reuse.pending;
 if(blocked)return <Card><p role="status" className="form-block">当前内容暂不可核对，请重新读取；未保存输入保留在当前页。</p></Card>;
 const changeTab=n=>{setTab(n);history.replaceState(null,'',makeCatalogAssetUrl(scope,asset.id,asset.version,returnTo,n));};
 return <>
  <Card><div className="hero-detail-card"><div className="asset-cover">{kind}<br/>{ASSET_STATE_LABELS[asset.state]}<br/><br/><small>v{asset.version}</small></div>
   <div><h2>{asset.metadata.title}</h2><div className="tag-row"><span className="pill">{kind}</span><span className="pill">{ASSET_STATE_LABELS[asset.state]}</span><span className="pill">v{asset.version}{asset.isHistorical?' · 历史版本':''}</span>{asset.metadata.analysisNature==='method_description'&&<span className="pill">方法说明 · 未执行</span>}</div><p>{asset.metadata.summary}</p><div className="tag-row"><span className="pill">合成演练材料</span></div></div>
   <div className="detail-list">{[['作者',asset.metadata.author??'未提供'],['负责人',asset.owner?.displayName??'未提供'],['所属机构',asset.metadata.institution??'未提供'],['创建时间',date(asset.assetCreatedAt)],['版本时间',date(asset.createdAt)],['版本','v'+asset.version+(asset.isHistorical?'（历史版本）':'（当前可见）')],['资产编号',asset.id]].map(([k,v])=><p key={k}><span>{k}</span><b>{v}</b></p>)}</div>
   <div><h3>审核状态</h3><div className="notice">{ASSET_STATE_LABELS[asset.state]}<br/><small>资产状态不代替原材料的专业审核。</small></div><h3>当前可用范围</h3><div className="tag-row"><Button disabled>{asset.bodyAccess==='allowed'?'可查看正文':'可查看摘要'}</Button><Button disabled={!asset.canActions?.some(a=>['manage_access','request_access'].includes(a))} onClick={()=>usage.open({assetId:asset.id,version:asset.version,action:asset.canActions.includes('manage_access')?'manage':'request'})}>{asset.canActions?.includes('request_access')?'申请使用':'使用按固定版本授权'}</Button></div></div>
  </div></Card><Tabs items={tabs} initial={initialTab} onChange={changeTab}/>
  <div className="two-col" style={{gridTemplateColumns:'minmax(0,1fr) 500px'}}><div className="stack"><Card title={tab===0?'1. 资产内容预览':tabs[tab]}>
   {tab===0?<AssetContentPreview asset={asset} api={api} scope={scope} onAccessLost={onAccessLost}/>:tab===1?<AssetVersionPanel asset={asset} api={api} blocked={blocked} href={href} onAccessLost={onAccessLost} canProceed={canProceed}/>:tab===2||tab===3?<div className="form-block asset-detail-connections"><AssetDetailCitations key={tab+':'+usageTick} studies={tab===3} asset={asset} scope={scope} api={api} blocked={operationsBlocked} onAccessLost={onAccessLost} canProceed={canProceed}/></div>:tab===4?<div className="form-block asset-detail-connections">{comments.panel}</div>:tab===5?<div className="form-block asset-detail-connections">{files.panel}</div>:tab===6?<AssetActivityPanel asset={asset} api={api} blocked={blocked} onAccessLost={onAccessLost} canProceed={canProceed}/>:<p className="form-block">{tabs[tab]}请在资产中心核对当前可用操作。</p>}
  </Card><Card title="4. 相关标签" action={tags.recovery?'核对上次标签保存':'编辑标签'} actionDisabled={!asset.canEditTags&&!tags.recovery} onAction={tags.open}><div className="tag-row form-block">{[...new Set([kind,...(asset.metadata.domains??[]),...(asset.metadata.tags??[])])].map(x=><span className="pill" key={x}>{x}</span>)}</div>{tags.notice&&<p role="alert" className="form-block">{tags.notice}</p>}</Card></div>
  <div className="stack">{asset.reportQaEligible?<ReportAssetQaPanel asset={asset} scope={scope} user={user} api={api} blocked={blocked} onAccessLost={onAccessLost} pendingRef={aiPending} canOpen={()=>!tags.pending()&&!usage.pending()&&!comments.pending()&&!files.pending()&&!reuse.pending()}/>: (asset.family==='report_context'||asset.aiAvailability==='unavailable')?<AIPanel title="AI 资产解读" actionDisabled><p>此资产尚未开放 AI 解读。</p></AIPanel>:<AssetDetailAiPanel asset={asset} user={user} api={api} scope={scope} blocked={blocked} onAccessLost={onAccessLost} pendingRef={aiPending} canOpen={()=>!tags.pending()&&!usage.pending()&&!comments.pending()&&!files.pending()&&!reuse.pending()}/>}<Card title="相关资产推荐" action="查看更多" actionDisabled={!more?.available} onAction={()=>more?.run()}><div className="form-block"><AssetDetailRecommendations asset={asset} scope={scope} api={api} blocked={operationsBlocked} canProceed={canProceed} onAccessLost={onAccessLost} returnTo={returnTo} registerMore={setMore}/></div></Card><Card title="5. 复用此资产"><div className="form-block"><p>先核对固定版本与许可依据；副本及新方案均为独立私有草稿，适用条件须重新确认。</p><div className="tag-row"><Button disabled={!reuse.canApply} primary onClick={()=>void reuse.open('apply')}>基于此模板新建方案</Button><Button disabled={!reuse.canCopy} onClick={()=>void reuse.open('copy')}>创建副本</Button><Button disabled={!files.canExport} onClick={files.exportMarkdown}>{asset.kind==='protocol'?'导出为模板':'导出 Markdown'}</Button></div><p>导出格式：Markdown（.md）</p></div></Card></div></div>
 {asset.family==='business'&&asset.ownerAccountId===user.accountId&&asset.hubSourceStudyId&&<Card><div className="form-block"><HubAssetWorkspace view="author" studyId={asset.hubSourceStudyId} assetId={asset.id} version={asset.version}/></div></Card>}
 {reuse.notice}{reuse.modal}{files.notice}{comments.notice&&<p role="alert">{comments.notice}</p>}{comments.modal}{usage.notice&&<p role="alert">{usage.notice}</p>}{tags.dialog}{usage.dialog}</>;
}
