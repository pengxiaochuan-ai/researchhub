import AgentHistoryRow from './AgentHistoryRow.jsx';
import React,{createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {articleAiHref} from '../../src/article-ai-session.js';
import {agentHistoryTitle,groupAgentHistory,applyHistoryCommand} from '../../src/agent-history-timeline.js';
const HistoryContext=createContext(null);
const empty=()=>({items:[],page:0,kind:'loading'});
export function AgentHistoryProvider({children,navigate,refreshKey=0}){
 const [state,setState]=useState(empty),request=useRef(0),scroll=useRef(0),updates=useRef(new Map());
 const mergeRecords=useCallback(items=>{for(const record of updates.current.values())items=applyHistoryCommand(items,record);return items;},[]);
 const recordCommand=useCallback(record=>{
  if(!record?.sessionId||typeof record.text!=='string'||!Number.isFinite(new Date(record.createdAt).getTime()))return;
  const previous=updates.current.get(record.sessionId),next={...record,text:previous?.text??record.text};updates.current.set(record.sessionId,next);
  setState(s=>({...s,items:applyHistoryCommand(s.items,next)}));
 },[]);
 return <HistoryContext.Provider value={{state,setState,request,navigate,refreshKey,scroll,recordCommand,mergeRecords}}>{children}</HistoryContext.Provider>;
}
export const useRecordAgentHistory=()=>useContext(HistoryContext)?.recordCommand;
export default function AgentHistory({client,paused,selectedId,refreshKey}){
 const shared=useContext(HistoryContext),[local,setLocal]=useState(empty),[attempt,setAttempt]=useState(0),localRequest=useRef(0);
 const state=shared?.state??local,setState=shared?.setState??setLocal,request=shared?.request??localRequest,heading=useRef(null);
 useLayoutEffect(()=>{
  const pane=heading.current?.closest('.conversationList');if(!shared||!pane)return;
  pane.scrollTop=shared.scroll.current;
  const save=()=>{shared.scroll.current=pane.scrollTop;};pane.addEventListener('scroll',save);
  return()=>{save();pane.removeEventListener('scroll',save);};
 },[]);
 useEffect(()=>{
  let active=true;if(paused){setState(empty());return()=>{active=false;};}
  ++request.current;
  setState(s=>s.kind==='ready'?{...s,loading:false,moreError:false}:empty());
  client.get('/sessions/hub-source/history?page=1&limit=20').then(r=>{if(active)setState({...r,items:shared?.mergeRecords(r.items)??r.items,kind:'ready',revision:shared?.refreshKey});}).catch(error=>{if(active)setState(s=>![401,403].includes(error?.status)&&s.items.length?{...s,refreshError:true}:{...empty(),kind:'error'});});
  return()=>{active=false;};
 },[client,paused,refreshKey,shared?.refreshKey,attempt]);
 useEffect(()=>()=>{request.current++;},[client,paused,refreshKey,attempt]);
 const more=async()=>{const turn=++request.current;setState(s=>({...s,loading:true}));try{const r=await client.get(`/sessions/hub-source/history?page=${state.page+1}&limit=20`);if(turn===request.current)setState(s=>{const items=[...new Map([...s.items,...r.items].map(x=>[x.id,x])).values()];return{...r,revision:s.revision,items:shared?.mergeRecords(items)??items,kind:'ready'};});}catch(error){if(turn===request.current)setState(s=>[401,403].includes(error?.status)?{...empty(),kind:'error'}:{...s,loading:false,moreError:true});}};
 return <><div ref={heading} tabIndex={-1} className="dateLabel">本人历史会话</div>{state.kind==='loading'?<p role="status">正在读取会话…</p>:state.kind==='error'?<p role="alert">暂时无法读取会话。<button onClick={()=>setAttempt(x=>x+1)}>重新读取</button></p>:<>
  {!state.items.length&&<p>暂无历史会话。</p>}{groupAgentHistory(state.items).map(group=><section className="agent-history-group" aria-label={group.label} key={group.label}><h3>{group.label}</h3>{group.items.map(item=><AgentHistoryRow key={item.id} item={item} selectedId={selectedId} navigate={shared?.navigate} client={client} paused={paused} fallbackFocus={heading.current} onChanged={()=>{setAttempt(x=>x+1);}}/>)}</section>)}
  {state.hasMore&&<button type="button" onClick={more} disabled={state.loading||paused}>{state.loading?'正在读取…':'加载更多会话'}</button>}{state.moreError&&<p role="alert">读取失败，请重新加载更多。</p>}
  {state.refreshError&&<p role="alert">历史会话更新失败。<button onClick={()=>setAttempt(x=>x+1)}>重新读取</button></p>}
 </>}</>;
}
