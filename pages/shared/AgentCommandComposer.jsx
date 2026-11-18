import React,{useEffect,useRef,useState} from 'react';
import AgentQuestion from './AgentQuestion.jsx';
import {Button} from './Components.jsx';
import useAgentCommands from './useAgentCommands.js';
import {useRecordAgentHistory} from './AgentHistory.jsx';
import {agentCommandView} from '../../src/agent-command-view.js';
import {agentQuestionError,agentQuestionLength,AGENT_QUESTION_MAX_CHARACTERS} from '../../src/agent-question.js';
export default function AgentCommandComposer({client,sessionId,paused=false,unavailable=false,inputUnavailable=unavailable,running=false,onRefresh,getSession,onPendingChange,initialQuestion='',label='研究问题',inputId='hub-agent-question',quota,networkIntent}){
 const [question,setQuestion]=useState(initialQuestion),[editing,setEditing]=useState(null),[editText,setEditText]=useState(''),[mutating,setMutating]=useState(false);
 const currentQuestion=useRef(question),composing=useRef(false);currentQuestion.current=question;
 const commands=useAgentCommands({client,sessionId,paused:paused||unavailable,onRefresh});
 const recordHistory=useRecordAgentHistory();
 const blocked=paused||unavailable||commands.restricted;
 const {primary,waiting}=agentCommandView({...commands,restricted:blocked},running,editing?.id);
 useEffect(()=>{onPendingChange?.(primary);},[primary,onPendingChange]);
 useEffect(()=>()=>onPendingChange?.(null),[onPendingChange]);
 const pending=waiting.filter(i=>i.status==='waiting'),clarifying=waiting.filter(i=>i.status==='paused'&&i.pauseCode==='HUB_SKILL_CLARIFICATION'),stopped=waiting.filter(i=>i.status==='paused'&&i.pauseCode!=='HUB_SKILL_CLARIFICATION');
 const counts=[['等待执行',pending.length],['需要补充',clarifying.length],['已暂停',stopped.length]].filter(([,count])=>count>0);
 const questionError=agentQuestionLength(question)>AGENT_QUESTION_MAX_CHARACTERS?agentQuestionError(question):'';
 const editError=agentQuestionLength(editText)>AGENT_QUESTION_MAX_CHARACTERS?agentQuestionError(editText):'';
 const cannotSend=blocked||commands.sending||commands.uncertain||Boolean(agentQuestionError(question));
 const submit=async event=>{event.preventDefault();if(cannotSend)return;const original=question;await commands.submit(original,getSession,confirmed=>{if(currentQuestion.current===original)setQuestion('');recordHistory?.(confirmed);},networkIntent);};
 const keyDown=event=>{
  if(event.key!=='Enter'||event.shiftKey||composing.current||event.nativeEvent.isComposing||event.keyCode===229)return;
  event.preventDefault();if(!event.repeat&&!cannotSend)event.currentTarget.form.requestSubmit();
 };
 const save=async()=>{if(!editing||mutating||agentQuestionError(editText))return;setMutating(true);try{if(await commands.edit(editing,editText))setEditing(null);}finally{setMutating(false);}};
 return <>
  {!!waiting.length&&<section className="agent-command-queue" aria-label="待执行指令">
   <div className="agent-command-heading"><b>{counts.map(([label,count],index)=><React.Fragment key={label}>{index>0?' / ':''}<span>{label} · {count}</span></React.Fragment>)}</b>{commands.paused&&<Button onClick={commands.resume} disabled={paused||unavailable}>继续队列</Button>}</div>
   {commands.uncertain&&<p role="alert">执行状态尚未确认，后续指令保持等待。</p>}
   <ol>{waiting.map((item,index)=><li key={item.id}>
    <div className="agent-command-label"><span>{item.status==='paused'?(item.pauseCode==='HUB_SKILL_CLARIFICATION'?'需要补充':'已暂停'):item.status==='waiting'?'等待 '+(pending.findIndex(i=>i.id===item.id)+1):'已开始执行'}</span><div>
     <Button onClick={()=>{setEditing(item);setEditText(item.text);}} disabled={paused||unavailable||!['waiting','paused'].includes(item.status)}>编辑</Button>
     <Button onClick={()=>commands.cancel(item)} disabled={paused||unavailable||!['waiting','paused'].includes(item.status)}>删除</Button>
    </div></div>
    {item.networkIntent?.enabled&&<small className="agent-network-label">智能搜索</small>}
    {editing?.id===item.id?<><AgentQuestion aria-label="修改待执行指令" value={editText} aria-invalid={Boolean(editError)} aria-describedby={editError?inputId+'-edit-error':undefined} onChange={e=>setEditText(e.target.value)} disabled={paused||unavailable}/>{editError&&<p id={inputId+'-edit-error'} role="alert">{editError}</p>}<div className="agent-command-actions"><Button onClick={()=>setEditing(null)}>取消修改</Button><Button onClick={save} disabled={mutating||paused||unavailable||Boolean(agentQuestionError(editText))||!['waiting','paused'].includes(item.status)}>保存修改</Button></div></>:<p>{item.text}</p>}
    {item.errorMessage&&<p role="alert">{item.errorMessage}</p>}
   </li>)}</ol>
  </section>}
  {commands.error&&<p role="alert">{commands.error} <Button onClick={commands.refresh} disabled={paused||unavailable}>重新获取状态</Button></p>}
  <form onSubmit={submit}><label htmlFor={inputId}>{label}</label>
   <AgentQuestion id={inputId} value={question} aria-invalid={Boolean(questionError)} aria-describedby={questionError?inputId+'-error':undefined} onChange={e=>setQuestion(e.target.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={keyDown} placeholder="请输入研究问题" disabled={paused||inputUnavailable||commands.restricted}/>
   {questionError&&<p id={inputId+'-error'} role="alert">{questionError}</p>}
   <Button type="submit" primary disabled={cannotSend}>{commands.sending?'正在确认提交…':'发送'}</Button>
  </form>
  {commands.uncertain&&<p role="status">发送结果尚未确认，问题已保留，不会自动重发。<Button onClick={commands.refresh} disabled={paused||unavailable}>重新获取状态</Button><Button onClick={commands.retryOriginal} disabled={paused||unavailable||commands.sending}>用原编号重试</Button></p>}
  {quota?.blocked&&<p role="status">{quota.message}</p>}
 </>;
}
