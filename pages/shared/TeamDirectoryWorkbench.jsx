import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {createDirectoryClient} from '../../src/directory-session.js';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import TeamWorkspaceDialog from './TeamWorkspaceDialog.jsx';
import {emptyTeam,TeamFields,TeamWorkspacePreview} from './TeamWorkspaceFields.jsx';
import TeamReviewDialog,{TeamReviewControls} from './TeamReviewDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {prepareTeamReview,teamEditRevision,requiresPublicConfirmation,manualInstitutionKey,teamReviewCheckKey,teamReviewCheckOutcome} from '../../src/team-review-flow.js';
import {TeamWorkspaceList} from './TeamWorkspaceList.jsx';
import {sameTeamDraft} from '../../src/team-draft-equality.js';
import {governanceTarget} from '../../src/governance-overview.js';
import './team-workspace.css';
const copy=value=>JSON.parse(JSON.stringify(value));
export default function TeamDirectoryWorkbench({showTaskDescription=true}){
 const client=useMemo(()=>createDirectoryClient(),[]),identity=useDirectoryIdentity();
 const [items,setItems]=useState([]),[pagination,setPagination]=useState(null),[query,setQuery]=useState(''),[page,setPage]=useState(1),[workspace,setWorkspace]=useState(null),[data,setData]=useState(emptyTeam),[baseline,setBaseline]=useState(null),[preview,setPreview]=useState(null),[confirmation,setConfirmation]=useState(null),[audience,setAudience]=useState('tenant'),[reason,setReason]=useState(''),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[pending,setPending]=useState(null),[comparison,setComparison]=useState(null);
 const epoch=useRef(0),locked=useRef(false),lastIdentity=useRef(''),pendingRef=useRef(null),dirtyRef=useRef(false),root=useRef(null),selection=useRef(null),reviewTrigger=useRef(null);
 const [actionConfirmation,setActionConfirmation]=useState(null);
 const requestedTeam=useRef(false);
 const [editorOpen,setEditorOpen]=useState(false);const editorTrigger=useRef(null),editorTarget=useRef(null);
 const [listRefreshing,setListRefreshing]=useState(false),[listFailed,setListFailed]=useState(false),[reviewCheck,setReviewCheck]=useState(null),[reviewRetry,setReviewRetry]=useState(0);const listSeq=useRef(0),listLocation=useRef({q:'',page:1});
 const [verificationState,setVerificationState]=useState(null),[verificationRefresh,setVerificationRefresh]=useState(0),verificationKey=manualInstitutionKey(data),verificationReady=verificationKey===null||verificationKey==='[]'||verificationState?.key===verificationKey&&verificationState.ready;
 const dirty=workspace&&!sameTeamDraft(data,baseline);dirtyRef.current=!!dirty||!!reason.trim()||!!pending||busy;selection.current=workspace?.id;
 const reviewKey=teamReviewCheckKey(workspace,dirty,audience),reviewState=reviewKey?(reviewCheck?.key===reviewKey?reviewCheck.status:'checking'):null,reviewBlocked=Boolean(reviewKey)&&reviewState!=='needed';
 function clear(){setActionConfirmation(null);setWorkspace(null);setData(emptyTeam());setBaseline(null);setPreview(null);setConfirmation(null);setPending(null);pendingRef.current=null;setComparison(null);setReason('');setAudience('tenant');}
 function reject(e){if(e.name==='AbortError')return;setError(e.message);setErrorCode(e.code??'');if(e.status===401||e.status===403&&e.code!=='DIRECTORY_ORIGIN_REJECTED'){clear();setEditorOpen(false);setReady(false);setItems([]);}}
 async function listing(q=listLocation.current.q,p=listLocation.current.page){const n=epoch.current,s=++listSeq.current;setListRefreshing(true);try{const result=await client.teamWorkspaces({q,page:p});if(n===epoch.current&&s===listSeq.current){setItems(result.items);setPagination(result.pagination);setPage(p);listLocation.current={q,page:p};setListFailed(false);setReady(true);return true;}}catch(e){if(n===epoch.current&&s===listSeq.current){setListFailed(true);reject(e);}}finally{if(n===epoch.current&&s===listSeq.current)setListRefreshing(false);}return false;}
 useEffect(()=>{
  epoch.current++;client.invalidate();setReady(false);setBusy(false);setListRefreshing(false);setListFailed(false);locked.current=false;setPreview(null);setConfirmation(null);setActionConfirmation(null);
  if(identity.checking)return;
  if(lastIdentity.current!==identity.identityKey){clear();setEditorOpen(false);setItems([]);setError('');setNotice('');lastIdentity.current=identity.identityKey;}else if(pendingRef.current)setPending(pendingRef.current);
  void listing();return()=>{epoch.current++;client.invalidate();};
 },[identity.checking,identity.identityKey,identity.unavailable]);
 useEffect(()=>{
  if(requestedTeam.current||!ready||identity.checking||identity.unavailable||!new URLSearchParams(window.location.search).has('team'))return;
  requestedTeam.current=true;const target=governanceTarget(window.location.search,'teams');
  if(target)void select(target);else setError('团队标识不正确，请从团队列表重新选择。');
 },[ready,identity.checking,identity.identityKey,identity.unavailable]);
 useEffect(()=>{if(!reviewKey||busy||pending||!ready||identity.checking||!verificationReady)return;let active=true;const n=epoch.current;setReviewCheck({key:reviewKey,status:'checking'});void client.previewTeamWorkspace(workspace.id,audience).then(result=>{if(active&&n===epoch.current)setReviewCheck({key:reviewKey,status:teamReviewCheckOutcome(result)});}).catch(e=>{if(!active||n!==epoch.current||e.name==='AbortError')return;if(e.status===401||e.status===403&&e.code!=='DIRECTORY_ORIGIN_REJECTED')reject(e);else setReviewCheck({key:reviewKey,status:'failed'});});return()=>{active=false;};},[reviewKey,reviewRetry,busy,!!pending,ready,identity.checking,verificationReady]);
 useEffect(()=>{const protect=e=>{if(dirtyRef.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[]);
 function confirmAction({title,description,label,run}){setActionConfirmation({title,description,label,run,epoch:epoch.current,trigger:document.activeElement});}
 function leaveTeam(run){if(locked.current||pendingRef.current||!ready||identity.checking)return;if(!dirtyRef.current){run();return;}confirmAction({title:'放弃当前修改？',description:'当前团队尚有未保存的修改。继续将离开当前团队，未保存的输入不会保留。',label:'放弃并继续',run});}
 function restoreEditorFocus(){requestAnimationFrame(()=>{const target=editorTrigger.current?.isConnected?editorTrigger.current:root.current?.querySelector('[data-new-team]');target?.focus({preventScroll:true});});}
 function closeEditor(){if(locked.current||pendingRef.current){setNotice(pendingRef.current?'提交结果尚未确认，请先核对原提交结果。':'正在处理，请稍候再关闭。');return;}leaveTeam(()=>{epoch.current++;client.invalidate();setEditorOpen(false);clear();setError('');setErrorCode('');setNotice('');const last=listLocation.current;void listing(last.q,last.page).then(ok=>{if(ok)restoreEditorFocus();});});}
 function newTeam(){clear();editorTarget.current=null;setEditorOpen(true);setWorkspace({id:null,version:0});setBaseline(emptyTeam());setNotice('请填写团队名称，其他资料可稍后补齐。');}
 function apply(w,preserveReview=false){const form={...copy(w.data),verificationMethod:w.data.verificationMethod??'administrator'};setVerificationState(null);setVerificationRefresh(v=>v+1);setWorkspace(w);setData(form);setBaseline(copy(form));setPreview(null);setConfirmation(null);setComparison(null);if(!preserveReview){setReason('');setAudience(w.publishedAudience??'tenant');}}
 async function select(id,trigger){if(locked.current||pendingRef.current||!ready||identity.checking)return;editorTrigger.current=trigger??document.activeElement;editorTarget.current=id;setEditorOpen(true);const n=++epoch.current;client.invalidate();setBusy(true);locked.current=true;setError('');setErrorCode('');setNotice('');setAudience('tenant');setWorkspace(null);setPreview(null);try{const w=await client.teamWorkspace(id);if(n===epoch.current){apply(w);root.current?.querySelector('input[name=teamName]')?.focus();}}catch(e){if(n===epoch.current)reject(e);}finally{if(n===epoch.current){setBusy(false);locked.current=false;}}}
 function change(next){setData(next);setPreview(null);setConfirmation(null);setNotice('');}
 async function complete(result,n,preserveReview=false){let w;try{w=await client.teamWorkspace(result.id);}catch(e){if(n!==epoch.current||e.name==='AbortError'||e.status===401||e.status===403&&e.code!=='DIRECTORY_ORIGIN_REJECTED')throw e;throw Object.assign(Error('提交已返回成功，资料暂未回读完成；请核对原提交结果，不要重新提交。'),{status:503,uncertain:true,postCommit:true,cause:e});}if(n!==epoch.current)return;apply(w,preserveReview);if(!await listing()){if(!pendingRef.current)return false;throw Object.assign(Error('提交后的列表暂未刷新，请核对原提交结果；不会重复提交。'),{status:503,uncertain:true});}return true;}
 async function perform(request,n){pendingRef.current=request;setConfirmation(null);
  try{const result=request.operation==='create'?await client.createTeamWorkspace(request.body):request.operation==='save'?await client.saveTeamWorkspace(request.id,request.body):await client.reviewTeamWorkspace(request.id,request.body);
   if(n!==epoch.current)return;if(!await complete(result,n,request.operation!=='review'))return;if(n!==epoch.current)return;pendingRef.current=null;setPending(null);if(request.operation==='review'){setEditorOpen(false);clear();}setNotice(request.operation==='review'?'审核通过，已按所选范围展示。':'草稿已保存，尚未审核展示。');
  }catch(e){if(n!==epoch.current)return;if(request.operation==='review')setPreview(null);reject(e);if(e.status===401||e.status===403&&e.code!=='DIRECTORY_ORIGIN_REJECTED')return;if(e.uncertain||pendingRef.current&&e.status>=500)setPending(request);else{pendingRef.current=null;setPending(null);}}
 }
 async function submit(request){if(locked.current||!ready||identity.checking||pendingRef.current&&pendingRef.current!==request)return;const n=epoch.current;locked.current=true;setBusy(true);setError('');setErrorCode('');setNotice('');try{await perform(request,n);}finally{if(n===epoch.current){locked.current=false;setBusy(false);}}}
 function save(){if(!data.name.trim()){setError('请填写团队名称。');root.current?.querySelector('[name=teamName]')?.focus();return;}const body={data:{...copy(data),directions:data.directions.map(x=>x.trim()).filter(Boolean)},requestKey:crypto.randomUUID()};void submit(workspace.id?{operation:'save',id:workspace.id,body:{...body,expectedVersion:workspace.version,baseRevision:teamEditRevision(workspace)}}:{operation:'create',body});}
 async function startReview(){
  if(locked.current||pending||!ready||identity.checking||!workspace||!verificationReady||reviewBlocked)return;
  if(!data.name.trim()){setError('请填写团队名称。');root.current?.querySelector('[name=teamName]')?.focus();return;}
  const n=epoch.current,reviewReason=reason.trim();locked.current=true;setBusy(true);setError('');setErrorCode('');setPreview(null);setConfirmation(null);setNotice(dirty?'正在保存草稿并核验审核条件…':'正在核验审核条件…');
  try{const result=await prepareTeamReview({client,workspace,data:copy(data),dirty,audience,requestKey:crypto.randomUUID(),institutionSnapshots:verificationState?.snapshots??[],onInstitutionsChanged:()=>{setVerificationState(null);setVerificationRefresh(v=>v+1);},isCurrent:()=>n===epoch.current,onRequest:r=>{pendingRef.current=r;},onSaved:async w=>{apply(w,true);pendingRef.current=null;setPending(null);await listing();}});
   if(n!==epoch.current)return;setPreview(result);setNotice('');
   if(!result.canApprove){setTimeout(()=>root.current?.querySelector('.team-review-feedback')?.focus(),0);return;}
   const request={operation:'review',id:result.id,body:{expectedVersion:result.version,planHash:result.planHash,audience:result.audience,reason:reviewReason,requestKey:crypto.randomUUID()}};
   if(requiresPublicConfirmation(result))setConfirmation(request);else await perform(request,n);
  }catch(e){if(n===epoch.current){reject(e);if(pendingRef.current&&(e.uncertain||e.status>=500))setPending(pendingRef.current);else pendingRef.current=null;}}
  finally{if(n===epoch.current){setBusy(false);locked.current=false;}}
 }
 async function receipt(){if(locked.current||!pending)return;const n=epoch.current;locked.current=true;setBusy(true);setError('');try{const id=pending.id??(await client.operation(pending.body.requestKey,'entity_create')).id,r=await client.teamWorkspaceReceipt(id,pending.body.requestKey);if(n!==epoch.current)return;if(!await complete(r.result,n,pending.operation!=='review'))return;if(n===epoch.current){setPending(null);pendingRef.current=null;if(pending.operation==='review'){setEditorOpen(false);clear();}setNotice('已核对原提交回执并读取服务器资料，没有重复提交。');}}catch(e){if(n===epoch.current)reject(e);}finally{if(n===epoch.current){locked.current=false;setBusy(false);}}}
 async function compare(){if(locked.current||!workspace?.id)return;const n=epoch.current;setBusy(true);locked.current=true;try{const w=await client.teamWorkspace(workspace.id);if(n===epoch.current){setVerificationState(null);setVerificationRefresh(v=>v+1);setComparison(w);setTimeout(()=>root.current?.querySelector('[data-team-comparison]')?.focus(),0);}}catch(e){if(n===epoch.current)reject(e);}finally{if(n===epoch.current){locked.current=false;setBusy(false);}}}
 const disabled=busy||!!pending||!ready||identity.checking||listRefreshing||listFailed;
 const listRecovery=<div><p>列表尚未更新，请刷新后继续。当前输入已保留。</p><Button disabled={busy||listRefreshing||identity.checking} onClick={()=>{setError('');void listing();}}>刷新团队列表</Button></div>;
 const reviewControls=<><TeamReviewControls audience={audience} onAudience={value=>{setAudience(value);setPreview(null);setConfirmation(null);}} reason={reason} onReason={value=>{setReason(value);setPreview(null);setConfirmation(null);}} disabled={disabled}/>{reviewState==='unchanged'&&<p className="team-helper" role="status">没有待审变更。</p>}{reviewState==='failed'&&<div role="alert">暂时无法核对审核状态，请重试。<Button disabled={disabled} onClick={()=>setReviewRetry(v=>v+1)}>重新核对审核状态</Button></div>}</>;
 const feedback=<><div className="team-feedback" role={error?'alert':'status'}>{identity.checking?'正在核对当前身份…':error||notice||(!ready?'正在读取团队目录…':'')}{busy&&<span> 正在处理…</span>}</div>
  {errorCode==='DIRECTORY_VERSION_CONFLICT'&&workspace?.id&&!comparison&&<Button disabled={busy||!!pending} onClick={()=>void compare()}>查看最新资料</Button>}</>;
 return <div className="team-workbench" ref={root} aria-busy={busy||identity.checking}>
  {showTaskDescription&&<p className="team-helper">草稿仅管理员可见，审核通过后按所选范围展示。</p>}
  {(!editorOpen||!ready||identity.checking)&&feedback}
  {!editorOpen&&listRefreshing&&<p role="status">正在刷新团队列表…</p>}
  {!editorOpen&&ready&&listFailed&&listRecovery}
  {!ready&&!identity.checking&&<Button disabled={busy} onClick={()=>void listing()}>重新读取团队目录</Button>}
  {ready&&!identity.checking&&<>
   <div className="team-search-toolbar"><div className="team-search-group"><label>查找团队<input type="search" placeholder="输入团队名称" value={query} maxLength={120} disabled={busy||!!pending} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void listing(query,1);}}}/></label><Button disabled={disabled} onClick={()=>void listing(query,1)}>查找团队</Button></div><Button disabled={disabled} data-new-team onClick={e=>{editorTrigger.current=e.currentTarget;leaveTeam(newTeam);}}>新建团队</Button></div>
   <TeamWorkspaceList items={items} selected={workspace?.id} onSelect={(id,trigger)=>leaveTeam(()=>void select(id,trigger))} disabled={disabled}/>
   {(pagination?.totalPages??0)>1&&<div className="team-form-actions"><Button disabled={disabled||page<=1} onClick={()=>void listing(listLocation.current.q,page-1)}>上一页团队</Button><span>第{page}／{pagination.totalPages}页</span><Button disabled={disabled||page>=pagination.totalPages} onClick={()=>void listing(listLocation.current.q,page+1)}>下一页团队</Button></div>}
  </>}
  {editorOpen&&ready&&!identity.checking&&<TeamWorkspaceDialog title={workspace?.id?'审核：'+workspace.data.name:workspace?'新建团队':'读取团队资料'} onClose={closeEditor} onAfterClose={restoreEditorFocus} busy={busy} footer={workspace?<><div className="team-form-actions team-submit-actions"><Button disabled={disabled||!dirty&&workspace.hasDraft} onClick={save}>保存草稿</Button><Button primary disabled={disabled||!verificationReady||reviewBlocked} onClick={e=>{reviewTrigger.current=e.currentTarget;void startReview();}}>{reviewState==='unchanged'?'已审核':reviewState==='checking'?'正在核对…':reviewState==='failed'?'审核状态待核对':'审核通过并展示'}</Button></div></>:null}>
   {feedback}
   {editorOpen&&ready&&listFailed&&listRecovery}
   {!workspace?<div><p>{busy?'正在读取团队资料…':'团队资料尚未读取成功。'}</p><Button disabled={busy} onClick={()=>void select(editorTarget.current,editorTrigger.current)}>重新读取团队资料</Button></div>:<>
    <div className="team-form-title"><p>{dirty?'有未保存修改':workspace.reviewedVersion===workspace.version&&workspace.id?'当前资料已审核':workspace.hasPublished?'有待审修改，当前仍展示上次审核内容。':workspace.id?'待首次审核':'尚未保存'}{workspace.savedAt?' · 上次保存 '+new Date(workspace.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):''}</p></div>
    {pending&&<section className="team-form-section" aria-label="核对未确认提交"><p>上次提交结果未确认。输入与原提交编号已保留，不会自动重试；核对前不能开始新操作。</p><Button disabled={busy} onClick={()=>void receipt()}>核对原提交结果</Button><Button disabled={busy} onClick={()=>void submit(pending)}>按原内容重试</Button></section>}
    <TeamFields key={workspace.id??'new-team'} data={data} onChange={change} client={client} disabled={disabled} onVerificationState={setVerificationState} verificationRefresh={verificationRefresh} reviewControls={reviewControls}/>
    {preview&&!confirmation&&<TeamWorkspacePreview preview={preview}/>}
    {comparison&&<section className="team-form-section" tabIndex={-1} data-team-comparison><h3>最新资料对照</h3><p>你的输入仍在上方表单中，尚未被覆盖。</p><h4>服务器草稿</h4><p>{comparison.data.name}</p><p>{comparison.data.summary||'简介未填写'}</p><p>所属机构：{comparison.data.organization?.name||'未填写'}；地区：{[comparison.data.region,comparison.data.city].filter(Boolean).join(' / ')||'未填写'}</p><p>备注：{comparison.data.notes||'未填写'}</p><ul>{comparison.data.members.map(m=><li key={m.key}>{m.name} · {m.role==='lead'?'负责人':m.role==='co_lead'?'共同负责人':'成员'}</li>)}</ul><details><summary>当前目录资料</summary><p>{comparison.currentData.name}</p><p>{comparison.currentData.summary}</p><p>{comparison.currentData.organization?.name}</p><ul>{comparison.currentData.members.map(m=><li key={m.key}>{m.name} · {m.role==='lead'?'负责人':m.role==='co_lead'?'共同负责人':'成员'}</li>)}</ul></details><p>选择保留输入后仍须手动保存，不会自动覆盖或批准。</p><Button disabled={disabled} onClick={()=>{setWorkspace({...comparison,baseRevision:comparison.currentRevision});setBaseline(copy(comparison.data));setComparison(null);setPreview(null);setError('');setErrorCode('');setNotice('已保留你的输入，请核对后保存草稿或继续审核。');}}>保留我的输入</Button><Button disabled={disabled} onClick={()=>{const snapshot=comparison;confirmAction({title:'使用服务器草稿？',description:'当前未保存的输入将被服务器草稿替换。服务器中的资料不会被修改。',label:'使用服务器草稿',run:()=>{if(comparison!==snapshot)return;apply(snapshot);setError('');setErrorCode('');root.current?.querySelector('[name=teamName]')?.focus();}});}}>使用服务器草稿</Button></section>}
   <details className="team-more"><summary>更多操作</summary>{workspace?.verifications?.length>0&&<details className="team-form-section"><summary>人工核实记录</summary><ul>{workspace.verifications.map(v=><li key={v.id}>{v.actorDisplayName} · {new Date(v.verifiedAt).toLocaleString('zh-CN')} · {v.audience==='public'?'公开访客':'仅租户成员'}{v.reason&&<p>{v.reason}</p>}</li>)}</ul></details>}{workspace?.history?.length>0&&<details className="team-form-section"><summary>保存与审核历史</summary><ul>{workspace.history.map((e,i)=><li key={i}>{e.operation==='review'?'审核展示':e.operation==='create'?'创建草稿':'保存草稿'} · {new Date(e.at).toLocaleString('zh-CN')}</li>)}</ul></details>}</details>
   </>}
    {confirmation&&preview&&<TeamReviewDialog returnFocus={reviewTrigger.current} preview={preview} busy={disabled} onClose={()=>{setConfirmation(null);setPreview(null);}} onConfirm={()=>void submit(confirmation)}/>}
  </TeamWorkspaceDialog>}
  {actionConfirmation&&<ConfirmDialog title={actionConfirmation.title} confirmLabel={actionConfirmation.label} returnFocus={actionConfirmation.trigger} fallbackFocus={root.current?.querySelector('[name=teamName]')} busy={disabled} onCancel={()=>setActionConfirmation(null)} onConfirm={()=>{if(disabled||locked.current||pendingRef.current)return;setActionConfirmation(null);if(actionConfirmation.epoch===epoch.current)actionConfirmation.run();}}><p>{actionConfirmation.description}</p></ConfirmDialog>}
 </div>;
}
