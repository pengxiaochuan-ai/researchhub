import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {AcademicReading} from './AcademicReading.jsx';
import {createAcademicContentClient} from '../../src/academic-content-client.js';
import {publicAcademicHref,readPublicAcademicRoute} from '../../src/academic-content-route.js';
import './public-academic.css';

const types={all:'全部',news:'资讯',progress:'研究进展',notice:'项目通知',event:'活动'};
const phases={upcoming:'即将举行',ongoing:'进行中',past:'活动回顾',cancelled:'已取消'};
const date=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const message=error=>error.status===404?'内容不存在、已撤下或尚未公开。':'内容暂时无法读取，请稍后重试。';
const query=filter=>({...filter.type!=='all'&&{type:filter.type},...filter.phase!=='all'&&{phase:filter.phase},...filter.q&&{q:filter.q},limit:'20'});
const uniqueItems=items=>[...new Map(items.map(item=>[item.id,item])).values()];

export default function PublicAcademic(){
 let initial;
 try{initial=readPublicAcademicRoute(location.search);}catch{return <section className="ls-public-academic"><h1>学术动态</h1><p role="alert">链接无效，请从学术动态列表重新进入。</p><a href={publicAcademicHref()}>返回学术动态</a></section>;}
 return <PublicAcademicContent initial={initial}/>;
}
function PublicAcademicContent({initial}){
 const api=useMemo(()=>createAcademicContentClient(),[]);
 const [filter,setFilter]=useState(initial),[search,setSearch]=useState(initial.q),[items,setItems]=useState(null),[detail,setDetail]=useState(null),[cursor,setCursor]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const generation=useRef(0),controller=useRef(null),pages=useRef(1),morePending=useRef(false);
 const listHref=publicAcademicHref({...filter,id:undefined}),memoryKey='rh-public-academic:'+listHref;
 useEffect(()=>{
  const n=++generation.current,abort=new AbortController();controller.current=abort;morePending.current=false;
  setItems(null);setDetail(null);setCursor(null);setError('');setBusy(false);
  void(async()=>{try{
   if(filter.id){const value=await api.detail('public',filter.id,{signal:abort.signal});if(n===generation.current)setDetail(value);return;}
   let saved;try{saved=JSON.parse(sessionStorage.getItem(memoryKey));}catch{}
   const restorePages=Math.min(20,Math.max(1,Math.floor(Number(saved?.pages)||1)));let all=[],next=null,loaded=0;
   for(let page=0;page<restorePages;page++){
    const value=await api.list('public',{...query(filter),...next&&{cursor:next}},{signal:abort.signal});
    all=uniqueItems([...all,...value.items]);next=value.nextCursor;loaded++;if(!next)break;
   }
   if(n!==generation.current)return;
   pages.current=loaded;setItems(all);setCursor(next);
   if(saved)requestAnimationFrame(()=>{if(n!==generation.current)return;window.scrollTo({top:Math.max(0,Number(saved.top)||0),behavior:'auto'});[...document.querySelectorAll('.ls-public-academic [data-content-id]')].find(node=>node.dataset.contentId===saved.id)?.focus({preventScroll:true});});
  }catch(e){if(n===generation.current)setError(message(e));}})();
  return()=>{generation.current++;abort.abort();};
 },[api,filter.id,filter.type,filter.phase,filter.q,refresh,memoryKey]);
 useEffect(()=>{
  const check=()=>{if(document.visibilityState==='visible'){setDetail(null);setItems(null);setRefresh(value=>value+1);}};
  window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);
  return()=>{window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',check);};
 },[]);
 useEffect(()=>{document.title=detail?.title?detail.title+'｜灵枢心域':'学术动态｜灵枢心域';},[detail?.title]);
 function change(values){
  const next={...filter,...values,id:undefined};setFilter(next);setError('');window.history.replaceState(null,'',publicAcademicHref(next));
  try{sessionStorage.removeItem('rh-public-academic:'+publicAcademicHref(next));}catch{}
 }
 function remember(id){try{sessionStorage.setItem(memoryKey,JSON.stringify({pages:pages.current,top:window.scrollY,id}));}catch{}}
 async function more(){
  if(morePending.current||!cursor)return;
  const n=generation.current;morePending.current=true;setBusy(true);setError('');
  try{
   const value=await api.list('public',{...query(filter),cursor},{signal:controller.current.signal});
   if(n!==generation.current)return;
   setItems(old=>n!==generation.current||!old?old:uniqueItems([...old,...value.items]));setCursor(value.nextCursor);pages.current++;
  }catch(e){if(n===generation.current)setError(message(e));}
  finally{if(n===generation.current){morePending.current=false;setBusy(false);}}
 }
 const filtered=filter.type!=='all'||filter.phase!=='all'||Boolean(filter.q);
 return <section className="ls-public-academic">
  <div className="ls-public-academic-hero"><div className="ls-public-academic-hero-copy">{filter.id?<p className="ls-public-academic-hero-title">学术动态</p>:<h1>学术动态</h1>}<p className="ls-public-academic-intro">浏览公开的资讯、研究进展、项目通知与学术活动。</p></div></div>
  {filter.id?<><a className="ls-public-academic-back" href={listHref}>返回动态列表</a>{!detail&&<h1>学术动态</h1>}</>:<>
   <div className="ls-public-academic-types" role="group" aria-label="动态类型">{Object.entries(types).map(([type,label])=><Button key={type} aria-pressed={filter.type===type} onClick={()=>change({type,phase:'all'})}>{label}</Button>)}</div>
   <form className="ls-public-academic-search" onSubmit={event=>{event.preventDefault();change({q:search.trim()});}}>
    {filter.type==='event'&&<label>活动状态<select aria-label="活动状态" value={filter.phase} onChange={event=>change({phase:event.target.value})}><option value="all">全部活动</option>{Object.entries(phases).map(([phase,label])=><option key={phase} value={phase}>{label}</option>)}</select></label>}
    <label className="ls-public-academic-keywords">标题或摘要<input type="search" value={search} maxLength={200} onChange={event=>setSearch(event.target.value)} placeholder="搜索学术动态"/></label><Button primary type="submit">搜索</Button>
   </form>
  </>}
  {error&&<div className="ls-public-academic-state" role="alert"><p>{error}</p><Button onClick={()=>setRefresh(value=>value+1)}>重新读取</Button></div>}
  {!error&&(filter.id?!detail:!items)&&<p role="status">正在读取内容…</p>}
  {detail&&<div className="ls-public-academic-detail"><AcademicReading item={detail} audience="public" headingLevel={1}/></div>}
  {!filter.id&&items&&<><ul className="ls-public-academic-list">{items.map(item=><li key={item.id}><p className="academic-meta">{types[item.type]}{item.event?' · '+phases[item.event.phase]:''} · {date(item.publishedAt)}</p><h2><a data-content-id={item.id} href={publicAcademicHref({...filter,id:item.id})} onClick={()=>remember(item.id)}>{item.title}</a></h2><p>{item.summary}</p>{item.event&&<p className="academic-meta">{date(item.event.startAt)}（北京时间） · {item.event.place}</p>}</li>)}</ul>
   {!items.length&&<div className="ls-public-academic-state"><p role="status">{filtered?'没有符合条件的公开动态。':'暂无已发布的公开动态。'}</p>{filtered&&<Button onClick={()=>{setSearch('');change({type:'all',phase:'all',q:''});}}>清空筛选</Button>}</div>}
   {cursor&&<Button className="ls-public-academic-more" loading={busy} disabled={busy} onClick={more}>加载更多</Button>}
  </>}
  <a className="ls-public-academic-home" href="/pages/p002/#community">返回门户</a>
 </section>;
}
