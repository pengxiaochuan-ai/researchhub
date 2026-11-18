import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {createGovernanceUsersClient} from '../../src/governance-users-session.js';
import {createAccountAccessClient,takeActionToken,validateAccountForm} from '../../src/account-session.js';
import {createAuthClient} from '../../src/auth-session.js';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {readInvitationLocation} from '../../src/invitation-location.js';
import {readInvitationTarget} from '../../src/invitation-exceptions.js';
import {governanceOverviewHref} from '../../src/governance-overview.js';
import {isGovernanceInvitationEntry} from '../../src/member-invitation-route.js';
import GovernanceSectionHeader from './GovernanceSectionHeader.jsx';
import './member-invitations.css';
const enabled=Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG);
function useClients(){return useMemo(()=>({account:createAccountAccessClient({enabled}),auth:createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG})}),[]);}
const labels={pending:'待确认投递',captured:"体验邮件已收取 · 待接受",failed:'投递失败',unknown:'投递结果未确认',accepted:'已接受',revoked:'已撤销',expired:'已过期'};
export default function MemberInvitations({mode='manage'}){return mode==='accept'?<Acceptance/>:<Management/>;}
function Management(){
 const governanceEntry=isGovernanceInvitationEntry(location.search);
 const directory=useDirectoryIdentity(),readController=useRef(null),focused=useRef('');
 const locationInfo=useMemo(()=>{try{return{target:readInvitationLocation(location.search)};}catch(e){return{error:e.message};}},[]);
 const {account,auth}=useClients(),[user,setUser]=useState(null),[selection,setSelection]=useState(''),[scopeInfo,setScopeInfo]=useState(null),[items,setItems]=useState([]),[cursor,setCursor]=useState(null),[email,setEmail]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[clock,setClock]=useState(Date.now()),[fieldError,setFieldError]=useState('');
 const [managed,setManaged]=useState([]),[confirmRevoke,setConfirmRevoke]=useState(null);
 const alive=useRef(true),seq=useRef(0),pending=useRef(false),errorRef=useRef(null),emailRef=useRef(null),key=useRef(crypto.randomUUID()),identity=useRef(null),selected=useRef('');
 selected.current=selection;
 const options=[...new Map([...(user?.studyGroups.flatMap(g=>g.researchProjects.map(p=>({value:g.id+'|'+p.id,label:g.name+' / '+p.name})))??[]),...managed.map(s=>({value:s.studyGroupId+'|'+s.researchProjectId,label:s.groupName+' / '+s.name}))].map(v=>[v.value,v])).values()];
 const scope=value=>{const[groupId,projectId]=value.split('|');return{groupId,projectId};};
 async function readScope(value,token){
  if(!value)return;readController.current?.abort();const controller=new AbortController();readController.current=controller;const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
  const details=await account.invitationContext(scope(value),{signal});if(!alive.current||seq.current!==token)return;setScopeInfo(details);
  if(details.canInvite){const target=locationInfo.target,requested=target&&target.groupId+'|'+target.projectId===value?target.invitationId:undefined;
   const result=requested?await readInvitationTarget((q,options)=>account.listInvitations(scope(value),q,options),requested,{signal}):await account.listInvitations(scope(value),{},{signal});
   if(alive.current&&seq.current===token){setItems(result.items);setCursor(result.nextCursor);if(requested&&!result.found)setNotice('该邀请已不存在或当前不可查看，请刷新状态或返回治理总览。');}
  }
 }
 async function initialize(){if(pending.current)return;pending.current=true;setBusy(true);const token=++seq.current;setError('');try{const current=await auth.me();const manageable=current?await createGovernanceUsersClient().studies():{items:[]};if(alive.current&&seq.current===token)setManaged(manageable.items);if(!alive.current||seq.current!==token)return;setUser(current);if(locationInfo.error)throw Error(locationInfo.error);if(identity.current!==current?.accountId){setEmail('');setItems([]);setCursor(null);setScopeInfo(null);key.current=crypto.randomUUID();}identity.current=current?.accountId;
   const p=new URLSearchParams(location.search),requested=(p.get('studyGroupId')??'')+'|'+(p.get('researchProjectId')??''),available=[...(current?.studyGroups.flatMap(g=>g.researchProjects.map(v=>g.id+'|'+v.id))??[]),...manageable.items.map(s=>s.studyGroupId+'|'+s.researchProjectId)],chosen=available.includes(selected.current)?selected.current:available.includes(requested)?requested:'';setSelection(chosen);setScopeInfo(null);setItems([]);setCursor(null);if(locationInfo.target&&!available.includes(requested))setNotice('该邀请已不存在或当前不可查看，请刷新状态或返回治理总览。');if(chosen)await readScope(chosen,token);
  }catch(e){if(alive.current&&seq.current===token){setScopeInfo(null);setItems([]);setCursor(null);setError(e.message);}}finally{if(alive.current&&seq.current===token){pending.current=false;setBusy(false);}}}
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),1000),focus=()=>initialize();window.addEventListener('focus',focus);window.addEventListener('qiyan:auth-changed',focus);return()=>{alive.current=false;seq.current++;readController.current?.abort();clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('qiyan:auth-changed',focus);};},[]);
 useEffect(()=>{
  seq.current++;readController.current?.abort();pending.current=false;setBusy(false);setScopeInfo(null);setItems([]);setCursor(null);setConfirmRevoke(null);setNotice('');
  if(directory.checking||directory.unavailable||!directory.user.authenticated){setUser(null);setManaged([]);return;}
  void initialize();
 },[directory.identityKey,directory.checking,directory.unavailable]);
 useEffect(()=>{
  const target=locationInfo.target;if(busy||directory.checking||directory.unavailable||!target||selection!==target.groupId+'|'+target.projectId||!items.some(x=>x.id===target.invitationId))return;
  const focusKey=directory.identityKey+':'+selection+':'+target.invitationId;if(focused.current===focusKey)return;
  const row=document.getElementById('invitation-'+target.invitationId);if(row){focused.current=focusKey;row.scrollIntoView({block:'center'});row.focus({preventScroll:true});}
 },[items,selection,busy,directory.identityKey,directory.checking,directory.unavailable]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 async function choose(value){if(pending.current)return;const token=++seq.current;setSelection(value);setScopeInfo(null);setItems([]);setCursor(null);setError('');setNotice('');if(!value)return;pending.current=true;setBusy(true);try{await readScope(value,token);}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current&&seq.current===token){pending.current=false;setBusy(false);}}}
 async function action(operation){if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');const token=seq.current;try{await operation(token);}catch(e){if(alive.current&&seq.current===token){setError(e.message);if(e.status===401||e.status===403){setScopeInfo(null);setItems([]);setCursor(null);}}}finally{if(alive.current&&seq.current===token){pending.current=false;setBusy(false);}}}
 async function refreshList(token){await readScope(selection,token);}
 function submit(e){e.preventDefault();const message=validateAccountForm({email},'request').email;if(message){setFieldError(message);emailRef.current?.focus();return;}setFieldError('');action(async token=>{const result=await account.issueInvitation(scope(selection),{email:email.trim().toLowerCase(),requestKey:key.current});if(!alive.current||seq.current!==token)return;setNotice(result.deliveryStatus==='captured'?"邀请邮件已进入体验收件箱，等待收件人接受；尚未加入成员。":'邀请已登记，但投递未确认；请核对状态，不会自动重发。');setEmail('');key.current=crypto.randomUUID();await refreshList(token);});}
 function changeInvitation(inv,resend){if(!resend&&confirmRevoke?.id!==inv.id){setConfirmRevoke(inv);return;}setConfirmRevoke(null);action(async token=>{const result=await account[resend?'resendInvitation':'revokeInvitation'](scope(selection),inv.id,{baseVersion:inv.version,requestKey:crypto.randomUUID()});if(!alive.current||seq.current!==token)return;setItems(list=>list.map(v=>v.id===inv.id?result:v));setNotice(resend?"已重新发送至体验收件箱；旧链接已失效。":'邀请已撤销，旧链接不能接受；未修改已有成员权限。');});}
 const currentUser=!directory.checking&&!directory.unavailable&&directory.user.authenticated&&user?.accountId===directory.user.id&&user.authVersion===directory.user.authVersion?user:null;
 return <main className="platform-main member-workspace"><div className="wf-content member-content">{governanceEntry&&<GovernanceSectionHeader title="邀请异常" description="选择已授权研究，核对邀请状态并处理异常。" backHref={governanceOverviewHref(locationInfo.target?.overview)}/>}<section className="member-card"><h2>当前账号与研究授权</h2><p>{currentUser?currentUser.displayName+' · '+currentUser.username:directory.unavailable?'身份暂时无法核对，请检查网络后重试。':'正在核验登录身份。'}{busy?' · 正在核对…':''}</p>
  {!currentUser?directory.user.authenticated||directory.checking||directory.unavailable?<p>正在核对账号与研究授权…</p>:<a href="/pages/p003/">前往登录</a>:options.length?<label htmlFor="member-study">选择已授权Study<select id="member-study" value={selection} onChange={e=>choose(e.target.value)} disabled={busy}><option value="">请选择研究，不自动进入示例</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>:<p>当前尚未加入私有研究。请负责人发送邀请，并在邮件中明确接受；注册不会自动加组。</p>}
  <Button disabled={busy||directory.checking} onClick={initialize}>刷新会话与授权</Button></section>
  {error&&<p className="member-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}{currentUser&&notice&&<p className="member-notice" role="status">{notice}</p>}
  {currentUser&&scopeInfo&&<section className="member-card"><h2>{scopeInfo.researchProject.name}</h2><p>课题组：{scopeInfo.studyGroup.name} · 当前角色：{scopeInfo.roleName}</p><p>新成员仅加入此Study，获得最小只读身份；不授予Agent、审批、锁库、发布、共享或导出。</p>
   {scopeInfo.canInvite?<><form onSubmit={submit} noValidate><label htmlFor="member-email">受邀体验邮箱<input id="member-email" type="email" autoComplete="email" ref={emailRef} value={email} disabled={busy} onChange={e=>{setEmail(e.target.value);setFieldError('');key.current=crypto.randomUUID();}} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError?'member-email-error':undefined} placeholder="name@example.test"/></label>{fieldError&&<p id="member-email-error" className="member-error">{fieldError}</p>}<Button primary type="submit" loading={busy}>发送Study邀请</Button></form><p>体验邮件不向外发送。受邀人须使用匹配的已验证邮箱登录，并明确接受邀请。</p>
   <div className="member-toolbar"><h3>邀请记录</h3><Button disabled={busy} onClick={()=>action(refreshList)}>刷新邀请状态</Button></div>
   {items.length?<ul className="member-list">{items.map(inv=><li key={inv.id} id={'invitation-'+inv.id} tabIndex={-1} data-invitation-selected={locationInfo.target?.invitationId===inv.id&&locationInfo.target.groupId+'|'+locationInfo.target.projectId===selection?'true':undefined}><strong>{inv.email}</strong><p>{labels[inv.status]} · 有效期至 {new Date(inv.expiresAt).toLocaleString()}</p>{!['accepted','revoked'].includes(inv.status)&&<div className="member-actions"><Button disabled={busy||clock<Date.parse(inv.resendAfter)} onClick={()=>changeInvitation(inv,true)}>显式重发</Button><Button danger disabled={busy} onClick={()=>changeInvitation(inv,false)}>撤销邀请</Button>{clock<Date.parse(inv.resendAfter)&&<span>重发还需 {Math.ceil((Date.parse(inv.resendAfter)-clock)/1000)} 秒</span>}</div>}</li>)}</ul>:<p>当前Study暂无邀请记录。</p>}
   {cursor&&<Button disabled={busy} onClick={()=>action(async token=>{const next=await account.listInvitations(scope(selection),{cursor});if(alive.current&&seq.current===token){setItems(list=>[...list,...next.items]);setCursor(next.nextCursor);}})}>加载更多邀请</Button>}</>:<p>当前为该Study最小只读身份，没有邀请或成员管理权限。</p>}
  </section>}
 {currentUser&&confirmRevoke&&<ConfirmDialog title="撤销邀请" confirmLabel="撤销邀请" onCancel={()=>setConfirmRevoke(null)} onConfirm={()=>changeInvitation(confirmRevoke,false)}><p>撤销发给 {confirmRevoke.email} 的当前Study邀请？旧链接将失效，不移除已有成员。</p></ConfirmDialog>}
 </div></main>;
}
function Acceptance(){
 const {account,auth}=useClients(),[token,setToken]=useState(()=>takeActionToken('invite')),[user,setUser]=useState(null),[preview,setPreview]=useState(null),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const alive=useRef(true),pending=useRef(false),generation=useRef(0),activeToken=useRef(token),previewToken=useRef(''),key=useRef(crypto.randomUUID()),errorRef=useRef(null);
 const isCurrent=current=>alive.current&&generation.current===current;
 async function load(){
  if(pending.current)return;
  const current=++generation.current,requestToken=activeToken.current;
  pending.current=true;previewToken.current='';setPreview(null);setResult(null);setBusy(true);setError('');
  try{
   const identity=await auth.me();if(!isCurrent(current))return;setUser(identity);
   if(!identity){setError('请先登录，再重新打开原邀请邮件。');return;}
   if(!requestToken){setError('链接凭证未提供或已从地址栏移除。请重新从原邮件打开，不会自动接受。');return;}
   const details=await account.previewInvitation({token:requestToken});if(!isCurrent(current))return;
   previewToken.current=requestToken;setPreview(details);
  }catch(e){if(isCurrent(current)){setPreview(null);setError(e.message);}}
  finally{if(isCurrent(current)){pending.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  alive.current=true;load();
  const invalidate=()=>{generation.current++;pending.current=false;previewToken.current='';setPreview(null);setResult(null);setUser(null);setBusy(false);};
  const receive=()=>{invalidate();activeToken.current=takeActionToken('invite');setToken(activeToken.current);key.current=crypto.randomUUID();setError('链接已切换，请重新核对邀请；原请求结果不会替代当前链接。');};
  const refresh=()=>{invalidate();void load();};
  window.addEventListener('hashchange',receive);window.addEventListener('focus',refresh);window.addEventListener('qiyan:auth-changed',refresh);
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('researchhub-auth'):null;
  channel?.addEventListener('message',event=>{if(event.data?.type==='changed')refresh();});
  return()=>{alive.current=false;generation.current++;channel?.close();window.removeEventListener('hashchange',receive);window.removeEventListener('focus',refresh);window.removeEventListener('qiyan:auth-changed',refresh);};
 },[]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 async function accept(){
  if(pending.current||!preview||!activeToken.current||previewToken.current!==activeToken.current)return;
  const current=++generation.current,requestToken=activeToken.current;pending.current=true;setBusy(true);setError('');
  try{const accepted=await account.acceptInvitation({token:requestToken,requestKey:key.current});if(isCurrent(current)){setResult(accepted);activeToken.current='';previewToken.current='';setToken('');window.dispatchEvent(new Event('qiyan:auth-refresh'));}}
  catch(e){if(isCurrent(current)){previewToken.current='';setPreview(null);setError(e.message);}}
  finally{if(isCurrent(current)){pending.current=false;setBusy(false);}}
 }
 const accepted=result||preview?.alreadyAccepted,scope=result??(preview?{studyGroupId:preview.studyGroup.id,researchProjectId:preview.researchProject.id}:null);
 return <section className="ls-profile-card wp02-access member-accept"><h1>确认Study成员邀请</h1><p>只在登录邮箱与邀请邮箱匹配、邮箱已验证且邀请仍有效时可接受。打开邮件不等于加入研究。</p><p>{user?'当前账号：'+user.displayName+' · '+user.username:'正在核对登录身份…'}</p>
  {error&&<p className="wp02-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
  {preview&&<><h2>{preview.researchProject.name}</h2><p>课题组：{preview.studyGroup.name}</p><p>将获得：{preview.targetRoleName}。不包括其他Study、Agent、审批、锁库、发布、共享或导出。</p><p>有效期至 {new Date(preview.expiresAt).toLocaleString()}</p>{accepted?<p role="status">本邀请已接受。仅此Study的最小成员权限已确认。</p>:<Button type="button" className="ls-primary" loading={busy} onClick={accept}>{preview.targetRoleName==='科研资产成员'?'确认接受科研资产邀请':'确认接受最小只读邀请'}</Button>}</>}
  {accepted&&scope&&<a className="ls-primary" href={'/pages/s11/?'+new URLSearchParams({members:'1',studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId})}>查看此Study的授权范围</a>}
  <div className="ls-auth-links"><a href="/pages/p003/">登录或切换账号</a><a href="/pages/p004/">尚无账号，先注册</a>{!accepted&&<Button disabled={busy||!token} className="ls-secondary" onClick={load}>重新核对邀请</Button>}</div><p className="wp02-help">若刷新清除了凭证，或需先登录/注册，请完成后重新打开原邮件；凭证不保存在本机草稿中。</p>
 </section>;
}
