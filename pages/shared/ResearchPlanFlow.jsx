import React,{useEffect,useRef,useState} from 'react';
import {Shell} from './Shell.jsx';
import {Card,Button,Stepper} from './Components.jsx';
import {createKnowledgeClient,resolveKnowledgeScope,canUseResearchPlans} from '../../src/knowledge-session.js';
import {validateResearchPico,isResearchPlanDirty,keepResearchPlanEditBase,canGenerateResearchPlan} from '../../src/research-plan-form.js';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import './research-plan-flow.css';
import SyntheticQualityPanel from './SyntheticQualityPanel.jsx';
import {makeDesignWorkspaceUrl} from '../../src/research-design-session.js';

const empty={question:'',p:'',i:'',c:'',o:''},labels={question:'核心研究问题',p:'P 人群',i:'I 干预',c:'C 对照',o:'O 结局'};
export default function ResearchPlanFlow(){
 const [params]=useState(()=>new URLSearchParams(location.search)),planId=params.get('researchPlanId'),client=useRef(null),alive=useRef(true),dirty=useRef(false),requests=useRef(new Map()),seen=useRef(''),refs=useRef({});
 const [profile,setProfile]=useState(null),[plan,setPlan]=useState(null),[pico,setPico]=useState(empty),[editor,setEditor]=useState(''),[error,setError]=useState(''),[errors,setErrors]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const baseline=useRef({pico:empty,editor:'',version:null}),trialActivity=useRef({dirty:false,busy:false});
 function apply(data){
  if(keepResearchPlanEditBase(dirty.current,baseline.current.version,data)){setError('已有新版本，当前输入和编辑基准保留；保存将校验原版本，不自动覆盖。请复制修改后核对，或放弃未保存修改读取新版本。');return;}
  setPlan(data);const signature=[data.version,data.proposal?.sourceMessageId].join(':');
  if(data.stage==='restricted'){setPico(empty);setEditor('');dirty.current=false;return;}
  if(!dirty.current&&signature!==seen.current){
   const values=data.pico||(data.proposal?.stage==='pico'?data.proposal.candidate:null),nextPico=values?Object.fromEntries(Object.keys(empty).map(k=>[k,values[k]??''])):empty,nextEditor=data.contentMd||data.proposal?.contentMd||'';
   setPico(nextPico);setEditor(nextEditor);baseline.current={pico:nextPico,editor:nextEditor,version:data.version};seen.current=signature;
  }
 }
 async function refresh(){if(!client.current)return;try{const data=await client.current.get('/research-plan-drafts/'+planId);if(alive.current)apply(data);}catch(e){if(alive.current)setError(e.message);}}
 useEffect(()=>{
  const stop=new AbortController();alive.current=true;
  (async()=>{try{
   if(!import.meta.env.VITE_AUTH_TENANT_SLUG||!/^[A-Za-z0-9_-]{1,160}$/.test(planId||''))throw Error("草稿链接无效或暂不可用，请从本人草稿列表重新进入。");
   const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:stop.signal});if(!response.ok)throw Error("请先登录后查看本人方案草稿。");const user=await response.json();
   const requested={studyGroupId:params.get('studyGroupId'),researchProjectId:params.get('researchProjectId')},scope=resolveKnowledgeScope(user,requested.studyGroupId,requested.researchProjectId);
   if(!scope||scope.studyGroupId!==requested.studyGroupId||scope.researchProjectId!==requested.researchProjectId||!canUseResearchPlans(user,scope))throw Error("当前账号无权访问此方案草稿。");
   if(!alive.current)return;setProfile(user);client.current=createKnowledgeClient({scope:()=>scope,onAccessLost:failure=>{if(alive.current){setError(failure.message);setPlan(null);setPico(empty);setEditor('');dirty.current=false;}}});
   const data=await client.current.get('/research-plan-drafts/'+planId);if(alive.current)apply(data);
  }catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}})();
  return()=>{alive.current=false;stop.abort();client.current=null;};
 },[planId]);
 useEffect(()=>{if(!plan)return;const timer=setInterval(()=>void refresh(),['queued','processing'].includes(plan.job?.status)?1200:5000);return()=>clearInterval(timer);},[planId,plan?.job?.status,!!plan]);
 useEffect(()=>{const protect=e=>{if(dirty.current||trialActivity.current.dirty||trialActivity.current.busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[]);
 const running=['queued','processing'].includes(plan?.job?.status),restricted=!plan||plan.sourceStatus!=='current',noAccess=plan?.sourceStatus==='restricted',picoReady=!!plan?.pico||plan?.proposal?.stage==='pico',hasCandidate=!!plan?.contentMd||plan?.proposal?.stage==='protocol';
 async function mutate(kind,payload){
  if(busy||!plan||restricted)return;setBusy(true);setError('');setFeedback('');
  const identity=JSON.stringify([kind,plan.version,payload]);let key=requests.current.get(identity);if(!key){key='rp-'+crypto.randomUUID();requests.current.set(identity,key);}
  try{const data=await client.current.post(`/research-plan-drafts/${planId}/${kind}`,{baseVersionNo:plan.version,requestKey:key,...payload});if(alive.current){dirty.current=false;apply(data);setFeedback(kind==='jobs'?'请求已入队；等待真实执行，不自动重发。':'已保存版本 v'+data.version+'。');setErrors({});}}
  catch(e){if(alive.current)setError(e.message+' 当前输入保留；请先刷新核对，不自动重试或覆盖。');}
  finally{if(alive.current)setBusy(false);}
 }
 function generate(stage){if(!canGenerateResearchPlan(plan)){setError(plan?.quota?.message||'暂时无法核对 Token 额度，请刷新后再发起。');return;}if(dirty.current){setError('当前有未保存修改，请先确认PICO或保存方案草稿。');return;}if(stage==='protocol'&&!plan?.confirmation){setError('请先逐项核对并确认PICO，再生成方案候选。');return;}void mutate('jobs',{stage});}
 function confirm(event){event?.preventDefault();const result=validateResearchPico(pico);setErrors(result.errors);if(!result.valid){refs.current[result.firstInvalid]?.focus();return;}void mutate('pico-confirmations',{pico});}
 function save(){if(!hasCandidate){setError('尚无方案候选可保存，请先确认PICO并生成方案。');return;}if(Object.keys(empty).some(k=>pico[k]!==baseline.current.pico[k])){setError('PICO有未确认修改，请先确认PICO，再生成新方案。');return;}if(plan.stage==='protocol_draft'&&!dirty.current){setFeedback("当前已保存草稿没有修改，不新增重复版本。");return;}void mutate('versions',{contentMd:editor});}
 useEffect(()=>{const action=e=>{if(e.detail?.pageId!=='q01')return;if(e.detail.label==='保存草稿')save();if(e.detail.label==='生成研究方案')generate('protocol');};window.addEventListener('qiyan:page-action',action);return()=>window.removeEventListener('qiyan:page-action',action);},[plan,pico,editor,busy,hasCandidate]);
 function change(key,value){const next={...pico,[key]:value};dirty.current=isResearchPlanDirty(next,editor,baseline.current);setPico(next);setFeedback('');}
 const step=plan?.stage==='protocol_draft'?3:plan?.confirmation?2:plan?.stage==='pico_pending'?1:0;
 return <Shell active="领域研究" hero={{title:'研究课题',breadcrumb:'知识资料 › 研究课题',subtitle:'从已审核合成材料形成PICO与可追溯方案候选。'}}>
  <div className="content stack q01-project research-plan-flow">
   <p className="notice">合成研究 · {profile?.displayName||'正在核对身份'} · 已保存的合成草稿，不代表正式立项、方法学确认或伦理批准。</p>
   {profile&&plan&&<p><a href={makeDesignWorkspaceUrl('q02',{studyGroupId:params.get('studyGroupId'),researchProjectId:params.get('researchProjectId')})}>返回我的研究设计草稿</a>{plan.stage==='protocol_draft'&&<> · <a href={makeDesignWorkspaceUrl('s07',{studyGroupId:params.get('studyGroupId'),researchProjectId:params.get('researchProjectId')},plan.id)}>完善研究设计与证据核对</a></>}</p>}
   {loading&&<p role="status">正在确认当前研究授权并读取草稿…</p>}
   {error&&<p role="alert" className="q01-error-summary">{error}</p>}
   {feedback&&<p role="status" className="q01-save-state">{feedback}</p>}
   {plan&&<>
    <Stepper steps={['审核资料就绪','PICO候选','研究者确认','研究方案草稿']} active={step}/>
    <div className="plan-toolbar"><span>草稿版本 v{plan.version} · {running?'AI'+(plan.job.status==='queued'?'排队中':'执行中'):plan.stage==='protocol_draft'?'已保存候选草稿':plan.confirmation?'PICO已确认':'待研究者确认'}</span><Button onClick={()=>void refresh()} disabled={busy}>刷新草稿</Button>{dirty.current&&<Button disabled={busy||running} onClick={()=>{if(window.confirm('放弃当前尚未保存的修改，并读取服务器版本？')){dirty.current=false;seen.current='';void refresh();}}}>放弃未保存修改</Button>}<a href="/pages/k01/">返回知识资料</a></div>
    {restricted&&<p role="alert" className="q01-error-summary">{plan.message||'来源版本已变化，当前草稿已过期；请返回资料核对后建立新候选。'}</p>}
    {plan.job?.status==='failed'&&<p role="alert" className="q01-error-summary">本次AI结果未交付：{plan.job.errorMessage||plan.job.errorCode}。已产生的实际模型用量仍按 Token 规则记账；不自动重试。</p>}
    {!noAccess&&<div className="main-grid">
     <div className="stack">
      <Card title="核心研究问题与PICO" className="form-block">
       <p>AI缺少依据的字段留空。请明确研究意图后逐项确认；未定方法参数保留在后续方案中。</p>
       <Button onClick={()=>generate('pico')} disabled={restricted||busy||running||!!plan.confirmation||!canGenerateResearchPlan(plan)} loading={busy&&!picoReady}>生成PICO候选</Button>
       {plan.proposal?.stage==='pico'&&<div className="plan-reading"><p>{plan.proposal.candidate.rationale}</p><p>仍需明确：{plan.proposal.candidate.unknowns.join('；')||'请研究者核对全部字段'}</p></div>}
       <form onSubmit={confirm} noValidate>
        {Object.entries(labels).map(([key,label])=><div className="q01-field" key={key}><label htmlFor={'rp-'+key}>{label}（必填）</label><textarea id={'rp-'+key} ref={e=>{refs.current[key]=e;}} rows={key==='question'?3:2} maxLength={500} value={pico[key]} disabled={restricted||!picoReady||running||busy} aria-required="true" aria-invalid={!!errors[key]} aria-describedby={errors[key]?'rp-error-'+key:undefined} onChange={e=>change(key,e.target.value)}/>{errors[key]&&<p id={'rp-error-'+key} className="q01-field-error">{errors[key]}</p>}</div>)}
        <div className="plan-actions"><Button type="submit" primary disabled={restricted||!picoReady||running||busy||!!plan.confirmation&&Object.keys(empty).every(k=>pico[k]===baseline.current.pico[k])} loading={busy&&picoReady}>确认PICO</Button><Button onClick={()=>generate('protocol')} disabled={restricted||!plan.confirmation||running||busy||plan.stage==='protocol_draft'||!canGenerateResearchPlan(plan)}>生成研究方案候选</Button></div>
        <p>确认PICO仅记录本人的研究意图，不代表正式立项或审批；人工补充不等于原资料已证实。修改后须重新确认，旧版本仍保留。</p>
        {plan.picoCandidate&&<details><summary>查看原AI候选与缺项</summary><div className="plan-reading"><p>{plan.picoCandidate.candidate.rationale}</p><p>{plan.picoCandidate.candidate.unknowns.join('；')}</p><p className="plan-meta">原候选消息：{plan.picoCandidate.sourceMessageId}</p></div></details>}
       </form>
      </Card>
      {hasCandidate&&<Card title="研究方案候选 · 待专业确认" className="form-block">
       <label htmlFor="rp-protocol">方案草稿正文（可编辑，保存后新增版本）</label><textarea id="rp-protocol" className="plan-editor" value={editor} rows={16} maxLength={24000} disabled={restricted||busy||running} onChange={e=>{dirty.current=isResearchPlanDirty(pico,e.target.value,baseline.current);setEditor(e.target.value);setFeedback('');}}/>
       <div className="plan-actions"><Button primary onClick={save} disabled={restricted||busy||running||plan.stage==='protocol_draft'&&!dirty.current} loading={busy}>保存方案草稿</Button><span>{plan.stage==='protocol_draft'&&!dirty.current?'已保存版本':'当前编辑尚未保存'}</span></div>
       <details><summary>阅读当前草稿</summary><div className="plan-reading"><Markdown allowImages={false}>{editor}</Markdown></div></details>
      </Card>}
      <SyntheticQualityPanel key={plan.id} plan={plan} client={client.current} parentDirty={dirty.current} parentBusy={busy||running} onActivity={activity=>{trialActivity.current=activity;}}/>
     </div>
     <div className="stack">
      <Card title="本次输入与可追溯来源" className="form-block"><p>使用当前库检索命中的 {plan.sources?.length||0} 个已审核片段，并不表示覆盖全部材料。资料变化会阻断后续操作。</p>{plan.sources?.map((s,i)=><details className="plan-source" key={s.chunkId+'-'+i}><summary>来源 [{i+1}]《{s.docTitle}》· v{s.version}</summary><blockquote className="plan-reading">{s.quote}</blockquote><p className="plan-meta">{s.page?`第${s.page}页 · `:''}{s.section||'未提供章节定位'}</p><p className="plan-meta">正文SHA256：{s.contentHash}</p><p className="plan-meta">分块：{s.chunkId} · {s.retrievedAt}</p></details>)}</Card>
      <Card title="费用与能力边界" className="form-block"><p>模型用量统一计入租户及账号 Token 额度，调用前预留、完成后按实际用量结算。</p>{plan.quota?.blocked&&<p role="status">{plan.quota.message}</p>}<p>AI仅提出候选。样本量、效应量与统计值未计算；没有审批、发布、导出入口。</p></Card>
      <Card title="修订记录" className="form-block"><ol>{plan.versions?.map(v=><li key={v.versionNo}>v{v.versionNo} · {v.changeSummary} · <span className="plan-meta">{v.createdAt}</span></li>)}</ol>{plan.confirmation&&<p className="plan-meta">PICO确认人：{plan.confirmation.accountId}<br/>确认时间：{plan.confirmation.at}<br/>确认SHA256：{plan.confirmation.hash}</p>}</Card>
     </div>
    </div>}
   </>}
   {!loading&&!plan&&<p>当前暂无可显示的方案结果。<a href="/pages/p003/">查看登录会话</a>，或<a href="/pages/k01/">返回知识资料</a>。</p>}
  </div>
 </Shell>;
}
