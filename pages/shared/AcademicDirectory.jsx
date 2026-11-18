import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {createAdmissionClient} from '../../src/admission-session.js';
import {createAcademicContentClient} from '../../src/academic-content-client.js';
import {academicHref,readAcademicRoute} from '../../src/academic-content-route.js';
import {AcademicReading} from './AcademicContent.jsx';

const types={all:'全部',news:'资讯',progress:'研究进展',notice:'项目通知',event:'活动'};
const phases={upcoming:'即将举行',ongoing:'进行中',past:'活动回顾',cancelled:'已取消'};
const date=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const message=e=>e.status===404?'内容不存在、已撤下或未向当前范围开放。':e.status===401||e.status===403?'当前访问资格需要重新核对，请重试。':'内容暂时无法读取，请重试。';
function route(){try{return{value:readAcademicRoute('h01',location.search)??{type:'all',phase:'all',q:''}};}catch(e){return{error:e.message};}}

export function AcademicDirectory({compact=false}){
 const identity=useDirectoryIdentity(),parsed=route();
 if(parsed.error)return <main className="platform-main"><section className="academic-content"><h2>学术动态</h2><p role="alert">{parsed.error}</p><a href={academicHref()}>返回学术动态</a></section></main>;
 const state=identity.checking?'checking':identity.unavailable||identity.user.sessionHealth==='unavailable'?'unavailable':identity.user.authenticated?'authenticated':'public';
 return <AcademicDirectoryContent key={identity.identityKey+':'+state+':'+compact} identity={identity} state={state} initial={parsed.value} compact={compact}/>;
}
function AcademicDirectoryContent({identity,state,initial,compact}){
 const api=useMemo(()=>createAcademicContentClient(),[]),admission=useMemo(()=>createAdmissionClient(),[]);
 const [filter,setFilter]=useState(initial),[search,setSearch]=useState(initial.q),[audience,setAudience]=useState(null),[items,setItems]=useState(null),[detail,setDetail]=useState(null),[cursor,setCursor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const seq=useRef(0),head=useRef(null),count=useRef(1);
 const listHref=academicHref({...filter,id:undefined}),memoryKey='rh-f03-reading:'+identity.identityKey+':'+listHref;
 useEffect(()=>{
  const n=++seq.current,controller=new AbortController();setAudience(null);setItems(null);setDetail(null);setCursor(null);setError('');setBusy(false);
  if(state==='checking')return;if(state==='unavailable'){setError('身份暂时无法核对，请检查连接后重试。');return;}
  const options={signal:controller.signal};
  void(async()=>{try{
   const scope=state==='public'?'public':(await admission.self(options)).status==='approved'?'member':'public';
   if(n!==seq.current)return;setAudience(scope);
   if(filter.id){const value=await api.detail(scope,filter.id,options);if(n===seq.current)setDetail(value);return;}
   let saved=null;try{saved=JSON.parse(sessionStorage.getItem(memoryKey));}catch{}
   const pages=compact?1:Math.min(20,Math.max(1,Number(saved?.pages)||1));let all=[],next;
   for(let p=0;p<pages;p++){const value=await api.list(scope,{...(filter.type!=='all'?{type:filter.type}:{}),...(filter.phase!=='all'?{phase:filter.phase}:{}),...(filter.q?{q:filter.q}:{}),limit:compact?'3':'20',...(next?{cursor:next}:{})},options);all.push(...value.items);next=value.nextCursor;if(!next)break;}
   if(n!==seq.current)return;setItems(all);setCursor(next??null);count.current=pages;
   if(!compact&&saved)requestAnimationFrame(()=>{document.querySelector('.platform-main')?.scrollTo({top:Number(saved.scroll)||0});const target=[...document.querySelectorAll('.academic-list a')].find(a=>a.dataset.contentId===saved.id);target?.focus({preventScroll:true});});
  }catch(e){if(n===seq.current){setItems(null);setDetail(null);setError(message(e));}}})();
  return()=>{seq.current++;controller.abort();};
 },[state,filter.id,filter.type,filter.phase,filter.q,refresh]);
 useEffect(()=>{const check=()=>{if(document.visibilityState==='visible'){setDetail(null);setItems(null);setAudience(null);setRefresh(v=>v+1);}};window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);return()=>{window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',check);};},[]);
 function change(next){const value={...filter,...next,id:undefined};setFilter(value);window.history.replaceState(null,'',academicHref(value));try{sessionStorage.removeItem('rh-f03-reading:'+identity.identityKey+':'+academicHref(value));}catch{}count.current=1;}
 function remember(id){try{sessionStorage.setItem(memoryKey,JSON.stringify({pages:count.current,scroll:document.querySelector('.platform-main')?.scrollTop??0,id}));}catch{}}
 async function more(){if(busy||!cursor||!audience)return;const n=seq.current;setBusy(true);setError('');try{const v=await api.list(audience,{...(filter.type!=='all'?{type:filter.type}:{}),...(filter.phase!=='all'?{phase:filter.phase}:{}),...(filter.q?{q:filter.q}:{}),limit:'20',cursor});if(n===seq.current){setItems(old=>[...old,...v.items.filter(x=>!old.some(y=>y.id===x.id))]);setCursor(v.nextCursor);count.current++;}}catch(e){if(n===seq.current){if([401,403].includes(e.status)){setItems(null);setDetail(null);setCursor(null);setAudience(null);}setError(message(e));}}finally{if(n===seq.current)setBusy(false);}}
 const content=<section className={compact?'academic-content academic-hub-summary hub-card':'academic-content'} aria-busy={busy}>
  <header className="academic-toolbar"><h2 ref={head} tabIndex={-1}>学术动态</h2>{compact?<a href={academicHref()}>查看全部</a>:<a href="/pages/h01/?hubKey=lingshu-xinyu">返回领域概况</a>}</header>
  {!compact&&filter.id?<a href={listHref}>返回动态列表</a>:!compact&&<form className="academic-toolbar" onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label>内容类型<select aria-label="内容类型" value={filter.type} onChange={e=>change({type:e.target.value,phase:'all'})}>{Object.entries(types).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{filter.type==='event'&&<label>活动状态<select aria-label="活动状态" value={filter.phase} onChange={e=>change({phase:e.target.value})}><option value="all">全部活动</option>{Object.entries(phases).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}<label>标题或摘要<input aria-label="标题或摘要" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></label><Button type="submit">搜索</Button></form>}
  {error&&<div role="alert"><p>{error}</p><Button onClick={()=>setRefresh(v=>v+1)}>重新读取</Button></div>}
  {state==='checking'&&!error&&<p role="status">正在核对身份…</p>}
  {!error&&state!=='checking'&&(filter.id?!detail:!items)&&<p role="status">正在读取内容…</p>}
  {detail&&<AcademicReading item={detail} audience={audience}/>}
  {!filter.id&&items&&<><ul className="academic-list">{items.map(item=><li key={item.id}><p className="academic-meta">{types[item.type]}{item.event?' · '+phases[item.event.phase]:''} · {date(item.publishedAt)}</p><h3><a data-content-id={item.id} href={academicHref({...filter,id:item.id})} onClick={()=>remember(item.id)}>{item.title}</a></h3><p>{item.summary}</p>{item.event&&<p>{date(item.event.startAt)} · {item.event.place}</p>}</li>)}</ul>{!items.length&&<p role="status">{filter.q||filter.type!=='all'||filter.phase!=='all'?'没有符合条件的已发布内容，可调整筛选。':'暂无可查看的学术动态。'}</p>}{!compact&&cursor&&<Button disabled={busy} loading={busy} onClick={more}>加载更多</Button>}</>}
  {!compact&&state==='public'&&<p>登录获准成员账号可查看成员内容。<a href={'/pages/p003/?'+new URLSearchParams({returnTo:academicHref(filter)})}>前往登录</a></p>}
 </section>;
 return compact?content:<main className="platform-main real-hub"><div className="content">{content}</div></main>;
}
