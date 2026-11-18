import React,{useEffect,useRef,useState} from 'react';
import {Card,Button} from './Components.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {createDesignRefreshGate} from '../../src/research-design-session.js';
import {makeCrfMethodAssetUrl,makeCrfMethodReportUrl,crfMethodAssetReadFailure,crfMethodAssetReadState,formatCrfMethodAssetOptions} from '../../src/crf-method-assets-session.js';
import {makeAssetApplicabilityUrl} from '../../src/asset-applicability-session.js';

const confirmations=['目标问题/PICO及材料使用授权','目标人群和入排标准','访视时点、单位及缺失语义','人工范围与方法适用性','新数据及新质控','正式治理要求'];
const steps=['重新确认目标研究和来源授权','准备新研究数据，不复制旧记录或结果','重新执行数据质控','执行适用的新方法','人工评审新报告'];
const show=value=>value===null||value===undefined?'未配置':typeof value==='boolean'?(value?'是':'否'):String(value);

export default function CrfMethodAssetDetail({initial,api,scope,initialVersion,onRestricted,onReadTarget,probeIssue,onReadValidated}){
 const [asset,setAsset]=useState(initial),[notes,setNotes]=useState(initial.notes),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[readIssue,setReadIssue]=useState(null);
 const base=useRef({version:initial.version,notes:initial.notes}),chosen=useRef(initialVersion??null),alive=useRef(true),sequence=useRef(0),gate=useRef(createDesignRefreshGate()),dirtyRef=useRef(false),busyRef=useRef(false),keys=useRef(new Map()),alert=useRef(null);
 const dirty=notes!==base.current.notes;dirtyRef.current=dirty;busyRef.current=busy;
 const health=crfMethodAssetReadState(readIssue,probeIssue),invalid=health?.state==='invalid',historyView=chosen.current!==null,blocked=busy||!!health||historyView||!asset.canEdit,root=asset.rootReference;
 function apply(value,force=false){if(value.sourceStatus==='restricted'){onRestricted(value.message??'来源授权已失效，内容已清除。');return;}setReadIssue(null);onReadValidated();setAsset(value);if(force||!dirtyRef.current){base.current={version:value.version,notes:value.notes};dirtyRef.current=false;setNotes(value.notes);}else if(value.version!==base.current.version)setError('候选已有新版本；未保存的说明与修改基准已保留，请核对后保存或明确放弃。');}
 function reject(e,n,reading=false){if(!alive.current||n!==sequence.current)return;if([401,403].includes(e.status))onRestricted(e.message);else if(reading)setReadIssue(crfMethodAssetReadFailure(e));else setError(e.message+' 未保存说明保留，不自动重发。');}
 async function refresh(){if(!api||busyRef.current)return;const g=gate.current.begin();if(!g)return;const n=sequence.current,target=chosen.current;onReadTarget(asset.id,target);try{const value=await api.get('/crf-method-asset-drafts/'+asset.id+(target!==null?'/versions/'+target:''));if(alive.current&&n===sequence.current)apply(value);}catch(e){reject(e,n,true);}finally{gate.current.finish(g);}}
 async function choose(no){if(busyRef.current)return;if(dirtyRef.current&&!window.confirm('放弃未保存的方法资产说明，读取所选版本？'))return;const n=++sequence.current;gate.current.invalidate();chosen.current=no;onReadTarget(asset.id,no);busyRef.current=true;setBusy(true);setError('');setFeedback('');try{const value=await api.get('/crf-method-asset-drafts/'+asset.id+(no!==null?'/versions/'+no:''));if(alive.current&&n===sequence.current){apply(value,true);history.replaceState(null,'',makeCrfMethodAssetUrl('a02',scope,asset.id,no));}}catch(e){reject(e,n,true);}finally{if(alive.current&&n===sequence.current){busyRef.current=false;setBusy(false);}}}
 async function mutate(derive){if(busyRef.current||health||historyView||asset.sourceStatus!=='current'||(derive?!asset.canDerive||dirtyRef.current:!asset.canEdit||!dirtyRef.current))return;
  const path='/crf-method-asset-drafts/'+asset.id+(derive?'/derivations':'/notes'),body={baseVersionNo:base.current.version,...(!derive?{notes}:{})},signature=JSON.stringify([path,body]);if(!keys.current.has(signature))keys.current.set(signature,'method-asset-ui-'+crypto.randomUUID());
  const n=++sequence.current;gate.current.invalidate();busyRef.current=true;setBusy(true);setError('');setFeedback('');
  try{const value=await api.post(path,{...body,requestKey:keys.current.get(signature)});if(!alive.current||n!==sequence.current)return;keys.current.delete(signature);
   if(derive){busyRef.current=false;setBusy(false);location.assign(makeCrfMethodAssetUrl('a02',scope,value.asset.id));return;}
   chosen.current=null;apply(value.asset,true);setFeedback('已保存本人说明 v'+value.asset.version+'；固定报告、事实和配方不变。');history.replaceState(null,'',makeCrfMethodAssetUrl('a02',scope,asset.id));
  }catch(e){reject(e,n);}finally{if(alive.current&&n===sequence.current){busyRef.current=false;setBusy(false);}}
 }
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>void refresh(),5000),unload=e=>{if(dirtyRef.current||busyRef.current){e.preventDefault();e.returnValue='';}},leave=e=>{const target=e.target instanceof Element?e.target.closest('a,button'):null;if(!target||!(target.tagName==='A'||target.matches('.qiyan-header-brand')||target.closest('.qiyan-platform-sidebar nav,.qiyan-context-breadcrumb,.qiyan-sidebar-ai')))return;if((dirtyRef.current||busyRef.current)&&!window.confirm('离开将放弃未保存的方法资产说明，是否继续？')){e.preventDefault();e.stopPropagation();}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);return()=>{alive.current=false;sequence.current++;gate.current.invalidate();busyRef.current=false;dirtyRef.current=false;clearInterval(timer);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};},[]);
 useEffect(()=>{if(error||health)alert.current?.focus();},[error,health?.message]);
 const recipe=asset.reuseRecipe,c=recipe.config;
 return <section aria-label="方法资产候选内容">
  <nav className="asset-actions" aria-label="方法候选导航"><a href={makeCrfMethodAssetUrl('a01',scope)}>返回我的方法候选列表</a><Button disabled={busy} loading={busy} onClick={()=>void choose(null)}>核对最新方法候选</Button></nav>
  <p role="status">本人候选 v{asset.version} / {health?'上次已读版本':'当前'} v{asset.currentVersion} · 根报告 v{root.reportVersionNo} · {health?'当前未核实':asset.sourceStatus==='current'?'来源有效':'来源或祖先已变化，仅历史核对'} · 未共享／未审批</p>
  {health&&<div><p ref={alert} tabIndex={-1} role="alert" className="asset-error">{health.message}；当前未核实，不能保存或派生。{invalid?'校验失败的历史报告、配方及来源已隐藏。':'下方仅是上次读取内容，不保证当前有效。'}本人未保存说明和原版本基准保留。</p><Button disabled={busy} onClick={()=>void refresh()}>重新验证当前候选</Button></div>}
  {historyView&&<p className="asset-notice">固定候选历史版本，只读核对；即使恰为最新版本，也不在历史视图提交。</p>}
  {asset.sourceStatus!=='current'&&<p className="asset-notice">报告、数据、方法、资料或派生父版本已变化，不能继续修订或派生；不会自动重绑或因说明改回而恢复。</p>}
  {error&&<p ref={alert} tabIndex={-1} role="alert" className="asset-error">{error}</p>}{feedback&&<p role="status">{feedback}</p>}
  {!invalid&&<><Card title="复用配方与待重新确认条件"><div className="method-recipe"><p>仅包含方法配置，不含旧CRF答案、被试记录或结果；复用不会创建研究、方案或方法运行。</p><h3>{c.label}</h3><p>表单：{c.form.name}；字段 {c.form.schema.fields.length} 项；访视 {c.visits.length} 项；结局 {c.outcomes.length} 项。</p>
   {!health&&!historyView&&asset.sourceStatus==='current'&&<p><a href={makeAssetApplicabilityUrl(scope)}>核对复用条件（新建本人核对记录）</a></p>}
   <h3>必须重新确认</h3><ul>{confirmations.map(label=><li key={label}>{label}</li>)}</ul>
   <h3>建议执行步骤（此处不执行）</h3><ol>{steps.map(label=><li key={label}>{label}</li>)}</ol>
   <p>方法：{recipe.method.executor} · {recipe.method.workerVersion} · {recipe.method.adapterVersion}。仅本人合成包的缺失、人工范围及包内计数检查，不是量表计分、疗效分析、全Study完成度或研究放行。</p>
   <details><summary>查看访视、字段、单位与映射配置</summary><ul>{c.visits.map(v=><li key={v.key}>{v.name}（{v.key}），顺序 {v.order}；目标日 {show(v.targetDayOffset)}，前窗 {show(v.windowBeforeDays)}，后窗 {show(v.windowAfterDays)}。</li>)}</ul><ul>{c.outcomes.map(o=><li key={o.key}>{o.label}：{o.definition}；单位 {show(o.unit)}。</li>)}</ul><ul>{c.form.schema.fields.map(f=><li key={f.key}>{f.label}（{f.key}，{f.type}），必填 {show(f.required)}；人工最小 {show(f.min)}，最大 {show(f.max)}{f.options?'；选项 '+formatCrfMethodAssetOptions(f.options):''}。</li>)}</ul><ul>{c.mappings.map(m=><li key={m.outcomeKey+':'+m.fieldKey}>{m.outcomeKey} → {m.fieldKey}，访视 {m.visitKeys.join('、')}，单位 {show(m.unit)}。</li>)}</ul><p>缺失状态：{c.missingStates.join('、')}；未配置不当作0或否。</p></details>
  </div></Card>
  <Card title="原历史方法报告（只读证据）"><p>固定报告 v{asset.snapshot.report.versionNo}，不是目标研究的新结果。已有AI内容只复用原消息，不重新推理；原状态：{asset.snapshot.historicalFacts.ai.status}。</p><div className="asset-reading method-reading"><Markdown allowImages={false} headingOffset={2}>{asset.snapshot.report.contentMd.replace(/^#{3,4}(?= )/gm,marks=>marks.slice(2))}</Markdown></div></Card></>}
  <Card title="本人复用说明与候选版本"><form noValidate onSubmit={e=>{e.preventDefault();void mutate(false);}}><label htmlFor="method-asset-notes">方法资产本人复用说明（不改写历史证据）</label><textarea id="method-asset-notes" rows={6} maxLength={6000} value={notes} disabled={blocked} onChange={e=>{setNotes(e.target.value);setFeedback('');}}/><p className="method-limits">最多6000字符，当前 {notes.length}；说明基于候选 v{base.current.version}。每份最多30版，已用 {asset.currentVersion}；派生层数 {asset.lineage.length}/8；本账号候选 {asset.capacity.count}/100。</p><div className="asset-actions"><Button primary type="submit" disabled={blocked||!dirty} loading={busy}>保存方法资产复用说明</Button>{dirty&&<Button disabled={busy} onClick={()=>void choose(null)}>放弃方法资产说明并核对最新</Button>}<span role="status">{dirty?'本人说明尚未保存':'当前说明与已读版本一致'}</span></div></form>
   <div className="asset-actions"><label htmlFor="method-asset-version">方法候选历史版本</label><select id="method-asset-version" value={asset.version} disabled={busy} onChange={e=>void choose(Number(e.target.value))}>{asset.versions.map(v=><option key={v.versionNo} value={v.versionNo}>v{v.versionNo} · {v.changeSummary||'固定报告初始封装'}</option>)}</select><Button disabled={busy||!!health||historyView||dirty||!asset.canDerive} onClick={()=>void mutate(true)}>派生本人新方法候选</Button></div>
   <p>派生只产生本人私有新草稿；新说明为空，父说明按固定版本保留。历史、过期、未保存或达到容量时不能派生；不自动共享、审批、锁库、发布或导出。</p>
  </Card>
  {!invalid&&<Card title="可追溯来源"><details><summary>核对固定来源、血缘与完整性</summary><p className="asset-meta">候选 {asset.id}<br/>根报告 {root.reportId} · v{root.reportVersionNo}<br/>报告正文 {asset.snapshot.report.contentHash}<br/>事实 {asset.snapshot.report.factsHash}<br/>候选快照 {asset.snapshotHash}</p><a href={makeCrfMethodReportUrl(scope,root.planId,root.collectionId,root.runId,root.reportId,root.reportVersionNo)}>核对原方法报告固定版本</a>
   <ul>{recipe.source.materials.map(m=><li key={m.chunkId}>{m.docTitle} · v{m.version}<p className="asset-meta">{m.docId} / {m.chunkId}<br/>{m.contentHash}<br/>{m.chunkHash}</p></li>)}</ul>
   {asset.lineage.map(p=><div key={p.id}><h3>固定父候选 v{p.version}</h3><p className="asset-meta">{p.id}<br/>{p.contentHash}</p><p className="method-parent-notes">父说明（历史）：{p.notes||'当时无说明'}</p></div>)}
   <ul>{asset.sourceRows.map(s=><li key={s.sourceType+':'+s.sourceId} className="asset-meta">{s.sourceType} · {s.sourceId} · {s.sourceVersion??'不可变消息'}<br/>{s.hash}</li>)}</ul>
  </details></Card>}
 </section>;
}
