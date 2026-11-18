import {createAcademicContentClient} from './academic-content-client.js';
import {academicHref} from './academic-content-route.js';

export function mountAcademicActivities(root,{fetchImpl=globalThis.fetch}={}){
 if(!root)return()=>{};
 const api=createAcademicContentClient({fetchImpl});let sequence=0,controller,disposed=false;
 const node=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
 async function load(){
  const n=++sequence;controller?.abort();controller=new AbortController();root.replaceChildren();const status=node('p','正在读取公开活动…');status.setAttribute('role','status');root.append(status);
  try{
   const value=await api.list('public',{type:'event',order:'portal',limit:'3'},{signal:controller.signal});if(disposed||n!==sequence)return;root.replaceChildren();
   if(!value.items.length){root.append(node('p','暂无已发布的公开活动。'));return;}
   const grid=node('div',null,'portal-academic-grid');
   for(const item of value.items){
    const card=node('article'),meta=node('p',({upcoming:'即将举行',ongoing:'进行中',past:'活动回顾',cancelled:'已取消'})[item.event.phase],'portal-academic-meta'),heading=node('h4'),link=node('a',item.title);link.href=academicHref({type:'event',id:item.id});heading.append(link);
    const time=new Date(item.event.startAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});card.append(meta,heading,node('p',item.summary),node('p',time+'（北京时间） · '+item.event.place));grid.append(card);
   }root.append(grid);
  }catch{if(disposed||n!==sequence)return;root.replaceChildren();const message=node('p','公开活动暂时无法读取，请稍后重试。');message.setAttribute('role','alert');const retry=node('button','重新读取','button outline');retry.type='button';retry.addEventListener('click',load);root.append(message,retry);}
 }
 const refresh=()=>{if(document.visibilityState==='visible')void load();};void load();window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);
 return()=>{disposed=true;sequence++;controller?.abort();window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);};
}
