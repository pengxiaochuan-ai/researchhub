import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {createResearchIdentityClient,profileToForm,formToChanges} from '../../src/research-identity-session.js';
import './research-identity.css';

export default function ResearchIdentityProfile(){
  const client=useMemo(()=>createResearchIdentityClient({enabled:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG)}),[]);
  const [snapshot,setSnapshot]=useState(null),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[errors,setErrors]=useState({}),[uncertain,setUncertain]=useState(null);
  const alive=useRef(true),inflight=useRef(false),summary=useRef(null),inputs=useRef({}),savedForm=useRef(null);
  const dirty=form&&savedForm.current&&JSON.stringify(form)!==JSON.stringify(savedForm.current);
  const current=()=>alive.current;
  function error(e){if(!current()||e.name==='AbortError')return;setNotice({error:true,text:e.message});setErrors(e.fieldErrors??{});if([401,403].includes(e.status)){setSnapshot(null);setForm(null);savedForm.current=null;setUncertain(null);}requestAnimationFrame(()=>{if(current()){const el=inputs.current[Object.keys(e.fieldErrors??{})[0]]??summary.current;el?.closest('details')?.setAttribute('open','');el?.focus();}});}
  async function load(){if(inflight.current)return;inflight.current=true;setBusy(true);try{const d=await client.read();if(!current())return;const f=profileToForm(d.profile);setSnapshot(d);setForm(f);savedForm.current=f;setErrors({});setNotice(null);setUncertain(null);}catch(e){error(e);}finally{inflight.current=false;if(current())setBusy(false);}}
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;client.invalidate();};},[]);
  useEffect(()=>{if(!dirty&&!uncertain)return;const leave=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty,uncertain]);
  async function commit(action,command){
    if(inflight.current||!snapshot)return;inflight.current=true;setBusy(true);setErrors({});
    try{
      const result=await client[action](command);if(!current())return;
      setUncertain(null);setSnapshot(s=>({...s,version:result.version,level:result.level,establishedAt:result.establishedAt}));
      if(action==='save'){savedForm.current=structuredClone(form);setForm({...form});}
      setNotice({text:action==='save'?`资料草稿已保存。${result.level==='L0'?'仍需明确建立L1；':''}不会公开到研究者目录或授予研究权限。`:'已建立L1个人科研身份。资料仍为私有自述，不是L2/L3认证，不改变Study权限。'});
    }catch(e){if(e.uncertain&&current())setUncertain({action,command});error(e);}
    finally{inflight.current=false;if(current())setBusy(false);}
  }
  async function checkReceipt(){if(inflight.current||!uncertain)return;inflight.current=true;setBusy(true);try{const r=await client.receipt(uncertain.command.requestKey,uncertain.command.expectedVersion);if(!current())return;setSnapshot(s=>({...s,version:r.version,level:r.level,establishedAt:r.establishedAt}));if(uncertain.action==='save'){savedForm.current=profileToForm({...uncertain.command.changes});setForm(savedForm.current);}setUncertain(null);setNotice({text:'已核对最近提交成功。不会重复保存或建立。'});}catch(e){if(current()&&e.status===404)setNotice({error:true,text:'当前无匹配的最近回执，不代表从未保存。请先保留输入并重新加载当前资料核对；不会自动重复提交。'});else error(e);}finally{inflight.current=false;if(current())setBusy(false);}}
  function change(name,value){setForm(f=>({...f,[name]:value}));setErrors(e=>{const next={...e};delete next[name];return next;});}
  function field(name,label,{multiline=false,maxLength,placeholder,help}={}){const props={id:'identity-'+name,value:form[name],onChange:e=>change(name,e.target.value),disabled:busy||Boolean(uncertain),maxLength,placeholder,'aria-invalid':Boolean(errors[name]),'aria-describedby':help||errors[name]?'identity-help-'+name:undefined,ref:el=>{inputs.current[name]=el;}};return <div className="ri-field"><label htmlFor={props.id}>{label}</label>{multiline?<textarea {...props} rows={3}/>:<input {...props}/>}{(help||errors[name])&&<p id={'identity-help-'+name} className={errors[name]?'wp02-field-error':'wp02-help'}>{errors[name]??help}</p>}</div>;}
  function claims(name,label,education=false){return <fieldset className="ri-claims"><legend>{label}（选填）</legend>{form[name].map((row,i)=><fieldset key={row.claimId}><legend>{label} {i+1}</legend>{[['organizationName','机构名称'],...(education?[['qualification','学历／学位']]:[['department','科室／部门'],['positionTitle','职称／岗位']]),['startMonth','开始年月'],['endMonth','结束年月']].map(([key,title])=>{const path=`${name}.${i}.${key}`,id=`identity-${name}-${i}-${key}`;return <label key={key} htmlFor={id}>{title}<input id={id} ref={el=>{inputs.current[path]=el;}} type={key.endsWith('Month')?'month':'text'} maxLength={key==='organizationName'?200:120} value={row[key]??''} aria-invalid={Boolean(errors[path])} aria-describedby={errors[path]?id+'-error':undefined} disabled={busy||Boolean(uncertain)} onChange={e=>change(name,form[name].map((r,n)=>n===i?{...r,[key]:e.target.value|| (key.endsWith('Month')?null:'')}:r))}/>{errors[path]&&<span id={id+'-error'} className="wp02-field-error">{errors[path]}</span>}</label>;})}<Button className="ls-secondary" type="button" disabled={busy||Boolean(uncertain)} onClick={()=>change(name,form[name].filter((_,n)=>n!==i))}>移除第{i+1}条{label}</Button></fieldset>)}<Button className="ls-secondary" type="button" disabled={busy||Boolean(uncertain)||form[name].length>=10} onClick={()=>change(name,[...form[name],{claimId:crypto.randomUUID(),organizationName:'',startMonth:null,endMonth:null,...(education?{qualification:''}:{department:'',positionTitle:''})}])}>添加{label}</Button>{errors[name]&&<p className="wp02-field-error">{errors[name]}</p>}</fieldset>;}
  return <section id="research-identity" className="research-identity" aria-labelledby="identity-heading" aria-busy={busy}>
    <h2 id="identity-heading">个人科研身份</h2><p>科研资料为本人私有自述，可选填、可稍后完善；不会自动出现在公开研究者目录。L2／L3认证申请与审核暂未开放。</p>
    {snapshot&&<p>当前身份：<strong>{snapshot.level==='L1'?'L1 · 个人科研身份':'L0 · 普通用户'}</strong>　{snapshot.level==='L1'?'已明确建立；不代表专业资质已认证。':'保存草稿不升级身份。'}</p>}
    {form?<form noValidate onSubmit={e=>{e.preventDefault();void commit('save',{expectedVersion:snapshot.version,requestKey:crypto.randomUUID(),changes:formToChanges(form)});}}>
      {field('researchName','科研展示姓名',{maxLength:80,help:'建立L1时必填；不会修改上方账号展示名称。'})}
      {field('researchDirections','研究方向',{maxLength:420,placeholder:'例如：针灸；情志病',help:'建立L1时至少1项，最多10项；用分号分隔，每项最多40字符。'})}
      <details><summary>补充科研资料（选填）</summary>{field('biography','科研简介',{multiline:true,maxLength:2000})}{field('orcid','ORCID',{maxLength:19,placeholder:'0000-0000-0000-0000',help:'仅保存本人声明，不等于ORCID或科研资质认证。'})}{field('publicHomepages','公开学术主页',{multiline:true,maxLength:6200,help:'每行1个HTTPS链接，最多3个；不会自动抓取网页。'})}{claims('affiliationClaims','任职经历')}{claims('educationClaims','教育经历',true)}</details>
      <details><summary>后续认证预备资料（选填）</summary>{field('professionalStatement','专业背景说明',{multiline:true,maxLength:2000,help:'仅私有保存供未来完善资料，不提交认证申请。'})}{field('publicEvidenceLinks','公开证明资料链接',{multiline:true,maxLength:10300,help:'每行1个HTTPS链接，最多5个。不收证件附件、不审核或授予L2/L3。'})}</details>
      <div className="ri-actions"><Button type="submit" className="ls-primary" disabled={busy||Boolean(uncertain)}>保存资料草稿</Button><Button type="button" className="ls-secondary" disabled={busy||Boolean(uncertain)||Boolean(dirty)||snapshot.level==='L1'} onClick={()=>void commit('establish',{expectedVersion:snapshot.version,requestKey:crypto.randomUUID()})}>{snapshot.level==='L1'?'已建立个人科研身份':'建立个人科研身份（L1）'}</Button></div>
      {dirty&&<p className="wp02-help">有未保存修改，请先保存草稿，再明确建立L1。未保存输入不存入浏览器。</p>}
    </form>:<p>{busy?'正在核对本人科研资料…':'暂无可显示的本人科研资料，请登录后重新核对。'}</p>}
    {notice&&<div tabIndex={-1} ref={summary} role={notice.error?'alert':'status'} className={notice.error?'wp02-error':''}><p>{notice.text}</p>{Object.entries(errors).length>0&&<ul>{Object.entries(errors).map(([name,message])=><li key={name}><a href={'#identity-'+name} onClick={e=>{e.preventDefault();const el=inputs.current[name];el?.closest('details')?.setAttribute('open','');el?.focus();}}>{message}</a></li>)}</ul>}</div>}
    {uncertain&&<div className="ri-actions"><Button className="ls-secondary" disabled={busy} onClick={()=>void checkReceipt()}>核对最近提交</Button><Button className="ls-secondary" disabled={busy} onClick={()=>void commit(uncertain.action,uncertain.command)}>用原提交编号重试</Button></div>}
    <div className="ls-auth-links"><Button className="ls-secondary" disabled={busy} onClick={()=>{if((!dirty&&!uncertain)||window.confirm('重新加载会放弃当前未保存输入。请先另行保留需要核对的内容，确定继续？'))void load();}}>重新加载科研资料</Button><a href="/pages/p01/">稍后完善，进入我的工作台</a></div>
  </section>;
}
