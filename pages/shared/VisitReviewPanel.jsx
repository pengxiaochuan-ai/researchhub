import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {ReadAnswers,FormPresentation} from './CaptureFields.jsx';
import {schemaFields,displayScore,captureUrl} from '../../src/formal-capture-session.js';
import {reviewItemEligible,visitReviewAwaitingIndependent,visitReviewSelection,visitReviewRows,visitReviewViewBinding} from '../../src/visit-workflow-session.js';
const stateLabel={pending:'尚未处理',unknown:'结果待核对',completed:'本次处理已记录',blocked:'未完成'};
export default function VisitReviewPanel({route,session,workflow,expanded,onExpand,onComplete}){
 const [selected,setSelected]=useState({epoch:0,ids:[]}),[confirm,setConfirm]=useState(null),[filter,setFilter]=useState('all'),host=useRef(null),loaded=useRef(null),view=useRef({epoch:0,binding:null,confirm:null}),batch=workflow.batch;
 const url=()=>[location.pathname,location.search,location.hash].map(x=>x??'').join(''),binding=visitReviewViewBinding(workflow.summary,workflow.scope,session,route,url()),activeBatch=batch&&batch.status!=='completed';
 if(view.current.binding!==binding||view.current.activeBatch!==!!activeBatch||view.current.pending!==!!workflow.pending){view.current.binding=binding;view.current.activeBatch=!!activeBatch;view.current.pending=!!workflow.pending;view.current.epoch++;view.current.confirm=null;}
 view.current.props={route,session,workflow};const epoch=view.current.epoch,summary=binding?workflow.summary:null,ids=selected.epoch===epoch?selected.ids:[],rows=summary?visitReviewRows(summary,filter):[];
 const clearSelection=()=>{setSelected({epoch:view.current.epoch,ids:[]});view.current.confirm=null;setConfirm(null);};
 const available=p=>!p.session.blocked&&!p.workflow.blocked&&!p.workflow.busy&&!p.workflow.pending&&(!p.workflow.batch||p.workflow.batch.status==='completed');
 const current=saved=>{const p=view.current.props;return view.current.confirm===saved&&saved.epoch===view.current.epoch&&available(p)&&visitReviewViewBinding(p.workflow.summary,p.workflow.scope,p.session,p.route,url())===saved.binding;};
 const changeFilter=next=>{if(next!==filter){view.current.epoch++;clearSelection();setFilter(next);}};
 const openConfirm=()=>{const p=view.current.props;if(!binding||!available(p)||visitReviewViewBinding(p.workflow.summary,p.workflow.scope,p.session,p.route,url())!==binding)return;try{visitReviewSelection(summary,ids);}catch{return;}const next={items:chosen,ids:[...ids],binding,epoch,trigger:document.activeElement};view.current.confirm=next;setConfirm(next);};
 const visibleConfirm=confirm&&current(confirm)?confirm:null;
 useEffect(clearSelection,[binding]);
 useEffect(()=>{
  if(!expanded){loaded.current=null;return;}const key=workflow.scope&&JSON.stringify(workflow.scope);
  if(key&&!session.blocked&&!workflow.busy&&(!loaded.current||loaded.current.key!==key||loaded.current.revision!==session.revision)){loaded.current={key,revision:session.revision};clearSelection();void workflow.load();}
 },[expanded,workflow.scope,session.revision,session.blocked,workflow.busy]);
 const blocked=session.blocked||workflow.blocked,chosen=summary?.items.filter(x=>ids.includes(x.assignmentId))??[],overLimit=chosen.length>(summary?.maxBatchItems??20),waitingIndependent=summary?.canStartBatch===false&&summary.items.some(visitReviewAwaitingIndependent);
 const reviewState=item=>item.unavailable?'暂不可核对':item.response?.locked?'已锁定':item.response?.review==='review_approved'?'已审核，待锁定':item.response?.status==='submitted'?'已提交，待审阅':'尚未提交';
 return <div ref={host} id="visit-review" tabIndex={-1} style={{scrollMarginTop:'calc(var(--layout-topbar) + 16px)'}} className="fc-review-panel">
  <Button className="fc-review-toggle" aria-expanded={expanded} aria-controls="visit-review-content" disabled={session.blocked||workflow.busy} onClick={()=>onExpand(!expanded)}>集中审阅本次访视</Button>
  {expanded&&<div id="visit-review-content">
   <p>{waitingIndependent?'已提交，待独立审阅。可在下方回看本次表单。':summary?.canStartBatch===false?'可在下方回看本次表单及审阅状态。':'请按原题和答案逐份核对，再选择本次审核与锁定的表单。访视完成仍需另行确认。'}</p>
   {workflow.error&&<p role="alert">{workflow.error}</p>}{workflow.notice&&<p role="status">{workflow.notice}</p>}
   {workflow.busy&&<p role="status">正在核对或处理本次记录…</p>}
   {!summary&&!workflow.busy&&<Button disabled={session.blocked||!workflow.scope} onClick={()=>void workflow.load()}>读取本次审阅清单</Button>}
   {workflow.pending&&<Button disabled={session.blocked||workflow.busy} onClick={()=>void workflow.recover()}>核对处理结果</Button>}
   {batch&&<section className="fc-review-progress" aria-live="polite"><h4 id="visit-review-result" tabIndex={-1} style={{scrollMarginTop:'calc(var(--layout-topbar) + 16px)'}}>本次处理结果</h4><p>{batch.completedCount} / {batch.items.length} 份已处理{batch.status==='completed'?'。':'，请核对下列状态。'}</p>{batch.error?.message&&<p role="alert">{batch.error.message}</p>}<ul>{batch.items.map(item=><li key={item.assignmentId}><strong>{item.title}</strong> · {stateLabel[item.status]||'待核对'}{item.error?.message&&<p>{item.error.message}</p>}</li>)}</ul>
    {batch.status==='completed'&&onComplete&&<div className="ep-actions"><Button data-visit-complete="true" primary disabled={blocked} onClick={onComplete}>完成访视</Button></div>}
    {!workflow.pending&&batch.canContinue&&<Button primary disabled={blocked} onClick={()=>void workflow.resume()}>继续处理剩余表单</Button>}
    {!workflow.pending&&batch.status==='processing'&&<Button disabled={blocked} onClick={()=>void workflow.recover()}>核对处理结果</Button>}
    {!workflow.pending&&batch.status==='blocked'&&<Button disabled={blocked} onClick={()=>void workflow.resetBlocked()}>重新核对当前表单</Button>}
   </section>}
   {summary&&<>{summary.visit.visitPlan?.requirements?.some(r=>r.kind!=='form_response')&&<section className="fc-review-progress"><h4>其他采集要求</h4><p>表单审核不代替文件、处理记录及其他必采要求。</p><ul>{summary.visit.visitPlan.requirements.filter(r=>r.kind!=='form_response').map(r=>{const status=summary.visit.fulfillments?.find(f=>f.visitRequirementId===r.id)?.status;return <li key={r.id}><strong>{r.name}</strong> · {r.required?'必采':'选采'} · {({satisfied:'已满足',waived:'已豁免',not_applicable:'不适用',pending:'待核对',missing:'未完成'})[status]||'待核对'} <a href="#visit-files" onClick={()=>{const node=document.getElementById('visit-files'),details=node?.querySelector('details');if(details)details.open=true;node?.scrollIntoView({block:'start'});node?.focus({preventScroll:true});}}>查看文件与处理记录</a></li>;})}</ul></section>}<div className="ep-actions" role="group" aria-label="审阅清单筛选"><Button primary={filter==='all'} aria-pressed={filter==='all'} onClick={()=>changeFilter('all')}>全部</Button><Button primary={filter==='attention'} aria-pressed={filter==='attention'} onClick={()=>changeFilter('attention')}>需关注</Button></div><ul className="fc-review-items">{rows.map(({item,reasons})=>{const fields=schemaFields(item.formVersion?.schema),eligible=reviewItemEligible(item),labels=reasons.filter(x=>x!==reviewState(item));return <li className="fc-review-item" key={item.assignmentId}>
    <h4>{item.title} · {item.required?'必采':'选采'}</h4><p>{reviewState(item)} · {item.mode==='patient_h5'?'受试者自填':'研究人员录入'}{item.response?.ref?' · 第'+item.response.ref.revisionNo+'次修订':''}</p>
    {labels.length>0&&<p>需关注：{labels.join('；')}</p>}
    <FormPresentation presentation={item.formVersion?.schema?.presentation}/>{item.response&&<><p>评分：{displayScore(item.response.score,fields)}</p><ReadAnswers fields={fields} answers={item.response.answers??{}}/></>}
    {item.unavailable?.message&&item.unavailable.message!==reviewState(item)&&<p>{item.unavailable.message}</p>}{!eligible&&visitReviewAwaitingIndependent(item)&&<p>待其他人员审阅。</p>}
    {eligible&&<label className="fc-review-select"><input type="checkbox" checked={ids.includes(item.assignmentId)} disabled={blocked||activeBatch} onChange={e=>setSelected({epoch,ids:e.target.checked?[...ids,item.assignmentId]:ids.filter(id=>id!==item.assignmentId)})}/>已核对此份{item.action==='lock'?'，仅锁定':'，审核通过并锁定'}</label>}
    <div className="ep-actions"><a href={captureUrl('s09',route.studyId,{visitId:route.visitId,assignmentId:item.assignmentId})}>查看原表、更正与历史</a><a href={captureUrl('s05',route.studyId,{assignmentId:item.assignmentId})}>查看此表单的数据疑问</a></div>
   </li>;})}</ul>{!summary.items.length?<p>本次访视暂无已分配表单，请按采集要求继续。</p>:!rows.length&&<p>本清单暂无明确关注标记，仍需逐份核对。</p>}
   {overLimit&&<p role="alert">本次最多处理{summary.maxBatchItems??20}份，请减少选择后再确认。</p>}
   {!activeBatch&&!workflow.pending&&<div className="ep-actions">{summary.canStartBatch&&<Button primary disabled={blocked||!chosen.length||overLimit} onClick={openConfirm}>{chosen.length&&chosen.every(x=>x.action==='lock')?'锁定已核对表单':'审核通过并锁定'}</Button>}<Button disabled={blocked} onClick={()=>void workflow.load()}>重新核对清单</Button></div>}
   </>}
   {onComplete&&batch?.status!=='completed'&&<div className="ep-actions"><Button data-visit-complete="true" primary disabled={blocked} onClick={onComplete}>完成访视</Button></div>}
  </div>}
  {visibleConfirm&&<ConfirmDialog title="审核并锁定所选表单？" confirmLabel="确认本次处理" danger={false} returnFocus={confirm.trigger} fallbackFocus={host.current} confirmDisabled={blocked} onCancel={()=>{if(view.current.confirm===confirm){view.current.confirm=null;setConfirm(null);}}} onConfirm={()=>{if(!current(confirm))return;const p=view.current.props;try{visitReviewSelection(p.workflow.summary,confirm.ids);}catch{return;}view.current.confirm=null;setConfirm(null);void p.workflow.start(confirm.ids);}}><p>本次仅针对以下{confirm.items.length}份已核对的修订。锁定后更改须按权限解锁并填写原因；已经审核通过的修订只补锁定。</p><ul>{confirm.items.map(item=><li key={item.assignmentId}>{item.title} · 第{item.response.ref.revisionNo}次修订</li>)}</ul></ConfirmDialog>}
 </div>;
}
