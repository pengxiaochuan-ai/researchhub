import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Card,Button} from './Components.jsx';
import {validateSyntheticEdits,syntheticRunUrl,reconcileSyntheticPlan} from '../../src/synthetic-quality-form.js';
import './synthetic-quality.css';
import SyntheticReportPanel from './SyntheticReportPanel.jsx';

const states={queued:'已入队',validating:'正在校验输入',running:"质控执行中",needs_review:'机器质控已执行 · 未审批',failed:'本次未交付',interrupted:'执行已中断 · 不自动重放',restricted:'访问已失效'};
export default function SyntheticQualityPanel({plan,client,parentDirty,parentBusy,onActivity}){
 const path=`/research-plan-drafts/${plan.id}/synthetic-trials`,alive=useRef(true),sequence=useRef(0),selected=useRef(''),keys=useRef(new Map()),fields=useRef({}),errorBox=useRef(null),planVersion=useRef(plan.version);
 const[seed,setSeed]=useState('42'),[run,setRun]=useState(null),[list,setList]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[cells,setCells]=useState({}),[reason,setReason]=useState(''),[errors,setErrors]=useState({});
 const[reportActivity,setReportActivity]=useState({dirty:false,busy:false}),onReportActivity=useCallback(value=>setReportActivity(old=>old.dirty===value.dirty&&old.busy===value.busy?old:value),[]);
 const dirty=!!Object.keys(cells).length||!!reason.trim(),running=run&&['queued','validating','running'].includes(run.status),historical=!!run&&run.latestRunId!==run.id,unavailable=plan.sourceStatus!=='current'||plan.stage!=='protocol_draft'||run?.sourceStatus==='stale'||run?.status==='restricted',blocked=!!busy||running||parentDirty||parentBusy||unavailable||historical||reportActivity.dirty||reportActivity.busy;
 useEffect(()=>{onActivity?.({dirty:dirty||reportActivity.dirty,busy:!!busy||reportActivity.busy});return()=>onActivity?.({dirty:false,busy:false});},[dirty,busy,reportActivity,onActivity]);
 useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
 async function listRuns(before){const data=await client.get(path+'?limit=10'+(before?'&before='+before:''));if(alive.current)setList(previous=>({...data,items:before?[...(previous?.items??[]),...data.items]:data.items}));return data;}
 async function loadRun(id,fromQuery=false){const seq=++sequence.current;selected.current=id;try{const data=await client.get(path+'/'+id);if(alive.current&&seq===sequence.current){if(fromQuery&&data.plan?.version!==plan.version){history.replaceState(null,'',reconcileSyntheticPlan(location.href,data.plan?.version,plan.version).href);selected.current='';setRun(null);setError('链接中的试跑绑定旧方案版本，已清除当前试跑与报告选择；旧结果仅可从本人历史显式核对，不自动重绑。');return;}setRun(data);}}catch(e){if(alive.current&&seq===sequence.current)setError(e.message);}}
 useEffect(()=>{alive.current=true;(async()=>{try{const data=await listRuns(),requested=new URLSearchParams(location.search).get('syntheticRunId'),id=requested||data.items[0]?.id;if(id){if(!/^[A-Za-z0-9_-]{1,160}$/.test(id))throw Error('合成试运行链接无效，请重新选择记录');await loadRun(id,Boolean(requested));}}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}})();return()=>{alive.current=false;sequence.current++;};},[path,client]);
 useEffect(()=>{const next=reconcileSyntheticPlan(location.href,planVersion.current,plan.version);planVersion.current=plan.version;if(!next.changed)return;sequence.current++;selected.current='';history.replaceState(null,'',next.href);setRun(null);setCells({});setReason('');setErrors({});setReportActivity({dirty:false,busy:false});setError('方案已保存新版本，已清除旧试跑与报告的当前选择；需本人显式建立新试跑，旧结果未修改。');},[plan.version]);
 useEffect(()=>{if(!run?.id)return;const timer=setInterval(()=>void loadRun(selected.current),running?1000:5000);return()=>clearInterval(timer);},[path,run?.id,running]);
 function choose(id){if(reportActivity.busy)return;if((dirty||reportActivity.dirty)&&!window.confirm('放弃当前未保存的合成或报告修改，查看所选版本？'))return;setCells({});setReason('');setErrors({});setError('');setFeedback('');history.replaceState(null,'',syntheticRunUrl(location.href,id));void loadRun(id);}
 async function submit(target,payload){
  setBusy(target===path?'create':'revision');setError('');setFeedback('');const identity=JSON.stringify([target,payload]);if(!keys.current.has(identity))keys.current.set(identity,'sim-'+crypto.randomUUID());sequence.current++;
  try{const data=await client.post(target,{...payload,requestKey:keys.current.get(identity)});if(!alive.current)return;sequence.current++;selected.current=data.id;setRun(data);setCells({});setReason('');setErrors({});history.replaceState(null,'',syntheticRunUrl(location.href,data.id));setFeedback(`合成v${data.revision}已保存，等待实际质控；不会自动修复或审批。`);await listRuns();}
  catch(e){if(alive.current){setError(e.message+' 当前输入保留；请刷新核对，不自动重发。');errorBox.current?.focus();}}
  finally{if(alive.current)setBusy('');}
 }
 function create(){const number=Number(seed);if(!/^\d+$/.test(seed)||!Number.isInteger(number)||number<1||number>999999){setErrors({seed:"请输入1–999999的整数随机种子。"});fields.current.seed?.focus();return;}if(dirty||parentDirty||reportActivity.dirty||reportActivity.busy){setError('请先保存或放弃未保存的合成及报告修改，再建立新的试跑。');return;}void submit(path,{baseVersionNo:plan.version,seed:number});}
 function revise(event){event.preventDefault();const form=validateSyntheticEdits(run.dataset,cells,reason,['failed','interrupted'].includes(run.status));setErrors(form.errors);if(!form.valid){fields.current[form.firstInvalid]?.focus();return;}void submit(path+'/'+run.id+'/revisions',{reason:form.reason,edits:form.edits});}
 function change(table,row,field,text){const key=[table,row.id,field].join(':');setCells(previous=>{const next={...previous};if(text===String(row[field]??''))delete next[key];else next[key]=text;return next;});setFeedback('');}
 const cellId=(table,rowId,field)=>'synth-'+[table,rowId,field].join('-');
 function locate(cell){const field=document.getElementById(cellId(cell.table,cell.rowId,cell.field));if(!field)return;for(let ancestor=field.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;field.scrollIntoView({block:'center',inline:'nearest'});field.focus({preventScroll:true});}
 function control(table,row,field,label){const key=[table,row.id,field].join(':'),value=cells[key]??String(row[field]??''),props={id:cellId(table,row.id,field),ref:e=>{fields.current[key]=e;},'aria-label':label,'aria-invalid':!!errors[key],'aria-describedby':errors[key]?cellId(table,row.id,field)+'-error':undefined,disabled:blocked,value,onChange:e=>change(table,row,field,e.target.value)};
  return <><label className="synth-cell-label" htmlFor={props.id}>{label}</label>{field==='group'?<select {...props}><option value="A">A（模拟）</option><option value="B">B（模拟）</option></select>:<input {...props} type="text" inputMode={field==='age'?'numeric':undefined} placeholder={field==='age'?'缺失（不是0）':'完整ISO时间'}/>} {errors[key]&&<p id={props.id+'-error'} className="q01-field-error">{errors[key]}</p>}</>;
 }
 return <Card title="合成试运行与质控" className="form-block synthetic-quality">
  <p className="plan-reading">基于已保存方案生成合成数据并运行质控，仅供演练，不用于临床结论。不是临床受试者、正式访视或已授权量表；不调用LLM生成数字，不自动补值。</p>
  {loading&&<p role="status">正在读取本人派生试跑…</p>}
  {error&&<p role="alert" tabIndex={-1} ref={errorBox} className="q01-error-summary">{error}</p>}
  {feedback&&<p role="status" className="q01-save-state">{feedback}</p>}
  {(parentDirty||parentBusy)&&<p role="status">方案有未保存修改或请求进行中，请先完成方案操作。</p>}
  {(reportActivity.dirty||reportActivity.busy)&&<p role="status">报告说明尚未保存或正在提交，请先完成报告操作，再变更合成数据。</p>}
  {unavailable&&<p role="status">请先保存来源有效的方案；方案或资料改变后旧试跑仅供核对，不能自动重绑。</p>}
  <div className="plan-actions"><label htmlFor="synthetic-seed">随机种子（复现用）</label><input id="synthetic-seed" ref={e=>{fields.current.seed=e;}} type="text" inputMode="numeric" value={seed} onChange={e=>setSeed(e.target.value)} disabled={!!busy||running} aria-invalid={!!errors.seed} aria-describedby={errors.seed?'synthetic-seed-error':undefined}/><Button primary={!run} disabled={!!busy||running||parentDirty||parentBusy||plan.sourceStatus!=='current'||plan.stage!=='protocol_draft'||dirty||reportActivity.dirty||reportActivity.busy} loading={busy==='create'} onClick={create}>生成合成数据并运行质控</Button><Button disabled={!!busy} onClick={()=>{void listRuns().catch(e=>setError(e.message));if(selected.current)void loadRun(selected.current);}}>刷新试跑</Button></div>
  {errors.seed&&<p id="synthetic-seed-error" className="q01-field-error">{errors.seed}</p>}
  <p className="plan-reading">使用8个合成编号、两个模拟时点；0–120仅为模拟年龄的校验范围，不是研究纳排标准，模拟时点也不代表临床访视安排。</p>
  {!!list?.items.length&&<details><summary>本人本方案的试跑与修订</summary><div className="synth-history">{list.items.map(item=><Button key={item.id} disabled={!!busy} onClick={()=>choose(item.id)}>合成v{item.revision} · {item.id} · {states[item.status]||item.status}</Button>)}</div>{list.nextCursor&&<Button onClick={()=>void listRuns(list.nextCursor).catch(e=>setError(e.message))}>加载更多本人试跑</Button>}</details>}
  {run?.status==='restricted'?<p role="alert">{run.message}</p>:run?.dataset&&<>
   <p role="status">合成v{run.revision} · {states[run.status]||run.status} · 方案v{run.plan.version} · seed {run.dataset.seed}</p>
   {run.error&&<p role="alert" className="q01-error-summary">{run.error.code}：{run.error.message}</p>}
   {historical&&<p>当前查看历史版本，未覆盖旧数据。<Button onClick={()=>choose(run.latestRunId)}>继续最新合成版本</Button></p>}
   {run.sourceStatus==='stale'&&<p role="alert">绑定的方案或来源已过期，请返回方案核对并建立新试跑；旧结果不代表当前方案。</p>}
   {run.summary&&<p className="plan-reading">{run.summary} 此处不提供审批或锁库。</p>}
   <section aria-label="实际质控问题"><h3>问题清单与定位</h3>{!run.findings.length?<p>{running?"正在等待质控结果。":'当前未检出问题或本次未交付；请核对运行状态，不等于正式放行。'}</p>:<ol>{run.findings.map((finding,i)=><li key={finding.code+'-'+i}><strong>{finding.severity==='blocking'?'阻断':'提示'} · {finding.code}</strong><p>{finding.message}</p><div className="plan-actions">{finding.cells.map(c=><button key={[c.table,c.rowId,c.field].join(':')} type="button" onClick={()=>locate(c)}>定位 {c.rowId} · {c.field}</button>)}</div></li>)}</ol>}</section>
   <form onSubmit={revise} noValidate>
    <h3>合成数据 · 人工修改形成新版本</h3><p>缺失留空而不是0；仅可修改当前可编辑字段。修改原因必填，保存后追加快照并重新执行，不改写原数据。</p>
    <details open><summary>模拟受试者字段（8个编号）</summary><div className="synth-table" tabIndex={0} aria-label="模拟受试者表，可横向滚动"><table><thead><tr><th>合成编号</th><th>模拟年龄</th><th>模拟分组</th></tr></thead><tbody>{run.dataset.subjects.map(row=><tr key={row.id}><th scope="row">{row.id}</th><td>{control('subjects',row,'age','合成年龄 '+row.id)}</td><td>{control('subjects',row,'group','合成分组 '+row.id)}</td></tr>)}</tbody></table></div></details>
    <details><summary>模拟访视时间（不是临床访视表）</summary><div className="synth-table" tabIndex={0} aria-label="模拟访视表，可横向滚动"><table><thead><tr><th>记录</th><th>合成编号</th><th>完成时间（UTC）</th></tr></thead><tbody>{run.dataset.visits.map(row=><tr key={row.id}><th scope="row">{row.id}</th><td>{row.subjectId}</td><td>{control('visits',row,'completedAt','模拟完成时间 '+row.id)}</td></tr>)}</tbody></table></div></details>
    <details><summary>测试测量记录（非临床量表，不计算得分）</summary><div className="synth-table" tabIndex={0} aria-label="测试测量表，可横向滚动"><table><thead><tr><th>记录</th><th>合成编号</th><th>采集时间（UTC）</th></tr></thead><tbody>{run.dataset.measurements.map(row=><tr key={row.id}><th scope="row">{row.id}</th><td>{row.subjectId}</td><td>{control('measurements',row,'collectedAt','测试采集时间 '+row.id)}</td></tr>)}</tbody></table></div></details>
    <label htmlFor="synthetic-reason">人工修改／显式重试原因（必填，8–500字）</label><textarea id="synthetic-reason" ref={e=>{fields.current.reason=e;}} value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={500} disabled={blocked} aria-required="true" aria-invalid={!!errors.reason} aria-describedby={errors.reason?'synthetic-reason-error':undefined}/>{errors.reason&&<p id="synthetic-reason-error" className="q01-field-error">{errors.reason}</p>}
    <div className="plan-actions"><Button primary type="submit" disabled={blocked} loading={busy==='revision'}>{['failed','interrupted'].includes(run.status)?'保存新版本并显式重跑':'保存合成修订并复跑'}</Button>{dirty&&<Button disabled={!!busy} onClick={()=>{if(window.confirm('放弃当前尚未保存的合成修改？')){setCells({});setReason('');setErrors({});}}}>放弃合成修改</Button>}<span>{dirty?'当前合成修改尚未保存':"合成版本已保存"}</span></div>
   </form>
   <details><summary>数值来源、绑定及修订记录</summary><p className="plan-meta">数据SHA256：{run.datasetHash}<br/>Manifest SHA256：{run.manifestHash||'尚未产生'}<br/>执行器：{run.operatorVersion} · 原运行：{run.id}<br/>人工原因：{run.reason}</p><ul>{run.changes?.map((c,i)=><li key={i}>{c.rowId} · {c.field}：{String(c.before??'缺失')} → {String(c.after??'缺失')}</li>)}</ul><div className="synth-table" tabIndex={0} aria-label="确定性数值来源，可横向滚动"><table><thead><tr><th>数值项</th><th>实际值</th><th>算子／版本</th></tr></thead><tbody>{run.numericEvidence.map((n,i)=><tr key={i}><td>{n.name}</td><td>{String(n.value)}</td><td>{n.operator}／{n.operatorVersion}</td></tr>)}</tbody></table></div></details>
   <SyntheticReportPanel key={run.id} planId={plan.id} run={run} client={client} inputBlocked={parentDirty||parentBusy||dirty||!!busy||running} onActivity={onReportActivity}/>
  </>}
 </Card>;
}
