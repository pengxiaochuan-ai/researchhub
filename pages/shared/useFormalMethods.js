import {readAnalysisStartBlocker,readLegacyMethodsBlocker} from '../../src/analysis-start-session.js';
import {useEffect,useRef,useState} from 'react';
import {getPlatformUser} from '../../src/platform-user.js';
import {createCaptureClient,sameValue} from '../../src/formal-capture-session.js';
import {validAnalysisPlan,validAnalysisSnapshot} from '../../src/formal-analysis-session.js';
import {methodsBase,methodsUrl,validMethodsMarker,methodsCommandPath,methodsReceiptPath,validMethodsResult} from '../../src/formal-methods-session.js';
import {readMethodsCurrent,createMethodsListReader,isMethodsAccessLoss as sensitive} from '../../src/formal-methods-read.js';
export default function useFormalMethods(route,{createTransport='native'}={}){
 const [view,setView]=useState(null),[busy,setBusy]=useState(false),[verified,setVerified]=useState(false),[pending,setPending]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [recent,setRecent]=useState({status:'loading',items:[]}),recentReader=useRef(null),recentEpoch=useRef(0),recentActive=useRef(null),recentStarted=useRef(false),recentReady=useRef(false);
 const actor=useRef(null),authVersion=useRef(null),epoch=useRef(0),reader=useRef(null),writer=useRef(null),client=useRef(null),current=useRef(null),marker=useRef(null),markerStorage=useRef(null),memory=useRef(null),restored=useRef(false),selection=useRef({runId:route?.runId,planId:route?.planId,snapshotId:route?.snapshotId});
 const base=route?methodsBase(route.studyId):'',key=id=>'rh-methods-pending:'+id+':'+route.studyId,scope=()=>({actor:actor.current,authVersion:authVersion.current,studyId:route?.studyId});
 function checkCreate(){const blocker=readAnalysisStartBlocker(sessionStorage,scope())??readLegacyMethodsBlocker(sessionStorage,scope(),{foreignOnly:true});if(blocker){setError(blocker.message);return false;}return true;}
 const actionKey=p=>'rh-methods-action-pending:'+p.actor+':'+p.authVersion+':'+p.studyId;
 const operationKey=p=>p.action==='create'?key(p.actor):actionKey(p);
 function stored(k){try{return JSON.parse(sessionStorage.getItem(k)||'null');}catch{return null;}}
 function storedCreate(){if(!actor.current||!route)return null;const p=stored(key(actor.current));return p?.action==='create'&&validMethodsMarker(p,{...scope(),authVersion:p.authVersion})?p:null;}
 function detach(){marker.current=null;markerStorage.current=null;memory.current=null;setPending(null);}
 function forget(){const p=marker.current,where=markerStorage.current??(p?operationKey(p):null);if(p&&where)try{const saved=stored(where);if(validMethodsMarker(saved,{actor:p.actor,authVersion:p.authVersion,studyId:p.studyId})&&sameValue(saved,p))sessionStorage.removeItem(where);}catch{}detach();}
 function stopRecent(paused=false){recentEpoch.current++;recentReader.current?.invalidate();recentActive.current=null;recentStarted.current=false;recentReady.current=false;setRecent({status:paused?'paused':'loading',items:[]});}
 function reset(message='',identity=false){epoch.current++;client.current?.invalidate();stopRecent();if(storedCreate()||validMethodsMarker(marker.current,scope()))detach();else forget();restored.current=false;reader.current=null;writer.current=null;current.current=null;setView(null);setBusy(false);setVerified(false);setError(message);setNotice('');setRevision(x=>x+1);if(identity){actor.current=null;authVersion.current=null;restored.current=false;}}
 if(!client.current)client.current=createCaptureClient({onAccessLost:e=>{reset(e.message,e.status===401);if(e.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}});
 if(!recentReader.current)recentReader.current=createMethodsListReader();
 async function readSource(planId,snapshotId){
  const [plan,snapshot,configuration]=await Promise.all([client.current.request(base+'/plans/'+planId+'?limit=20'),client.current.request(base+'/snapshots/'+snapshotId),client.current.request('/research-studies/'+route.studyId+'/configuration')]);
  if(!validAnalysisPlan(plan,route.studyId,planId)||!validAnalysisSnapshot(snapshot,plan,snapshotId)||configuration?.study?.id!==route.studyId||!Array.isArray(configuration.forms))throw Error('固定快照与当前研究来源暂不可核对，请从计划重新进入。');return {...snapshot,plan,configuration};
 }
 const readView=({quiet=false}={})=>readMethodsCurrent({studyId:route.studyId,ids:selection.current,request:(...args)=>client.current.request(...args),readSource,quiet,current:current.current});
 async function loadRecent({force=false}={}){
  if(!route||!actor.current||writer.current||marker.current)return false;if(recentActive.current)return recentActive.current.promise;if(recentStarted.current&&!force)return recentReady.current;
  const token=recentEpoch.current,expected={actor:actor.current,authVersion:authVersion.current},id=Symbol();recentStarted.current=true;recentReady.current=false;setRecent({status:'loading',items:[]});
  const valid=()=>token===recentEpoch.current&&expected.actor===actor.current&&expected.authVersion===authVersion.current;
  const checkIdentity=async()=>{const me=await recentReader.current.identity();if(!valid())return false;if(me.accountId!==expected.actor||me.authVersion!==expected.authVersion){reset('登录状态已变化，请重新核对。',true);window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));return false;}return true;};
  const promise=(async()=>{try{if(!await checkIdentity())return false;const list=await recentReader.current.read(route.studyId);if(!valid()||!await checkIdentity())return false;recentReady.current=true;setRecent({status:'ready',items:list.items});return true;}
   catch(e){if(valid()&&!e.stale){if(sensitive(e)){reset(e.message,e.status===401);if(e.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}else setRecent({status:'error',items:[]});}return false;}
   finally{if(recentActive.current?.id===id)recentActive.current=null;}})();recentActive.current={id,promise};return promise;
 }
 async function load({quiet=false,resetInput=false}={}){
  if(!route||!actor.current||reader.current||writer.current)return false;const token=++epoch.current,r=Symbol();reader.current=r;if(!quiet)setBusy(true);
  try{const me=await client.current.request('/auth/me');if(token!==epoch.current)return false;if(me.accountId!==actor.current||!Number.isSafeInteger(me.authVersion)||authVersion.current!==null&&authVersion.current!==me.authVersion){reset('登录状态已变化，请重新核对。',true);window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));return false;}authVersion.current=me.authVersion;
   if(!restored.current){restored.current=true;const currentKey=actionKey(scope()),operation=stored(currentKey),legacyKey=key(actor.current),legacy=stored(legacyKey);let p,where;if(validMethodsMarker(operation,scope())&&operation.action!=='create'){p=operation;where=currentKey;}else if(validMethodsMarker(legacy,scope())){p=legacy;where=legacyKey;}if(p){marker.current=p;markerStorage.current=where;setPending(p);setRecent({status:'paused',items:[]});setError('上次操作结果尚未确认，请先核对。');}}
   const exact=!!(selection.current.runId||selection.current.snapshotId);if(!exact&&!marker.current&&!await loadRecent({force:!quiet})){if(token===epoch.current)setVerified(false);return false;}
   const next=await readView({quiet});if(token!==epoch.current)return false;current.current=next;setView(old=>sameValue(old,next)?old:next);setVerified(true);if(!marker.current)setError('');if(exact&&!marker.current)void loadRecent({force:!quiet});
   if(resetInput)setRevision(x=>x+1);return true;
  }catch(e){if(token===epoch.current&&!e.stale){if(sensitive(e)){reset(e.message);return false;}setVerified(false);setError(e.message);if(current.current){current.current={list:current.current.list,sourceError:e.message,sourceCurrent:false,resultValid:false};setView(current.current);}}return false;}
  finally{if(reader.current===r){reader.current=null;if(!quiet)setBusy(false);}}
 }
 useEffect(()=>{if(!route)return;const identity=e=>{const u=e.detail??getPlatformUser(),id=u.authenticated&&u.id?u.id:null;if(id===actor.current&&(u.authVersion===undefined||authVersion.current===null||u.authVersion===authVersion.current))return;reset('',true);actor.current=id;if(id)void load();else setError('请登录后继续。');};identity({detail:getPlatformUser()});window.addEventListener('qiyan:user-change',identity);const check=()=>{if(document.visibilityState==='visible')void load({quiet:true});};window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);const timer=setInterval(check,10000);return()=>{epoch.current++;client.current.invalidate();recentEpoch.current++;recentReader.current.invalidate();clearInterval(timer);window.removeEventListener('qiyan:user-change',identity);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};},[route?.studyId]);
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>{if(memory.current&&Date.now()-memory.current.at>=900000){memory.current=null;setRevision(x=>x+1);}},1000);return()=>clearInterval(timer);},[pending]);
 async function acknowledged(p){
  const receipt=await client.current.request(methodsReceiptPath(p));if(!validMethodsResult(receipt,p))throw Object.assign(Error(p.action==='cancel'?'取消结果仍未确认，请继续核对当前状态。':'原操作结果尚不可确认，请保留核对记录。'),{unknown:true});
  selection.current={runId:p.action==='create'?receipt.id:p.runId,planId:null,snapshotId:null};const next=await readView();if(p.action==='cancel'){if(next.capabilities?.status!=='cancelled')throw Error('当前取消状态暂不可核对，请保留核对记录。');}else if(!next.run||!next.sourceCurrent){current.current=next;setView(next);throw Error('操作已保存，但当前运行来源或状态暂不可核对，请核对上次结果。');}
  current.current=next;setView(next);setVerified(true);forget();setRevision(x=>x+1);history.replaceState(null,'',methodsUrl(route.studyId,{runId:selection.current.runId}));setNotice(p.action==='cancel'?'当前运行已取消。':p.action==='review'?'审核记录已保存，当前运行已核对。':next.run.status==='failed'?'本次运行失败，未发布统计结果，请核对失败原因。':['queued','running','validating'].includes(next.run.status)?'运行已受理，正在核对当前状态。':'描述统计已生成，请核对原值来源、分母及结果。');return receipt;
 }
 async function send(action,body={}){
  if(action==='create'&&createTransport==='jobs'){setError('请从当前固定数据确认开始分析；原运行仍可回看与审核。');return false;}
  if(action==='create'&&!checkCreate())return false;
  if(!verified||pending||marker.current||writer.current||!actor.current)return false;if(reader.current){setError('正在核对当前权限，输入仍保留，请稍后再次确认。');return false;}const p={...scope(),action,runId:action==='create'?null:current.current?.run?.id,snapshotId:action==='create'?current.current?.source?.basis.snapshotId:null,requestKey:crypto.randomUUID()};if(!validMethodsMarker(p,scope()))return false;
  try{const where=operationKey(p);sessionStorage.setItem(where,JSON.stringify(p));markerStorage.current=where;}catch{setError('无法保留操作核对记录，请检查浏览器存储。');return false;}stopRecent(true);marker.current=p;memory.current={at:Date.now()};setPending(p);const token=++epoch.current,w=Symbol();writer.current=w;setBusy(true);setError('');setNotice('');let saved=false;
  try{if(action==='create'&&!checkCreate()){forget();return false;}const result=await client.current.request(methodsCommandPath(p),{method:'POST',body:action==='cancel'?{}:{requestKey:p.requestKey,...body,...(action==='create'?{snapshotId:p.snapshotId}:{})}});if(token!==epoch.current)return false;
   const receipt=result?.receipt,valid=action==='create'?validMethodsResult(result,p):action==='review'?result.studyId===p.studyId&&result.id===p.runId&&receipt?.requestKey===p.requestKey&&receipt.action==='analysis.run.review'&&receipt.targetId===p.runId:result.studyId===p.studyId&&result.id===p.runId&&result.status==='cancelled';if(!valid)throw Object.assign(Error('未能确认操作结果，请核对。'),{unknown:true});saved=true;return await acknowledged(p);
  }catch(e){if(token===epoch.current&&!e.stale){if(sensitive(e)){reset(e.message);return false;}if(!saved&&!e.unknown)forget();setVerified(false);if(current.current){current.current={list:current.current.list,sourceError:e.message,sourceCurrent:false,resultValid:false};setView(current.current);}setError(saved?'操作已保存，但当前状态尚未核对，请核对上次结果。':e.unknown?'上次操作结果尚未确认，请先核对，不能重复提交。':e.message);}return false;}
  finally{if(writer.current===w){writer.current=null;setBusy(false);if(!marker.current&&current.current)void loadRecent({force:true});}}
 }
 async function recover(){if(!marker.current||!verified||writer.current||reader.current)return false;stopRecent(true);const p=marker.current,token=++epoch.current,w=Symbol();writer.current=w;setBusy(true);setError('');try{return await acknowledged(p);}catch(e){if(token===epoch.current&&!e.stale){if(sensitive(e)){reset(e.message);return false;}setVerified(false);if(current.current){current.current={list:current.current.list,sourceError:e.message,sourceCurrent:false,resultValid:false};setView(current.current);}setError(e.status===404?'尚未查到原操作结果，核对标记仍保留；请稍后继续核对，不要重复提交。':e.message);}return false;}finally{if(writer.current===w){writer.current=null;setBusy(false);if(!marker.current&&current.current)void loadRecent({force:true});}}}
 return {view,recent,busy,verified,pending,error,notice,revision,checkCreate,createBlocker:readAnalysisStartBlocker(sessionStorage,scope())??readLegacyMethodsBlocker(sessionStorage,scope(),{foreignOnly:true}),actor:actor.current,blocked:busy||!verified||!!pending,load,send,recover,request:(...args)=>client.current.request(...args)};
}
