import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {createHubBillingClient} from '../../src/hub-billing-session.js';
import {governanceTarget} from '../../src/governance-overview.js';
import './token-reconciliation.css';
import GovernanceServiceStatus from './GovernanceServiceStatus.jsx';
import GovernanceSectionHeader from './GovernanceSectionHeader.jsx';
import {governanceBackHref} from '../../src/governance-overview.js';
const number=value=>value===null||value===undefined?'—':BigInt(value).toLocaleString('zh-CN');
const date=value=>new Date(value).toLocaleString('zh-CN',{hour12:false});
const state=item=>item.status==='settled'?'已结算':item.status==='released'?'已释放':item.executing?'执行中':item.canSettle?'可结算':'待核实';
export default function TokenReconciliation(){
 const identity=useDirectoryIdentity(),client=useMemo(()=>createHubBillingClient(),[]);
 const [result,setResult]=useState(null),[quota,setQuota]=useState(null),[status,setStatus]=useState('pending'),[page,setPage]=useState(1),[detail,setDetail]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[pending,setPending]=useState(null),[denied,setDenied]=useState(false);
 const epoch=useRef(0),listSeq=useRef(0),trigger=useRef(null),locked=useRef(false),root=useRef(null),pendingRef=useRef(null);
 const requestedRecord=useRef(false);
 const recoveryKey='rh-token-recovery:'+identity.identityKey;
 function remember(value){if(value)sessionStorage.setItem(recoveryKey,JSON.stringify(value));else sessionStorage.removeItem(recoveryKey);}
 function reject(e){
  if(e.name==='AbortError')return;
  setError(e.message);
  if(e.status===401||e.status===403){client.invalidate();epoch.current++;locked.current=false;setBusy(false);setResult(null);setQuota(null);setDetail(null);setPending(null);pendingRef.current=null;setDenied(true);}
 }
 async function listing(){
  const n=epoch.current,seq=++listSeq.current;setLoading(true);
  try{const [r,q]=await Promise.all([client.list({page,status}),client.me()]);if(n!==epoch.current||seq!==listSeq.current)return;setResult(r);setQuota(q);}
  catch(e){if(n===epoch.current&&seq===listSeq.current)reject(e);}
  finally{if(n===epoch.current&&seq===listSeq.current)setLoading(false);}
 }
 useEffect(()=>{
  client.invalidate();epoch.current++;locked.current=false;setBusy(false);setResult(null);setQuota(null);setDetail(null);setPending(null);pendingRef.current=null;setError('');setNotice('');setDenied(false);
  if(!identity.checking&&identity.user.authenticated){
   try{const value=JSON.parse(sessionStorage.getItem(recoveryKey));if(value&&/^[A-Za-z0-9_-]{1,200}$/.test(value.id)&&/^[A-Za-z0-9_-]{8,160}$/.test(value.input?.requestKey)&&/^[a-f0-9]{64}$/.test(value.input?.fingerprint)&&value.input.action==='settle'){pendingRef.current=value;setPending(value);}}catch{/* Storage unavailability does not sign out a user. */}
   void listing();
  }
  return()=>{epoch.current++;client.invalidate();};
 },[identity.checking,identity.identityKey]);
 useEffect(()=>{if(!identity.checking&&identity.user.authenticated&&!denied)void listing();},[page,status,retry]);
 useEffect(()=>{
  if(requestedRecord.current||!result||denied||identity.checking||identity.unavailable||!new URLSearchParams(window.location.search).has('record'))return;
  requestedRecord.current=true;const id=governanceTarget(window.location.search,'billing');
  if(id)void open({id},{currentTarget:root.current?.querySelector('button')});else setError('记录标识不正确，请从用量列表重新选择。');
 },[result,denied,identity.checking,identity.unavailable]);
 async function open(item,event){
  if(loading||locked.current||pendingRef.current&&pendingRef.current.id!==item.id)return;trigger.current=event.currentTarget;setError('');setNotice('');locked.current=true;setBusy(true);const n=epoch.current;
  try{const d=await client.detail(item.id);if(n===epoch.current)setDetail(d);}catch(e){if(n===epoch.current)reject(e);}finally{if(n===epoch.current){locked.current=false;setBusy(false);}}
 }
 async function refreshDetail(){
  if(locked.current||!detail)return;locked.current=true;setBusy(true);const n=epoch.current;
  try{const d=await client.detail(detail.id);if(n===epoch.current){setDetail(d);setError('');}}
  catch(e){if(n===epoch.current)reject(e);}finally{if(n===epoch.current){locked.current=false;setBusy(false);}}
 }
 async function submit(){
  if(locked.current||!detail||!detail.canSettle&&!pendingRef.current)return;
  const n=epoch.current,request=pendingRef.current?.input??{requestKey:crypto.randomUUID(),fingerprint:detail.fingerprint,action:'settle'},recovery={id:detail.id,input:request};
  pendingRef.current=recovery;setPending(recovery);locked.current=true;setBusy(true);setError('');
  try{
   try{remember(recovery);}catch{throw Error('无法保留结算恢复记录，尚未提交；请检查浏览器存储后重试。');}
   const r=await client.resolve(detail.id,request);if(n!==epoch.current)return;
   if(r.status!=='settled')throw Error('结算结果尚未确认，请核对原提交。');
   pendingRef.current=null;setPending(null);try{remember(null);}catch{}setDetail(null);setNotice('已按实际用量结算，剩余预留已释放。');await listing();
  }catch(e){if(n!==epoch.current)return;if(!e.uncertain){pendingRef.current=null;setPending(null);try{remember(null);}catch{}}reject(e);}
  finally{if(n===epoch.current){locked.current=false;setBusy(false);}}
 }
 function close(){if(busy)return;setDetail(null);setError('');}
 return <section className="governance-workspace governance-token-workspace">
  <GovernanceSectionHeader title="AI用量与对账" description="按实际模型用量结算；用量不明的记录保留待核实。" backHref={governanceBackHref(window.location.search)}/>
  <section className="hub-token-workbench" ref={root} aria-label="AI用量与对账">
  {quota&&<p className="hub-token-balance">本人可用 <strong>{number(quota.effectiveRemainingTokens)}</strong> Token</p>}
  <div className="hub-token-toolbar"><label>记录<select aria-label="对账记录状态" value={status} disabled={busy||!!pending} onChange={e=>{setStatus(e.target.value);setPage(1);setError('');}}><option value="pending">待处理</option><option value="settled">已处理</option></select></label><Button disabled={busy||loading||!!pending} onClick={()=>{setError('');setRetry(x=>x+1);}}>刷新</Button></div>
  {notice&&<p role="status">{notice}</p>}
  {pending&&!detail&&!denied&&<p role="status">有一笔结算结果尚未确认。<Button disabled={busy} onClick={e=>open({id:pending.id},e)}>恢复未确认结算</Button></p>}
  {error&&!detail&&<p role="alert">{error}</p>}
  {loading&&<p role="status">正在读取用量记录…</p>}
  {!identity.checking&&!identity.user.authenticated&&<p>请登录管理员账号查看。</p>}
  {result&&!denied&&<><div className="hub-token-table-wrap"><table><caption>本租户模型用量记录</caption><thead><tr><th>账号</th><th>发生时间</th><th>预留 Token</th><th>实际 Token</th><th>状态</th><th>操作</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><th scope="row">{item.accountName}</th><td>{date(item.createdAt)}</td><td>{number(item.reservedTokens)}</td><td>{number(item.actualTokens??item.usage?.totalTokens)}</td><td>{state(item)}</td><td><Button data-billing-id={item.id} disabled={busy||loading||!!pending&&pending.id!==item.id} onClick={e=>open(item,e)}>核对</Button></td></tr>)}</tbody></table></div>{!result.items.length&&<p>暂无{status==='pending'?'待处理':'已处理'}记录。</p>}
   <div className="hub-token-pagination"><span>第 {result.page} 页，共 {result.total} 条</span><Button disabled={busy||loading||page<=1} onClick={()=>setPage(x=>x-1)}>上一页</Button><Button disabled={busy||loading||page*result.pageSize>=result.total} onClick={()=>setPage(x=>x+1)}>下一页</Button></div></>}
  <GovernanceServiceStatus refreshVersion={retry}/>
  {detail&&<ConfirmDialog title="核对模型用量" danger={false} confirmDisabled={!detail.canSettle&&!pending} confirmLabel={pending?'核对原提交结果':'确认结算'} cancelLabel="关闭" busy={busy} returnFocus={trigger.current} fallbackFocus={root.current?.querySelector('button')} onCancel={close} onConfirm={submit}>
   <dl className="hub-token-details"><dt>账号</dt><dd>{detail.accountName}</dd><dt>发生时间</dt><dd>{date(detail.createdAt)}</dd><dt>状态</dt><dd>{state(detail)}</dd><dt>预留</dt><dd>{number(detail.reservedTokens)} Token</dd><dt>实际用量</dt><dd>{number(detail.actualTokens??detail.usage?.totalTokens)} Token</dd>{detail.usage&&<><dt>模型 / 次数</dt><dd>{detail.usage.model} / {detail.usage.callCount} 次</dd><dt>输入 / 输出</dt><dd>{number(detail.usage.promptTokens)} / {number(detail.usage.completionTokens)} Token</dd></>}</dl>
   {detail.taskLabel&&<p><strong>任务：</strong>{detail.taskLabel}</p>}
   <p>{detail.message}</p>{detail.canSettle&&<p>结算只记录已核验的实际消费，并释放多余预留；不会增加额度。</p>}
   {!!detail.attempts?.length&&<details><summary>查看调用依据（{detail.attempts.length}次）</summary><ul>{detail.attempts.map(a=><li key={a.number}>第{a.number}次 · {a.model} · {a.status==='known'?number(a.totalTokens)+' Token':'用量待核实'}</li>)}</ul>{!detail.usage&&detail.knownPartialTokens>0&&<p>已核验部分：{number(detail.knownPartialTokens)} Token，非完整用量，不可据此结清。</p>}</details>}
   {detail.resolution&&<p>处理人：{detail.resolution.operatorName} · {date(detail.resolution.processedAt)} · 已记账 {number(detail.resolution.actualTokens)} Token</p>}
   {error&&<p role="alert">{error}</p>}{pending&&<p>提交结果未确认。请核对原提交，不会另建结算。</p>}
   {!pending&&<Button disabled={busy} onClick={refreshDetail}>重新核对</Button>}
  </ConfirmDialog>}
 </section></section>;
}
