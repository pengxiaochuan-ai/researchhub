import React,{useEffect,useRef} from 'react';
export default function AgentPendingMessage({command,messages=[]}){
 const ref=useRef(null);
 useEffect(()=>{
  const node=ref.current,thread=node?.closest('.thread');if(!thread)return;
  thread.scrollTop+=node.getBoundingClientRect().top-thread.getBoundingClientRect().top;
 },[command?.id]);
 if(!command||messages.some(m=>m.id===command.id))return null;
 return <article ref={ref} className="agent-message agent-user-message agent-pending-message" aria-label="我的问题">
  <b>我的问题</b><p>{command.text}</p><p role="status">正在处理…</p>
 </article>;
}
