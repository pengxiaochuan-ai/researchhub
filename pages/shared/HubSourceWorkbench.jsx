import React,{useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Shell} from './Shell.jsx';
import {Button} from './Components.jsx';
import {hubSourceRequest} from '../../src/hub-source-api.js';
import {savePendingReview,readPendingReview,clearPendingReview,matchesReviewReceipt} from '../../src/source-review-recovery.js';
import {filterReviewQueue,isPendingReview,isDecidedReview,nextPendingKey,nextPendingAfterSave,reviewVisibilityNames,sourceReviewCopy,sourceReviewIdentityKey} from '../../src/source-review-queue.js';
import {reviewQueueCounts,nextReviewLabel} from '../../src/pmc-review-content.js';
import {governanceTarget} from '../../src/governance-overview.js';
import ExternalReviewPreview from './ExternalReviewPreview.jsx';
import PmcReviewPreview from './PmcReviewPreview.jsx';
import WorkbookReviewDetails from './WorkbookReviewDetails.jsx';
import './hub-source-workbench.css';
import './source-review-queue.css';

const kindNames={pmc:'PMC文章',external:'外部来源',workbook:'工作簿来源'};
const decisionHelp={
  public:'任何访客都能在Hub页面查看；有AI使用权限的用户可在问答中检索引用。',
  tenant:'仅当前租户（组织）的已登录成员可查看，AI也仅限该租户内检索引用。',
  withheld:'不向用户展示，也不供AI检索；内容仍保留在审核队列，可稍后重新决定。',
  public_display:'本次仅更新公开页面展示，不会新增或修改AI用途；AI检索仍未获准。',
};
export function ReviewDecisionActions({disabled,status,onDecide,allowDisplayOnly=false,snapshot=status}) {
  const id=useId(),saved=Object.hasOwn(reviewVisibilityNames,status)?status:'';
  const [draft,setDraft]=useState(()=>({snapshot,choice:saved}));
  // A workbook scope is temporarily unavailable during revalidation. Retain an
  // unsaved choice only if the exact same scope/version returns; never carry it to a new one.
  useEffect(()=>{if(snapshot!=null)setDraft(value=>value.snapshot===snapshot?value:{snapshot,choice:saved});},[snapshot,saved]);
  const choice=draft.snapshot===snapshot?draft.choice:saved;
  return <div className="hub-review-decision-select">
    <label htmlFor={id}>本次可见范围</label>
    <div className="hub-review-decision-actions">
      <select id={id} value={choice} disabled={disabled} aria-describedby={`${id}-help ${id}-state`} onChange={event=>setDraft({snapshot,choice:event.target.value})}>
        <option value="">请选择可见范围</option>{Object.entries(reviewVisibilityNames).filter(([value])=>value!=='public_display'||allowDisplayOnly).map(([value,label])=><option key={value} value={value}>{value==='public_display'?'仅更新公开展示（AI不变）':label}</option>)}
      </select>
      <Button primary disabled={disabled||!choice||choice===saved} onClick={()=>{if(!disabled&&choice&&choice!==saved)onDecide(choice);}}>确认保存</Button>
    </div>
    <p id={`${id}-help`} className="hub-review-choice-help">{decisionHelp[choice]||'选择当前内容的页面展示与AI检索范围，选择本身不会保存。'}</p>
    <p id={`${id}-state`} className="hub-review-choice-state" role="status">{!choice?'尚未选择范围，不会自动放行。':choice===saved?'当前范围已保存；修改后再确认保存。':'本次选择尚未保存，点击“确认保存”才会生效。'}</p>
  </div>;
}
export default function HubSourceWorkbench({embedded=false,showTaskDescription=true}) {
  const [items,setItems]=useState([]),[selectedKey,setSelectedKey]=useState('');
  const [filters,setFilters]=useState({kind:'all',status:'pending',q:''});
  const [state,setState]=useState('loading'),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false),[workbookScope,setWorkbookScope]=useState(null),[showDetail,setShowDetail]=useState(false),[revision,setRevision]=useState(0);
  const [pendingReview,setPendingReview]=useState(null);
  const [pendingMissing,setPendingMissing]=useState(false);
  const generation=useRef(0),controller=useRef(null),submitting=useRef(false),heading=useRef(null);
  const focusRequested=useRef(false);
  const identityPending=useRef(false);
  const reviewerIdentity=useRef(null);
  const decisionPanel=useRef(null);
  const queuePanel=useRef(null);
  const queuePositionRequested=useRef(true);
  const requestedSource=useRef(new URLSearchParams(window.location.search).has('reviewKey'));
  const missingRequestedSource=useRef(false);
  const selected=items.find(x=>x.key===selectedKey);
  const filtered=filterReviewQueue(items,filters);
  const nextKey=nextPendingKey(items,selectedKey,filters);
  const counts=reviewQueueCounts(items,filters);
  const receiveScope=useCallback(scope=>setWorkbookScope(scope),[]);
  useLayoutEffect(()=>{
    if(!focusRequested.current)return;focusRequested.current=false;
    heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});
  },[selectedKey,showDetail]);
  useLayoutEffect(()=>{
    const node=queuePanel.current;if(!node)return;
    let frame=0;
    const update=()=>{frame=0;
      // At the parent's lower edge sticky can move upward; do not grow into the frozen 64px header.
      const top=Math.max(80,node.getBoundingClientRect().top),bottom=Math.min(window.innerHeight-16,node.parentElement.getBoundingClientRect().bottom);
      const height=Math.max(0,bottom-top);
      node.style.setProperty('--hub-review-queue-height',`${height}px`);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
    const observer=new ResizeObserver(schedule);observer.observe(node.closest('.hub-review-workspace'));
    return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
  },[state,items.length]);
  useLayoutEffect(()=>{
    if(state!=='ready'||!queuePositionRequested.current)return;
    const button=queuePanel.current?.querySelector('[aria-current=true]');
    if(!button?.getClientRects().length)return;
    const list=button.closest('ul');
    if(list.scrollHeight>list.clientHeight){
      // Scroll only the queue; scrolling its ancestors would displace the current detail.
      list.scrollTop+=button.getBoundingClientRect().top-list.getBoundingClientRect().top-list.clientTop;
    }else if(!showDetail)button.scrollIntoView({block:'nearest'});
    queuePositionRequested.current=false;
  },[state,selectedKey,showDetail]);

  const load=useCallback(async({clearNotice=false,advanceFrom=null,advanceFilters={}}={})=>{
    if(identityPending.current)return false;
    controller.current?.abort();const request=new AbortController();controller.current=request;
    const current=++generation.current;
    setState('loading');setError('');setWorkbookScope(null);setRevision(value=>value+1);
    if(clearNotice){setNotice('');queuePositionRequested.current=true;}
    try {
      if(!reviewerIdentity.current){
        const {getPlatformUser}=await import('../../src/platform-user.js');
        if(request.signal.aborted||current!==generation.current)return false;
        reviewerIdentity.current=sourceReviewIdentityKey(getPlatformUser());
      }
      const identity=reviewerIdentity.current,pending=readPendingReview(sessionStorage,identity);let recovered=false,recoveryMessage='',missing=false;
      setPendingReview(pending);setPendingMissing(false);
      if(pending){
        try{const result=await hubSourceRequest(`review-receipts/${pending.input.operationId}`,{signal:request.signal});
          if(!matchesReviewReceipt(pending,result.receipt))throw Error('操作结果与原提交不一致，请联系管理员核对。');
          recovered=true;
        }catch(cause){
          if([401,403].includes(cause.status))throw cause;
          missing=cause.status===404;
          recoveryMessage=`“${pending.savedLabel}”`+(missing?'尚未查到上次提交结果。可点击“重试上次保存”，仅按原内容重试，不会新建另一笔审核。':'上次提交结果仍待核对：'+cause.message);
        }
      }
      const result=await hubSourceRequest('review-queue',{signal:request.signal});
      if(request.signal.aborted||current!==generation.current)return false;
      if(pending){
        if(recovered){clearPendingReview(sessionStorage,identity);setPendingReview(null);setNotice(`已确认“${pending.savedLabel}”上次审核保存成功；当前队列已重新核对。`);}
        else{setError(recoveryMessage);setPendingMissing(missing);}
      }
      const advanceKey=advanceFrom?nextPendingAfterSave(result.items,advanceFrom,advanceFilters):null;
      setItems(result.items);
      if(advanceFrom){setSelectedKey(advanceKey||(result.items.some(x=>x.key===advanceFrom)?advanceFrom:''));
        if(advanceKey){focusRequested.current=true;queuePositionRequested.current=true;setShowDetail(true);}}
      else if(requestedSource.current){
        requestedSource.current=false;
        const key=governanceTarget(window.location.search,'sources');
        if(key&&result.items.some(x=>x.key===key)){setSelectedKey(key);setFilters({kind:'all',status:'all',q:''});setShowDetail(true);focusRequested.current=true;queuePositionRequested.current=true;}
        else{missingRequestedSource.current=true;setSelectedKey('');setError('指定来源当前不存在或无权访问，请从审核队列重新选择。');}
      }else if(missingRequestedSource.current){setSelectedKey('');setError('指定来源当前不存在或无权访问，请从审核队列重新选择。');}
      else setSelectedKey(key=>result.items.some(x=>x.key===key)?key:(result.items.find(isPendingReview)||result.items[0])?.key||'');
      setState('ready');return {advanced:!!advanceKey};
    } catch(cause) {
      if(!request.signal.aborted&&current===generation.current){setItems([]);setState(cause.status===403?'forbidden':'error');
        setError(cause.status===403?'当前账号没有此 Hub 的来源审核授权。':cause.message);}
      return false;
    }
  },[]);
  const restricted=useCallback(()=>{generation.current++;controller.current?.abort();setItems([]);setNotice('');setState('forbidden');setError('当前会话或来源审核授权已失效，请重新登录或核对授权。');},[]);
  const stale=useCallback(()=>{setNotice('原文版本已变化，正在重新核对当前对象。');load();},[load]);
  useEffect(()=>{
    load();
    const refresh=()=>{if(!document.hidden&&!submitting.current&&!identityPending.current)load();};
    const identity=event=>{const next=sourceReviewIdentityKey(event.detail),same=next!==null&&next===reviewerIdentity.current;reviewerIdentity.current=next;
      if(same){if(!submitting.current)load();return;}
      generation.current++;controller.current?.abort();setItems([]);setSelectedKey('');setWorkbookScope(null);setBusy(false);submitting.current=false;setPendingReview(null);setNotice('');queuePositionRequested.current=true;
      identityPending.current=['checking','unavailable'].includes(event.detail?.status);setState('loading');
      if(!identityPending.current)load();};
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('qiyan:user-change',identity);
    return()=>{generation.current++;controller.current?.abort();window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',refresh);window.removeEventListener('qiyan:user-change',identity);};
  },[load]);
  function select(key) {
    if(submitting.current||state!=='ready')return;
    missingRequestedSource.current=false;
    focusRequested.current=true;
    if(key===selectedKey){
      if(showDetail){focusRequested.current=false;heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});}
      else {queuePositionRequested.current=true;setShowDetail(true);}
      return;
    }
    queuePositionRequested.current=true;setSelectedKey(key);setWorkbookScope(null);setNotice('');if(!pendingReview)setError('');setShowDetail(true);
  }
  function changeFilters(change) {
    if(submitting.current)return;
    const next={...filters,...change};setFilters(next);setShowDetail(false);setNotice('');
    const list=filterReviewQueue(items,next);if(!list.some(x=>x.key===selectedKey))setSelectedKey(list[0]?.key||'');
  }
  const currentState=selected?.kind==='workbook'?workbookScope?.state:selected?.state;
  const currentCopy=sourceReviewCopy({...selected,state:currentState});
  const count=selected?.kind==='workbook'?workbookScope?.eligibleBibliographic:1;
  const unavailable=!selected||selected.state.status==='unavailable'||(selected.kind==='workbook'&&!workbookScope);
  const target=selected?.kind==='workbook'?(workbookScope?.sourceRecordId?'当前所选单行':`当前来源、本批次的 ${count??'—'} 条合格记录`):'当前这一份内容';
  const decisionSnapshot=selected?.kind==='workbook'&&!workbookScope?null:JSON.stringify([selected?.key,currentState?.status,selected?.kind==='workbook'?workbookScope?.fingerprint:
    selected?.kind==='pmc'?[selected.detail.versionId,selected.detail.rawSha256,selected.detail.assetFingerprint,selected.detail.articleDecision?.version]:selected?.fingerprint]);
  const effectiveRange=Object.hasOwn(reviewVisibilityNames,currentState?.status)?reviewVisibilityNames[currentState.status]:
    currentState?.status==='pending'?'尚未放行':currentState?.status==='changed'?
      `${reviewVisibilityNames[selected?.detail.articleDecision?.visibility]||'原决定'}（仅原已审核内容，新增内容待核对）`:
      currentState?.status==='partial'?currentCopy.summary:'正在核对或内容待补齐';
  async function decide(visibility) {
    if(unavailable||submitting.current||pendingReview||state!=='ready')return;
    const item=selected.detail;
    const savedLabel=selected.kind==='pmc'?selected.subtitle:`${selected.title} · ${target}`;
    let body;
    if(selected.kind==='pmc') {
      body={operationId:crypto.randomUUID(),versionId:item.versionId,rawSha256:item.rawSha256,visibility,
        expectedVersion:item.articleDecision?.version||'0',expectedAssetFingerprint:item.assetFingerprint};
    } else {
      body={kind:selected.kind,visibility:visibility==='public_display'?'public':visibility,
        ...(visibility==='public_display'?{mode:'display_only'}:{}),operationId:crypto.randomUUID(),
        expectedFingerprint:selected.kind==='workbook'?workbookScope.fingerprint:selected.fingerprint,
        ...(selected.kind==='external'?{documentId:item.id}:{batchId:item.batchId,sourceRegistryId:item.sourceRegistryId,sourceRecordId:workbookScope.sourceRecordId})};
    }
    return transmit({kind:selected.kind,input:body,sourceKey:selectedKey,savedLabel});
  }
  async function transmit(pending){
    if(submitting.current||state!=='ready')return;
    const submission=Symbol('review-submit');submitting.current=submission;setBusy(true);setPendingMissing(false);setError('');setNotice('');
    const current=generation.current,identity=reviewerIdentity.current,body=pending.input;
    const path=pending.kind==='pmc'?'pmc-reviews':'object-reviews',visibility=body.mode==='display_only'?'public_display':body.visibility;
    try {
      try{savePendingReview(sessionStorage,identity,pending);setPendingReview(pending);}
      catch{setError('本次操作尚未发出：无法保留操作记录，请确认登录状态及浏览器存储可用后重试。');return;}
      const result=await hubSourceRequest(path,{method:'POST',body:JSON.stringify(body)});
      if(current!==generation.current)return;
      if(!matchesReviewReceipt(pending,{kind:pending.kind,input:body,review:result.review}))throw Error('返回结果无法与本次操作核对。');
      clearPendingReview(sessionStorage,identity);setPendingReview(null);
      setNotice(`已保存：${reviewVisibilityNames[visibility]}。正在核对保存后的真实状态…`);
      const loaded=await load({advanceFrom:pending.sourceKey,advanceFilters:filters});
      if(submitting.current!==submission)return;
      if(loaded)setNotice(`上一项“${pending.savedLabel}”已保存为“${reviewVisibilityNames[visibility]}”。${loaded.advanced?'已自动显示下一项待审核内容。':'当前筛选范围内已无其他待审内容，保留当前对象。'}`);
      else if(submitting.current===submission)setNotice('保存已获确认，但未能重新核对队列，尚未自动切换。请重新核对后继续。');
    } catch(cause) {
      if(current!==generation.current)return;
      if(cause.status>=400&&cause.status<500&&![408,429].includes(cause.status)){clearPendingReview(sessionStorage,identity);setPendingReview(null);}
      if([401,403].includes(cause.status)){setItems([]);setState('forbidden');setError('当前账号没有此 Hub 的来源审核授权。');}
      else if(cause.status===409){await load();if(submitting.current!==submission)return;setError(`内容或审核状态已变化，本次选择“${reviewVisibilityNames[visibility]}”未保存，已重新读取；请核对后再决定。`);}
      else setError(`“${pending.savedLabel}”保存结果尚未确认：`+cause.message+'。请点击“重新核对”查看当前状态，不会自动重复提交。');
    } finally {
      if(submitting.current===submission){submitting.current=false;setBusy(false);}
    }
  }
  const content=<div className="hub-source-content hub-review-workspace">
    <div className="hub-review-toolbar">
      {showTaskDescription&&<p>选择内容并核对原文，然后确认可见范围。</p>}
      <Button disabled={busy||state==='loading'} onClick={()=>pendingReview&&pendingMissing?transmit(pendingReview):load({clearNotice:true})}>{pendingReview&&pendingMissing?'重试上次保存':'重新核对'}</Button>
    </div>
    {notice&&!selected&&<p className="hub-source-notice" role="status">{notice}</p>}
    {error&&<p className="hub-source-error" role="alert">{error}</p>}
    {state==='loading'&&<p role="status">正在读取当前审核队列…</p>}
    {((state==='ready')||(state==='loading'&&items.length>0))&&<>
      <div className="hub-review-filters">
        <label>处理状态<select aria-label="处理状态" value={filters.status} disabled={busy} onChange={event=>changeFilters({status:event.target.value})}>
          <option value="pending">待处理（{counts.pending}）</option>
          <option value="all">全部（{counts.all}）</option>
          <option value="decided">已决定（{counts.decided}）</option>
        </select></label>
        <label>来源类型<select aria-label="来源类型" value={filters.kind} disabled={busy} onChange={event=>changeFilters({kind:event.target.value})}>
          <option value="all">全部类型（{filterReviewQueue(items,{...filters,kind:'all'}).length}）</option>{Object.entries(kindNames).map(([value,label])=><option key={value} value={value}>{label}（{filterReviewQueue(items,{...filters,kind:value}).length}）</option>)}
        </select></label>
        <label className="hub-review-search">搜索题名或编号<input type="search" value={filters.q} maxLength={150} disabled={busy}
          onChange={event=>changeFilters({q:event.target.value})} placeholder="输入题名、PMC编号或来源"/></label>
      </div>
      <div className={`hub-review-columns ${showDetail?'is-detail-open':''}`}>
        <aside className="hub-review-queue" aria-label="来源审核队列" ref={queuePanel}>
          <p className="hub-review-queue-count">{filters.kind==='all'?'全部类型':kindNames[filters.kind]} · {filters.status==='pending'?'待处理':filters.status==='all'?'全部状态':'已决定'} · 符合条件 {filtered.length} 项{selected&&!filtered.some(x=>x.key===selectedKey)?' · 当前详情保留刚处理的对象':''}</p>
          {filtered.length?<ul>{filtered.map(item=><li key={item.key}><button type="button" disabled={busy} aria-current={selectedKey===item.key?'true':undefined} onClick={()=>select(item.key)}>
            <span className="hub-review-queue-kind">{kindNames[item.kind]}</span><strong>{item.title}</strong>
            <span>{item.subtitle}</span><span className={`hub-review-status status-${item.state.status}`}>{sourceReviewCopy(item).label}</span>
          </button></li>)}</ul>:<p role="status">当前条件下没有匹配内容。可切换状态或清空搜索。</p>}
        </aside>
        <section className="hub-review-detail" aria-label="当前来源审核详情">
          <Button className="hub-review-back" disabled={busy} onClick={()=>{queuePositionRequested.current=true;setShowDetail(false);}}>返回审核队列</Button>
          {selected?<div key={selected.key}>
            <div className="hub-review-detail-heading"><span>{kindNames[selected.kind]} · {selected.subtitle}</span>
              <h3 tabIndex={-1} ref={heading}>{selected.title}</h3></div>
            {notice&&<p className="hub-source-notice" role="status">{notice}</p>}
            <section className="hub-review-decision" aria-label="本次审核决定" ref={decisionPanel} tabIndex={-1}>
              <p><strong>{currentState?.status==='partial'?'当前使用状态：':'当前已生效范围：'}{effectiveRange}</strong></p>
              {!Object.hasOwn(reviewVisibilityNames,currentState?.status)&&currentState?.status!=='partial'&&<p>当前状态：{currentState?.label||'正在核对范围'}</p>}
              <p>本次决定作用于：{target}。{selected.canUpdateDisplayOnly?'可仅更新公开展示，或明确选择页面与AI同时放行。':'页面展示与AI检索同步生效。'}</p>
              <p>先选择范围，再确认保存。AI检索指有权限的用户提问时引用获准文字，不会因放行自动运行AI。</p>
              <ReviewDecisionActions key={selected.key} snapshot={decisionSnapshot} disabled={busy||!!pendingReview||state!=='ready'||unavailable} status={currentState?.status} allowDisplayOnly={selected.canUpdateDisplayOnly===true} onDecide={decide}/>
              {unavailable&&<p>请先取得可核验内容或等待范围核对完成，再作决定。</p>}
              <p className="hub-review-help">审核人、时间、内容版本和范围由系统自动记录。</p>
              <div className="hub-review-next"><Button disabled={busy||!nextKey||state!=='ready'} onClick={()=>select(nextKey)}>{nextReviewLabel(currentState?.status,selected.kind)}</Button>
                <span>{!nextKey?'当前筛选下没有其他待审项。':isDecidedReview({state:currentState||{}})?'当前决定已保存；查看下一项不会更改本项。':'尚未提交决定；跳过后本项仍保留待处理。'}</span></div>
            </section>
            {selected.kind==='pmc'?<PmcReviewPreview item={selected.detail} onRestricted={restricted} onStale={stale}/>:selected.kind==='external'?<ExternalReviewPreview item={selected.detail}/>
              :<WorkbookReviewDetails key={selected.key} entry={selected} refreshVersion={revision} busy={busy} onScope={receiveScope}/>}
            <nav className="hub-review-reading-actions" aria-label="长文审核操作">
              <span>{selected.kind==='pmc'?selected.detail.pmcid:'当前所选对象'} · {currentCopy.label||'范围核对中'}</span>
              <Button disabled={busy||state!=='ready'} onClick={()=>{decisionPanel.current?.focus({preventScroll:true});decisionPanel.current?.scrollIntoView({block:'start'});}}>回到审核决定</Button>
              <Button disabled={busy||!nextKey||state!=='ready'} onClick={()=>select(nextKey)}>{nextReviewLabel(currentState?.status,selected.kind)}</Button>
            </nav>
          </div>:<p>从审核队列选择一项查看内容。</p>}
        </section>
      </div>
    </>}
  </div>;
  if(embedded)return content;
  return <Shell className="g02-page hub-source-workbench" active="管理与治理" hero={{breadcrumb:'管理与治理',title:'来源审核',subtitle:'核对来源内容并决定可见范围。'}}>{content}</Shell>;
}
