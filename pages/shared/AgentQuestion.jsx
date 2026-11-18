import React,{useEffect,useRef} from 'react';
export function fitAgentQuestion(element,style,viewportHeight){
 const min=parseFloat(style.minHeight),max=Math.max(min,Math.min(parseFloat(style.maxHeight),viewportHeight*.2));
 const border=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
 element.style.height='auto';const needed=element.scrollHeight+border;
 element.style.height=Math.max(min,Math.min(needed,max))+'px';element.style.overflowY=needed>max?'auto':'hidden';
}
export default function AgentQuestion(props){
 const ref=useRef(null);
 useEffect(()=>{
  const box=ref.current;if(!box)return;const fit=()=>fitAgentQuestion(box,getComputedStyle(box),window.innerHeight);fit();let width;
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next!==width){width=next;fit();}}):null;
  observer?.observe(box);window.addEventListener('resize',fit);return()=>{observer?.disconnect();window.removeEventListener('resize',fit);};
 },[props.value]);
 return <textarea {...props} ref={ref} rows={2}/>;
}
