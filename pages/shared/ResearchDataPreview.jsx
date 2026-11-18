import React,{useEffect,useRef,useState} from 'react';import {Button} from './Components.jsx';
import {assertResearchDataPage,assertDataPlan,researchDataIssueLabel,researchDataCell,researchDataColumnDescription} from '../../src/research-data-session.js';
import './ResearchDataPreview.css';
import ResearchDataImport,{useResearchDataImports} from './ResearchDataImport.jsx';
import ResearchDataOverview,{useResearchDataOverview} from './ResearchDataOverview.jsx';
import SubjectProfileImport,{useSubjectProfileImport} from './SubjectProfileImport.jsx';
import {createUploadStudyIntents} from '../../src/research-data-upload-intent.js';
export function useResearchData({client,identity,sessionId,enabled=false,overviewEnabled=false,analysisReady=false,paused=false}){
 const alive=useRef(true),epoch=useRef(0),sidRef=useRef(sessionId),previous=useRef(sessionId),busy=useRef(false);sidRef.current=sessionId;
 const [items,setItems]=useState([]),[plan,setPlan]=useState(null),[uploadIntent,setUploadIntent]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[checked,setChecked]=useState(null),[pending,setPending]=useState(false),[shownKey,setShownKey]=useState(null),[nextCursor,setNextCursor]=useState(null);
 const contextKey=identity+':'+(sessionId??''),key=sid=>'rh-data-plan-pending:'+identity+':'+sid;
 const current=(sid,turn)=>alive.current&&turn===epoch.current&&(sidRef.current===null||sidRef.current===sid);
 const readPending=sid=>{try{const v=JSON.parse(sessionStorage.getItem(key(sid))??'null');return v&&typeof v.requestKey==='string'&&Array.isArray(v.files)?v:null;}catch{return null;}};
 const forget=sid=>{try{sessionStorage.removeItem(key(sid));}catch{}setPending(false);};
 const intents=sid=>createUploadStudyIntents({storage:sessionStorage,identity,sessionId:sid});
 const acceptIntent=(sid,p,marker)=>{const value=marker?.uploadKeys?.length?intents(sid).bind(p,marker.uploadKeys):intents(sid).forBatch(p);setUploadIntent(value);};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 useEffect(()=>{epoch.current++;setItems([]);setPlan(null);setError('');setChecked(null);setShownKey(null);},[client,identity,enabled,paused]);
 async function refresh(sid=sessionId,cursor){
  if(!enabled||paused||!sid)return;const turn=epoch.current;setLoading(true);
  try{
   const [data,saved]=await Promise.all([client.get(`/sessions/${sid}/research-data?limit=20${cursor?'&cursor='+encodeURIComponent(cursor):''}`),client.get(`/sessions/${sid}/data-preflights`)]);
   if(!current(sid,turn))return;const accepted=assertResearchDataPage(data);setItems(old=>cursor?[...new Map([...old,...accepted.items].map(i=>[i.id,i])).values()]:accepted.items);setNextCursor(accepted.nextCursor);const savedPlan=assertDataPlan(saved.item);setPlan(savedPlan);acceptIntent(sid,savedPlan);setError('');setChecked(identity+':'+sid);setShownKey(identity+':'+sid);
   const p=readPending(sid);setPending(Boolean(p));if(p){const receipt=await client.get(`/sessions/${sid}/data-preflights/receipts/${p.requestKey}`);if(!current(sid,turn))return;if(receipt.found){const found=assertDataPlan(receipt.item);acceptIntent(sid,found,p);setPlan(found);forget(sid);}}
  }catch(e){if(current(sid,turn)){setError(e.message);setShownKey(identity+':'+sid);setPlan(null);if([401,403,404].includes(e.status))setItems([]);}}
  finally{if(current(sid,turn))setLoading(false);}
 }
 useEffect(()=>{if(previous.current!==sessionId&&previous.current!==null)epoch.current++;previous.current=sessionId;setItems([]);setPlan(null);setError('');setChecked(null);setShownKey(null);setPending(false);setNextCursor(null);if(sessionId)void refresh(sessionId);},[client,identity,sessionId,enabled,paused]);
 async function preview(sid=sessionId,newFiles,options={}){
  if(busy.current||!enabled||paused)return;busy.current=true;const turn=epoch.current;setLoading(true);setError('');
  try{
   if(!newFiles&&(!imports.canChangeSource||error))throw Error('请先核对当前导入状态，再重新预检。');
   const saved=readPending(sid),files=newFiles?newFiles.filter(x=>x.state==='ready').map(({id,version})=>({id,version})):plan?.files??items.filter(x=>x.state==='ready').map(({id,version})=>({id,version})),body=saved??{requestKey:'data-plan-'+crypto.randomUUID(),files,...(options.uploadKeys?.length?{uploadKeys:options.uploadKeys}:{})};
   if(saved&&newFiles&&JSON.stringify(saved.files)!==JSON.stringify(files))throw Error('上次预检结果尚未核对，请先核对原批次，再处理新文件。');
   if(!body.files.length)throw Error('请先上传可识别的研究数据。');
   if(body.files.length>20)throw Error('每批最多预检20份文件。请上传所需的新批次；原文件仍保留。');
   try{sessionStorage.setItem(key(sid),JSON.stringify(body));}catch{throw Error('无法保存预检进度，本次未提交预检。请允许站点存储后重试。');}
   setPending(true);const value=await client.post(`/sessions/${sid}/data-preflights`,{requestKey:body.requestKey,files:body.files});if(!current(sid,turn))return;
   const accepted=assertDataPlan(value);acceptIntent(sid,accepted,body);setPlan(accepted);forget(sid);await refresh(sid);
  }catch(e){if(current(sid,turn)){if([400,413].includes(e.status))forget(sid);setPlan(null);setError(e.message);}throw e;}
  finally{busy.current=false;if(current(sid,turn))setLoading(false);}
 }
 async function cancel(){if(!plan||loading||!imports.canCancelSource)return;const sid=sessionId,turn=epoch.current;setLoading(true);try{await imports.cancel();if(!current(sid,turn))return;const value=await client.post(`/sessions/${sid}/data-preflights/${plan.id}/cancellation`,{version:plan.version});if(current(sid,turn)){setPlan(assertDataPlan(value));setError('');}}catch(e){if(current(sid,turn)){setPlan(null);setError(e.message);}}finally{if(current(sid,turn))setLoading(false);}}
 const scopeActive=enabled&&!paused,active=scopeActive&&shownKey===contextKey;
 const boundIntent=active&&plan?.id===uploadIntent?.preflightId&&plan?.version===uploadIntent?.preflightVersion?uploadIntent:null;
 const profiles=useSubjectProfileImport({client,identity,sessionId,preflight:active?plan:null,enabled:active,uploadIntent:boundIntent});
 const legacyImports=useResearchDataImports({client,identity,sessionId,preflight:active?plan:null,enabled:active&&!loading&&profiles.route==='legacy',preferredStudyId:boundIntent?.studyId});
 const imports=profiles.route==='profile'?profiles:profiles.route==='legacy'?legacyImports:{canChangeSource:false,canCancelSource:false,cancel:async()=>{throw Error('请先核对文件类型。');}};
 const overview=useResearchDataOverview({client,identity,sessionId,item:legacyImports.item,enabled:active&&!loading&&overviewEnabled&&profiles.route==='legacy'});
 return{imports,profiles,overview,analysisReady:analysisReady&&profiles.route==='legacy',analysisAvailable:Boolean(analysisReady&&overview.ready),items:active?items:[],plan:active?plan:null,error:active?(error||(!profiles.route?profiles.error:'')):'',loading:active&&(loading||profiles.loading),pending:active&&pending,nextCursor:active?nextCursor:null,refresh,preview,cancel,more:()=>!loading&&nextCursor?refresh(sessionId,nextCursor):undefined,
  hasData:active&&items.length>0,blocksAnalysis:scopeActive&&Boolean(sessionId&&(checked!==contextKey||error||pending||items.length&&(!analysisReady||!overview.ready))),
  uploaded:()=>refresh(sidRef.current)};
}
export default function ResearchDataPreview({data}){
 if(!data.plan&&!data.error&&!data.pending&&!data.items.length)return null;
 const result=data.plan?.result,files=result?.files??[],rows=files.reduce((n,f)=>n+f.rowsRead,0),errors=files.reduce((n,f)=>n+f.rejectedRows,0);
 const imported=data.imports?.item?.state==='committed';
 return <section className="research-data-preview" aria-label={imported?'研究数据导入':'研究数据预检'} aria-busy={data.loading||data.imports?.loading}>
  <h3>{imported?'研究数据导入':'研究数据预检'}</h3>
  {data.error&&<p role="alert">{data.error} <Button onClick={()=>data.refresh()}>核对状态</Button></p>}
  {data.pending&&<p role="status">预检结果尚未确认，文件已保留。<Button onClick={()=>data.refresh()}>核对预检</Button></p>}
  {data.plan?.state==='invalid'&&<p>这份预检已失效，文件仍保留。请核对文件后重新预检。</p>}
  {data.plan?.state==='cancelled'?<p>本次预检已取消，文件仍保留。</p>:data.plan?.state==='previewed'&&result&&<>
   <p>已检查{files.length}份文件、{rows}行记录；{errors?`${errors}行需要处理。`:'未发现行结构错误。'}</p>
   {data.profiles?.route==='profile'?<SubjectProfileImport data={data.profiles}/>:data.profiles?.route==='legacy'?<ResearchDataImport data={data.imports}/>:<p>正在核对文件的导入方式。{data.profiles?.error&&<Button onClick={data.profiles.refresh}>重新核对</Button>}</p>}
   {imported&&data.profiles?.route==='legacy'&&<ResearchDataOverview data={data.overview}/>}
   {files.map(f=><details key={f.fileId}><summary>{data.items.find(i=>i.id===f.fileId)?.name??'研究数据'} · {f.rowsRead}行{f.rejectedRows?`，${f.rejectedRows}行需处理`:''}</summary>
    <ul>{f.issues.map(code=><li key={code}>{researchDataIssueLabel(code)}</li>)}</ul>
    {[...new Set(f.sampleRows.map(r=>r.sheet))].map(sheet=><div className="research-data-table" key={sheet}><table><caption>{sheet} · 前{f.sampleRows.filter(r=>r.sheet===sheet).length}行原始值预览；空值不补零</caption><thead><tr><th scope="col">工作表／行</th>{f.fields.filter(x=>x.sheet===sheet).map((field,i)=><th scope="col" key={i}>{field.name||'未命名列'}{researchDataColumnDescription(field)&&<span className="research-data-column-description">{researchDataColumnDescription(field)}</span>}</th>)}</tr></thead><tbody>{f.sampleRows.filter(r=>r.sheet===sheet).map((r,i)=><tr key={i}><th scope="row">{r.sheet}／{r.rowNumber}</th>{r.values.length?r.values.map((v,j)=><td key={j}>{researchDataCell(v)}</td>):<td colSpan={f.fields.filter(x=>x.sheet===sheet).length}>本行原值暂不展示，请核对下方异常。</td>}</tr>)}</tbody></table></div>)}
    {f.exceptions.length>0&&<ul>{f.exceptions.map((r,i)=><li key={i}>{r.sheet}第{r.rowNumber}行：{r.issues.map(researchDataIssueLabel).join('；')}</li>)}</ul>}
    {f.rejectedRows>f.exceptions.length&&<p>仅列出前{f.exceptions.length}行异常，请修正文件后重新预检。</p>}
   </details>)}
  </>}
  <div><Button disabled={data.loading||Boolean(data.error)||data.imports?.canChangeSource===false} onClick={()=>data.preview().catch(()=>{})}>{data.pending?'继续预检':'重新预检'}</Button>{data.plan?.state==='previewed'&&data.imports?.item?.state!=='committed'&&<Button disabled={data.loading||data.imports?.canCancelSource===false} onClick={data.cancel}>取消预检</Button>}</div>
 </section>;
}
