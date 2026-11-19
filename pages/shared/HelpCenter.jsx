import React,{useState} from 'react';
import {Button} from './Components.jsx';
import {HELP_CATEGORIES,HELP_STATUS,HELP_UPDATED,getHelpArticle,searchHelpArticles} from './help-content.js';
import './help-center.css';

function HelpBanner({detail=false}){
 const Title=detail?'p':'h1';
 return <div className="ls-help-banner"><div className="ls-help-banner-copy"><Title className={detail?'ls-help-banner-title':undefined}>帮助你顺利开展研究</Title><p className="ls-help-banner-intro">从加入平台到完成课题，按任务查找操作指引。</p></div></div>;
}

export function HelpCenter(){
 const [query,setQuery]=useState(''),[category,setCategory]=useState('全部');
 const visible=searchHelpArticles(query,category);
 return <div className="ls-help-center">
  <section className="ls-page-hero"><HelpBanner/><label className="ls-help-search">搜索帮助<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索注册、课题、访视、文献或资产" maxLength={200}/></label></section>
  <div className="ls-help-filters" role="group" aria-label="帮助分类">{['全部',...HELP_CATEGORIES].map(value=><Button key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</Button>)}</div>
  <p role="status" className="ls-help-count">{visible.length} 篇帮助文章</p>
  <div className="ls-info-grid">{visible.map(article=><section key={article.id} className="ls-help-card"><div className="ls-help-card-meta"><small>{article.category}</small><span className={'ls-help-state '+(article.status==='planned'?'planned':'')}>{HELP_STATUS[article.status]}</span></div><h2><a href={'/pages/p009/?article='+article.id}>{article.title}</a></h2><p>{article.summary}</p></section>)}</div>
  {!visible.length&&<section className="ls-empty"><h2>未找到相关帮助</h2><p>试试“注册”“课题”或“访视”，也可以清空关键词或切换分类。</p></section>}
  <section className="ls-mode-note ls-help-support"><p>遇到问题时，请记录页面、操作步骤和提示信息，交由研究负责人或平台管理员处理。</p><a href="/pages/p009/?article=troubleshooting">查看问题处理指引</a></section>
 </div>;
}

export function HelpArticle(){
 const article=getHelpArticle(new URLSearchParams(location.search).get('article'));
 if(!article)return <div className="ls-help-detail"><HelpBanner detail/><article className="ls-article ls-help-article"><h1>帮助文章不存在</h1><p>请返回帮助中心重新查找。</p><a className="ls-primary" href="/pages/p008/">返回帮助中心</a></article></div>;
 return <div className="ls-help-detail"><HelpBanner detail/><article className="ls-article ls-help-article">
  <a href="/pages/p008/">返回帮助中心</a>
  <div className="ls-help-article-meta"><span>{article.category}</span><span className={'ls-help-state '+(article.status==='planned'?'planned':'')}>{HELP_STATUS[article.status]}</span></div>
  <h1>{article.title}</h1><p className="ls-help-article-summary">{article.summary}</p>
  <p className="ls-help-audience">适用对象：{article.audience}<br/>更新于{HELP_UPDATED}</p>
  {article.status==='planned'&&<p className="ls-mode-note">以下是后续完善方向，当前尚未开放相应操作。开放范围明确后会更新使用指引。</p>}
  {article.sections.map(section=><section className="ls-help-article-section" key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}{section.steps&&<ol>{section.steps.map(text=><li key={text}>{text}</li>)}</ol>}</section>)}
  {article.action&&<div className="ls-help-article-action"><a className="ls-primary" href={article.action.href}>{article.action.label}</a></div>}
 </article></div>;
}
