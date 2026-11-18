import {useEffect,useRef,useState} from 'react';
import {sameValue} from '../../src/formal-capture-session.js';
import {validVisitWorkflowSummary,visitReviewSelection,validVisitReviewBatch,visitWorkflowRoot,visitReviewMarkerKey,visitReviewParentKey,makeVisitReviewMarker,visitReviewResultProved,visitReviewBlockedProved,visitReviewInputHash,processVisitReviewBatch,visitReviewRejectedBeforeAcceptance,readVisitReviewStorage,persistVisitReviewMarker,clearVisitReviewMarker,withVisitReviewLock,readStoredVisitReview} from '../../src/visit-workflow-session.js';
const empty=()=>({scope:null,summary:null,batch:null,pending:null,busy:false,writing:false,error:'',notice:''});
const members=batch=>batch.items.map(x=>({assignmentId:x.assignmentId,expectedVersion:x.initialVersion,expectedRef:x.expectedRef}));
export default function useVisitWorkflow({route,session,onDirty,onExpanded}){
 const [state,setState]=useState(empty),current=useRef(empty()),epoch=useRef(0),running=useRef(false),writeHeld=useRef(false),resync=useRef(false),sessionRef=useRef(session);sessionRef.current=session;
 const update=next=>{current.current=typeof next==='function'?next(current.current):{...current.current,...next};setState(current.current);};
 const active=token=>token===epoch.current&&sessionRef.current.verified&&sessionRef.current.actor===current.current.scope?.actor;
 const request=(...args)=>sessionRef.current.request(...args);
 function savePending(marker){persistVisitReviewMarker(localStorage,marker);update({pending:marker});}
 function forgetPending(marker){if(!clearVisitReviewMarker(localStorage,current.current.scope,marker))throw Error('另一页面已更新处理记录，请重新核对。');update({pending:null});}
 function clearParent(batch){const s=current.current.scope,p=readVisitReviewStorage(localStorage,s).parent;if(p?.batchId===batch.batchId)localStorage.removeItem(visitReviewParentKey(s));}
 async function rememberBatch(batch){
  const s=current.current.scope,parent={version:1,...s,batchId:batch.batchId,membersHash:await visitReviewInputHash(members(batch))},old=readVisitReviewStorage(localStorage,s).parent;
  if(old&&old.batchId!==parent.batchId)throw Error('另一页面已有原处理记录，请先核对。');localStorage.setItem(visitReviewParentKey(s),JSON.stringify(parent));
 }
 async function readSummary(token){const s=current.current.scope,v=await request(visitWorkflowRoot(s));if(!active(token))return null;if(!validVisitWorkflowSummary(v,s))throw Error('当前访视审阅清单无法核对，请重新读取。');update({summary:v});return v;}
 async function receive(batch,marker,token){
  if(!active(token))return null;if(!validVisitReviewBatch(batch,current.current.scope))throw Error('本次处理结果无法核对，请保留原记录。');update({batch});
  const proved=await visitReviewResultProved(batch,marker),blocked=await visitReviewBlockedProved(batch,marker);if(!active(token))return null;
  if(!proved&&!blocked){update({notice:'',error:'原步骤尚未取得完成证明，请核对处理结果。'});return null;}
  const commit=async()=>{if(!active(token))return false;await rememberBatch(batch);if(!active(token))return false;forgetPending(marker);return true;};
  const committed=writeHeld.current===running.current?await commit():await withVisitReviewLock(globalThis.navigator?.locks,visitReviewMarkerKey(current.current.scope),commit,()=>false);
  if(!committed){if(active(token))update({notice:'已只读核对本次结果，另一页面仍在处理，请等待原页面完成。'});return batch;}
  if(batch.status==='completed'){clearParent(batch);update({notice:'所选表单已审核并锁定，请核对后完成访视。'});}
  if(blocked||batch.status==='blocked')update({notice:'',error:batch.error?.message||'部分表单尚未处理完成，请查看具体原因；已成功记录保留。'});
  return batch;
 }
 async function recoverInternal(token){
  const s=current.current.scope;update({pending:readVisitReviewStorage(localStorage,s).pending});const{pending,batch}=await readStoredVisitReview({storage:localStorage,scope:s,request,fallbackBatch:current.current.batch});if(!active(token)||!batch)return null;
  if(pending)return receive(batch,pending,token);
  update({batch,error:batch.error?.message||'',notice:batch.status==='completed'?'已核对原批次，所选表单已审核并锁定。':batch.canContinue?'已核对原批次，请明确继续尚未处理的表单。':'原批次尚未完成，请核对当前状态及阻断原因。'});if(batch.status==='completed')clearParent(batch);return batch;
 }
 async function perform(fn,write=false){
  if(running.current||!current.current.scope||!sessionRef.current.verified||sessionRef.current.blocked)return null;
  const token=epoch.current,execution=Symbol('visit-workflow');running.current=execution;if(write)onDirty?.('visitReview',true);update({busy:true,writing:write,error:''});
  const work=async()=>{
   if(!active(token))return null;
   if(write){const stored=readVisitReviewStorage(localStorage,current.current.scope);if(stored.pending||stored.parent&&stored.parent.batchId!==current.current.batch?.batchId){update({pending:stored.pending});await recoverInternal(token);update({notice:'已核对另一页面的处理记录，请明确继续。'});return null;}}
   if(write)writeHeld.current=execution;return fn(token);
  };
  try{return write?await withVisitReviewLock(globalThis.navigator?.locks,visitReviewMarkerKey(current.current.scope),work,()=>{update({notice:'另一页面正在处理本次访视，请稍后核对。'});return null;}):await work();}
  catch(error){if(active(token)&&!error.stale)update({error:current.current.pending?'本次结果尚未确认，请先核对处理结果。':error.message});return null;}
  finally{
   if(writeHeld.current===execution)writeHeld.current=false;
   if(running.current===execution){running.current=false;if(current.current.scope){update({busy:false,writing:false});if(token===epoch.current)onDirty?.('visitReview',!!current.current.pending);}if(resync.current&&current.current.scope){resync.current=false;queueMicrotask(()=>void perform(async latest=>{await recoverInternal(latest);if(active(latest))await readSummary(latest);}));}}
  }
 }
 async function post(marker,path,body,token){
  try{return await request(path,{method:'POST',body});}
  catch(error){
   if(active(token)&&visitReviewRejectedBeforeAcceptance(error,marker)&&sameValue(readVisitReviewStorage(localStorage,current.current.scope).pending,marker)){
    forgetPending(marker);await recoverInternal(token);if(active(token)){await readSummary(token);update({notice:'本次操作未受理，已重新核对当前记录。请重新选择，或明确继续原批次。',error:''});}return null;
   }
   throw error;
  }
 }
 async function loop(batch,token,explicit=false){
  const value=await processVisitReviewBatch(batch,async previous=>{
   const s=current.current.scope,requestKey=crypto.randomUUID(),marker=await makeVisitReviewMarker(s,'advance',{requestKey,batch:previous});if(!active(token))return null;savePending(marker);
   const response=await post(marker,visitWorkflowRoot(s)+'/batches/'+previous.batchId+'/advance',{requestKey,expectedStateHash:previous.stateHash},token);return response?receive(response,marker,token):null;
  },()=>{},()=>active(token),explicit);
  if(active(token)){await sessionRef.current.load();if(active(token))await readSummary(token);}return value;
 }
 const start=ids=>perform(async token=>{
  if(current.current.pending||current.current.batch&&current.current.batch.status!=='completed')throw Error('请先核对原批次。');const s=current.current.scope,summary=current.current.summary,items=visitReviewSelection(summary,ids),requestKey=crypto.randomUUID(),marker=await makeVisitReviewMarker(s,'create',{requestKey,items});if(!active(token))return null;savePending(marker);
  const response=await post(marker,visitWorkflowRoot(s)+'/batches',{requestKey,expectedSummaryHash:summary.summaryHash,items},token),batch=response?await receive(response,marker,token):null;return batch?loop(batch,token):null;
 },true);
 const load=()=>perform(readSummary);
 const recover=()=>perform(async token=>{const batch=await recoverInternal(token);if(batch&&active(token)){await sessionRef.current.load();if(active(token))await readSummary(token);}return batch;});
 const resume=()=>perform(token=>current.current.pending?recoverInternal(token):loop(current.current.batch,token,true),true);
 const resetBlocked=()=>perform(async token=>{if(current.current.pending||current.current.batch?.status!=='blocked')return null;clearParent(current.current.batch);update({batch:null,notice:'原处理记录保留，请重新核对当前表单后选择。'});return readSummary(token);},true);
 useEffect(()=>{
  const token=++epoch.current;running.current=false;resync.current=false;update(empty());if(!route?.visitId||!session.verified||!session.actor)return;
  let live=true;request('/auth/me').then(async me=>{
   if(!live||token!==epoch.current||me.accountId!==sessionRef.current.actor||typeof me.tenantId!=='string'||!Number.isSafeInteger(me.authVersion))return;
   const scope={tenantId:me.tenantId,actor:me.accountId,authVersion:me.authVersion,studyId:route.studyId,visitId:route.visitId};update({scope});
   const stored=readVisitReviewStorage(localStorage,scope);if(stored.pending||stored.parent){update({pending:stored.pending});onExpanded?.(true);await perform(async latest=>{await recoverInternal(latest);if(active(latest))await readSummary(latest);});}
  }).catch(e=>{if(live&&token===epoch.current&&!e.stale)update({error:e.message});});
  return()=>{live=false;epoch.current++;};
 },[route?.studyId,route?.visitId,session.actor,session.verified]);
 useEffect(()=>{
  const changed=event=>{
   const s=current.current.scope;if(!s||event.storageArea!==localStorage||![visitReviewMarkerKey(s),visitReviewParentKey(s)].includes(event.key))return;
   epoch.current++;try{const stored=readVisitReviewStorage(localStorage,s);update({pending:stored.pending,notice:'另一页面更新了本次处理，正在只读核对。'});}catch(e){update({error:e.message});return;}
   onExpanded?.(true);if(running.current){resync.current=true;return;}void perform(async token=>{await recoverInternal(token);if(active(token))await readSummary(token);});
  };window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[]);
 useEffect(()=>{onDirty?.('visitReview',state.writing||!!state.pending);return()=>onDirty?.('visitReview',false);},[state.writing,state.pending,onDirty]);
 return{...state,load,start,recover,resume,resetBlocked,blocked:state.busy||!!state.pending};
}
