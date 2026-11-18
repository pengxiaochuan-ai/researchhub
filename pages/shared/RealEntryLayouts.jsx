import React,{useState} from 'react';
import {Card,Stats,Button} from './Components.jsx';
import {makeStudyOverviewUrl} from '../../src/study-overview-route.js';
import './real-entry-layouts.css';

export function RealDesignEntry({state,links,retry}){
  const [query,setQuery]=useState('');
  const projects=(state.user?.studyGroups??[]).flatMap(group=>(group.researchProjects??[]).map(project=>({group,project})));
  return <main className="platform-main real-workspace-entry real-design-entry"><div className="wf-content"><section className="wf-panel"><h2>我的课题与草稿</h2><EntryStatus state={state} retry={retry}/><div className="wf-toolbar"><label>搜索当前已授权课题<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="课题名称"/></label><Button primary onClick={()=>location.assign('/pages/q01/?researchCreation=1')}>新建课题</Button><a href="/pages/q02/?researchProjects=1">查看已保存课题</a></div><p>选择研究后查看概览，或继续本人的草稿。</p><ul className="wf-list">{projects.filter(({group,project})=>(group.name+' '+project.name).includes(query.trim())).map(({group,project})=><li key={group.id+':'+project.id}><strong>{project.name}</strong><small>{group.name}</small><a href={makeStudyOverviewUrl({studyGroupId:group.id,researchProjectId:project.id})}>打开课题</a><a href={links.find(link=>new URL(link.url,'http://local').searchParams.get('researchProjectId')===project.id&&new URL(link.url,'http://local').searchParams.get('studyGroupId')===group.id)?.url}>继续草稿</a></li>)}</ul>{state.kind==='ready'&&!projects.length&&<p role="status">暂无已授权的私有课题，请联系研究负责人邀请加入。</p>}</section></div></main>;
}

export function EntryStatus({state,retry}){return state.kind==='ready'?<p>当前账号：{state.user.displayName} · {state.user.username}</p>:<div role={state.kind==='error'?'alert':'status'}><p>{state.kind==='loading'?'正在核验当前账号与 Study…':state.kind==='signed-out'?'请先登录；公开注册不自动获得私有 Study 权限。':state.message}</p>{state.kind==='signed-out'?<a href="/pages/p003/">前往登录</a>:state.kind==='error'?<Button onClick={retry}>重新核验</Button>:null}</div>;}

export function RealAssetEntry({state,links,retry}){
  const [tab,setTab]=useState('资产列表'),[detailTab,setDetailTab]=useState('基本信息');
  const [scopeUrl,setScopeUrl]=useState('');
  const selected=links.find(link=>link.url===scopeUrl);
  return <main className="platform-main real-workspace-entry real-asset-entry"><div className="content stack"><Stats items={['全部资产','研究方案','数据集','量表/工具','分析结果','论文/报告'].map(label=>({label,value:'—',note:"汇总暂不可用"}))}/>
    <div className="two-col real-assets-grid"><div className="stack"><Card><div className="ui-tabs">{['资产列表','资产图谱','我的贡献','共享与协作','回收站'].map(label=><button key={label} type="button" className={tab===label?'active':''} onClick={()=>setTab(label)}>{label}</button>)}</div><div className="toolbar toolbar-split">{['资产类型','研究领域','资产状态','共享范围','来源'].map(label=><label key={label}>{label}<select disabled><option>全部（暂不可用）</option></select></label>)}</div><EntryStatus state={state} retry={retry}/>
      {tab==='资产列表'?<><div className="real-asset-study"><label>当前已授权 Study<select value={selected?.url??''} onChange={event=>setScopeUrl(event.target.value)}><option value="">请选择 Study</option>{links.map(link=><option key={link.url} value={link.url}>{link.description}</option>)}</select></label>{selected&&<a href={selected.url}>查看本人方法资产候选 →</a>}<p>平台资产列表暂不可用。可选择研究查看本人候选；候选未共享、审批或发布。</p></div><div className="real-asset-table"><table><thead><tr>{['资产名称','资产类型','相关研究/来源','版本','状态','共享范围','负责人','更新时间','操作'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={9}>平台资产列表暂不可用。</td></tr></tbody></table></div><div className="pagination"><span>总数未核验</span><button disabled>上一页</button><button disabled>下一页</button></div></>:<p className="form-block">{tab}暂不可用。</p>}
    </Card><Card title="推荐资产"><p className="form-block">暂无已核验推荐。</p></Card></div><div className="stack"><Card title="资产详情" className="form-block"><h3>选择资产后预览</h3><p>平台资产详情暂不可用；可从左侧选择研究查看本人候选。</p><div className="ui-tabs">{['基本信息','版本历史','关联资产','引用情况'].map(label=><button type="button" key={label} className={detailTab===label?'active':''} onClick={()=>setDetailTab(label)}>{label}</button>)}</div><p>{detailTab}：尚无可核验的选中记录。</p><div className="tag-row"><Button disabled>引用此资产</Button><Button disabled>申请使用</Button><Button disabled>更多操作</Button></div></Card><Card title="资产使用趋势"><p className="form-block">使用趋势暂不可用。</p></Card></div></div>
  </div></main>;
}
