import TaskConfirmation,{useTaskConfirmation} from './TaskConfirmation.jsx';
import {FormalTaskMode} from './FormalTaskSourcePicker.jsx';
import FormalStudyTaskContext from './FormalStudyTaskContext.jsx';
import {isFormalTaskRoute,readFormalTaskRoute,formalTasksUrl,createFormalTaskClient,validTaskMarker,validFormalTaskReceipt} from '../../src/formal-tasks-session.js';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Button} from './Components.jsx';
import StudyTaskForm from './StudyTaskForm.jsx';
import StudyTaskRow from './StudyTaskRow.jsx';
import {StudyTaskContext} from './StudyTaskContext.jsx';
import {StudyTaskConflict} from './StudyTaskConflict.jsx';
import {canApplyTaskRead,rebaseTaskSubmission} from '../../src/study-task-draft-guard.js';
import {TaskListFilters,TaskPagination} from './StudyTaskListControls.jsx';
import {newTaskListState,applyTaskFilters,taskListQuery,moveTaskPage,taskListSnapshot,restoreTaskList} from '../../src/study-task-list-state.js';
import {createStudyTaskClient,readStudyTaskLocation,studyTasksUrl} from '../../src/study-tasks-session.js';
import './workflow-pages.css';
import './study-tasks.css';

export function StudyTasksLayout({formal=false,context,participants=[],participantsCursor,onMoreParticipants,page={items:[],nextCursor:null},relations={items:[],nextCursor:null},listState=newTaskListState(),onFilter,onPage,selected,loading=false,error='',notice='',formKey='new',editing,busy=false,conflictContent,onSave,onDirty,onDetailDirty,onContextDirty,onCancel,onAssign,onMoreDependencies,onTransition,onReview,onRemind,onLink,loadLinks,loadEvidence,onError,onSelect=()=>{},onEdit=()=>{},onRefresh=()=>{},unknown,onRecover,onRetry}){
 return <main className="platform-main"><div className="wf-content s08-tasks">
  {error&&<div role="alert" className="wf-error" tabIndex={-1} data-task-error>{error}</div>}{notice&&!busy&&<p role="status" className="wf-notice">{notice}</p>}
  {conflictContent}
  {unknown&&<div className="wf-error"><p>{formal?'上次操作结果尚未确认，请先核对。':<>原提交编号：{unknown.input.requestKey}。结果未确认，输入保留；不会自动重试。</>}</p><Button disabled={busy} onClick={onRecover}>核对原提交回执</Button>{unknown.notFound&&!unknown.markerOnly&&<Button disabled={busy} onClick={onRetry}>使用同一编号重试</Button>}</div>}
  <section className="wf-panel"><h2>执行任务与进度</h2>
   {(!formal||!context||context.capabilities.canCreate)?<StudyTaskForm key={formKey} task={editing} participants={participants} dependencies={relations.items} dependencyCursor={relations.nextCursor} onMoreDependencies={onMoreDependencies} loadLinks={loadLinks} onError={onError} allowed={Boolean(context?.capabilities.canCreate)&&!unknown} busy={busy||loading} onSave={onSave} onDirty={onDirty} onCancel={onCancel}/>:context&&<p>当前账号可处理获分派的任务。</p>}
   {!context&&!loading&&<p><a href="/pages/p003/">登录或切换账号</a>；请从“我的工作台”选择研究后进入。</p>}
   {participantsCursor&&<Button disabled={busy||loading||Boolean(unknown)} onClick={onMoreParticipants}>读取更多成员</Button>}<TaskListFilters key={JSON.stringify(listState.filters)} filters={listState.filters} participants={participants} busy={loading||busy||Boolean(unknown)} onApply={onFilter}/>
   <div className="wf-toolbar"><Button disabled={loading||busy&&!conflictContent} onClick={onRefresh}>刷新任务</Button>{loading&&<span role="status">正在读取服务端任务…</span>}</div>
   {!loading&&!page.items.length&&<div className="wf-empty">当前范围暂无任务。</div>}
   <ul className="wf-list">{page.items.map(task=><StudyTaskRow key={task.id} task={task} selected={selected} actorId={context?.actor.id} participants={participants} relations={relations} busy={busy} unknown={unknown} onSelect={onSelect} onEdit={onEdit} onAssign={onAssign} onMoreDependencies={onMoreDependencies} onDirty={onDetailDirty} onTransition={onTransition} onReview={onReview} onRemind={onRemind} loadEvidence={loadEvidence} onError={onError}/>)}</ul>
   <TaskPagination index={listState.index} nextCursor={page.nextCursor} busy={loading||busy||Boolean(unknown)} onPage={onPage}/>
  </section>
  <section className="wf-panel"><h2>受试者与访视</h2>{formal?<FormalStudyTaskContext key={selected?selected.id+':'+selected.version:'none'} task={selected} busy={busy} unknown={Boolean(unknown)} onSave={onLink} onDirty={onContextDirty}/>:<StudyTaskContext key={selected?selected.id+':'+selected.version:'none'} task={selected} busy={busy} unknown={Boolean(unknown)} loader={loadLinks} onSave={onLink} onDirty={onContextDirty} onError={onError}/>}</section>
 </div></main>;
}

function TaskWorkspace(){
 const formal=isFormalTaskRoute('s08',location.search),confirm=useTaskConfirmation(),route=formal?(()=>{try{return readFormalTaskRoute(location.search);}catch{return null;}})():null,pendingMemory=useRef(null),formalMarker=useRef(null),authVersion=useRef(null),actorRef=useRef(null);
 const routeUrl=(scope,taskId)=>formal?formalTasksUrl(scope,taskId):studyTasksUrl(scope,taskId);
 const storageKey=actor=>'rh-task-pending:'+actor+':'+route?.studyId;
 function forgetFormal(){if(actorRef.current)try{sessionStorage.removeItem(storageKey(actorRef.current));}catch{}pendingMemory.current=null;formalMarker.current=null;}

 const client=useRef(null),epoch=useRef(0),scopeRef=useRef(null),dirtyRef=useRef(false),dirtyParts=useRef({form:false,detail:false,context:false}),draftRevision=useRef(0),contextRef=useRef(null),selection=useRef(0),selectedRef=useRef(null),polling=useRef(false),conflictRef=useRef(null);
 const [conflict,setConflict]=useState(null);conflictRef.current=conflict;
 const [participantsCursor,setParticipantsCursor]=useState(null);
 const [relations,setRelations]=useState({items:[],nextCursor:null});
 const [listState,setListState]=useState(newTaskListState),listRef=useRef(newTaskListState()),listSequence=useRef(0);
 const [context,setContext]=useState(null),[studies,setStudies]=useState([]),[participants,setParticipants]=useState([]),[page,setPage]=useState({items:[],nextCursor:null}),[selected,setSelected]=useState(null),[editing,setEditing]=useState(null),[formKey,setFormKey]=useState('new'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[unknown,setUnknown]=useState(null),[headerSlot,setHeaderSlot]=useState(null);
 contextRef.current=context;
 selectedRef.current=selected;
 const onDirty=useCallback(value=>{if(value||dirtyParts.current.form)draftRevision.current++;dirtyParts.current.form=value;dirtyRef.current=Object.values(dirtyParts.current).some(Boolean);},[]);
 const onDetailDirty=useCallback(value=>{if(value||dirtyParts.current.detail)draftRevision.current++;dirtyParts.current.detail=value;dirtyRef.current=Object.values(dirtyParts.current).some(Boolean);},[]);
 const onContextDirty=useCallback(value=>{if(value||dirtyParts.current.context)draftRevision.current++;dirtyParts.current.context=value;dirtyRef.current=Object.values(dirtyParts.current).some(Boolean);},[]);
 function resetDrafts(){dirtyParts.current={form:false,detail:false,context:false};dirtyRef.current=false;}
 function clear(){pendingMemory.current=null;formalMarker.current=null;actorRef.current=null;authVersion.current=null;epoch.current++;selection.current++;listSequence.current++;client.current.invalidate();setConflict(null);setBusy(false);setNotice('');setContext(null);setParticipants([]);setParticipantsCursor(null);setStudies([]);setPage({items:[],nextCursor:null});setRelations({items:[],nextCursor:null});setSelected(null);setEditing(null);setUnknown(null);setFormKey(crypto.randomUUID());listRef.current=newTaskListState();setListState(listRef.current);resetDrafts();}
 if(!client.current)client.current=formal&&route?createFormalTaskClient({studyId:route.studyId,onAccessLost:e=>{clear();setError(e.message);if(e.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}}):createStudyTaskClient();
 function reject(e){if(e.name==='AbortError')return;if([401,403].includes(e.status))clear();setError(e.message);queueMicrotask(()=>document.querySelector('[data-task-error]')?.focus());}
 async function initialize(){clear();setError('');setNotice('');setLoading(true);const token=epoch.current;
  try{if(formal&&!route)throw Error('任务链接无效，请从研究重新进入。');const {scope,taskId}=formal?{scope:{studyId:route.studyId},taskId:route.taskId}:readStudyTaskLocation(location.search);if(formal){const me=await client.current.request('/auth/me');if(token!==epoch.current)return;actorRef.current=me.accountId;authVersion.current=me.authVersion;}scopeRef.current=scope;const [ctx,people,choices]=await Promise.all([client.current.loadContext(scope),client.current.loadParticipants(scope),client.current.loadStudies()]);if(token!==epoch.current)return;const restored=restoreTaskList(history.state?.s08List,scope,ctx.actor.id);const [list,all]=await Promise.all([client.current.loadTaskPage(scope,taskListQuery(restored)),client.current.loadTaskPage(scope)]);if(token!==epoch.current)return;listRef.current=restored;setListState(restored);setContext(ctx);setPage(list);setRelations(all);setParticipants(people.items);setParticipantsCursor(people.nextCursor);setStudies(choices.items);if(formal){let marker;try{marker=JSON.parse(sessionStorage.getItem(storageKey(ctx.actor.id))||'null');}catch{}if(validTaskMarker(marker,{actor:ctx.actor.id,authVersion:authVersion.current,studyId:route.studyId})){formalMarker.current=marker;setUnknown({action:marker.action,taskId:marker.taskId,input:{requestKey:marker.requestKey},markerOnly:true});}}if(taskId){const detail=await client.current.loadTask(scope,taskId);if(token===epoch.current)setSelected(detail.item);}}
  catch(e){if(token===epoch.current)reject(e);}finally{if(token===epoch.current)setLoading(false);}
 }
 async function refresh(){
  const token=epoch.current;setLoading(true);setError('');
  try{const [ctx,list,all]=await Promise.all([client.current.loadContext(scopeRef.current),client.current.loadTaskPage(scopeRef.current,taskListQuery(listRef.current)),client.current.loadTaskPage(scopeRef.current)]);
   if(token!==epoch.current)return;setContext(ctx);setPage(list);setRelations(all);
   if(conflictRef.current){const latest=(await client.current.loadTask(scopeRef.current,conflictRef.current.pending.taskId)).item;if(token===epoch.current)setConflict(old=>old?{...old,latest}:old);}
   else if(selected&&!dirtyParts.current.detail&&!dirtyParts.current.context){const revision=draftRevision.current,sequence=selection.current,detail=await client.current.loadTask(scopeRef.current,selected.id);if(token===epoch.current&&canApplyTaskRead({startedRevision:revision,currentRevision:draftRevision.current,startedSelection:sequence,currentSelection:selection.current}))setSelected(old=>old?.id===detail.item.id&&old.version>detail.item.version?old:detail.item);}
  }catch(e){if(token===epoch.current)reject(e);}finally{if(token===epoch.current)setLoading(false);}
 }
 async function select(id){if(conflictRef.current)return;if((dirtyParts.current.detail||dirtyParts.current.context)&&!await confirm('放弃当前任务未保存的详情或关联修改并重新读取任务？'))return;const token=epoch.current,sequence=++selection.current,revision=draftRevision.current;setError('');try{const result=await client.current.loadTask(scopeRef.current,id);if(token===epoch.current&&sequence===selection.current){if(!canApplyTaskRead({startedRevision:revision,currentRevision:draftRevision.current,startedSelection:sequence,currentSelection:selection.current})){setNotice('读取期间产生了新修改，已保留草稿；请先保存或取消后再刷新详情。');return;}setSelected(result.item);history.replaceState({...history.state,s08List:taskListSnapshot(listRef.current,scopeRef.current,contextRef.current.actor.id)},'',routeUrl(scopeRef.current,id));}}catch(e){if(token===epoch.current&&sequence===selection.current)reject(e);}}
 async function loadList(next){
  if(busy||unknown)return;
  if(dirtyRef.current&&!await confirm('放弃尚未保存的任务修改并切换筛选或页码？'))return;
  const token=epoch.current,sequence=++listSequence.current;selection.current++;setLoading(true);setError('');
  try{const result=await client.current.loadTaskPage(scopeRef.current,taskListQuery(next));if(token!==epoch.current||sequence!==listSequence.current)return;
   listRef.current=next;setListState(next);setPage(result);setSelected(null);setEditing(null);setFormKey(crypto.randomUUID());
   dirtyParts.current={form:false,detail:false,context:false};dirtyRef.current=false;
   history.replaceState({...history.state,s08List:taskListSnapshot(next,scopeRef.current,contextRef.current.actor.id)},'',routeUrl(scopeRef.current));
  }catch(e){if(token===epoch.current&&sequence===listSequence.current)reject(e);}finally{if(token===epoch.current&&sequence===listSequence.current)setLoading(false);}
 }
 function filter(input){try{void loadList(applyTaskFilters(input));}catch(e){reject(e);}}
 function turnPage(direction){try{void loadList(moveTaskPage(listRef.current,direction,page.nextCursor));}catch(e){reject(e);}}
 async function submit(pending){
  if(pending.action==='link'?dirtyParts.current.form||dirtyParts.current.detail:['create','edit'].includes(pending.action)?dirtyParts.current.detail||dirtyParts.current.context:dirtyParts.current.form||dirtyParts.current.context){setError('请先保存或取消另一区域的未保存修改，避免丢失工作。');return;}
  const token=epoch.current;selection.current++;setBusy(true);setError('');setNotice('');let acknowledged=false;
  try{
   let marker=formalMarker.current;if(formal){if(!marker){marker={actor:actorRef.current,authVersion:authVersion.current,studyId:route.studyId,taskId:pending.taskId??null,action:pending.action,requestKey:pending.input.requestKey};if(!validTaskMarker(marker,{actor:actorRef.current,authVersion:authVersion.current,studyId:route.studyId}))throw Error('当前操作无法核对。');sessionStorage.setItem(storageKey(actorRef.current),JSON.stringify(marker));formalMarker.current=marker;pendingMemory.current={at:performance.now(),pending};}else if(marker.requestKey!==pending.input.requestKey)throw Error('上次操作仍待核对，不能重复提交。');}
   const receipt=await client.current.mutateTask(scopeRef.current,pending.action,pending.input,pending.taskId);if(formal){if(!validFormalTaskReceipt(receipt,marker))throw Object.assign(Error('结果尚未确认。'),{code:'STUDY_TASK_RESULT_UNKNOWN'});acknowledged=true;await client.current.loadTask(scopeRef.current,receipt.taskId);if(token!==epoch.current)return;forgetFormal();}
   if(token!==epoch.current)return;
   setUnknown(null);setConflict(null);conflictRef.current=null;setEditing(null);setFormKey(crypto.randomUUID());resetDrafts();
   setNotice('已保存到服务端，任务版本 v'+receipt.version+"。");
   await refresh();if(token===epoch.current)await select(receipt.taskId);
  }catch(e){if(token!==epoch.current)return;if(formal&&acknowledged)e.code='STUDY_TASK_RESULT_UNKNOWN';if(formal&&e.code!=='STUDY_TASK_RESULT_UNKNOWN'&&e.status!==401&&e.status!==403)forgetFormal();if(e.status===409&&pending.taskId){try{const latest=(await client.current.loadTask(scopeRef.current,pending.taskId)).item;if(token===epoch.current){setConflict({pending,latest});setError('任务发生冲突，草稿已保留。请核对下方当前版本后明确确认，不会自动覆盖。');}return;}catch(readError){if(token===epoch.current)reject(readError);return;}}if(e.code==='STUDY_TASK_RESULT_UNKNOWN')setUnknown(pending);reject(e);}
  finally{if(token===epoch.current)setBusy(false);}
 }
 function save(draft,task){if(busy||unknown)return;const input={requestKey:crypto.randomUUID(),name:draft.name.trim(),dueDate:draft.dueDate,priority:draft.priority,...(task?{expectedVersion:task.version}:{assigneeAccountId:draft.assigneeAccountId,collaboratorAccountIds:draft.collaboratorAccountIds,dependencyTaskIds:draft.dependencyTaskIds,...(draft.context?{context:draft.context}:{})})};void submit({action:task?'edit':'create',input,taskId:task?.id});}
 function assign(draft,task){if(busy||unknown)return;void submit({action:'assign',input:{requestKey:crypto.randomUUID(),expectedVersion:task.version,...draft},taskId:task.id});}
 function transition(draft,task){
  if(busy||unknown)return;
  const input={requestKey:crypto.randomUUID(),expectedVersion:task.version,status:draft.status};
  if(draft.reason.trim())input.reason=draft.reason.trim();
  if(draft.status==='blocked')input.blockedReason=draft.blockedReason.trim();
  if(draft.status==='completed'){
   input.completionNote=draft.completionNote.trim();
   input.evidenceRefs=draft.evidenceRefs.map(ref=>Object.fromEntries((ref.kind==='formal_response_ref'?['kind','responseId','assignmentId','revisionNo','contentHash']:['kind','artifactId','version','contentHash','sourceSnapshotHash']).map(key=>[key,ref[key]])));
  }
  void submit({action:'transition',input,taskId:task.id});
 }
 const loadEvidence=useCallback((query,signal)=>formal?Promise.resolve({items:[],nextCursor:null,availability:'restricted'}):client.current.loadEvidenceOptions(scopeRef.current,query,signal),[]);
 function review(draft,task){if(busy||unknown)return;void submit({action:'review',taskId:task.id,input:{requestKey:crypto.randomUUID(),expectedVersion:task.version,decision:draft.decision,note:draft.note.trim()}});}
 function remind(task){if(busy||unknown)return;void submit({action:'remind',taskId:task.id,input:{requestKey:crypto.randomUUID(),expectedVersion:task.version}});}
 const loadLinks=useCallback((query,signal)=>formal?Promise.resolve({items:[],nextCursor:null,availability:'restricted'}):client.current.loadLinkOptions(scopeRef.current,query,signal),[]);
 function link(context,task){if(busy||unknown)return;void submit({action:'link',taskId:task.id,input:{requestKey:crypto.randomUUID(),expectedVersion:task.version,context}});}
 async function moreParticipants(){if(!participantsCursor)return;const token=epoch.current;try{const next=await client.current.loadParticipants(scopeRef.current,{cursor:participantsCursor});if(token===epoch.current){if(next.nextCursor===participantsCursor)throw Error('成员列表无法继续，请重新读取。');setParticipants(old=>[...new Map([...old,...next.items].map(p=>[p.id,p])).values()]);setParticipantsCursor(next.nextCursor);}}catch(e){if(token===epoch.current)reject(e);}}
 async function moreDependencies(){if(!relations.nextCursor)return;const token=epoch.current;try{const next=await client.current.loadTaskPage(scopeRef.current,{cursor:relations.nextCursor});if(token===epoch.current)setRelations(old=>({items:[...new Map([...old.items,...next.items].map(t=>[t.id,t])).values()],nextCursor:next.nextCursor}));}catch(e){if(token===epoch.current)reject(e);}}
 async function recover(){const token=epoch.current;setBusy(true);setNotice('');try{const receipt=await client.current.loadReceipt(scopeRef.current,unknown.input.requestKey);if(token!==epoch.current)return;if(formal){if(!validFormalTaskReceipt(receipt,formalMarker.current))throw Error('上次结果暂不能核对。');await client.current.loadTask(scopeRef.current,receipt.taskId);if(token!==epoch.current)return;forgetFormal();}setUnknown(null);setEditing(null);setFormKey(crypto.randomUUID());resetDrafts();setNotice('原提交已核对成功，没有重复创建。');await refresh();if(token===epoch.current)await select(receipt.taskId);}catch(e){if(token!==epoch.current)return;if(e.status===404){setUnknown(old=>({...old,notFound:true}));setError(formal?'暂未查到上次结果，请保留当前状态并稍后继续核对。':'尚未查到回执，不代表原提交必未发生；可显式使用同一编号重试。');}else reject(e);}finally{if(token===epoch.current)setBusy(false);}}
 useEffect(()=>{if(!formal||!unknown)return;const timer=setInterval(()=>{if(pendingMemory.current&&performance.now()-pendingMemory.current.at>=900000){pendingMemory.current=null;setUnknown(old=>old?{action:old.action,taskId:old.taskId,input:{requestKey:old.input.requestKey},markerOnly:true}:old);setEditing(null);setSelected(null);setFormKey(crypto.randomUUID());resetDrafts();}},1000);return()=>clearInterval(timer);},[unknown]);
 useEffect(()=>{if(formal)document.title='执行任务｜岐研';void initialize();const leave=e=>{if(dirtyRef.current||formalMarker.current){e.preventDefault();e.returnValue='';}};const navigate=async e=>{if(!(dirtyRef.current||formalMarker.current)||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href],button[data-page],.qiyan-context-breadcrumb button,.qiyan-header-brand');if(!a||a.target==='_blank')return;let href=a.href;if(a.dataset.page)href='/pages/'+a.dataset.page+'/';else if(a.closest('.qiyan-context-breadcrumb'))href=a.textContent==='研究概览'&&formal?'/pages/s01/?'+new URLSearchParams({researchStudy:'1',studyId:route.studyId}):'/pages/p01/';else if(a.matches('.qiyan-header-brand'))href='/pages/p002/';if(!href)return;e.preventDefault();e.stopPropagation();if(await confirm('离开将放弃未保存任务输入；未知结果仍须返回后核对。')){resetDrafts();formalMarker.current=null;location.assign(href);}};document.addEventListener('click',navigate,true);const changed=()=>void initialize();const identity=e=>{if(e.detail?.status==='checking')return;if(e.detail?.authenticated&&(!contextRef.current||e.detail.id!==contextRef.current.actor.id||formal&&Number.isSafeInteger(e.detail.authVersion)&&e.detail.authVersion!==authVersion.current))void initialize();else if(e.detail?.status==='anonymous'||e.detail?.authenticated===false){clear();setLoading(false);setError('登录已失效，私有任务内容已清除。');}};window.addEventListener('beforeunload',leave);window.addEventListener('qiyan:auth-changed',changed);window.addEventListener('qiyan:user-change',identity);return()=>{document.removeEventListener('click',navigate,true);window.removeEventListener('beforeunload',leave);window.removeEventListener('qiyan:auth-changed',changed);window.removeEventListener('qiyan:user-change',identity);epoch.current++;client.current.invalidate();};},[]);
 useEffect(()=>{
  let disposed=false;
  async function recheck(){
   if(disposed||polling.current||!contextRef.current||document.visibilityState==='hidden')return;
   const token=epoch.current,target=selectedRef.current,sequence=selection.current;polling.current=true;
   try{
    if(formal){const me=await client.current.request('/auth/me');if(token!==epoch.current)return;if(me.accountId!==actorRef.current||me.authVersion!==authVersion.current){clear();setError('登录状态已变化，未保存任务内容已清除。');return;}}const ctx=await client.current.loadContext(scopeRef.current);if(disposed||token!==epoch.current)return;setContext(ctx);
    if(target){const value=(await client.current.loadTask(scopeRef.current,target.id)).item;if(disposed||token!==epoch.current||selectedRef.current?.id!==target.id||sequence!==selection.current)return;
     if(dirtyParts.current.detail||dirtyParts.current.context||conflictRef.current)setSelected(old=>old?.id===value.id?{...old,context:value.context,evidence:value.evidence,capabilities:value.capabilities}:old);
     else setSelected(old=>old?.id===value.id&&old.version>value.version?old:value);
    }
   }catch(e){if(!disposed&&token===epoch.current)reject(e);}finally{polling.current=false;}
  }
  const timer=setInterval(()=>void recheck(),3000),visible=()=>void recheck();window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 useEffect(()=>{const find=()=>{const slot=document.querySelector('[data-page-context="s08"] .qiyan-page-actions');if(slot)setHeaderSlot(slot);};find();const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
 useEffect(()=>{if(headerSlot)window.dispatchEvent(new CustomEvent('qiyan:study-task-presentation',{detail:context}));},[context,headerSlot]);
 const switcher=!formal&&context&&headerSlot?createPortal(<label className="s08-study-select">切换Study<select value={context.scope.researchProjectId} disabled={busy||loading||Boolean(unknown)} onChange={async e=>{if(dirtyRef.current&&!await confirm('放弃未保存修改并切换研究？'))return;const target=studies.find(s=>s.id===e.target.value);if(target)location.assign(studyTasksUrl({studyGroupId:target.studyGroupId,researchProjectId:target.id}));}}>{studies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>,headerSlot):null;
 const conflictContent=conflict?<StudyTaskConflict conflict={conflict} busy={busy} onConfirm={()=>{const next=rebaseTaskSubmission(conflict.pending,conflict.latest);void submit(next);}} onDiscard={async()=>{if(!await confirm('确定放弃本次未保存的草稿并读取当前任务？'))return;setConflict(null);conflictRef.current=null;setEditing(null);setFormKey(crypto.randomUUID());resetDrafts();setSelected(conflict.latest);setError('');}}/>:null;
 return <FormalTaskMode.Provider value={formal?{studyId:route?.studyId,client:client.current}:null}>{switcher}<StudyTasksLayout formal={formal} context={context} participants={participants} participantsCursor={participantsCursor} onMoreParticipants={moreParticipants} page={page} relations={relations} listState={listState} onFilter={filter} onPage={turnPage} selected={selected} loading={loading} busy={busy||Boolean(conflict)} conflictContent={conflictContent} error={error} notice={notice} editing={editing} formKey={formKey} onSave={save} onDirty={onDirty} onDetailDirty={onDetailDirty} onContextDirty={onContextDirty} onAssign={assign} onMoreDependencies={moreDependencies} onTransition={transition} onReview={review} onRemind={remind} onLink={link} loadLinks={loadLinks} loadEvidence={loadEvidence} onError={reject} onCancel={async()=>{if(!dirtyParts.current.form||await confirm('放弃未保存修改？')){setEditing(null);setFormKey(crypto.randomUUID());}}} onSelect={select} onEdit={async task=>{if(!dirtyRef.current||await confirm('放弃当前表单未保存修改并编辑任务？')){setEditing(task);setFormKey(task.id+':'+task.version);}}} onRefresh={refresh} unknown={unknown} onRecover={recover} onRetry={()=>{if(!formal||pendingMemory.current&&performance.now()-pendingMemory.current.at<900000)void submit(formal?pendingMemory.current.pending:unknown);}}/></FormalTaskMode.Provider>;
}

export default function StudyTasks(){return <TaskConfirmation><TaskWorkspace/></TaskConfirmation>;}
