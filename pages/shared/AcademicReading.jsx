import React from 'react';
import {academicResourceHref} from '../../src/academic-content-client.js';
import './academic-content.css';

const types={news:'资讯',progress:'研究进展',notice:'项目通知',event:'活动'},phases={upcoming:'即将举行',ongoing:'进行中',past:'活动回顾',cancelled:'已取消'};
const date=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'';

export function AcademicReading({item,audience='public',preview=false,headingLevel=2}){
 const Heading=headingLevel===1?'h1':'h2',Subheading=headingLevel===1?'h2':'h3';
 return <article className="academic-reading"><p className="academic-meta">{types[item.type]}{item.event?.phase?' · '+phases[item.event.phase]:''}{item.publishedAt?' · 发布于 '+date(item.publishedAt):''}</p><Heading>{item.title||'未填写标题'}</Heading>{item.summary&&<p className="academic-summary">{item.summary}</p>}
  {item.type==='event'&&item.event&&<section className="academic-card" aria-label="活动安排"><Subheading>活动安排</Subheading><p>{date(item.event.startAt)} — {date(item.event.endAt)}（北京时间）</p><p>{item.event.speaker?'讲者：'+item.event.speaker:''}{item.event.organizer?'　组织：'+item.event.organizer:''}</p><p>{({online:'线上',offline:'线下',hybrid:'线上及线下'})[item.event.mode]} · {item.event.place}</p>{item.event.cancelled&&<p>已取消：{item.event.cancellationReason}</p>}</section>}
  <div className="academic-body">{item.body}</div><footer><p>来源：{item.source||'尚未填写'}</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看原始来源（外部网站）</a>}</footer>
  <section aria-label="活动及内容资料"><Subheading>资料与回放</Subheading>{item.resources?.length?<ul>{item.resources.map((r,i)=><li key={r.key??i}>{preview?<span>{r.label||'未命名资料'} · {r.audience==='public'?'公开':'仅成员'}</span>:<a href={academicResourceHref(audience,item.id,r.key)} target="_blank" rel="noopener noreferrer">{r.label}（前往原站）</a>}</li>)}</ul>:<p>{item.type==='event'?'暂无获准展示的资料或回放。':'暂无附加资料。'}</p>}</section>
 </article>;
}
