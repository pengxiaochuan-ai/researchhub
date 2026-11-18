import {isNamedAssetTargetAdminScope,assetTargetTransportPath} from '../../src/research-assets-reuse.js';
import {assetRegistrationHeaders} from '../../src/research-assets-registration.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import {makeCatalogAssetUrl} from '../../src/research-assets-catalog-session.js';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
import {canUseResearchPlans,createKnowledgeClient,resolveKnowledgeScope} from '../../src/knowledge-session.js';
import {createDesignReadFence,createDesignRefreshGate,readResearchDesignLocation,makeDesignWorkspaceUrl} from '../../src/research-design-session.js';
import './research-design.css';
import ResearchDesignEvidence from './ResearchDesignEvidence.jsx';
import ResearchDesignSuggestions from './ResearchDesignSuggestions.jsx';
import ResearchDesignHistory from './ResearchDesignHistory.jsx';
import ResearchDesignGuidanceCitations from './ResearchDesignGuidanceCitations.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {makePreparationUrl} from '../../src/research-execution-preparation-session.js';

export default function ResearchDesignWorkspace({pageId='q02'}){return pageId==='s07'?<ResearchDesignDetail/>:<ResearchDesignList pageId={pageId}/>;}
function ResearchDesignList({pageId}){
 const [user,setUser]=useState(null),[scope,setScope]=useState(null),[items,setItems]=useState([]),[cursor,setCursor]=useState(null),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const fence=useRef(createDesignReadFence()),client=useRef(null),errorRef=useRef(null),pending=useRef(false);
 const current=token=>fence.current.current(token);
 function rejected(e,token){if(!current(token))return;setError(e.message);if(e.status===401||e.status===403){setItems([]);setCursor(null);setUser(null);setScope(null);client.current=null;setLoaded(false);}}
 async function initialize(){
  const token=fence.current.begin();pending.current=true;setBusy(true);setError('');setItems([]);setCursor(null);setLoaded(false);setUser(null);setScope(null);client.current=null;
  try{
   const route=readResearchDesignLocation(pageId,location.search);if(!import.meta.env.VITE_AUTH_TENANT_SLUG)throw Error("研究设计暂不可用，请稍后重试。");
   if(!['q02','s02'].includes(pageId))throw Error("当前入口不可用，请返回本人草稿列表继续。");
   const res=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw Object.assign(Error(res.status===401?"请先登录后打开本人研究设计草稿。":"当前登录状态无法核验，请重试。"),{status:res.status});
   const identity=await res.json(),authorized=isNamedAssetTargetAdminScope(identity,route.scope)?route.scope:resolveKnowledgeScope(identity,route.scope.studyGroupId,route.scope.researchProjectId);
   if(!authorized||authorized.studyGroupId!==route.scope.studyGroupId||authorized.researchProjectId!==route.scope.researchProjectId||!(isNamedAssetTargetAdminScope(identity,authorized)||canUseResearchPlans(identity,authorized)))throw Object.assign(Error("当前账号无权访问研究设计草稿；研究成员资格与AI授权须分别取得。"),{status:403});
   const api=designClient(identity,authorized),data=await api.get('/research-plan-drafts?limit=20');if(!current(token))return;
   client.current=api;setUser(identity);setScope(authorized);setItems(data.items);setCursor(data.nextCursor);setLoaded(true);
  }catch(e){rejected(e,token);}finally{if(current(token)){pending.current=false;setBusy(false);}}
 }
 async function loadMore(){
  if(pending.current||!cursor||!client.current)return;const token=fence.current.begin();pending.current=true;setBusy(true);setError('');
  try{const data=await client.current.get('/research-plan-drafts?limit=20&before='+encodeURIComponent(cursor));if(current(token)){setItems(list=>[...list,...data.items]);setCursor(data.nextCursor);}}
  catch(e){rejected(e,token);}finally{if(current(token)){pending.current=false;setBusy(false);}}
 }
 useEffect(()=>{void initialize();const refresh=()=>void initialize();window.addEventListener('focus',refresh);window.addEventListener('qiyan:auth-changed',refresh);return()=>{fence.current.invalidate();window.removeEventListener('focus',refresh);window.removeEventListener('qiyan:auth-changed',refresh);};},[]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 const studyGroup=pageId==='s02'&&scope?user?.studyGroups?.find(group=>group.id===scope.studyGroupId):null;
 const studyProject=studyGroup?.researchProjects?.find(project=>project.id===scope.researchProjectId);
 return <main className="platform-main design-workspace"><div className="wf-content design-content">
  <section className="design-summary"><h2>当前研究与本人草稿</h2><p>{user?user.displayName+' · '+user.username:"正在核对身份与当前研究权限。"}</p>{studyGroup&&studyProject&&<p>当前 Study：{studyGroup.name} / {studyProject.name}</p>}<p>仅本人私有合成草稿，不代表正式立项、方法学确认或审批。资料整理仅覆盖已封存片段，不代表整库或全文检索。</p>
   <div className="design-actions"><Button onClick={()=>void initialize()} disabled={busy} loading={busy}>刷新草稿列表</Button><a href="/pages/k01/">返回知识资料</a></div>
  </section>
  {error&&<p role="alert" ref={errorRef} tabIndex={-1} className="design-error">{error}</p>}
  {!busy&&!user&&<a href="/pages/p003/">前往真实登录</a>}
  {busy&&<p role="status">正在读取当前账号的已保存草稿…</p>}
  {loaded&&!busy&&!items.length&&!error&&<p role="status">当前研究尚无本人方案草稿。请到知识资料选择已审核材料，显式形成候选；不会自动调用模型。</p>}
  {user&&items.length>0&&<ul className="design-draft-list">{items.map(item=><li key={item.id}>
   <div><h3>{item.displayTitle??(item.sourceStatus==='stale'?'来源已变化的历史草稿':'来源或草稿上下文已受限')}</h3><p>{item.nextAction?.label??'请打开草稿核对当前阶段'}</p><p className="design-meta">{item.id} · v{item.version} · {item.sourceStatus==='current'?'来源当前有效':item.sourceStatus==='stale'?'来源过期 · 只读核对':'来源访问失效'}</p>{item.coverage&&<p className="design-meta">选定 {item.coverage.selectedFragments} 个审核片段 · 不代表全文覆盖</p>}{item.preparation&&<p className="design-meta">执行准备：{item.preparation.status==='empty'?'尚未配置':item.preparation.status==='current'?'当前配置 r'+item.preparation.revisionNo+' · '+item.preparation.findingCount+'项待核对':'上游变更，须重新核对'}</p>}</div>
   {item.sourceStatus!=='restricted'&&scope?<div className="design-actions"><a href={makeDesignWorkspaceUrl(item.stage==='asset_template_draft'?'s07':'q01',scope,item.id)}>{item.stage==='asset_template_draft'?'核对复用方案草稿':'继续草稿'}</a>{item.stage==='protocol_draft'&&<><a href={makeDesignWorkspaceUrl('s07',scope,item.id)}>完善研究设计</a><a href={makePreparationUrl(scope,item.id)}>执行准备草稿</a></>}</div>:<span>当前不可交付正文，请核对授权与资料状态。</span>}
  </li>)}</ul>}
  {user&&cursor&&<Button onClick={()=>void loadMore()} disabled={busy}>加载更多本人草稿</Button>}
  <p className="design-limit">可继续本人PICO与方案，或进入固定片段证据、逐节完善建议、本人决策及历史差异。仅本人合成草稿，不代表正式方案或专业确认；AI调用受当前授权与用量限制。</p>
 </div></main>;
}

function designClient(user,scope){return createKnowledgeClient({scope:()=>scope,...(scope.researchProjectId==='rh-asset-detail-20261113-study-b'?{fetchImpl:(url,init)=>fetch(assetTargetTransportPath(url),{...init,headers:{...init.headers,...assetRegistrationHeaders(user,init.method!=='GET'),'X-Research-Project-Id':'rh-kb-local-b0e2af9d-project'}})}:{})});}

function ResearchDesignDetail(){
 const [discardApplication,setDiscardApplication]=useState(false),[profile,setProfile]=useState(null),[scope,setScope]=useState(null),[view,setView]=useState(null),[sourceStatus,setSourceStatus]=useState('current'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[dirty,setDirty]=useState(false),[reset,setReset]=useState(0);
 const client=useRef(null),route=useRef(null),live=useRef(null),dirtyRef=useRef(false),writing=useRef(false),fence=useRef(createDesignReadFence()),keys=useRef(new Map()),errorRef=useRef(null);
 const dirtyFields=useRef({}),refreshGate=useRef(createDesignRefreshGate());
 const activity=useCallback((value,key)=>{if(key)dirtyFields.current[key]=value;else dirtyFields.current={};const any=Object.values(dirtyFields.current).some(Boolean);dirtyRef.current=any;setDirty(any);},[]);
 const evidenceActivity=useCallback(value=>activity(value,'evidence'),[activity]),suggestionActivity=useCallback(value=>activity(value,'suggestions'),[activity]),bodyActivity=useCallback(value=>activity(value,'body'),[activity]);
 const citationActivity=useCallback(value=>activity(value,'citations'),[activity]);
 function rejected(e,token){if(!fence.current.current(token))return;setError(e.message);if(e.status===401||e.status===403){setView(null);live.current=null;setProfile(null);client.current=null;activity(false);}}
 function apply(data,force=false){setSourceStatus(data.sourceStatus);if(data.sourceStatus==='restricted'){setView(null);live.current=null;activity(false);setError(data.message);return;}if(dirtyRef.current&&!force){if(data.version!==live.current?.version)setError('已有新版本，当前输入与修改基准已保留；请核对后再保存或放弃修改。');return;}live.current=data;setView(data);if(force){activity(false);setReset(n=>n+1);}}
 async function refresh(force=false){if(!client.current||writing.current)return;const reading=refreshGate.current.begin(force);if(!reading)return;const token=fence.current.begin();try{const data=await client.current.get('/research-plan-drafts/'+route.current.planId+'/design');if(fence.current.current(token)){if(force)setError('');apply(data,force);}}catch(e){rejected(e,token);}finally{if(refreshGate.current.finish(reading))void refresh(true);}}
 async function initialize(){refreshGate.current.invalidate();const token=fence.current.begin();setBusy(true);setError('');setView(null);live.current=null;client.current=null;activity(false);
  try{const parsed=readResearchDesignLocation('s07',location.search);route.current=parsed;if(!import.meta.env.VITE_AUTH_TENANT_SLUG)throw Error("研究设计暂不可用，请稍后重试。");const res=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Object.assign(Error('当前会话无法核验，请先真实登录。'),{status:res.status});const user=await res.json(),authorized=isNamedAssetTargetAdminScope(user,parsed.scope)?parsed.scope:resolveKnowledgeScope(user,parsed.scope.studyGroupId,parsed.scope.researchProjectId);if(!authorized||authorized.studyGroupId!==parsed.scope.studyGroupId||authorized.researchProjectId!==parsed.scope.researchProjectId||!(isNamedAssetTargetAdminScope(user,authorized)||canUseResearchPlans(user,authorized)))throw Object.assign(Error('当前账号没有该Study的本人草稿权限，不自动加入或授予AI权限。'),{status:403});const api=designClient(user,authorized),data=await api.get('/research-plan-drafts/'+parsed.planId+'/design');if(!fence.current.current(token))return;client.current=api;setProfile(user);setScope(authorized);apply(data,true);
  }catch(e){rejected(e,token);}finally{if(fence.current.current(token))setBusy(false);}
 }
 useEffect(()=>{void initialize();const auth=()=>{fence.current.invalidate();setView(null);live.current=null;setProfile(null);client.current=null;activity(false);void initialize();},focus=()=>void refresh();window.addEventListener('qiyan:auth-changed',auth);window.addEventListener('focus',focus);const timer=setInterval(()=>void refresh(),3000);return()=>{refreshGate.current.invalidate();client.current=null;fence.current.invalidate();clearInterval(timer);window.removeEventListener('qiyan:auth-changed',auth);window.removeEventListener('focus',focus);};},[]);
 useEffect(()=>{const protect=e=>{if(dirtyRef.current||writing.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 async function mutate(endpoint,payload){
  if(writing.current||!live.current||sourceStatus!=='current')return;
  writing.current=true;setBusy(true);setError('');setFeedback('');
  const p=live.current,signature=JSON.stringify([endpoint,p.version,payload]);
  if(!keys.current.has(signature))keys.current.set(signature,'design-'+crypto.randomUUID());
  const token=fence.current.begin();
  try{
   const suffix=endpoint==='body'?'/versions':endpoint==='guidance-citations'?'/guidance-citations':'/design/'+endpoint;
   const response=await client.current.post('/research-plan-drafts/'+p.id+suffix,{baseVersionNo:p.version,requestKey:keys.current.get(signature),...payload});
   const data=['body','guidance-citations'].includes(endpoint)?await client.current.get('/research-plan-drafts/'+p.id+'/design'):response;
   if(!fence.current.current(token))return;
   fence.current.invalidate();apply(data,true);
   setFeedback(endpoint==='jobs'?'请求已入队，等待真实执行；不自动重发。':endpoint==='guidance-citations'&&response.replayed?'已核对上次提交：应用版本 v'+response.appliedVersionNo+'；当前方案版本 v'+data.version+'。':'已保存版本 v'+data.version+'。');
   return{ok:true};
  }catch(e){rejected(e,token);return{ok:false,status:e.status??0};}
  finally{writing.current=false;setBusy(false);}
 }
 async function readVersion(version){try{return await client.current.get('/research-plan-drafts/'+route.current.planId+'/versions/'+version);}catch(e){if(e.status===401||e.status===403)rejected(e,fence.current.begin());throw e;}}
 const running=['queued','processing'].includes(view?.job?.status),readOnly=sourceStatus!=='current'||running;
 return <main className="platform-main design-workspace design-detail"><div className="wf-content design-content">
  <section className="design-summary"><h2>本人研究设计草稿</h2><p>{profile?profile.displayName+' · '+profile.username:"正在核对身份与当前研究权限。"}</p>{view&&<p>已保存版本 v{view.version} · 本人私有合成草稿，未审批、未发布。</p>}<div className="design-actions"><Button onClick={()=>void refresh()} disabled={busy}>刷新设计</Button>{dirty&&<Button disabled={busy||running} onClick={()=>{if(view?.assetReuse)setDiscardApplication(true);else if(window.confirm("放弃未保存修改，并读取已保存版本？"))void refresh(true);}}>放弃未保存修改</Button>}{scope&&view&&<><a href={makeDesignWorkspaceUrl('q02',scope)}>返回我的研究设计草稿</a>{!view.assetReuse&&<a href={makeDesignWorkspaceUrl('q01',scope,view.id)}>返回PICO与合成试运行</a>}</>}</div></section>
  {error&&<p ref={errorRef} tabIndex={-1} role="alert" className="design-error">{error} 当前未保存输入不会自动提交或覆盖。</p>}{feedback&&<p role="status">{feedback}</p>}{busy&&!view&&<p role="status">正在读取本人真实设计草稿…</p>}{!profile&&!busy&&<a href="/pages/p003/">前往真实登录</a>}
  {discardApplication&&<ConfirmDialog title="放弃未保存修改？" confirmLabel="放弃修改并重读" cancelLabel="继续编辑" onCancel={()=>setDiscardApplication(false)} onConfirm={()=>{setDiscardApplication(false);void refresh(true);}}><p>尚未保存的正文修改将被放弃，已保存草稿保持。</p></ConfirmDialog>}
  {view&&<><Card title={view.assetReuse?'来源模板与待确认研究意图':'已确认研究意图与当前方案'} className="design-panel"><p>{view.assetReuse?'此草稿尚未确认PICO、研究设计、访视、CRF及方法参数，不继承原模板的审批或适用结论。':'本人的PICO确认不是疗效证明或方法学批准。以下内容来自本草稿已保存版本。'}</p>{view.assetReuse&&<p>{view.assetReuse.sourceAvailable?<a href={makeCatalogAssetUrl({studyGroupId:scope.studyGroupId,researchProjectId:view.assetReuse.sourceProjectId},view.assetReuse.sourceId,view.assetReuse.sourceVersion)}>核对来源模板 · {view.assetReuse.sourceTitle} · v{view.assetReuse.sourceVersion}</a>:'来源当前不可核对，草稿保留历史事实；请重新确认使用条件。'}</p>}<details><summary>{view.assetReuse?'核对来源正文与未确认事项':'核对已确认PICO与方案原文'}</summary><div className="design-reading"><p>{view.pico?.question}</p>{['p','i','c','o'].map(k=><p key={k}>{k.toUpperCase()}：{view.pico?.[k]??'尚未确认'}</p>)}<Markdown allowImages={false}>{view.contentMd}</Markdown></div></details></Card>
   <ResearchDesignGuidanceCitations key={view.id+':guidance'} view={view} client={client.current} busy={busy||running} readOnly={readOnly||dirtyFields.current.evidence||dirtyFields.current.suggestions||dirtyFields.current.body} onDirty={citationActivity} onSave={payload=>mutate('guidance-citations',payload)} onRefresh={()=>void refresh()} onAccessLost={e=>rejected(e,fence.current.begin())}/>
   <section className="design-summary"><h2>AI证据整理</h2><p>模型用量统一计入租户及账号 Token 额度。只基于已封存片段，新的生成会实际调用模型，人工证据处置不调用模型。</p>{view.job&&<p role="status">证据任务：{({queued:'排队中',processing:'实际执行中',completed:'已完成，待本人核对',failed:'失败，结果未交付'})[view.job.status]}</p>}{view.job?.status==='failed'&&<p role="alert" className="design-error">{view.job.errorMessage??view.job.errorCode}；已产生费用保留，不自动重试。</p>}<Button disabled={busy||running||dirty||readOnly||!view.confirmation||!view.contentMd||view.quota?.blocked} onClick={()=>void mutate('jobs',{kind:'evidence'})}>整理固定资料证据（调用AI）</Button><p>{dirty?'请先保存或明确放弃未保存处置，再开始新的AI任务。':view.quota?.blocked?view.quota.message:'仅显式点击才生成；刷新和阅读不会调用模型。'}</p></section>
   <ResearchDesignEvidence key={view.id+':'+view.version+':'+(view.evidence?.resultMessageId??'pending')+':'+reset} view={view} busy={busy||running} readOnly={readOnly||dirtyFields.current.citations||dirtyFields.current.suggestions||dirtyFields.current.body||view.evidence?.status!=='current'} onDirty={evidenceActivity} onSave={decisions=>mutate('evidence-decisions',{resultMessageId:view.evidence.resultMessageId,decisions})}/>
   <section className="design-summary"><h2>AI辅助方案完善</h2><p>只使用当前已纳入证据和显式背景。需要已确认PICO、已保存方案及至少一项当前纳入证据；生成不改变草稿正文。</p><Button disabled={busy||running||dirty||readOnly||view.quota?.blocked||view.evidence?.status!=='current'||!view.evidence?.rows.some(row=>row.decision==='include')} onClick={()=>void mutate('jobs',{kind:'refine'})}>提出方案完善建议（调用AI）</Button></section>
   <ResearchDesignSuggestions key={view.id+':suggestions:'+view.version+':'+(view.suggestions?.resultMessageId??'pending')+':'+reset} view={view} busy={busy||running} readOnly={readOnly||dirtyFields.current.citations||dirtyFields.current.evidence||dirtyFields.current.body} onDirty={suggestionActivity} onSave={decisions=>mutate('decisions',{resultMessageId:view.suggestions.resultMessageId,decisions})}/>
   <ResearchDesignHistory key={view.id+':history:'+view.version+':'+reset} view={view} busy={busy||running} readOnly={readOnly||view.assetReuse?.canEdit===false||dirtyFields.current.citations||dirtyFields.current.evidence||dirtyFields.current.suggestions} onDirty={bodyActivity} onSave={contentMd=>mutate('body',{contentMd})} onRead={readVersion}/>
   {scope&&view.sourceStatus==='current'&&!view.assetReuse&&<p className="design-actions"><a href={makePreparationUrl(scope,view.id)}>进入研究执行准备草稿</a></p>}
   <p className="design-limit">本页仅处理本人设计草稿、证据及明确决策。需要质控时返回PICO与合成试运行，显式建立绑定当前版本的新试跑；旧报告不自动重绑。无审批、共享、锁库、发布或导出。</p>
  </>}
 </div></main>;
}
