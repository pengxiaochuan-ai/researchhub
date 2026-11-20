import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MoreHorizontal,Pencil,Pin,PinOff,Trash2} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog.jsx';
import {articleAiHref,readArticleAiRoute} from '../../src/article-ai-session.js';
import {studyDataHistoryHref} from '../../src/study-data-navigation.js';
import {agentHistoryTitle} from '../../src/agent-history-timeline.js';
export default function AgentHistoryRow({item,selectedId,navigate,client,paused,onChanged,fallbackFocus}){
 const [menu,setMenu]=useState(null),[dialog,setDialog]=useState(null),[title,setTitle]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const trigger=useRef(null),popup=useRef(null),saving=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const close=()=>{setMenu(null);trigger.current?.focus();};
 useEffect(()=>{if(!menu)return;popup.current?.querySelector('button')?.focus();const outside=e=>{if(!popup.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null);};const escape=e=>{if(e.key==='Escape'){e.preventDefault();close();}};const move=()=>setMenu(null);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',move);window.addEventListener('scroll',move,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true);};},[menu]);
 useEffect(()=>{if(paused){setMenu(null);setDialog(null);}},[paused]);
 function open(){if(menu){close();return;}const r=trigger.current.getBoundingClientRect();setError('');setMenu({left:Math.max(8,Math.min(window.innerWidth-164,r.right-148)),top:Math.max(8,Math.min(window.innerHeight-164,r.bottom+4))});}
 function choose(action){setMenu(null);setError('');if(action==='pin'){void save({action:'pin',pinned:!item.pinned});}else{setTitle(item.title??'');setDialog(action);}}
 async function save(body){if(saving.current||paused)return;saving.current=true;setBusy(true);setError('');try{await client.patch(`/sessions/${item.id}/history-action`,body);if(!live.current)return;setDialog(null);onChanged(item,body.action);if(body.action==='delete'&&item.id===selectedId)navigate?.('/pages/ai01/');}catch(e){if(live.current)setError(e.message||'操作结果暂时无法核对，请刷新会话列表后查看。');}finally{saving.current=false;if(live.current)setBusy(false);}}
 const href=item.kind==='article'?articleAiHref(item.recordId,item.recovery):studyDataHistoryHref(item.id,readArticleAiRoute(globalThis.location?.search??''));
 return <div className={'agent-history-row'+(selectedId===item.id?' selected':'')}>
  <a className={'conv'+(selectedId===item.id?' selected':'')} title={item.title} aria-label={(item.title||'新对话')+' · '+(item.kind==='article'?'文章解读':'Hub 问答')} aria-current={selectedId===item.id?'page':undefined} href={href} onClick={e=>{if(navigate&&!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(href);}}}><b>{agentHistoryTitle(item.title)}</b><span>{item.kind==='article'?'文章解读':'Hub 问答'}</span></a>
  <button type="button" className="history-more" ref={trigger} aria-label={'更多操作：'+(item.title||'新对话')} aria-haspopup="menu" aria-expanded={Boolean(menu)} disabled={paused||busy} onClick={open}><MoreHorizontal size={18}/></button>
  {error&&!dialog&&<p className="history-action-error" role="alert">{error}</p>}
  {menu&&createPortal(<div ref={popup} className="history-action-menu" role="menu" aria-label="会话操作" style={menu} onKeyDown={e=>{const buttons=[...popup.current.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Tab')setMenu(null);}}>
   <button role="menuitem" onClick={()=>choose('rename')}><Pencil size={18}/>重命名</button>
   <button role="menuitem" onClick={()=>choose('pin')}>{item.pinned?<PinOff size={18}/>:<Pin size={18}/>}{item.pinned?'取消置顶':'置顶'}</button>
   <button role="menuitem" className="danger" onClick={()=>choose('delete')}><Trash2 size={18}/>删除</button>
  </div>,document.body)}
  {dialog&&<ConfirmDialog title={dialog==='rename'?'重命名会话':'删除会话'} confirmLabel={busy?'正在保存…':dialog==='rename'?'保存':'删除'} danger={dialog==='delete'} busy={busy} confirmDisabled={dialog==='rename'&&(!title.trim()||[...title.trim()].length>100)} returnFocus={trigger.current} fallbackFocus={fallbackFocus} onCancel={()=>{setDialog(null);setError('');}} onConfirm={()=>save(dialog==='rename'?{action:'rename',title}:{action:'delete'})}>
   {dialog==='rename'?<label className="history-title-label">会话名称<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&title.trim()&&[...title.trim()].length<=100){e.preventDefault();void save({action:'rename',title});}}}/><small>1–100字</small></label>:<p>删除“{item.title}”后，会话将从历史记录中移除。已导入的被试档案、研究数据和科研产物保留。</p>}
   {error&&<p role="alert">{error}</p>}
  </ConfirmDialog>}
 </div>;
}
