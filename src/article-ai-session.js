// Single-article transport/recovery only. No storage of prompts, evidence or credentials.
import {agentQuestionError} from './agent-question.js';
export const ARTICLE_DEFAULT_QUESTION='请仅依据这篇文章，说明研究问题、研究设计与对象、主要发现、局限及对针灸情志病研究的参考价值；缺失的信息明确标注。';
const pmc=/^pmc-PMC[1-9][0-9]{0,10}$/,sha=/^[a-f0-9]{64}$/,key=/^[A-Za-z0-9_-]{8,160}$/;
const fail=(message='单篇文章响应或恢复线索无法核对，请返回原文重新核对。',status=409)=>{throw Object.assign(new Error(message),{status});};
const bkeys=['recordId','articleVersion','rawSha256','reviewVersion'];
const canonical=b=>JSON.stringify(Object.fromEntries(bkeys.map(k=>[k,b?.[k]])));
export function validArticleBinding(b){return Boolean(b&&Object.keys(b).length===4&&pmc.test(b.recordId??'')&&
  new RegExp('^'+b.recordId.slice(4)+'[.][1-9][0-9]{0,2}$').test(b.articleVersion??'')&&sha.test(b.rawSha256??'')&&/^(?:article:)?[1-9][0-9]{0,18}$/.test(b.reviewVersion??''));}
export function readArticleAiRoute(search=''){
  const p=new URLSearchParams(search);if(!p.size)return {kind:'none'};
  const hubKeys=['sessionId','uploadStudyId','uploadSubjectId','uploadVisitId'];
  if(hubKeys.some(k=>p.has(k)))return [...p.keys()].every(k=>hubKeys.includes(k)&&p.getAll(k).length===1&&/^[A-Za-z0-9_-]{1,160}$/.test(p.get(k)??''))&&(!p.has('uploadSubjectId')||p.has('uploadStudyId'))&&(!p.has('uploadVisitId')||p.has('uploadSubjectId'))?{kind:'hub',...Object.fromEntries(hubKeys.filter(k=>p.has(k)).map(k=>[k,p.get(k)]))}:{kind:'invalid'};
  if([...p.keys()].some(k=>!['articleId','requestKey','inputHash'].includes(k)||p.getAll(k).length!==1)||!pmc.test(p.get('articleId')??'')||
    (p.has('requestKey')!==p.has('inputHash'))||(p.has('requestKey')&&(!key.test(p.get('requestKey'))||!sha.test(p.get('inputHash')))))return {kind:'invalid'};
  return {kind:'article',recordId:p.get('articleId'),recovery:p.has('requestKey')?{requestKey:p.get('requestKey'),inputHash:p.get('inputHash')}:null};
}
export function hubAiHref(sessionId,uploadStudyId,context={}){if(Object.keys(context).some(k=>!['uploadSubjectId','uploadVisitId'].includes(k)))fail('会话入口无效。');const p=new URLSearchParams();if(sessionId)p.set('sessionId',sessionId);if(uploadStudyId)p.set('uploadStudyId',uploadStudyId);for(const key of ['uploadSubjectId','uploadVisitId'])if(context[key]!==undefined)p.set(key,context[key]);if(p.size&&readArticleAiRoute(p.toString()).kind!=='hub')fail('会话入口无效。');return'/pages/ai01/'+(p.size?'?'+p:'');}
export function articleAiHref(recordId,recovery=null){
  if(!pmc.test(recordId??''))fail();const p=new URLSearchParams({articleId:recordId});
  if(recovery){if(!key.test(recovery.requestKey)||!sha.test(recovery.inputHash))fail();p.set('requestKey',recovery.requestKey);p.set('inputHash',recovery.inputHash);}
  return '/pages/ai01/?'+p;
}
export function articleEvidenceHref(binding,fragment){
  if(!validArticleBinding(binding))fail();
  const p=new URLSearchParams(binding);if(fragment){
    if(!['abstract','body','table'].includes(fragment.field)||!Number.isSafeInteger(fragment.offset)||fragment.offset<0||fragment.offset>8388608||!Number.isSafeInteger(fragment.length)||fragment.length<1||fragment.length>1200)fail();
    p.set('evidenceField',fragment.field);p.set('evidenceOffset',fragment.offset);p.set('evidenceLength',fragment.length);
  }return '/pages/e02/?'+p+(fragment?'#article-evidence-'+fragment.field:'');
}
export function readArticleLocation(search=''){
  const p=new URLSearchParams(search);if(!['articleVersion','rawSha256','reviewVersion','evidenceField','evidenceOffset','evidenceLength'].some(k=>p.has(k)))return null;
  if([...p.keys()].some(k=>!['recordId',...bkeys.slice(1),'evidenceField','evidenceOffset','evidenceLength'].includes(k)||p.getAll(k).length!==1))fail();
  const binding=Object.fromEntries(bkeys.map(k=>[k,p.get(k)]));if(!validArticleBinding(binding))fail();
  if(!p.has('evidenceField')){if(p.has('evidenceOffset')||p.has('evidenceLength'))fail();return {binding};}
  if(!/^\d{1,8}$/.test(p.get('evidenceOffset')??'')||!/^\d{1,4}$/.test(p.get('evidenceLength')??''))fail();
  const f={field:p.get('evidenceField'),offset:Number(p.get('evidenceOffset')),length:Number(p.get('evidenceLength'))};articleEvidenceHref(binding,f);return {binding,...f};
}
export function articleRawRange(raw,offset,length){
  if(typeof raw!=='string'||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>1200)return null;
  const positions=[];let previousSpace=true;
  for(const m of raw.matchAll(/\s+|\S+/g)){
    const space=/^\s/.test(m[0]);if(space){if(!previousSpace)positions.push({start:m.index,end:m.index+m[0].length});}
    else for(let i=0;i<m[0].length;i++)positions.push({start:m.index+i,end:m.index+i+1});previousSpace=space;
  }if(previousSpace)positions.pop();
  return offset+length<=positions.length?{start:positions[offset].start,end:positions[offset+length-1].end}:null;
}
export async function articleInputHash(binding,text){
  if(!validArticleBinding(binding))fail();
  const context='hub-article:v1:'+btoa(canonical(binding)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const bytes=new TextEncoder().encode(JSON.stringify({binding:context,text:text.trim(),kbIds:[]}));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function checkedArticle(a,id){
  const p=a?.evidence;if(!validArticleBinding(a?.binding)||a.binding.recordId!==id||!p||canonical(p.binding)!==canonical(a.binding)||
    !sha.test(p.packHash??'')||p.packHash!==a.packHash||typeof a.title!=='string'||p.source?.title!==a.title||p.source?.pmcRecordId!==id||!Array.isArray(p.fragments)||p.fragments.length<1||p.fragments.length>6||
    new Set(p.fragments.map(f=>f.id)).size!==p.fragments.length||
    p.fragments.some(f=>!['abstract','body','table'].includes(f.field)||typeof f.text!=='string'||f.text.length!==f.length||f.length<1||f.length>1200||!sha.test(f.textHash??'')||!Number.isSafeInteger(f.offset)||f.offset<0)||
    p.fragments.reduce((n,f)=>n+f.length,0)>6000||typeof a.execution?.canStart!=='boolean')fail();return a;
}
const running=t=>['queued','processing'].includes(t?.status);
export function createArticleAiSession({recordId,client,onChange=()=>{},onRecovery=()=>{},recovery=null,wait=ms=>new Promise(r=>setTimeout(r,ms)),maxPolls=20,pollMs=1500}={}){
  if(!pmc.test(recordId??''))fail();
  let epoch=0,disposed=false,pending=recovery?{...recovery,text:null}:null,binding=null,questionDirty=false;
  let view={kind:'loading',article:null,sessionId:null,task:null,answer:null,question:recovery?'':ARTICLE_DEFAULT_QUESTION,phase:'idle',error:'',paused:false};
  const emit=patch=>{if(!disposed){view={...view,...patch};onChange(view);}};
  const current=turn=>!disposed&&turn===epoch&&!view.paused;
  const contextPath=()=>'/hub-sources/article-context/'+recordId+(pending?'?requestKey='+encodeURIComponent(pending.requestKey):'');
  function remember(value){pending=value;onRecovery(value?{requestKey:value.requestKey,inputHash:value.inputHash}:null);}
  function failed(e,turn){if(!current(turn))return;emit({kind:[401,403,404,409].includes(e.status)?'restricted':'error',article:null,answer:null,messages:[],phase:'idle',error:e.message});}
  async function readState(turn){
    if(!view.sessionId)return;
    const r=await client.get(`/sessions/${view.sessionId}/knowledge-state?limit=60`);if(!current(turn))return;
    if(r.articleContext?.status==='restricted'||!validArticleBinding(r.articleContext?.binding)||canonical(r.articleContext.binding)!==canonical(binding))fail('固定文章版本或授权已变化，请返回原文重新核对。',403);
    if(r.articleContext.execution){const fresh=checkedArticle(r.articleContext,recordId);if(fresh.packHash!==view.article?.packHash)fail('本次证据包已变化，请返回原文重新核对。');emit({article:fresh,...(fresh.execution.quota?{quota:fresh.execution.quota}:{})});}
    emit({messages:r.messages??[],jobs:r.jobs??[],nextCursor:r.nextCursor});
    const t=pending?r.jobs?.find(j=>j.requestKey===pending.requestKey):null;
    if(!t){emit({task:null,answer:null,phase:pending?'uncertain':'idle'});return;}
    if(t.inputHash!==pending.inputHash)fail('请求编号对应的原输入无法核对，不交付其他任务结果。');
    const original=r.messages?.find(m=>m.id===t.userMessageId&&m.role==='user');
    if(original){if(await articleInputHash(binding,original.content)!==t.inputHash)fail();if(!current(turn))return;pending={...pending,text:original.content};}
    let answer=null,phase=t.status==='completed'?'completed':t.status==='failed'?'failed':'running',error='';
    if(t.status==='completed'){
      answer=r.messages?.find(m=>m.id===t.assistantMessageId&&m.role==='assistant')??null;
      if(!answer){phase='running';error='任务已完成，正在核对本次回答；不会重新发送。';}
      else if(answer.meta?.sourceStatus!=='current'||canonical(answer.meta?.provenance?.articleEvidence?.binding)!==canonical(binding)){phase='failed';answer=null;error='完成回执与当前获准来源尚不能对应，请核对状态；不展示旧回答。';}
    }else if(t.status==='failed'){
      const reasons={ARTICLE_AI_NUMERIC_REJECTED:'回答中的数值未通过来源与语境核验，未交付解读。问题已保留；可核对右侧原文，不会自动重试。',ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED:'数值引用与当前文章片段或版本不一致，未交付解读。问题已保留，请核对来源；不会自动重试。',ARTICLE_EVIDENCE_CHANGED:'文章版本或来源已变化，未交付解读。请返回原文核对；不会自动重试。',QA_MODEL_TRUNCATED:'模型回答达到长度限制，未交付解读。问题已保留，可缩小范围后主动发送；不会自动重试。'};
      Object.assign(reasons,{ARTICLE_NO_DELIVERABLE_SECTIONS:'本次没有可交付的解释段落，未生成解读。问题已保留，请对照原文缩小问题范围；不会自动重试。',ARTICLE_RESPONSE_CHANGED:'回答与当前核验记录无法对应，未交付解读。问题已保留，请核对状态；不会自动重试。',ARTICLE_AI_JSON_INVALID:'模型返回格式无法读取，未交付解读。问题已保留，不会自动重试。',ARTICLE_AI_SCHEMA_REJECTED:'模型返回格式不完整，未交付解读。问题已保留，不会自动重试。'});
      error=reasons[t.errorCode]??'本次任务执行失败，未交付解读。问题已保留，请核对状态；不会自动重试。';
    }
    emit({task:t,answer,phase,error,...(original&&(!questionDirty||running(t))?{question:original.content}:{})});
  }
  async function readContext(turn){
    const a=checkedArticle(await client.get(contextPath()),recordId);if(!current(turn))return;
    if(binding&&canonical(binding)!==canonical(a.binding))fail('文章已有新版本或审核决定，请返回原文重新核对。');binding=a.binding;
    if(a.latestTask){
      if(pending&&(a.latestTask.requestKey!==pending.requestKey||a.latestTask.inputHash!==pending.inputHash))fail();
      if(!pending){remember({requestKey:a.latestTask.requestKey,inputHash:a.latestTask.inputHash,text:null});}
    }
    if(pending&&(!a.existingSessionId||a.requestStatus==='not_found'))fail('该历史请求与当前文章版本无法对应，请返回原文核对。');
    emit({kind:'ready',article:a,sessionId:a.existingSessionId,task:null,answer:null,error:'',phase:pending?'uncertain':'idle',...(a.execution.quota?{quota:a.execution.quota}:{})});
    if(view.sessionId)await readState(turn);
  }
  async function open(){const turn=++epoch;emit({kind:'loading',article:null,answer:null,error:'',paused:false});
    try{const [agents,status]=await Promise.all([client.get('/agents'),client.get('/knowledge/ai-status')]);if(!current(turn))return;
      const agent=agents.find(a=>a.type==='research');if(!agent)fail('当前账号没有科研 Agent 使用授权。',403);
      emit({agentId:agent.id,quota:status.quota});await readContext(turn);
    }catch(e){failed(e,turn);}}
  async function refresh(){if(view.paused||disposed)return;const turn=++epoch;emit({error:'',refreshing:true});try{await readContext(turn);}catch(e){failed(e,turn);}finally{if(current(turn))emit({refreshing:false});}}
  async function send(original=false){
    if(disposed||view.paused||view.kind!=='ready'||['ensuring','sending','running'].includes(view.phase)||!view.article?.execution.canStart||view.quota?.blocked)return;
    const text=view.question.trim(),inputError=agentQuestionError(text);if(inputError){emit({error:inputError});return;}
    const turn=++epoch,hash=await articleInputHash(binding,text);if(!current(turn))return;
    if(pending&&view.phase==='uncertain'&&!original){emit({error:'请先查看状态；仅可明确使用原编号与原问题重试。'});return;}
    if(original&&(!pending||pending.inputHash!==hash)){emit({error:'输入与原问题不一致，请输入原问题后再核对，不能换编号重发。'});return;}
    if(!original)remember({requestKey:'article-'+crypto.randomUUID(),inputHash:hash,text});
    else pending={...pending,text};
    questionDirty=false;
    emit({answer:null,task:null,error:'',phase:view.sessionId?'sending':'ensuring'});
    try{
      if(!view.sessionId){const s=await client.post('/sessions/hub-source',{agentId:view.agentId,hubKey:'lingshu-xinyu',articleBinding:binding});if(!current(turn))return;emit({sessionId:s.id,phase:'sending'});}
      const j=await client.post(`/sessions/${view.sessionId}/knowledge-messages`,{text,requestKey:pending.requestKey,kbIds:[]});if(!current(turn))return;
      if(j.requestKey!==pending.requestKey){if(!key.test(j.requestKey??'')||!sha.test(j.inputHash??''))fail();remember({requestKey:j.requestKey,inputHash:j.inputHash,text:null});}
      else if(j.inputHash!==pending.inputHash)fail();
      emit({task:j,phase:'running'});
      for(let n=0;n<maxPolls;n++){await readState(turn);if(!current(turn)||view.phase!=='running')return;if(n+1<maxPolls)await wait(pollMs);if(!current(turn))return;}
      emit({phase:'running',error:'任务仍在执行。可点击“查看状态”，离开或刷新不会取消，也不会自动重新发送。'});
    }catch(e){if(!current(turn))return;
      if([401,403].includes(e.status)&&e.code!=='ARTICLE_PAID_NOT_APPROVED'){failed(e,turn);return;}
      if([400,403,422,429].includes(e.status)){emit({phase:'failed',error:e.message,answer:null});return;}
      emit({phase:'uncertain',answer:null,error:'提交结果尚未确认，正在只读核对原编号；不会自动重新发送。'});
      try{await readContext(turn);if(current(turn)&&!view.task)emit({phase:'uncertain',error:'尚未确认原请求是否入队。请查看状态；如需重试，只能使用原编号与原问题。'});}catch(reason){failed(reason,turn);}
    }
  }
  async function loadOlder(){
    if(!view.nextCursor||view.paused||view.loadingOlder)return;const turn=epoch;emit({loadingOlder:true});
    try{const r=await client.get(`/sessions/${view.sessionId}/knowledge-state?limit=60&before=${view.nextCursor}`);if(!current(turn))return;
      if(r.articleContext?.status==='restricted'||canonical(r.articleContext?.binding)!==canonical(binding))fail('固定文章版本或授权已变化。',403);
      emit({messages:[...new Map([...(r.messages??[]),...(view.messages??[])].map(m=>[m.id,m])).values()],nextCursor:r.nextCursor});
    }catch(e){failed(e,turn);}finally{if(current(turn))emit({loadingOlder:false});}
  }
  async function ensureForQueue(){
    if(view.paused||disposed||view.kind!=='ready'||!binding)fail('请先核对本篇文章与当前身份。',403);
    if(view.sessionId)return view.sessionId;const turn=epoch;
    const s=await client.post('/sessions/hub-source',{agentId:view.agentId,hubKey:'lingshu-xinyu',articleBinding:binding});
    if(!current(turn))fail('当前会话已变化，请重新进入。',409);emit({sessionId:s.id});return s.id;
  }
  return {open,refresh,ensureForQueue,refreshLatest:async()=>{if(view.paused||disposed)return;remember(null);return refresh();},loadOlder,send:()=>send(false),retryOriginal:()=>send(true),getState:()=>view,
    setQuestion:text=>{if(!['ensuring','sending','running'].includes(view.phase)&&!(view.phase==='uncertain'&&pending?.text)){questionDirty=true;emit({question:text,error:''});}},
    pause(){++epoch;emit({paused:true,article:null,answer:null,messages:[]});},dispose(){disposed=true;++epoch;},
  };
}
