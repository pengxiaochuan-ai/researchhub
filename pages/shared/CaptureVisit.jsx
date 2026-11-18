import CaptureFiles from './CaptureFiles.jsx';
import VisitReviewPanel from './VisitReviewPanel.jsx';
import useVisitWorkflow from './useVisitWorkflow.js';
import {nextVisitCapture,visitReviewAwaitingIndependent} from '../../src/visit-workflow-session.js';
import {getPlatformUser} from '../../src/platform-user.js';
import './visit-workflow.css';
import {formalTasksUrl} from '../../src/formal-tasks-session.js';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import CaptureConfirmation from './CaptureConfirmation.jsx';
import CaptureAssignment from './CaptureAssignment.jsx';
import CaptureEmailInvitation from './CaptureEmailInvitation.jsx';
import {captureModes} from '../../src/questionnaire-h5-session.js';
import {captureUrl} from '../../src/formal-capture-session.js';
import {subjectUrl} from '../../src/research-subjects-session.js';
export const visitStatus={planned:'计划中',due_soon:'即将到期',overdue:'已逾期',in_progress:'进行中',deviation:'有偏差',completed:'已完成',cancelled:'已取消'};
const fulfillmentStatus={missing:'未完成',satisfied:'已满足',waived:'已豁免',pending:'待核对',not_applicable:'不适用'};
export const date=value=>value?new Date(value).toLocaleDateString('sv-SE'):'等待安排';
export default function CaptureVisit({route,session,onDirty}){
 const visit=session.view.visit,[afterSubmit,setAfterSubmit]=useState(null),[confirm,setConfirm]=useState(null),[reason,setReason]=useState(''),reasonBase=useRef(null),[reviewOpen,setReviewOpen]=useState(()=>location.hash==='#visit-review'),[flowBusy,setFlowBusy]=useState(false),flowRunning=useRef(false),focusedAssignment=useRef(null),focusedCompletion=useRef(null),dirtyFields=useRef({}),[draftDirty,setDraftDirty]=useState(false);
 const markDirty=useCallback((key,value)=>{dirtyFields.current[key]=value;setDraftDirty(Object.entries(dirtyFields.current).some(([name,dirty])=>dirty&&!['visitReview','visitFlow','visitReason'].includes(name)));onDirty?.(key,value);},[onDirty]);
 const workflowRoute={...route,visitId:visit?.id},workflow=useVisitWorkflow({route:workflowRoute,session:{...session,blocked:session.blocked||draftDirty||flowBusy},onDirty:markDirty,onExpanded:setReviewOpen});
 useEffect(()=>{
  if(!afterSubmit)return;
  if(afterSubmit.actor!==session.actor||afterSubmit.authVersion!==session.authVersion||afterSubmit.studyId!==route.studyId||afterSubmit.visitId!==visit?.id||afterSubmit.assignmentId!==route.assignmentId){setAfterSubmit(null);return;}
  if(session.blocked||session.checking||workflow.blocked||flowBusy)return;
  setAfterSubmit(null);void continueCapture();
 },[afterSubmit,session.actor,session.authVersion,route.studyId,route.assignmentId,visit?.id,session.blocked,session.checking,workflow.blocked,flowBusy]);
 useEffect(()=>{
  const assignmentId=session.view.capture?.assignment.id;
  if(!assignmentId||assignmentId!==route.assignmentId||route.fixedRef||route.queryId||!session.verified||session.busy||session.checking||session.pending)return;
  const target=document.getElementById?.('fc-assignment-title'),key=JSON.stringify([session.actor,session.authVersion,route.studyId,visit?.id,assignmentId]);
  if(!target||focusedAssignment.current===key)return;
  let active=true;const frame=requestAnimationFrame(()=>{const user=getPlatformUser();if(!active||!target.isConnected||user.id!==session.actor||user.authVersion!==session.authVersion)return;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});focusedAssignment.current=key;});
  return()=>{active=false;cancelAnimationFrame(frame);};
 },[session.actor,session.authVersion,route.studyId,route.assignmentId,route.fixedRef,route.queryId,visit?.id,session.view.capture?.assignment.id,session.verified,session.busy,session.checking,session.pending]);
 useEffect(()=>{
  const batch=workflow.batch;
  if(!reviewOpen||!workflow.summary||batch?.status!=='completed'||!batch.batchId||!visit?.capabilities.canComplete||!session.verified||session.busy||session.checking||session.pending||workflow.blocked||workflow.busy)return;
  const target=document.getElementById?.('visit-review-result'),key=JSON.stringify([session.actor,session.authVersion,route.studyId,visit.id,batch.batchId]);
  if(!target||focusedCompletion.current===key)return;
  let active=true;const frame=requestAnimationFrame(()=>{const user=getPlatformUser();if(!active||!target.isConnected||user.id!==session.actor||user.authVersion!==session.authVersion)return;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});focusedCompletion.current=key;});
  return()=>{active=false;cancelAnimationFrame(frame);};
 },[reviewOpen,!!workflow.summary,workflow.batch?.batchId,workflow.batch?.status,workflow.blocked,workflow.busy,visit?.id,visit?.capabilities.canComplete,route.studyId,session.actor,session.authVersion,session.verified,session.busy,session.checking,session.pending]);
 function submitted(result){const receipt=result?.receipt;if(receipt?.action!=='form.submit'||receipt.targetId!==route.assignmentId||result.studyId!==route.studyId)return;setAfterSubmit({actor:session.actor,authVersion:session.authVersion,studyId:route.studyId,visitId:visit.id,assignmentId:route.assignmentId});}
 function openConfirm(action,expectedVersion){setConfirm({action,expectedVersion,operation:{actor:session.actor,authVersion:session.authVersion,studyId:route.studyId,visitId:visit.id,assignmentId:null,domain:'visit',action},trigger:document.activeElement});}
 if(!visit)return null;
 const operationBlocked=session.blocked||workflow.blocked||flowBusy,blocked=operationBlocked||draftDirty,childSession={...session,blocked:operationBlocked};
 function focus(id){requestAnimationFrame(()=>{const node=document.getElementById(id);node?.scrollIntoView({block:'start'});node?.focus({preventScroll:true});});}
 function openReview(){setReviewOpen(true);focus('visit-review');}
 async function continueCapture(start=false){
  if(flowRunning.current||session.blocked||workflow.blocked)return;flowRunning.current=true;setFlowBusy(true);onDirty?.('visitFlow',true);const actor=session.actor;
  try{
   if(start&&!await session.send('visit','start',{expectedVersion:visit.version},{visitId:visit.id}))return;
   const value=await session.request('/research-studies/'+route.studyId+'/visits/'+visit.id),current=value.visit;
   if(getPlatformUser().id!==actor||value.studyId!==route.studyId||current?.id!==visit.id||current.subject?.id!==visit.subject.id)return;
   const next=nextVisitCapture(current);
   if(next.kind==='open'){session.go(captureUrl('s09',route.studyId,{visitId:visit.id,assignmentId:next.assignmentId}));return;}
   if(next.kind==='assign'){
    const result=await session.send('visit','assign',{formVersionId:next.formVersionId},{visitId:visit.id});
    if(result&&getPlatformUser().id===actor)session.go(captureUrl('s09',route.studyId,{visitId:visit.id,assignmentId:result.result.id}));return;
   }
   if(next.kind==='requirement'){focus('capture-requirement-'+next.requirementId);return;}
   openReview();
  }catch(error){if(!error.stale)session.setError(error.message);}finally{flowRunning.current=false;setFlowBusy(false);onDirty?.('visitFlow',false);}
 }
 const next=nextVisitCapture(visit),inProgress=['in_progress','deviation'].includes(visit.status),completeInReview=reviewOpen&&!!workflow.summary&&visit.capabilities.canComplete;
 const waitingIndependent=next.kind==='review'&&visit.status!=='completed'&&(workflow.summary?workflow.summary.canStartBatch===false&&workflow.summary.items.some(visitReviewAwaitingIndependent):visitReviewAwaitingIndependent(session.view.capture));
 async function command(action,expectedVersion=visit.version){if(blocked)return false;if(action==='reverify'&&!reason.trim())return session.setError('请填写重新核对的原因。');return session.send('visit',action,{expectedVersion,...(action==='reverify'?{reason:reason.trim()}:{})},{visitId:visit.id,assignmentId:null});}
 function completed(){setReason('');reasonBase.current=null;onDirty?.('visitReason',false);setConfirm(null);}
 async function assign(requirement){if(blocked)return;const result=await session.send('visit','assign',{formVersionId:requirement.config.formVersionId},{visitId:visit.id});if(result)session.go(captureUrl('s09',route.studyId,{visitId:visit.id,assignmentId:result.result.id}));}
 return <><section className="fc-visit-summary"><h2>{visit.subject.subjectId} · {visit.visitPlan.name}</h2><p>{visitStatus[visit.status]||'状态待核对'} · {visit.scheduleState==='pending_anchor'?'等待起始事件后安排':date(visit.targetDate)}</p><p>访视窗口：{date(visit.windowStart)} 至 {date(visit.windowEnd)}</p>{visit.actualCompletedAt&&<p>完成日期：{date(visit.actualCompletedAt)}{visit.completionIntegrity==='requires_review'?' · 依据变化，待重新核对':visit.completionIntegrity==='legacy_unversioned'?' · 历史依据版本待核验':''}</p>}<div className="ep-actions"><a href={captureUrl('s09',route.studyId)+'#csv-import'}>批量录入</a><a href={formalTasksUrl({studyId:route.studyId})}>查看执行任务</a><a href={subjectUrl('s04',route.studyId,visit.subject.id)}>返回受试者详情</a><a href={captureUrl('s05',route.studyId,route.assignmentId?{assignmentId:route.assignmentId}:{})}>查看数据疑问</a>{visit.capabilities.canStart?<Button primary disabled={blocked} onClick={()=>void continueCapture(true)}>{visit.capabilities.canAssign?'开始采集':'开始访视'}</Button>:visit.completionIntegrity==='requires_review'?<Button primary disabled={blocked} onClick={openReview}>核对更正影响</Button>:visit.capabilities.canComplete?(completeInReview?null:<Button data-visit-complete="true" primary disabled={blocked} onClick={()=>openConfirm('complete',visit.version)}>完成访视</Button>):inProgress&&next.kind!=='review'?<Button primary disabled={blocked} onClick={()=>void continueCapture()}>继续采集</Button>:<Button primary disabled={blocked} onClick={openReview}>{visit.status==='completed'?'查看本次记录':waitingIndependent?'查看待审项':'集中审阅'}</Button>}</div>{waitingIndependent&&<p role="status">已提交，待独立审阅。</p>}</section><section className="fc-requirements"><h3>本次采集要求</h3><ul>{visit.visitPlan.requirements.map(r=>{const f=visit.fulfillments.find(x=>x.visitRequirementId===r.id),assignment=visit.assignments.find(a=>a.formVersionId===r.config?.formVersionId),modes=captureModes(r.config);return <li id={'capture-requirement-'+r.id} tabIndex={-1} key={r.id}><div><strong>{r.name}</strong> · {r.required?'必采':'选采'} · {fulfillmentStatus[f?.status]||'待核对'}</div>{r.kind==='form_response'?assignment?<a href={captureUrl('s09',route.studyId,{visitId:visit.id,assignmentId:assignment.id})}>{assignment.id===session.view.capture?.assignment.id?'当前表单':'打开表单'}</a>:visit.capabilities.canAssign&&r.config?.formVersionId&&modes.includes('researcher')?<Button disabled={blocked} onClick={()=>void assign(r)}>填写{r.name}</Button>:<p>{modes.includes('researcher')?'当前不能开始填写，请核对访视安排与参与条件。':modes.includes('patient_h5')?'本项由受试者自填。':'采集方式暂不可核对，请联系研究管理员。'}</p>:<p>此项请按研究安排完成，不能用表单提交代替。 <a href="#visit-files" onClick={()=>{const node=document.getElementById('visit-files');const details=node?.querySelector('details');if(details)details.open=true;focus('visit-files');}}>查看文件与处理记录</a></p>}{r.kind==='form_response'&&modes.includes('patient_h5')&&(!assignment||assignment.mode==='patient_h5')&&<CaptureEmailInvitation key={r.id} route={route} session={childSession} requirement={r} assignment={assignment} onDirty={markDirty}/>}</li>;})}</ul></section>{session.view.capture&&<CaptureAssignment key={session.view.capture.assignment.id+':'+session.revision} route={route} session={childSession} onDirty={markDirty} onSubmitted={submitted}/>}<div id="visit-files" tabIndex={-1}><CaptureFiles route={route} session={childSession} onDirty={markDirty}/></div><section className="fc-visit-complete"><h3>访视完成</h3><VisitReviewPanel route={workflowRoute} session={{...session,blocked:session.blocked||draftDirty||flowBusy}} workflow={workflow} expanded={reviewOpen} onExpand={setReviewOpen} onComplete={completeInReview?()=>openConfirm('complete',visit.version):undefined}/>{draftDirty&&<p>请先暂存或取消当前未保存输入，再集中审阅。</p>}{visit.status==='completed'?<p>{visit.completionIntegrity==='current'?'已完成，本次依据已核对。':visit.completionIntegrity==='requires_review'?'完成历史保留；当前依据已变化，需审阅、锁定后重新核对。':'完成历史保留；旧依据版本无法核验。'}</p>:<p>全部必采项满足后，由有权人员核对并完成本次访视。</p>}{visit.capabilities.canReverify&&<><label className="ep-label">重新核对原因<textarea maxLength={5000} value={reason} onChange={e=>{if(reasonBase.current===null)reasonBase.current=visit.version;setReason(e.target.value);onDirty('visitReason',Boolean(e.target.value));}}/></label>{reasonBase.current!==null&&reasonBase.current!==visit.version&&<p role="alert">访视已有变化，原因已保留。<Button disabled={blocked} onClick={()=>{reasonBase.current=null;setReason('');onDirty('visitReason',false);}}>核对后重新填写原因</Button></p>}<Button primary disabled={blocked||!reason.trim()||reasonBase.current!==null&&reasonBase.current!==visit.version} onClick={()=>openConfirm('reverify',reasonBase.current??visit.version)}>重新核对完成依据</Button></>}{confirm&&<CaptureConfirmation session={session} currentStudyId={route.studyId} operation={confirm.operation} disabled={blocked||visit.version!==confirm.expectedVersion||(confirm.action==='complete'?!visit.capabilities.canComplete:!visit.capabilities.canReverify)} title={confirm.action==='complete'?'确认完成本次访视？':'确认重新核对完成依据？'} confirmLabel="确认" danger={false} returnFocus={confirm.trigger} onCancel={()=>setConfirm(null)} onConfirm={()=>command(confirm.action,confirm.expectedVersion)} onCompleted={completed}><p>{visit.subject.subjectId} · {visit.visitPlan.name}</p><p>{confirm.action==='complete'?'将核对当前必采项、最新修订、审阅及锁定状态，并保留完成记录。':'将按当前要求和修订追加核对依据，保留原完成日期与历史依据。'}</p>{confirm.action==='reverify'&&<p>原因：{reason}</p>}</CaptureConfirmation>}</section></>;
}
