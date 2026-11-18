import React,{useState} from 'react';
import {Card,Button,Tabs,AIPanel} from './Components.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {RESEARCH_ASSET_LABELS,makeResearchAssetUrl} from '../../src/research-assets-session.js';
const tabs=['内容概览','版本历史','引用与复用','相关研究','评论与讨论','文件附件','变更记录'];
const showDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'未提供':date.toLocaleString('zh-CN',{hour12:false});};
export default function ResearchAssetDetail({asset,scope}){
 const [tab,setTab]=useState(0),kind=RESEARCH_ASSET_LABELS[asset.kind];
 const versions=asset.versions.some(v=>v.version===asset.version)?asset.versions:[...asset.versions,{version:asset.version,changeSummary:asset.changeSummary}];
 return <>
  <Card><div className="hero-detail-card">
   <div className="asset-cover">{kind}<br/>私有草稿<br/><br/><small>v{asset.version}</small></div>
   <div><h2>{asset.title}</h2><div className="tag-row"><span className="pill">{kind}</span><span className="pill orange">草稿</span><span className="pill">v{asset.version}{asset.isHistorical?' · 历史版本':''}</span></div><p>{asset.metadata.summary}</p><div className="tag-row"><span className="pill">合成演练材料</span></div></div>
   <div className="detail-list"><p><span>作者</span><b>{asset.metadata.author}</b></p><p><span>所属机构</span><b>未提供</b></p><p><span>创建时间</span><b>{showDate(asset.assetCreatedAt)}</b></p><p><span>版本时间</span><b>{showDate(asset.createdAt)}</b></p><p><span>版本</span><b>v{asset.version}{asset.isHistorical?'（历史，当前v'+asset.currentVersion+'）':'（当前最新）'}</b></p><p><span>资产编号</span><b>{asset.id}</b></p></div>
   <div><h3>审核状态</h3><div className="notice">尚未审核<br/><small>合成演练草稿，不是已审定科研结论。</small></div><h3>共享范围</h3><div className="tag-row"><Button disabled>本人私有</Button><Button disabled>机构内共享</Button><Button disabled>公开共享</Button></div></div>
  </div></Card>
  <Tabs items={tabs} onChange={setTab}/>
  <div className="two-col" style={{gridTemplateColumns:'minmax(0,1fr) 500px'}}><div className="stack">
   <Card title={tab===0?'1. 资产内容预览':tabs[tab]}>
    {tab===0?<div className="asset-preview"><div className="research-asset-reading"><Markdown allowImages={false} headingOffset={2}>{asset.contentMd}</Markdown></div><div className="stack"><Card title="核心信息"><div className="detail-list form-block">{[['资产类型',kind],['用途',asset.metadata.purpose],['适用限制',asset.metadata.limitations],['材料来源',asset.source.label]].map(([label,value])=><p key={label}><span>{label}</span><b>{value}</b></p>)}</div></Card><Card title="摘要"><div className="form-block"><p>{asset.metadata.summary}</p></div></Card></div></div>:
     tab===1||tab===6?<div className="form-block"><label htmlFor="research-asset-version">查看固定版本</label><select id="research-asset-version" value={asset.version} onChange={e=>location.assign(makeResearchAssetUrl(scope,asset.id,Number(e.target.value)))}>{versions.map(v=><option key={v.version} value={v.version}>v{v.version} · {v.changeSummary||'未提供版本说明'}</option>)}</select><ul>{asset.versions.map(v=><li key={v.version}><a href={makeResearchAssetUrl(scope,asset.id,v.version)}>v{v.version}</a> · {v.changeSummary||'未提供版本说明'} · {showDate(v.createdAt)}</li>)}</ul>{asset.hasMoreVersions&&<p>仅列最近50版；可通过固定版本链接核对更早版本。</p>}</div>:
      <div className="form-block"><p>{tab===2?'此草稿尚未开放引用与复用。':tab===3?'未关联其他研究。':tab===4?'此草稿暂无评论与讨论。':'此版本未提供附件。'}</p></div>}
   </Card>
   <Card title="4. 相关标签" action="编辑标签" actionDisabled><div className="tag-row form-block"><span className="pill">{kind}</span><span className="pill">合成演练材料</span></div></Card>
  </div><div className="stack"><AIPanel title="AI 资产解读" actionDisabled><p>此版本暂无 AI 解读。</p></AIPanel><Card title="相关资产推荐" action="查看更多" actionDisabled><div className="form-block"><p>暂无可用推荐。</p></div></Card><Card title="5. 复用此资产"><div className="form-block"><p className="muted">当前为本人私有草稿，尚未开放应用或导出。</p><div className="tag-row"><Button disabled primary>基于此模板新建方案</Button><Button disabled>创建副本</Button><Button disabled>导出为模板</Button></div></div></Card></div></div>
 </>;
}
