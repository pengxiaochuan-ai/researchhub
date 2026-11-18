import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {getPlatformUser} from '../../src/platform-user.js';

const markerKeys=['actor','authVersion','studyId','visitId','assignmentId','domain','action'];
export default function CaptureConfirmation({session,operation,currentStudyId=operation.studyId,disabled=false,children,onConfirm,onCompleted,onCancel,...dialogProps}){
 const running=useRef(false),live=useRef(null),openedLocation=useRef({pathname:location.pathname,search:location.search}),[working,setWorking]=useState(false),[feedback,setFeedback]=useState(''),[lookedUp,setLookedUp]=useState(false);
 const sameScope=currentStudyId===operation.studyId&&session.actor===operation.actor&&session.authVersion===operation.authVersion&&session.view?.visit?.id===operation.visitId;
 live.current={session,sameScope,onCompleted};
 useEffect(()=>session.holdConfirmation(),[session.holdConfirmation]);
 function contextCurrent(){const user=getPlatformUser(),opened=openedLocation.current;return user.id===operation.actor&&user.authVersion===operation.authVersion&&location.pathname===opened.pathname&&location.search===opened.search;}
 const pending=session.pending,matches=pending&&markerKeys.every(key=>pending[key]===operation[key]),busy=working||session.busy;
 const unavailable=disabled||session.blocked||session.checking||!session.verified||!!pending||!sameScope;
 async function perform(task,{lookup=false,readOnly=false}={}){
  if(running.current||busy||session.checking||!sameScope)return;
  if(!contextCurrent()){setFeedback('登录身份或访视已变化，本次未继续执行。请取消后重新进入。');return;}
  running.current=true;setWorking(true);setFeedback('');
  try{
   const result=await task();if(!live.current.sameScope||!contextCurrent())return;
   if(readOnly){setFeedback(live.current.session.pending?'本次操作结果仍待核对，请核对本次操作结果。':result?'当前状态已核对，本次尚未执行。请确认后继续。':'本次尚未执行，输入仍保留。请先重新核对当前状态。');return;}
   if(lookup)setLookedUp(true);
   if(result)await live.current.onCompleted(result);
   else setFeedback('本次尚未执行，输入仍保留。请核对当前状态后继续。');
  }catch(error){if(live.current.sameScope)setFeedback('当前结果暂不可核对，请保留本页并重新核对。');}
  finally{running.current=false;setWorking(false);}
 }
 function confirm(){if(unavailable)return;return perform(onConfirm);}
 function recover(retry=false){if(!matches||!session.verified)return;return perform(()=>session.recover(retry),{lookup:true});}
 function cancel(){if(!running.current&&!session.busy)onCancel();}
 return <ConfirmDialog {...dialogProps} busy={busy} confirmDisabled={unavailable} onConfirm={confirm} onCancel={cancel}>
  {children}
  {working?<p role="status">正在处理，请稍候；请勿重复确认。</p>:session.checking?<p role="status">正在核对当前状态，尚未执行本次操作。核对完成后可确认。</p>:!sameScope?<p role="alert">登录身份或访视已变化，本次未继续执行。请取消后重新进入。</p>:pending?<>
   <p role="alert">{matches?(session.notice||session.error||'本次操作结果尚未确认，输入仍保留。请核对本次操作结果，不要重新提交。'):'已有另一项操作待核对。请取消后处理原操作，本次未继续执行。'}</p>
   {matches&&<div className="ep-actions">{!session.verified&&<Button disabled={busy} onClick={()=>void perform(()=>session.load(),{readOnly:true})}>重新核对当前状态</Button>}<Button disabled={busy||!session.verified} onClick={()=>void recover(false)}>核对本次操作结果</Button>{lookedUp&&session.canRetry&&<Button disabled={busy||!session.verified} onClick={()=>void recover(true)}>以原内容重试</Button>}</div>}
  </>:<>
   {!session.verified?<><p role="alert">本次尚未执行，输入仍保留。请先重新核对当前状态。</p>{session.error&&<p role="alert">{session.error}</p>}<Button disabled={busy} onClick={()=>void perform(()=>session.load(),{readOnly:true})}>重新核对当前状态</Button></>:disabled?<p role="alert">当前记录或操作条件已有变化，本次尚未执行。请取消后核对当前记录。</p>:(feedback||session.error)&&<p role="alert">{feedback||session.error}</p>}
  </>}
 </ConfirmDialog>;
}
