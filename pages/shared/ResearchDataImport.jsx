import React,{useEffect,useRef,useState} from 'react';import {Button} from './Components.jsx';import {assertResearchDataImport,assertResearchDataMapping,researchDataMappingSelection,researchDataColumnKey} from '../../src/research-data-import-session.js';import {subjectUrl} from '../../src/research-subjects-session.js';import {captureUrl} from '../../src/formal-capture-session.js';
import {researchDataMappingDescription} from '../../src/research-data-session.js';
export function useResearchDataImports({client,identity,sessionId,preflight,enabled,preferredStudyId}){
 const alive=useRef(true),context=useRef(''),busy=useRef(false),epoch=useRef(0);
 const binding=identity+':'+sessionId+':'+(preflight?.id??'')+':'+(preflight?.version??'');context.current=binding;
 const empty=()=>({binding:'',item:null,choice:null,choices:{},mappingStale:false,targets:[],error:'',loading:false,pending:false,studyId:'',unavailable:false,checked:false,retryable:false});
 const [state,setState]=useState(empty);
 const valid=token=>alive.current&&context.current===token.binding&&epoch.current===token.epoch;
 const token=()=>({binding,epoch:epoch.current});
 const put=(t,patch)=>{if(valid(t))setState(old=>({...old,...patch,binding}));};
 const markerKey='rh-data-import:'+identity+':'+sessionId+':'+preflight?.id;
 const readMarker=()=>{try{const v=JSON.parse(sessionStorage.getItem(markerKey)??'null');return v&&v.preflightId===preflight?.id&&v.preflightVersion===preflight.version&&typeof v.requestKey==='string'?v:null;}catch{return null;}};
 const saveMarker=value=>{try{sessionStorage.setItem(markerKey,JSON.stringify(value));}catch{throw Error('无法保存本次导入进度，请允许站点存储后重试。');}};
 const accept=(p,studyId)=>{const item=assertResearchDataImport(p,{preflightId:preflight.id,studyId});if(item.preflight.version!==preflight.version)throw Error('来源预检版本已变化，请核对当前结果。');return item;};
 const remember=item=>saveMarker({requestKey:item.requestKey,studyId:item.study.id,preflightId:preflight.id,preflightVersion:preflight.version,phase:item.state==='committed'?'committed':'prepared'});
 const original=async(t,marker,studyId)=>{
  const r=await client.get(`/sessions/${sessionId}/research-data-imports/receipts/${marker.requestKey}`);if(!valid(t))return;
  if(r.found){const item=accept(r.item,studyId);if(item.requestKey!==marker.requestKey)throw Error('返回结果不对应原操作，请继续核对。');remember(item);put(t,{item,choice:null,checked:true,pending:false,retryable:false,error:''});}
  else put(t,{item:null,choice:marker.draft??null,choices:marker.choices??{},checked:true,pending:false,retryable:true,error:'尚未查到本次核对结果，可重试同一次核对。'});
 };
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 async function prepare(t,studyId,{retry=false,selection}={}){
  if(!valid(t)||!studyId)return;let marker=readMarker();
  if(marker&&marker.studyId!==studyId)marker=null;
  if(marker&&!retry&&!selection){await original(t,marker,studyId);return;}
  marker=marker??{requestKey:'data-import-'+crypto.randomUUID(),studyId,preflightId:preflight.id,preflightVersion:preflight.version};
  if(selection)marker={...marker,mapping:researchDataMappingSelection(selection.choice,selection.choices),mappingHash:selection.choice.mapping.hash,draft:selection.choice,choices:selection.choices};
  saveMarker({...marker,phase:'preparing'});put(t,{pending:true,checked:false,retryable:false});
  let value;try{value=await client.post(`/sessions/${sessionId}/research-data-imports`,{requestKey:marker.requestKey,studyId,preflightId:preflight.id,preflightVersion:preflight.version,...(marker.mapping?{mapping:marker.mapping,mappingHash:marker.mappingHash}:{})});}
  catch(e){if(valid(t)&&[400,409,413].includes(e.status)&&!e.unknown){
   if(marker.draft&&['DATA_IMPORT_UNIT_REQUIRED','DATA_IMPORT_INVALID_ROWS','DATA_IMPORT_MAPPING_REQUIRED'].includes(e.code)){saveMarker({...marker,phase:'mapping',mapping:undefined,mappingHash:undefined});}
   else sessionStorage.removeItem(markerKey);
   put(t,{item:null,error:e.message,pending:false,checked:true,retryable:false,mappingStale:e.code==='DATA_IMPORT_MAPPING_CHANGED'});return;
  }throw e;}
  if(!valid(t))return;
  if(value?.state==='mapping_required'){
   const choice=assertResearchDataMapping(value,{preflightId:preflight.id,version:preflight.version,studyId});if(choice.requestKey!==marker.requestKey)throw Error('字段对应不属于本次操作。');
   const choices=marker.draft?.mapping.hash===choice.mapping.hash?marker.choices??{}:{};saveMarker({...marker,phase:'mapping',draft:choice,choices});put(t,{item:null,choice,choices,mappingStale:false,pending:false,checked:true,retryable:false,error:''});return;
  }
  const item=accept(value,studyId);if(item.requestKey!==marker.requestKey)throw Error('导入核对结果不对应本次操作，请重新获取。');remember(item);put(t,{item,choice:null,pending:false,checked:true,retryable:false,error:''});
 }
 async function refresh({autoPrepare=false,studyId}={}){
  if(!enabled||!sessionId||preflight?.state!=='previewed'||busy.current)return;const t=token();busy.current=true;put(t,{loading:true,error:'',checked:false,retryable:false});
  try{
   const [available,current]=await Promise.all([client.get(`/sessions/${sessionId}/research-data-import-targets`),client.get(`/sessions/${sessionId}/research-data-imports`)]);if(!valid(t))return;
   if(!Array.isArray(available.items)||available.items.some(x=>typeof x.id!=='string'||typeof x.name!=='string'))throw Error('关联研究无法核对，请重新获取。');
   const targets=available.items,selected=studyId??preferredStudyId??(targets.length===1?targets[0].id:state.studyId);put(t,{targets,studyId:selected??'',unavailable:false});
   if(preferredStudyId&&(!targets.some(s=>s.id===preferredStudyId)||current.item?.preflight?.id===preflight.id&&current.item.study.id!==preferredStudyId))throw Error('本次上传选择的研究当前不能接收这类表单，请核对研究与表单权限；文件已保留。');
   const marker=readMarker(),matches=marker&&(!selected||marker.studyId===selected);
   // An unknown write is resolved by its original key before any newer item.
   if(matches&&['preparing','confirming'].includes(marker.phase)){await original(t,marker,selected);return;}
   if(current.item?.preflight?.id===preflight.id&&(!selected||current.item.study.id===selected)){const item=accept(current.item,selected);put(t,{item,choice:null,pending:false,checked:true,retryable:false});return;}
   put(t,{item:null,choice:null,choices:{},checked:true,pending:false});if(!selected||!targets.some(s=>s.id===selected))return;
   if(matches&&marker.phase==='mapping'&&marker.draft){const choice=assertResearchDataMapping(marker.draft,{preflightId:preflight.id,version:preflight.version,studyId:selected});put(t,{choice,choices:marker.choices??{}});return;}
   if(matches){await original(t,marker,selected);return;}
   if(autoPrepare)await prepare(t,selected);
   // A user status check is GET only; it never creates another plan.
  }catch(e){if(valid(t)){put(t,{error:e.status===404?'导入暂不可用，请稍后再核对。':e.message,item:null,choice:null,pending:Boolean(readMarker()),checked:false,retryable:false,unavailable:[401,403,404].includes(e.status)});}}
  finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}
 }
 useEffect(()=>{epoch.current++;busy.current=false;setState({...empty(),binding});if(enabled&&preflight?.state==='previewed')void refresh({autoPrepare:true});},[client,identity,sessionId,preflight?.id,preflight?.version,preflight?.state,enabled,preferredStudyId]);
 async function confirm(){
  if(busy.current||state.binding!==binding||!state.checked||state.pending||state.item?.state!=='planned')return;const t=token(),item=state.item;busy.current=true;put(t,{loading:true,error:'',checked:false});
  try{saveMarker({requestKey:item.requestKey,studyId:item.study.id,preflightId:preflight.id,preflightVersion:preflight.version,phase:'confirming'});put(t,{pending:true});
   const value=await client.post(`/sessions/${sessionId}/research-data-imports/${item.id}/confirmations`,{version:item.version,hash:item.hash});if(!valid(t))return;const accepted=accept(value,item.study.id);if(accepted.id!==item.id||accepted.requestKey!==item.requestKey||accepted.state!=='committed')throw Error('尚未确认本次导入结果，请核对状态。');remember(accepted);put(t,{item:accepted,pending:false,checked:true});
  }catch(e){if(valid(t)){if([401,403,404].includes(e.status))put(t,{item:null,unavailable:true});put(t,{error:e.message,pending:true,checked:false});}}
  finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}
 }
 async function retry(){if(busy.current||!state.retryable)return;const t=token();busy.current=true;put(t,{loading:true,error:''});try{await prepare(t,state.studyId,{retry:true});}catch(e){put(t,{error:e.message,item:null,pending:true,checked:false,retryable:false});}finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}}
 function choose(column,value){if(busy.current||!state.choice||state.pending||state.retryable)return;const choices={...state.choices,[researchDataColumnKey(column)]:value};try{const marker=readMarker();if(marker)saveMarker({...marker,phase:'mapping',draft:state.choice,choices});setState(s=>({...s,choices,error:''}));}catch(e){setState(s=>({...s,error:e.message}));}}
 async function mapFields(){if(busy.current||!state.choice||state.pending||state.retryable||state.mappingStale)return;const t=token();busy.current=true;put(t,{loading:true,error:''});try{await prepare(t,state.studyId,{selection:{choice:state.choice,choices:state.choices}});}catch(e){put(t,{error:e.message,pending:Boolean(readMarker()?.phase==='preparing'),checked:![401,403,404].includes(e.status),...([401,403,404].includes(e.status)?{choice:null,item:null,unavailable:true}:{})});}finally{if(valid(t)){busy.current=false;put(t,{loading:false});}}}
 async function cancel(){if(state.binding!==binding||!state.checked||state.loading||state.pending)throw Error('请先核对当前导入状态。');if(state.item?.state!=='planned')return;const t=token();const value=await client.post(`/sessions/${sessionId}/research-data-imports/${state.item.id}/cancellation`,{version:state.item.version});if(valid(t))put(t,{item:accept(value,state.item.study.id),pending:false,checked:true});}
 const active=state.binding===binding&&enabled;
 const canChangeSource=Boolean(enabled&&(preflight?.state!=='previewed'||active&&state.checked&&!state.loading&&!state.pending));
 return{...(active?state:empty()),boundStudyId:preferredStudyId,canChangeSource,canCancelSource:canChangeSource&&state.item?.state!=='committed',confirm,refresh,retry,cancel,choose,mapFields,recheckFields:()=>refresh({autoPrepare:true}),select:studyId=>refresh({autoPrepare:true,studyId})};
}
export default function ResearchDataImport({data}){
 if(!data)return <p>尚未导入被试库。</p>;
 const item=data.item,receipt=item?.receipt;
 if(receipt)return <div className="research-data-import" role="status"><p>已导入{receipt.subjects.length}名被试{receipt.visits.length?`、${receipt.visits.length}条访视表单`:''} · {item.study.name}{item.study.protocolVersion?` · 方案v${item.study.protocolVersion}`:''}</p><p><a href={subjectUrl('s03',item.study.id)}>查看本次被试</a>{receipt.visits.map(v=><React.Fragment key={v.id}> · <a href={captureUrl('s09',item.study.id,{visitId:v.id,assignmentId:v.assignmentId,responseId:v.ref.responseId,revisionNo:v.ref.revisionNo,contentHash:v.ref.contentHash})}>{receipt.subjects.find(s=>s.id===v.subjectId)?.subjectCode??'本次被试'} · {v.visitCode}</a></React.Fragment>)}</p></div>;
 return <div className="research-data-import" aria-busy={data.loading}>
  {data.targets.length>1&&!data.boundStudyId&&<label>关联研究 <select value={data.studyId} disabled={data.loading} onChange={e=>data.select(e.target.value)}><option value="">请选择研究</option>{data.targets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {data.choice&&<fieldset className="research-data-mapping" disabled={data.loading||data.pending||data.retryable||data.mappingStale}><legend>核对字段对应 · {data.choice.study.name}</legend><p>请选择不确定列对应的表单字段，原文件无需重传。</p>{data.choice.mapping.columns.map(c=><label key={researchDataColumnKey(c)}><span>{c.sheet} · 第{c.column}列 · {c.name}</span><select aria-label={c.sheet+'第'+c.column+'列“'+c.name+'”对应字段'} value={data.choices[researchDataColumnKey(c)]??''} onChange={e=>data.choose(c,e.target.value)}><option value="">不导入此列</option>{c.targetKeys.map(key=>{const f=data.choice.mapping.fields.find(f=>f.key===key);return <option key={key} value={key}>{f?.label??key}{data.choice.mapping.fields.filter(x=>x.label===f?.label).length>1?' · '+key:''}{f?.unit?'（'+f.unit+'）':''}{f?.required?' · 必填':''}</option>;})}</select></label>)}<Button primary onClick={data.mapFields}>核对字段</Button></fieldset>}
  {item?.state==='planned'?<><p>关联研究：{item.study.name}{item.study.protocolVersion?` · 方案v${item.study.protocolVersion}`:''}</p><p>本次将导入{item.summary.subjects}名被试{item.summary.visits?`、${item.summary.visits}条访视表单（${item.summary.fields.join('、')}）`:'档案，不自动入组'}。</p>{item.summary.unmapped.length>0&&<p>其余{item.summary.unmapped.length}列保留在原件，本次不写入。</p>}</>:!data.choice&&!data.loading&&!data.error&&<p>{data.targets.length?'尚未导入被试库。请先明确关联研究。':'当前暂无可导入的研究，请联系研究负责人核对。'}</p>}
  {data.loading&&<p role="status">正在核对本次导入…</p>}
  {item?.state==='planned'&&item.summary.transforms?.length>0&&<ul aria-label="本次字段对应">{item.summary.transforms.map((m,i)=><li key={i}>{researchDataMappingDescription(m)}</li>)}</ul>}
  {data.error&&<p role="alert">{data.error} <Button disabled={data.loading} onClick={()=>data.mappingStale?data.recheckFields():data.refresh()}>{data.mappingStale?'重新核对字段':'核对状态'}</Button>{data.retryable&&!item&&!data.unavailable&&<Button disabled={data.loading} onClick={data.retry}>重试本次核对</Button>}</p>}
  {item?.state==='planned'&&<Button primary disabled={data.loading||data.pending} onClick={data.confirm}>确认导入</Button>}
 </div>;
}
