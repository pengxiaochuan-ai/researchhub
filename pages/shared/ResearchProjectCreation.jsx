import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Shell} from './Shell.jsx';
import {Button,Card} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {readResearchProjectRoute,researchProjectUrl,researchProjectsUrl} from '../../src/research-projects-session.js';
import {createProjectPreparation} from '../../src/project-preparation-session.js';
import {getPlatformUser} from '../../src/platform-user.js';
import {pageRoutes} from '../../src/platform-navigation.js';
import {buildPageRoute,readContext} from '../../src/route-context.js';
import {useResearchProjectAccess} from './research-project-hooks.js';
import './q01-project.css';
import './research-projects.css';

const blank=()=>({title:'',question:'',researchType:'',hubKey:'',pico:{p:'',i:'',c:'',o:''}});
const valuesOf=item=>({title:item.title??'',question:item.question??'',researchType:item.researchType??'',hubKey:item.hubKey??'',pico:{...blank().pico,...item.pico}});
const serialize=value=>JSON.stringify(value);
export default function ResearchProjectCreation(){
 let route,error;try{route=readResearchProjectRoute('q01',location.search);}catch(caught){error=caught.message;}
 return <Shell active="我的工作台" hero={{title:'研究课题',breadcrumb:'我的课题 › 研究课题',subtitle:'明确研究问题，保存后继续研究准备。'}}><div className="content stack q01-project rh-project-creation">{error?<p role="alert">{error}</p>:<ProjectForm initialId={route?.id}/>}</div></Shell>;
}
function ProjectForm({initialId}){
 const [headerSlot,setHeaderSlot]=useState(null);
 const [id,setId]=useState(initialId),[item,setItem]=useState(null),[values,setValues]=useState(blank),[context,setContext]=useState(null),[capabilities,setCapabilities]=useState(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[groupId,setGroupId]=useState(''),[leave,setLeave]=useState(null),[conflict,setConflict]=useState(false),[sessionRevision,setSessionRevision]=useState(0),[recoveryChecked,setRecoveryChecked]=useState(false);
 const base=useRef(serialize(blank())),dirty=useRef(false),active=useRef(true),mutation=useRef(null),valuesRef=useRef(values),readSequence=useRef(0),submittedRef=useRef(null),busyRef=useRef(false),identityRef=useRef(getPlatformUser()),actionSequence=useRef(0);valuesRef.current=values;
 function reset(){readSequence.current++;actionSequence.current++;submittedRef.current=null;setItem(null);setValues(blank());base.current=serialize(blank());setContext(null);setCapabilities(null);setStatus('restricted');setBusy(false);busyRef.current=false;setUnknown(false);setRecoveryChecked(false);setFeedback('');setError('');setGroupId('');setConflict(false);mutation.current?.invalidate();dirty.current=false;}
 const access=useResearchProjectAccess(reset);
 if(!mutation.current)mutation.current=createProjectPreparation({request:(...args)=>access.client.request(...args),projectId:initialId,scope:()=>{const user=getPlatformUser();return user.authenticated?{actorId:user.id,authVersion:user.authVersion,route:location.pathname+location.search}:null;},onSaved:result=>{if(active.current)apply(result,submittedRef.current);}});
 useEffect(()=>{const changed=()=>{const next=getPlatformUser(),previous=identityRef.current;identityRef.current=next;if(next.id!==previous.id||next.authVersion!==previous.authVersion||next.authenticated!==previous.authenticated){access.client.invalidate();reset();setSessionRevision(n=>n+1);}};window.addEventListener('qiyan:user-change',changed);return()=>window.removeEventListener('qiyan:user-change',changed);},[]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;mutation.current?.invalidate();};},[]);
 useEffect(()=>{if(busyRef.current)return;let live=true;const identity=getPlatformUser(),readToken=++readSequence.current;setError('');if(!dirty.current)setStatus(current=>current==='ready'?'ready':'loading');
  Promise.all([access.client.request(id?'/research-projects/'+id:'/research-projects/context'),...(id?[access.client.request('/research-projects/context')]:[])]).then(([data,currentContext])=>{if(!live||readToken!==readSequence.current||identity.id!==getPlatformUser().id||identity.authVersion!==getPlatformUser().authVersion)return;if(currentContext)data={...data,hubs:currentContext.hubs};setContext(data);setCapabilities(data.capabilities??{});setStatus('ready');try{setUnknown(Boolean(mutation.current.pending()));const saved=mutation.current.checkpoint();if(saved?.groupId)setGroupId(saved.groupId);}catch(caught){setError(caught.message);}if(data.item){if(!dirty.current){setItem(data.item);const next=valuesOf(data.item);base.current=serialize(next);setValues(next);}else if(data.item.version!==item?.version)setConflict(true);}}).catch(caught=>{if(!live||readToken!==readSequence.current||caught.code==='RESEARCH_STALE')return;setError(caught.message);if(!dirty.current)setStatus('error');});return()=>{live=false;};
 },[id,access.revision,sessionRevision]);
 useEffect(()=>{const protectedState=()=>{if(dirty.current||mutation.current?.inFlight())return true;try{return Boolean(mutation.current?.pending());}catch{return false;}};const protect=event=>{if(protectedState()){event.preventDefault();event.returnValue='';}};
  const navigate=event=>{if(event.defaultPrevented||!protectedState()||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest?.('a[href],button[data-page],.qiyan-context-breadcrumb button,.qiyan-header-brand');if(!link||link.target==='_blank')return;let href=link.href;if(link.dataset.page)href=buildPageRoute(pageRoutes,link.dataset.page,readContext(location.search));else if(link.closest('.qiyan-context-breadcrumb'))href=link.textContent==='我的工作台'?'/pages/p01/':researchProjectsUrl;else if(link.matches('.qiyan-header-brand'))href='/pages/p00/';if(!href)return;const url=new URL(href,location.href);if(url.href===location.href||url.hash&&url.pathname===location.pathname&&url.search===location.search)return;event.preventDefault();event.stopPropagation();setLeave({url:url.href,trigger:link});};
  window.addEventListener('beforeunload',protect);document.addEventListener('click',navigate,true);return()=>{window.removeEventListener('beforeunload',protect);document.removeEventListener('click',navigate,true);};
 },[]);
 function edit(field,value){const next=field.startsWith('pico.')?{...values,pico:{...values.pico,[field.slice(5)]:value}}:{...values,[field]:value};dirty.current=serialize(next)!==base.current;setValues(next);setFeedback('');}
 function apply(result,submitted){const saved=result.item;readSequence.current++;setItem(saved);setId(saved.id);setCapabilities(result.capabilities??{});setContext(previous=>({...result,hubs:previous?.hubs??[]}));const next=valuesOf(saved);base.current=serialize(next);if(!dirty.current||serialize(valuesRef.current)===serialize(next)||submitted&&serialize(valuesRef.current)===serialize(submitted)){setValues(next);dirty.current=false;}setConflict(false);setFeedback(dirty.current?'原提交已保存，当前修改尚未保存。':saved.study?'研究已建立，可继续研究准备。':'课题草稿已保存。');history.replaceState(null,'',researchProjectUrl(saved.id));}
 async function execute(kind){if(busyRef.current||!access.authenticated)return;setError('');setFeedback('');
  if(!['recover','retry'].includes(kind)&&!values.title.trim()){setError('请填写研究课题名称。');document.getElementById('research-project-title')?.focus();return;}
  readSequence.current++;const actionToken=++actionSequence.current;if(!['recover','retry'].includes(kind))submittedRef.current=structuredClone(values);busyRef.current=true;setBusy(true);
  try{const result=kind==='recover'?await mutation.current.recover():kind==='retry'?await mutation.current.retryOriginal(values):await mutation.current.start({mode:kind,values,item,dirty:dirty.current,groups:context?.creationGroups??[],groupId});if(!active.current||actionToken!==actionSequence.current)return;if(kind==='recover'){setRecoveryChecked(false);if(dirty.current)setFeedback('原提交已保存，当前修改尚未保存。');else if(result?.item?.study)setFeedback('已核定研究建立成功，可进入研究准备。');else setFeedback('课题已保存，请点击保存并准备研究继续。');}if(result?.href&&!dirty.current)location.assign(result.href);}
  catch(caught){if(!active.current||actionToken!==actionSequence.current||caught.code==='RESEARCH_STALE')return;let pending=false;try{pending=Boolean(mutation.current.pending());}catch{}setUnknown(pending);setRecoveryChecked(kind==='recover'&&pending);setError(pending?'上次操作的结果尚未核定。当前输入已保留，请先核对；若仍无法核定，可恢复原内容后明确重试同一次操作。':caught.message);if(caught.status===409)setConflict(true);}
  finally{if(active.current&&actionToken===actionSequence.current){busyRef.current=false;setBusy(false);try{setUnknown(Boolean(mutation.current.pending()));}catch{setUnknown(false);}}}
 }
 useEffect(()=>{const find=()=>{const slot=document.querySelector('[data-page-context="q01"] .qiyan-page-actions');if(slot)setHeaderSlot(slot);};find();const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
 const groups=context?.creationGroups??[],canEdit=access.authenticated&&(id?capabilities?.canEdit===true:capabilities?.canCreateProject===true),disabled=busy||unknown||!canEdit;
 const canPrepare=Boolean(item?.study)||groups.length>0&&(groups.length===1||groups.some(group=>group.id===groupId));
 const notice=error||access.accessError||(unknown?'上次操作结果待核对，当前输入已保留，请先核对。':'');
 const taskAction=status==='ready'?<div className="rh-project-actions">{unknown?<><Button primary disabled={busy||!access.authenticated} loading={busy} onClick={()=>void execute('recover')}>核对上次操作</Button>{recoveryChecked&&<Button disabled={busy||!canEdit} onClick={()=>void execute('retry')}>使用原内容重试</Button>}</>:<><Button primary disabled={(item?.study&&!dirty.current?busy||unknown||!access.authenticated:disabled)||!canPrepare} loading={busy} onClick={()=>void execute('prepare')}>{item?.study&&!dirty.current?'进入研究准备':'保存并准备研究'}</Button>{(!item?.study||dirty.current)&&<Button disabled={disabled} onClick={()=>void execute('draft')}>保存草稿</Button>}</>}
    {conflict&&<Button disabled={busy||unknown} onClick={()=>setLeave({reload:true,trigger:document.activeElement})}>核对最新版本</Button>}
   </div>:null;
 return <>
  {headerSlot?createPortal(taskAction,headerSlot):taskAction}
  <div className="rh-project-toolbar"><a href={researchProjectsUrl}>返回我的课题</a><span role="status">{status==='loading'?'正在读取课题…':dirty.current?'有未保存修改':item?'已保存':'新课题'}</span></div>
  {notice&&<p role="alert" className="q01-error-summary">{notice}</p>}{feedback&&<p role="status">{feedback}</p>}
  {status==='error'&&<Button onClick={access.retry}>重新读取</Button>}
  {status==='ready'&&<>
   {!canEdit&&<p role="status">{access.authenticated?'当前账号可查看此课题，编辑权限暂不可用。':'正在核验当前账号，请稍候。'}</p>}
   <div className="main-grid"><div className="stack"><Card className="form-block"><div className="q01-kicker"><h2>研究课题</h2></div>
    <div className="q01-field"><label htmlFor="research-project-title">研究课题名称（必填）</label><textarea id="research-project-title" className="textarea" maxLength={300} value={values.title} disabled={busy||!canEdit} onChange={event=>edit('title',event.target.value)}/></div>
    <div className="q01-field"><label htmlFor="research-project-type">研究类型（选填）</label><input id="research-project-type" maxLength={100} value={values.researchType} disabled={busy||!canEdit} onChange={event=>edit('researchType',event.target.value)}/></div>
    {!item?.study&&(context?.hubs??[]).length>0&&<div className="q01-field"><label htmlFor="research-project-hub">相关领域（选填）</label><select id="research-project-hub" value={values.hubKey} disabled={busy||!canEdit} onChange={event=>edit('hubKey',event.target.value)}><option value="">暂不关联</option>{context.hubs.map(hub=><option key={hub.key??hub.hubKey} value={hub.key??hub.hubKey}>{hub.name??hub.title}</option>)}</select></div>}
   </Card><Card className="form-block"><div className="q01-kicker"><h2>核心研究问题</h2></div><div className="q01-field"><label htmlFor="research-project-question">核心研究问题（选填）</label><textarea id="research-project-question" className="textarea" maxLength={20000} value={values.question} disabled={busy||!canEdit} onChange={event=>edit('question',event.target.value)}/></div><h3>PICO（适用时填写）</h3><div className="q01-pico">{[['p','P','人群'],['i','I','干预'],['c','C','对照'],['o','O','结局']].map(([key,mark,label])=><div className="q01-pico-field" key={key}><label htmlFor={'research-project-'+key}>{mark} — {label}</label><textarea id={'research-project-'+key} className="textarea" maxLength={10000} value={values.pico[key]} disabled={busy||!canEdit} onChange={event=>edit('pico.'+key,event.target.value)}/></div>)}</div></Card></div>
    <aside className="stack"><Card className="form-block" title="研究准备"><p>{item?.study?'研究已建立，可继续准备方案。':'保存并准备研究后，继续填写研究方案；批准与启用仍需另行确认。'}</p>{!item?.study&&groups.length===1&&<p>研究组：{groups[0].name}</p>}{!item?.study&&groups.length>1&&<div className="q01-field"><label htmlFor="research-project-group">研究组</label><select id="research-project-group" value={groupId} disabled={busy||unknown||!access.authenticated} onChange={event=>setGroupId(event.target.value)}><option value="">请选择研究组</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}{!item?.study&&!groups.length&&<p>课题可保留。请联系租户管理员配置可创建研究的研究组。</p>}</Card></aside></div>

  </>}
  {leave&&<ConfirmDialog title={leave.reload?'读取最新课题？':'离开前保留修改'} confirmLabel={leave.reload?'放弃修改并读取':'放弃修改并离开'} returnFocus={leave.trigger} onCancel={()=>setLeave(null)} onConfirm={()=>{dirty.current=false;if(leave.reload)mutation.current.discardCheckpoint();else mutation.current.invalidate();if(leave.reload){setLeave(null);access.retry();}else location.assign(leave.url);}}><p>当前未保存的输入将被放弃。{unknown?'上次操作仍可能已完成，返回后请先核对已保存课题。':'可取消返回，先保存课题。'}</p></ConfirmDialog>}
 </>;
}
