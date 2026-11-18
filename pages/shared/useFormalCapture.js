import {sameFileResult,fileVerified} from '../../src/capture-file-session.js';
import {resolveImportLabels} from '../../src/capture-import-session.js';
import {useEffect,useRef,useState} from 'react';
import {getPlatformUser} from '../../src/platform-user.js';
import {createCaptureClient,validCaptureMarker,captureCommandPath,captureReceiptPath,validCaptureResult,sameValue} from '../../src/formal-capture-session.js';
const clone=value=>structuredClone(value);
export default function useFormalCapture(route){
 const [view,setView]=useState(null),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[verified,setVerified]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(null),[revision,setRevision]=useState(0),[lastImport,setLastImport]=useState(null),[lastFile,setLastFile]=useState(null);
 const confirmationHolds=useRef(new Set()),holdConfirmation=useRef(null);
 if(!holdConfirmation.current)holdConfirmation.current=()=>{const hold=Symbol('capture-confirmation');confirmationHolds.current.add(hold);return()=>confirmationHolds.current.delete(hold);};
 const actor=useRef(null),authVersion=useRef(null),epoch=useRef(0),writer=useRef(null),reader=useRef(null),client=useRef(null),memory=useRef(null),marker=useRef(null),restored=useRef(false),current=useRef(null),reset=useRef(0);
 const base=route?'/research-studies/'+route.studyId:'',key=id=>'rh-capture-pending:'+id+':'+route.studyId;
 const scope=()=>({actor:actor.current,authVersion:authVersion.current,studyId:route?.studyId});
 function forget(){if(actor.current&&route)try{sessionStorage.removeItem(key(actor.current));}catch{}memory.current=null;marker.current=null;setPending(null);}
 function clear(message=''){epoch.current++;client.current?.invalidate();forget();actor.current=null;authVersion.current=null;writer.current=null;reader.current=null;current.current=null;restored.current=false;setView(null);setVerified(false);setBusy(false);setChecking(false);setError(message);setNotice('');setLastImport(null);setLastFile(null);reset.current++;setRevision(reset.current);}
 if(!client.current)client.current=createCaptureClient({onAccessLost:e=>{clear(e.message);if(e.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}});
 async function readView({fileSnapshot=false}={}){
  const value={};
  if(route.page==='s05'){
   value.queries=await client.current.request(base+'/data-queries?'+new URLSearchParams({limit:'20',...(route.assignmentId?{assignmentId:route.assignmentId}:{})}));
   if(route.queryId)value.query=await client.current.request(base+'/data-queries/'+route.queryId);
  }else if(!route.visitId&&!route.assignmentId){value.visits=await client.current.request(base+'/visits?limit=20');return value;}
  if(value.query&&route.assignmentId&&value.query.query.target.ref.assignmentId!==route.assignmentId)throw Object.assign(Error('疑问与表单不匹配。'),{clear:true});
  let assignmentId=route.assignmentId??(route.page==='s05'?value.query?.query.target.ref.assignmentId:null);
  if(assignmentId)value.capture=await client.current.request(base+'/assignments/'+assignmentId);
  if(value.capture&&!value.capture.assignment.subjectVisitId)throw Object.assign(Error('此表单未关联访视，请从受试者选择访视后继续。'),{clear:true});
  const visitId=route.visitId??value.capture?.assignment.subjectVisitId;
  if(visitId)value.visit=(await client.current.request(base+'/visits/'+visitId)).visit;
  if(value.capture&&(value.capture.studyId!==route.studyId||route.visitId&&value.capture.assignment.subjectVisitId!==route.visitId||value.visit&&value.capture.assignment.subjectId!==value.visit.subject.id))throw Object.assign(Error('表单与访视不匹配，请从受试者重新进入。'),{clear:true});
  if(route.page==='s09'&&assignmentId)value.queries=await client.current.request(base+'/data-queries?'+new URLSearchParams({limit:'20',assignmentId}));
  if(route.page==='s09'&&route.queryId){value.query=await client.current.request(base+'/data-queries/'+route.queryId);if(value.query.query.target.ref.assignmentId!==assignmentId)throw Object.assign(Error('疑问与表单不匹配。'),{clear:true});}
  if(route.page==='s09'&&value.visit){try{const files=await client.current.request(base+'/visits/'+value.visit.id+'/files?limit='+(fileSnapshot?'20':'1'));if(files.studyId!==route.studyId||files.visitId!==value.visit.id||typeof files.capabilities?.canUploadPreprocessed!=='boolean'||!['available','unavailable'].includes(files.preprocessedUploadStatus))throw Error('文件当前权限暂不可核对，请重新读取。');value.fileAccess={capabilities:files.capabilities,preprocessedUploadStatus:files.preprocessedUploadStatus};if(fileSnapshot)value.files=files;}catch(e){if(e.stale||[401,403,404].includes(e.status))throw e;value.fileAccessError=e.message;}}
  return value;
 }
 async function load({quiet=false,resetDraft=false}={}){
  if(!route||writer.current||reader.current||quiet&&confirmationHolds.current.size)return false;if(!actor.current){if(!quiet)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));return false;}const token=++epoch.current,id=actor.current,r=Symbol();reader.current=r;setChecking(true);if(!quiet)setBusy(true);
  try{const me=await client.current.request('/auth/me');if(token!==epoch.current)return false;if(me.accountId!==id||!Number.isSafeInteger(me.authVersion)||authVersion.current!==null&&authVersion.current!==me.authVersion){clear('登录状态已变化，请重新核对。');window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));return false;}authVersion.current=me.authVersion;
   const next=await readView({fileSnapshot:resetDraft||!current.current?.visit});if(token!==epoch.current)return false;current.current=next;setView(next);setVerified(true);if(!marker.current)setError('');
   if(!restored.current){restored.current=true;let p;try{p=JSON.parse(sessionStorage.getItem(key(id))||'null');}catch{}if(validCaptureMarker(p,scope())){marker.current=p;setPending(p);setError('上次操作结果尚未确认，请先核对。');}else if(p)forget();}
   if(resetDraft){reset.current++;setRevision(reset.current);}return true;
  }catch(e){if(token===epoch.current&&!e.stale){setVerified(false);setError(e.message);if(e.clear||e.status===404){current.current=null;setView(null);}}return false;}
  finally{if(reader.current===r){reader.current=null;setChecking(false);if(!quiet)setBusy(false);}}
 }
 useEffect(()=>{if(!route)return;const identity=e=>{const u=e.detail??getPlatformUser(),id=u.authenticated&&u.id?u.id:null;if(id===actor.current&&(u.authVersion===undefined||authVersion.current===null||u.authVersion===authVersion.current))return;clear();actor.current=id;if(id)void load();else setError('请登录后继续。');};window.addEventListener('qiyan:user-change',identity);identity({detail:getPlatformUser()});const check=()=>{if(document.visibilityState==='visible')void load({quiet:true});};window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);const timer=setInterval(check,10000);return()=>{epoch.current++;client.current.invalidate();clearInterval(timer);window.removeEventListener('qiyan:user-change',identity);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};},[route?.studyId,route?.visitId,route?.assignmentId,route?.queryId]);
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>{if(memory.current&&Date.now()-memory.current.createdAt>=900000){memory.current=null;setPending({...marker.current});reset.current++;setRevision(reset.current);}},1000);return()=>clearInterval(timer);},[pending]);
 async function execute(p,body){
  if(writer.current||reader.current||!verified||!validCaptureMarker(p,scope()))return false;const token=++epoch.current,w=Symbol();writer.current=w;setBusy(true);setError('');setNotice('');let acknowledged=false;
  try{const result=await client.current.request(captureCommandPath(p),{method:'POST',body});if(token!==epoch.current)return false;if(!validCaptureResult(result,p)||p.domain==='file'&&result.sourceSha256!==memory.current?.fileSourceSha256)throw Object.assign(Error('未能确认操作结果，请核对。'),{unknown:true});acknowledged=true;memory.current=null;const checked=await readAcknowledged(p,result);if(token!==epoch.current)return false;writer.current=null;
   if(!await load({resetDraft:true})){setNotice('已保存，但当前状态暂时无法核对；请先重新核对。');return false;}finishAcknowledged(p,checked);return checked??result;
  }catch(e){if(token===epoch.current&&!e.stale){if(!e.unknown&&!acknowledged)forget();setVerified(false);setError(acknowledged?'操作已保存，但当前状态暂时无法核对；请先核对。':e.unknown?'上次操作结果尚未确认，输入仍保留；请先核对。':e.message);}return false;}
  finally{if(writer.current===w)writer.current=null;setBusy(false);}
 }
 async function send(domain,action,body,targets={}){
  if(marker.current||!actor.current||busy||writer.current)return false;if(reader.current||!verified){setNotice('本次尚未执行，输入仍保留。'+(reader.current?'正在核对当前状态，请等待核对完成后确认。':'请先重新核对当前状态，再确认。'));return false;}
  const p={...scope(),visitId:targets.visitId??current.current?.visit?.id??null,assignmentId:targets.assignmentId===null?null:targets.assignmentId??current.current?.capture?.assignment.id??null,queryId:targets.queryId??null,domain,action,requestKey:crypto.randomUUID()};
  if(!validCaptureMarker(p,scope())){setError('当前对象无法核对，请重新进入。');return false;}
  try{sessionStorage.setItem(key(actor.current),JSON.stringify(p));}catch{setError('无法保留操作核对记录，请检查浏览器存储。');return false;}
  marker.current=p;setPending(p);if(domain==='import')setLastImport(null);if(domain==='file')setLastFile(null);memory.current={createdAt:Date.now(),body:clone({...body,requestKey:p.requestKey}),...(domain==='file'?{fileSourceSha256:targets.sourceSha256}:{})};return execute(p,memory.current.body);
 }
 async function readAcknowledged(p,result){
  if(p.domain==='file'){const current=await client.current.request(captureReceiptPath(p));if(!validCaptureResult(current,p)||!sameFileResult(current,result))throw Error('上次文件结果暂不可核对。');return current;}
  if(p.domain==='import'){const current=await client.current.request(base+'/imports/receipts/'+p.requestKey);if(!validCaptureResult(current,p)||!sameValue(current.rows,result.rows)||current.source.csvSha256!==result.source.csvSha256||current.formVersionId!==result.formVersionId)throw Error('上次导入结果暂不可核对。');return resolveImportLabels(current,(...args)=>client.current.request(...args));}
  else if(p.domain==='email'){const current=await client.current.request(base+'/email-invitations/'+result.invitationId);if(current.studyId!==p.studyId||current.visitId!==p.visitId||current.assignmentId!==result.assignmentId)throw Error('上次邀请与当前访视不匹配。');}
  else if(p.domain==='query'){const current=await client.current.request(base+'/data-queries/'+result.result.id);if(current.query.target.ref.assignmentId!==p.assignmentId)throw Error('上次结果与当前表单不匹配。');}
  else if(p.domain==='assignment'||p.action==='assign'){const current=await client.current.request(base+'/assignments/'+(p.action==='assign'?result.result.id:p.assignmentId));if(p.visitId&&current.assignment.subjectVisitId!==p.visitId)throw Error('上次结果与当前访视不匹配。');}
  else await client.current.request(base+'/visits/'+p.visitId);
 }
 async function recover(retry=false){
  const p=marker.current;if(!p||writer.current||reader.current||!verified||!validCaptureMarker(p,scope()))return false;
  if(retry&&!['email','import','file'].includes(p.domain)&&memory.current&&Date.now()-memory.current.createdAt<900000)return execute(p,memory.current.body);
  const token=++epoch.current,w=Symbol();writer.current=w;setBusy(true);setError('');
  try{const result=await client.current.request(captureReceiptPath(p));if(token!==epoch.current)return false;if(!validCaptureResult(result,p))throw Error('上次操作暂时无法确认，请稍后核对。');const checked=await readAcknowledged(p,result);if(token!==epoch.current)return false;writer.current=null;if(!await load({resetDraft:true})){setError('已查到结果，但当前状态暂时无法核对。');return false;}finishAcknowledged(p,checked);return checked??result;
  }catch(e){if(token===epoch.current&&!e.stale){if(p.domain==='file'&&e.status===404)setLastFile(null);setError(e.status===404?'暂未查到上次结果，请保留当前状态，稍后继续核对。':e.message);}return false;}
  finally{if(writer.current===w)writer.current=null;setBusy(false);}
 }
 function finishAcknowledged(p,checked){
  setError('');if(p.domain==='import')setLastImport(checked);if(p.domain==='file')setLastFile(checked);
  if(p.domain==='file'&&!fileVerified(checked)){setNotice('文件与特征已登记，存储内容核验尚未完成。请核对以下状态。');return;}
  forget();setNotice('已保存并核对当前状态。');
 }
 async function verifyFile(){
  const p=marker.current;if(!p||p.domain!=='file'||!lastFile||fileVerified(lastFile)||writer.current||reader.current||!verified||!validCaptureMarker(p,scope())||!validCaptureResult(lastFile,p))return false;
  const token=++epoch.current,w=Symbol();writer.current=w;setBusy(true);setError('');
  try{const result=await client.current.request(captureReceiptPath(p)+'/verify',{method:'POST',body:{}});if(token!==epoch.current)return false;if(!validCaptureResult(result,p)||!sameFileResult(result,lastFile))throw Error('文件核验结果暂不可确认，请核对原回执。');const checked=await readAcknowledged(p,result);if(token!==epoch.current)return false;writer.current=null;if(!await load({resetDraft:true})){setError('文件核验已返回，但当前状态暂时无法核对。');return false;}finishAcknowledged(p,checked);return checked;
  }catch(e){if(token===epoch.current&&!e.stale){if(e.status===404)setLastFile(null);setError(e.unknown?'核验结果尚未确认，请核对原回执。':e.message);}return false;}
  finally{if(writer.current===w)writer.current=null;setBusy(false);}
 }
 async function more(kind){const page=current.current?.[kind];if(busy||!verified||!page?.nextCursor)return;const token=++epoch.current;setBusy(true);try{const suffix=kind==='visits'?'/visits':'/data-queries',params=new URLSearchParams({limit:'20',cursor:page.nextCursor,...(kind==='queries'&&route.assignmentId?{assignmentId:route.assignmentId}:kind==='queries'&&current.current.capture?{assignmentId:current.current.capture.assignment.id}:{})}),next=await client.current.request(base+suffix+'?'+params);if(token!==epoch.current)return;if(next.nextCursor===page.nextCursor||next.items.some(v=>page.items.some(x=>x.id===v.id)))throw Error('列表无法继续，请重新核对。');const merged={...current.current,[kind]:{...next,items:[...page.items,...next.items]}};current.current=merged;setView(merged);}catch(e){if(token===epoch.current)setError(e.message);}finally{if(token===epoch.current)setBusy(false);}}
 return {lastImport,lastFile,verifyFile,canVerifyFile:marker.current?.domain==='file'&&!!lastFile&&!fileVerified(lastFile)&&verified&&!busy,view,busy,checking,holdConfirmation:holdConfirmation.current,verified,error,notice,pending,revision,load,send,recover,more,setError,setNotice,request:(...args)=>client.current.request(...args),canRetry:!['email','import','file'].includes(marker.current?.domain)&&!!memory.current&&Date.now()-memory.current.createdAt<900000,blocked:busy||!verified||!!pending,actor:actor.current,authVersion:authVersion.current};
}
