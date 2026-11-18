import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {createGovernanceSystemClient} from '../../src/governance-system-session.js';
const configuration={configured:'已配置',missing:'未配置',unknown:'待核实'};
const labels={account:'账号登录',email:'账号邮件',parser:'文档解析',vector:'向量检索',ai:'科研 AI'};
const date=v=>new Date(v).toLocaleString('zh-CN',{hour12:false});
export default function GovernanceServiceStatus({refreshVersion=0}){
 const identity=useDirectoryIdentity(),client=useMemo(()=>createGovernanceSystemClient(),[]),sequence=useRef(0);
 const [result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  client.invalidate();const n=++sequence.current;setResult(null);setError('');setLoading(false);
  if(identity.checking||identity.unavailable||!identity.user.authenticated)return;
  setLoading(true);client.status().then(data=>{if(sequence.current===n)setResult({identityKey:identity.identityKey,data});}).catch(e=>{if(sequence.current===n&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(sequence.current===n)setLoading(false);});
  return()=>{sequence.current++;client.invalidate();};
 },[identity.identityKey,identity.checking,identity.unavailable,refreshVersion,retry]);
 const available=!identity.checking&&!identity.unavailable&&identity.user.authenticated;
 const data=available&&result?.identityKey===identity.identityKey?result.data:null;
 return <section className="hub-service-status" aria-label="服务状态">
  <h3>服务状态</h3><p>已配置不代表当前可用；检查结果仅反映所列时间。</p>
  {identity.unavailable?<p role="status">身份暂时无法核对，请稍后重试。</p>:loading||identity.checking?<p role="status">正在读取服务状态…</p>:null}
  {available&&error&&<p role="alert">{error} <Button onClick={()=>setRetry(v=>v+1)}>重试</Button></p>}
  {data&&<><div className="hub-token-table-wrap"><table><caption>服务接入与最近检查</caption><thead><tr><th>服务</th><th>配置</th><th>检查结果</th><th>检查时间</th></tr></thead><tbody>{data.services.filter(s=>Object.hasOwn(labels,s.key)).map(s=><tr key={s.key}><th scope="row">{labels[s.key]}</th><td>{configuration[s.configuration]??'待核实'}</td><td>{s.check?.status==='passed'?'最近检查通过':s.check?.status==='failed'?'最近检查失败':'未检查'}</td><td>{s.check?.checkedAt?date(s.check.checkedAt):'—'}</td></tr>)}</tbody></table></div><p className="hub-service-observed">状态读取时间：{date(data.observedAt)}</p></>}
 </section>;
}
