import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
import useAssetGovernance from './useAssetGovernance.jsx';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {REPORT_CONTEXT} from '../../scripts/research-assets-report-context.mjs';
import {reportAssetScope,reportAssetDetailUrl,reportAssetListUrl,reportAssetSourcePath,validReportAssetReview} from '../../src/report-asset-context.js';
import {reportsUrl} from '../../src/formal-reports-session.js';
const states={draft:'待提交',in_review:'待审核',changes_requested:'退回修订',approved:'已审核，未发布'};
export default function ReportAssetReview(){
 const q=new URLSearchParams(location.search),portable=q.has('reportId')&&q.get('reportId')!=='rh-formal-report-2d0c1ee7-a6b9-48b9-8433-f47be111ae58',scope=portable?{studyGroupId:q.get('studyGroupId'),researchProjectId:q.get('researchProjectId')}:reportAssetScope,studyId=q.get('studyId')??REPORT_CONTEXT.studyId,context=portable?{studyId,scope}:undefined;
 const [user,setUser]=useState(null),[items,setItems]=useState([]),[ready,setReady]=useState(false),[error,setError]=useState(''),epoch=useRef(0),pending=useRef(()=>false),currentUser=useRef(null),reader=useRef(null);
 const governance=useAssetGovernance({current:{user,scope,ready},apiFactory:(u,s)=>createAssetCatalogClient({user:u,scope:s}),onSaved:()=>{epoch.current++;reader.current=null;setReady(false);void load();}});pending.current=governance.pending;currentUser.current=user;
 let valid=false;
 valid=validReportAssetReview(q);const reportId=q.get('reportId')??REPORT_CONTEXT.reportId;
 async function load(){
  if(!valid||reader.current)return;const token=++epoch.current,reading=Symbol();reader.current=reading;setError('');
  try{
   const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Object.assign(Error('请先登录后处理资产审核。'),{status:response.status});
   const me=await response.json();if(token!==epoch.current)return;
   if(me.role!=='tenant_admin'||(portable?me.isTenantAdmin!==true:me.accountId!=='rh-kb-local-b0e2af9d-admin'))throw Object.assign(Error('当前账号没有此资产的审核权限。'),{status:403});
   const api=createAssetCatalogClient({user:me,scope}),source=await api.get(reportAssetSourcePath(reportId,undefined,context)),data=await api.get('/research-assets/catalog');if(token!==epoch.current)return;
   if(source.reportId!==reportId||source.studyId!==studyId||!Array.isArray(data.items))throw Error('审核目录暂不可核对，请重新读取。');
   const selected=source.existing?data.items.filter(a=>a.id===source.existing.assetId):[];if(source.existing&&selected.length!==1)throw Error('当前登记结果暂不可核对，请重新读取。');
   setUser(me);setItems(selected);setReady(true);
  }catch(e){if(token===epoch.current){setReady(false);setItems([]);setError(e.message);if([401,403].includes(e.status))setUser(null);}}
  finally{if(reader.current===reading)reader.current=null;}
 }
 useEffect(()=>{
  void load();const timer=setInterval(()=>{if(!pending.current())void load();},5000);
  const changed=e=>{const u=e.detail,old=currentUser.current;if(old&&u?.authenticated===true&&u.id===old.accountId&&(u.authVersion===undefined||u.authVersion===old.authVersion))return;epoch.current++;reader.current=null;setUser(null);setItems([]);setReady(false);void load();};
  window.addEventListener('qiyan:user-change',changed);return()=>{epoch.current++;clearInterval(timer);window.removeEventListener('qiyan:user-change',changed);};
 },[valid]);
 if(!valid)return <p role="alert">审核入口范围无效，请从原报告重新进入。</p>;
 return <section className="g02-review-panel content stack" aria-label="科研资产审核">
  <a className="g02-review-back" href="/pages/g02/">返回治理总览</a>
  <Card title="科研资产审核"><div className="form-block stack"><div className="tag-row"><a href={reportsUrl(studyId,{artifactId:reportId})}>返回原方法报告</a><a href={reportAssetListUrl(items[0]?.version??1,items[0]?.id,scope)}>查看本研究资产</a><Button disabled={governance.pending()} onClick={()=>void load()}>重新读取</Button></div>
   {error&&<p role="alert">{error}</p>}{governance.notice&&<p role="status">{governance.notice}</p>}
   {!ready&&!error&&<p role="status">正在读取当前审核事项…</p>}
   {ready&&!items.length&&<p>尚无待处理资产，请从方法报告登记。</p>}
   {ready&&items.map(a=><article key={a.id}><h3>{a.title}</h3><p>第{a.version}版 · {states[a.state]??'状态待核对'} · {a.owner.displayName}</p><p>{a.summary}</p><div className="tag-row"><a href={reportAssetDetailUrl(a.version,a.id,scope)}>查看固定资产详情</a>{['submit','review'].filter(action=>a.canActions.includes(action)).map(action=><Button key={action} primary onClick={()=>governance.open({assetId:a.id,version:a.version,action})}>{action==='submit'?'提交审核':'审核资产'}</Button>)}{a.state==='changes_requested'&&<a href={reportsUrl(studyId,{artifactId:reportId})}>返回报告完善资产说明</a>}</div></article>)}
  </div></Card>{governance.dialog}
 </section>;
}
