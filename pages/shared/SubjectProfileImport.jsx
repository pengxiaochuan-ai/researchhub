import React,{useEffect,useRef,useState} from 'react';import {Button} from './Components.jsx';import {assertProfileImport} from '../../src/subject-profile-import-session.js';import {subjectUrl} from '../../src/research-subjects-session.js';
import {profileAutoPreparation} from '../../src/research-data-upload-intent.js';
export function useSubjectProfileImport({client,identity,sessionId,preflight,enabled,uploadIntent}){
 const binding=identity+':'+sessionId+':'+preflight?.id+':'+preflight?.version,context=useRef(binding),generation=useRef(0),busy=useRef(false);context.current=binding;
 const autoAttempt=useRef(null),empty={binding:'',route:null,targets:[],studyId:'',sheetName:'',choice:null,recordBindings:{},item:null,error:'',loading:false,pending:false,checked:false};const [state,set]=useState(empty),markerKey='rh-profile-import:'+binding;
 const token=()=>({binding,g:generation.current}),valid=t=>context.current===t.binding&&generation.current===t.g,put=(t,patch)=>{if(valid(t))set(s=>({...s,...patch,binding:t.binding}));};
 const read=()=>{try{return JSON.parse(sessionStorage.getItem(markerKey)??'null');}catch{return null;}};
 const save=v=>{try{sessionStorage.setItem(markerKey,JSON.stringify(v));}catch{throw Error('无法保存导入进度，请允许站点存储后重试。');}};
 const accept=p=>assertProfileImport(p,{preflightId:preflight.id,preflightVersion:preflight.version});
 async function refresh(){if(!enabled||preflight?.state!=='previewed'||busy.current)return;const t=token();busy.current=true;put(t,{loading:true,error:''});try{
  const probe=await client.get(`/sessions/${sessionId}/profile-import-probes/${preflight.id}`);if(!['profile','legacy'].includes(probe.route))throw Error('文件类型尚未核实，请重新核对。');put(t,{route:probe.route});if(probe.route==='legacy'){put(t,{checked:true});return;}
  const [targets,saved]=await Promise.all([client.get(`/sessions/${sessionId}/profile-import-targets`),client.get(`/sessions/${sessionId}/profile-import-current/${preflight.id}`)]);if(!Array.isArray(targets.items)||targets.items.some(x=>!x.id||typeof x.name!=='string'))throw Error('研究列表尚未核实。');
  let item=saved.item?accept(saved.item):null;const marker=read();if(marker){const r=await client.get(`/sessions/${sessionId}/profile-imports/receipts/${marker.requestKey}`);if(r.found){item=accept(r.item);if(item.requestKey!==marker.requestKey)throw Error('返回结果与原操作不一致。');sessionStorage.removeItem(markerKey);}else if(marker.phase==='confirming')throw Error('确认结果尚未查到，请继续核对原操作。');}
  if(item&&uploadIntent&&item.study.id!==uploadIntent.studyId)throw Error('原导入归属与本次上传选择不一致，请核对原操作。');
  put(t,{targets:targets.items,item,studyId:item?.study.id??marker?.studyId??uploadIntent?.studyId??(targets.items.length===1?targets.items[0].id:''),pending:Boolean(marker&&!item),checked:true,...(marker&&!item?{error:'尚未查到本次检查结果，请先核对状态；重试时沿用原操作。'}:{})});
 }catch(e){put(t,{error:e.message,item:null,targets:[],choice:null,recordBindings:{},checked:false});}finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}}
 useEffect(()=>{generation.current++;busy.current=false;set({...empty,binding});if(enabled&&preflight?.state==='previewed')void refresh();return()=>{generation.current++;};},[client,identity,sessionId,preflight?.id,preflight?.version,preflight?.state,enabled]);
 async function prepare({studyId=state.studyId,sheetName=state.sheetName}={}){if(busy.current||!studyId||state.item)return;const t=token();busy.current=true;put(t,{loading:true,error:''});try{
  let marker=read();if(marker&&marker.studyId!==studyId)throw Error('先核对原研究中的导入状态，再更换研究。');if(uploadIntent&&uploadIntent.studyId!==studyId)throw Error('请沿用本次上传选择的研究。');marker??={requestKey:'profile-'+crypto.randomUUID(),preflightId:preflight.id,studyId};
  const recordBindings=state.choice?.kind==='mapping_required'?state.choice.records.map(r=>({recordNumber:r.recordNumber,subjectCode:(state.recordBindings[r.recordNumber]??r.sourceSubjectCode??'').trim()})):undefined;
  marker={...marker,...(sheetName?{sheetName}:{}),...(recordBindings?{recordBindings}:{}),phase:'preparing'};save(marker);put(t,{pending:true});const {phase,...body}=marker;
  const result=await client.post(`/sessions/${sessionId}/profile-imports`,body);if(!valid(t))return;
  if(['sheet_required','mapping_required'].includes(result?.kind)){sessionStorage.removeItem(markerKey);put(t,{choice:result,sheetName:result.sheetName??'',pending:false,checked:true,studyId});}
  else{const item=accept(result);sessionStorage.removeItem(markerKey);put(t,{item,choice:null,pending:false,checked:true});}
 }catch(e){if([400,403,409,413].includes(e.status)&&!e.unknown){sessionStorage.removeItem(markerKey);put(t,{pending:false});}put(t,{error:e.message,item:null,...([401,403,404].includes(e.status)?{targets:[],choice:null,recordBindings:{},checked:false}:{})});}finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}}
 useEffect(()=>{if(state.binding!==binding||!enabled)return;const studyId=profileAutoPreparation({...state,intent:uploadIntent}),key=binding+':'+studyId;if(studyId&&autoAttempt.current!==key){autoAttempt.current=key;void prepare({studyId});}},[enabled,binding,uploadIntent,state.binding,state.route,state.checked,state.loading,state.pending,state.item,state.choice,state.error]);
 useEffect(()=>{if(state.binding===binding&&uploadIntent&&state.item&&state.item.study.id!==uploadIntent.studyId)set(s=>({...s,item:null,targets:[],choice:null,recordBindings:{},checked:false,error:'原导入与本次上传归属不一致，请核对状态。'}));},[binding,state.binding,state.item,uploadIntent?.studyId]);
 async function confirm(){if(busy.current||state.pending||state.item?.state!=='planned')return;if(uploadIntent&&state.item.study.id!==uploadIntent.studyId){set(s=>({...s,item:null,error:'原导入与本次上传归属不一致，请核对状态。',checked:false}));return;}const t=token(),item=state.item;busy.current=true;put(t,{loading:true,error:'',pending:true});try{save({requestKey:item.requestKey,studyId:item.study.id,preflightId:preflight.id,phase:'confirming'});const result=accept(await client.post(`/sessions/${sessionId}/profile-imports/${item.id}/confirmations`,{version:item.version,hash:item.hash}));if(result.state!=='committed'||result.id!==item.id)throw Error('导入结果尚未确认，请核对原操作。');if(valid(t)){sessionStorage.removeItem(markerKey);put(t,{item:result,pending:false});}}catch(e){put(t,{error:e.message,checked:false,item:null,targets:[],choice:null,recordBindings:{}});}finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}}
 async function cancel(){if(state.loading||state.pending||!state.checked)throw Error('请先核对当前导入结果。');if(state.item?.state!=='planned')return;const t=token();const r=await client.post(`/sessions/${sessionId}/profile-imports/${state.item.id}/cancellation`,{version:state.item.version});if(r.state!=='cancelled')throw Error('取消结果尚未核实。');put(t,{item:null});}
 const active=state.binding===binding&&enabled,s=active?state:empty;return{...s,uploadBound:Boolean(uploadIntent),canRetryPreparation:active&&s.checked&&s.pending&&!s.item&&read()?.phase==='preparing',refresh,prepare,confirm,cancel,select:studyId=>{set(x=>({...x,studyId,error:''}));if(studyId)void prepare({studyId});},sheet:sheetName=>{set(x=>({...x,sheetName}));if(sheetName)void prepare({sheetName});},map:(n,subjectCode)=>set(x=>({...x,recordBindings:{...x.recordBindings,[n]:subjectCode}})),canChangeSource:active&&s.checked&&!s.pending&&!s.loading,canCancelSource:active&&s.checked&&!s.pending&&!s.loading&&s.item?.state!=='committed'};
}
export default function SubjectProfileImport({data}){
 if(data.route!=='profile')return null;const item=data.item,done=item?.state==='committed';
 return <div className="research-data-import" aria-label="被试档案导入" aria-busy={data.loading}>
  <h4>{done?'被试档案已导入':'确认被试档案'}</h4>
  {data.error&&<p role="alert">{data.error} <Button disabled={data.loading} onClick={data.refresh}>核对状态</Button></p>}
  {data.canRetryPreparation&&<Button disabled={data.loading} onClick={()=>data.prepare()}>重试原检查</Button>}
  {data.loading&&<p role="status">正在检查档案与被试对应…</p>}
  {data.pending&&<p role="status">正在核对原操作结果，请不要重复上传或提交。</p>}
  {!item&&!data.loading&&!data.targets.length&&<p>当前没有可导入的研究。请联系研究负责人核对上传权限。</p>}
  {!item&&data.targets.length>0&&<>
   {data.uploadBound?<p>归属研究：{data.targets.find(t=>t.id===data.studyId)?.name??'本次上传选择的研究'}</p>:<label>归属研究 <select value={data.studyId} disabled={data.loading||data.pending} onChange={e=>data.select(e.target.value)}><option value="">请选择研究</option>{data.targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
   {data.choice?.kind==='sheet_required'&&<label>档案工作表 <select value={data.sheetName} onChange={e=>data.sheet(e.target.value)}><option value="">请选择工作表</option>{data.choice.sheetNames.map(s=><option key={s}>{s}</option>)}</select></label>}
   {data.choice?.kind==='mapping_required'&&<div><p>请将每条记录对应到已有的假名被试编号，不填写姓名。</p>{data.choice.records.map(r=><label key={r.recordNumber}>第{r.recordNumber}条记录 <input value={data.recordBindings[r.recordNumber]??r.sourceSubjectCode??''} maxLength={64} onChange={e=>data.map(r.recordNumber,e.target.value)}/></label>)}</div>}
   {data.choice?.kind==='mapping_required'?<Button disabled={data.loading||data.pending||!data.studyId} onClick={()=>data.prepare()}>应用对应</Button>:!data.uploadBound&&!data.choice&&<Button disabled={data.loading||data.pending||!data.studyId} onClick={()=>data.prepare()}>继续检查</Button>}
  </>}
  {item&&<><p>{done?`已更新${item.rows.length}份被试档案`:`将更新${item.rows.length}份已有被试档案`} · {data.targets.find(t=>t.id===item.study.id)?.name??'所选研究'} · {item.sheetName}</p>
   {item.qualityWarnings?.length>0&&<ul>{item.qualityWarnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
   <div className="research-data-table"><table><caption>{done?'本次导入内容':'请核对以下字段；未提供的字段保持原值'}</caption><thead><tr><th scope="col">被试编号</th><th scope="col">档案字段</th><th scope="col">值</th></tr></thead><tbody>{item.rows.flatMap(r=>Object.entries(r.values).map(([k,v])=><tr key={r.subjectCode+':'+k}><th scope="row">{done?<a href={subjectUrl('s04',item.study.id,item.receipt.subjects.find(s=>s.subjectCode===r.subjectCode).id)}>{r.subjectCode}</a>:r.subjectCode}</th><td>{item.fields[k]}</td><td>{typeof v==='boolean'?v?'是':'否':String(v)}</td></tr>))}</tbody></table></div>
   {item.rows.some(r=>r.changedAfterImport)&&<p role="status">部分档案在本次导入后已有更改，此处保留本次导入值，请到被试档案查看当前内容。</p>}
   {item.targetChanged&&<p role="alert">被试档案或研究状态已有变化，不能覆盖。请取消本次预检后重新核对。</p>}
   {done?<p><a href={subjectUrl('s03',item.study.id)}>查看被试档案</a> · 档案AI分析暂不可用，可先查看导入内容。</p>:item.state==='planned'&&<Button variant="primary" disabled={data.loading||data.pending||!data.checked||item.targetChanged} onClick={data.confirm}>确认导入</Button>}
  </>}
 </div>;
}
