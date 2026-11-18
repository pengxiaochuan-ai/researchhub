import {useEffect,useRef,useState} from 'react';
import {agentQuestionError} from '../../src/agent-question.js';
export default function useAgentCommands({client,sessionId,paused,onRefresh}){
 const [view,setView]=useState({items:[],paused:false}),[sending,setSending]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[ensured,setEnsured]=useState(null);
 const epoch=useRef(0),pending=useRef(null),posting=useRef(false),refreshRef=useRef(onRefresh),last=useRef(''),polling=useRef(false),accepted=useRef(null),resolver=useRef(null);
 refreshRef.current=onRefresh;const sid=sessionId??ensured;
 const readFailed=reason=>{
  setError(reason.message);
  if([401,403,404,409].includes(reason.status)){setView({items:[],paused:true,restricted:true});void Promise.resolve(refreshRef.current?.()).catch(()=>{});}
 };
 useEffect(()=>{++epoch.current;setSending(false);if(pending.current)setUncertain(true);return()=>{++epoch.current;};},[client,paused]);
 const read=async(id=sid)=>{
  if(!id||paused)return;const turn=epoch.current;
  const next=await client.get(`/sessions/${id}/commands`);if(turn!==epoch.current)return;
  setView({...next,restricted:false});const signature=next.items.map(i=>i.id+':'+i.status+':'+i.version).join('|');
  if(signature!==last.current||next.items.some(i=>['queued','processing'].includes(i.status))){last.current=signature;await refreshRef.current?.();}
  const found=pending.current&&[...next.items,...(next.recent??[])].find(i=>i.requestKey===pending.current.requestKey);
  if(found){const text=pending.current.text;pending.current=null;setUncertain(false);setError('');accepted.current?.({...found,sessionId:id,text});accepted.current=null;}
  return next;
 };
 useEffect(()=>{
  if(paused||!sid)return;let active=true,timer;
  const poll=async()=>{if(polling.current){timer=setTimeout(poll,500);return;}polling.current=true;try{await read(sid);}catch(reason){if(active)readFailed(reason);}finally{polling.current=false;if(active)timer=setTimeout(poll,1500);}};
  void poll();return()=>{active=false;clearTimeout(timer);};
 },[client,sid,paused]);
 const submit=async(text,getSession,onAccepted,networkIntent)=>{
  if(paused||posting.current)return false;
  const inputError=agentQuestionError(text);if(inputError){setError(inputError);return false;}
  if(pending.current&&pending.current.text!==text.trim()){setError('上一条发送结果尚未确认，请先核对原指令。当前输入已保留。');return false;}
  posting.current=true;setSending(true);setError('');const turn=epoch.current;
  if(!pending.current){pending.current={text:text.trim(),requestKey:'hub-command-'+crypto.randomUUID(),kbIds:[],networkIntent:{schema:'hub-network-intent.v1',enabled:networkIntent?.enabled===true}};resolver.current=getSession;}accepted.current=onAccepted;
  const operation=pending.current;
  try{
   const id=sid??await resolver.current();if(turn!==epoch.current)return false;if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw Object.assign(Error('会话尚未建立，请重新核对。'),{status:409});setEnsured(id);
   const confirmed=await client.post(`/sessions/${id}/commands`,operation);if(turn!==epoch.current)return false;
   pending.current=null;setUncertain(false);accepted.current?.({...confirmed,sessionId:id,text:operation.text});accepted.current=null;
   await read(id);return true;
  }catch(reason){if(turn===epoch.current){
    if(pending.current!==operation){setUncertain(false);return true;}
    const unknown=!reason.status||reason.status>=500;setUncertain(unknown);if(!unknown){pending.current=null;accepted.current=null;}setError(reason.message);}
   return false;
  }finally{posting.current=false;if(turn===epoch.current)setSending(false);}
 };
 const mutate=async(path,body,method='post',expectedItem)=>{
  if(paused||!sid)return false;const turn=epoch.current;
  try{await client[method](`/sessions/${sid}/commands`+path,body);if(turn!==epoch.current)return false;setError('');await read();return true;}
  catch(reason){
   if(turn!==epoch.current)return false;
   // A scheduler pause can change the version without changing the user's
   // instruction. Re-read once and retry only that same explicit edit/delete;
   // changed text, dispatched work, unknown results and model tasks never retry.
   if(reason.status===409&&expectedItem){try{
    const fresh=await read(),item=fresh?.items.find(i=>i.id===expectedItem.id);
    if(turn!==epoch.current)return false;
    if(item&&['waiting','paused'].includes(item.status)&&item.text===expectedItem.text&&item.requestKey===expectedItem.requestKey){
     await client[method](`/sessions/${sid}/commands`+path,{...body,version:item.version});if(turn!==epoch.current)return false;setError('');await read();return true;
    }
   }catch(next){reason=next;}}
   if(turn===epoch.current)setError(reason.message);return false;
  }
 };
 return{...view,sending,error,uncertain,submit,refresh:()=>read().then(()=>setError('')).catch(readFailed),
  retryOriginal:()=>pending.current?submit(pending.current.text,resolver.current,accepted.current):Promise.resolve(false),
  edit:(item,text)=>{const error=agentQuestionError(text);if(error){setError(error);return Promise.resolve(false);}return mutate('/'+item.id,{text,version:item.version},'patch',item);},cancel:item=>mutate('/'+item.id+'/cancellation',{version:item.version},'post',item),resume:()=>mutate('/resumption',{}),
 };
}
