import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {getPlatformUser} from '../../src/platform-user.js';
import {captureUrl} from '../../src/formal-capture-session.js';
import {studyDataAiHref} from '../../src/study-data-navigation.js';
import './subject-data.css';

const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const count=x=>Number.isSafeInteger(x)&&x>=0;
const scalar=x=>x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x);
const nullableText=x=>x===null||typeof x==='string';
const date=x=>x===null||typeof x==='string'&&Number.isFinite(Date.parse(x));
const fields={onsetAge:'首发年龄',episodeCount:'发作次数',currentEpisodeMonths:'本次病程（月）',totalEpisodeMonths:'总病程（月）',hospitalizationCount:'住院次数',familyHistory:'家族史',familyHistoryNote:'家族史说明',onMedication:'是否服药',medication:'目前服药',onsetTrigger:'发病诱因',illnessFeature:'病情特点',economicStatus:'经济状况',education:'教育程度',occupation:'职业',ethnicity:'民族',residence:'居住地',maritalStatus:'婚姻状况',collectionDate:'采集日期',dataDate:'数据日期'};
const statuses={needs_review:'待核对',ingested:'已登记',uploaded:'已上传',pending:'待处理',queued:'等待处理',running:'处理中',processing:'处理中',complete:'已完成',completed:'已完成',processed:'已处理',failed:'处理失败',cancelled:'已取消'};
const value=x=>x===undefined?'未提供':x===null?'缺失':x===false?'否':x===true?'是':x===''?'空文本':String(x);
const initial=()=>({section:'files',fileId:null,taskId:null});
export function assertSubjectDataPage(p,scope){
 const fail=()=>{throw Error('研究数据或来源已有变化，请重新读取。');};
 const d=p?.data,c=p?.clinical,allowed=p?.capabilities?.canReadClinicalData;
 if(p?.schema!=='hub-subject-data.v1'||p.studyId!==scope.studyId||p.subject?.id!==scope.subjectId||!id(p.subject.subjectId)||typeof allowed!=='boolean'||!c||!d||d.section!==scope.section||d.fileId!==scope.fileId||d.taskId!==scope.taskId||!Array.isArray(d.items)||d.items.length>100||!(d.nextCursor===null||typeof d.nextCursor==='string'&&d.nextCursor.length>0&&d.nextCursor.length<=4096))fail();
 if(!allowed){if(c.status!=='restricted'||c.subject!==null||c.profile!==null||d.status!=='restricted'||d.items.length||d.nextCursor!==null)fail();return p;}
 if(c.status!=='available'||d.status!=='available'||!c.subject||!c.profile||Object.values(c.subject).some(x=>!scalar(x))||!['available','missing'].includes(c.profile.status)||!c.profile.values||Array.isArray(c.profile.values)||typeof c.profile.values!=='object'||Object.entries(c.profile.values).some(([k,v])=>!Object.hasOwn(fields,k)||!scalar(v))||c.profile.status==='missing'&&Object.keys(c.profile.values).length||!date(c.profile.updatedAt))fail();
 const seen=new Set();
 for(const x of d.items){
  if(!id(x.id)||seen.has(x.id))fail();seen.add(x.id);
  if(d.section==='files'){
   if(typeof x.modality!=='string'||typeof x.kind!=='string'||typeof x.status!=='string'||!nullableText(x.filename)||!date(x.collectedAt)||!date(x.createdAt)||!count(x.taskCount)||!count(x.featureCount)||x.sourceRef!==null&&(x.sourceRef?.kind!=='modality_file'||x.sourceRef.id!==x.id||!/^[a-f0-9]{64}$/.test(x.sourceRef.sha256??'')))fail();
  }else if(d.section==='tasks'){
   if(!id(d.fileId)||d.taskId!==null||typeof x.status!=='string'||typeof x.skillKey!=='string'||!count(x.featureCount)||!date(x.createdAt)||!date(x.updatedAt)||!date(x.completedAt)||x.progress!==null&&(!Number.isFinite(x.progress)||x.progress<0||x.progress>100))fail();
  }else if(d.section==='features'){
   if(!id(d.fileId)||!id(d.taskId)||typeof x.featureKey!=='string'||typeof x.modality!=='string'||!nullableText(x.timeWindow)||!nullableText(x.sourcePipeline)||!nullableText(x.extractionVersion)||!date(x.collectedAt)||Object.hasOwn(x,'value')||Object.hasOwn(x,'unit')||x.sourceRef!==null&&(x.sourceRef?.kind!=='feature'||x.sourceRef.id!==x.id||x.sourceRef.fileId!==d.fileId||x.sourceRef.taskId!==d.taskId))fail();
  }else fail();
 }
 return p;
}

export default function SubjectDataPanel({client,identity,studyId,subjectId,enabled,visits=[]}){
 const [selection,setSelection]=useState(initial),[state,setState]=useState({key:'',page:null,busy:false,error:''}),epoch=useRef(0),reading=useRef(false),current=useRef(null),latest=useRef(null);
 const key=[identity,studyId,subjectId,enabled].join(':');latest.current={client,key,enabled,selection};
 const verified=()=>{const u=getPlatformUser();return enabled&&u.authenticated&&identity===u.id+':'+u.authVersion;};
 const valid=token=>epoch.current===token&&latest.current.key===key&&latest.current.client===client&&verified();
 function clear(){epoch.current++;reading.current=false;current.current=null;setState({key,page:null,busy:false,error:''});}
 async function load(next=selection,cursor){
  if(reading.current||!verified())return;const token=++epoch.current;reading.current=true;setState(old=>({...old,key,busy:true,error:''}));
  try{
   const params=new URLSearchParams({section:next.section,limit:'20',...(next.fileId?{fileId:next.fileId}:{}),...(next.taskId?{taskId:next.taskId}:{}),...(cursor?{cursor}:{})});
   let p=assertSubjectDataPage(await client.request('/research-studies/'+studyId+'/subjects/'+subjectId+'/data?'+params),{studyId,subjectId,...next});if(!valid(token))return;
   if(cursor&&p.capabilities.canReadClinicalData){const old=current.current;if(!old||old.data.nextCursor!==cursor||p.data.nextCursor===cursor||p.data.items.some(x=>old.data.items.some(y=>x.id===y.id)))throw Error('数据列表已有变化，请重新读取。');p={...p,data:{...p.data,items:[...old.data.items,...p.data.items]}};}
   current.current=p;setState({key,page:p,busy:false,error:''});
  }catch(error){if(valid(token)){current.current=null;setState({key,page:null,busy:false,error:error.message||'暂时无法读取研究数据，请重试。'});}}
  finally{if(epoch.current===token)reading.current=false;}
 }
 useEffect(()=>{clear();setSelection(initial());if(verified())void load(initial());const changed=()=>{clear();setSelection(initial());if(verified())void load(initial());},focus=()=>{if(document.visibilityState==='visible')void load(latest.current.selection);};window.addEventListener('qiyan:user-change',changed);window.addEventListener('focus',focus);return()=>{epoch.current++;reading.current=false;window.removeEventListener('qiyan:user-change',changed);window.removeEventListener('focus',focus);};},[client,identity,studyId,subjectId,enabled]);
 function choose(next){if(reading.current)return;current.current=null;setSelection(next);setState({key,page:null,busy:false,error:''});void load(next);}
 const shown=state.key===key&&verified()?state:{page:null,busy:false,error:''},page=shown.page,data=page?.data,clinical=page?.clinical;
 return <section id="subject-data" tabIndex={-1} className="subject-data" aria-label="受试者研究数据" aria-busy={shown.busy}>
  <div className="subject-data-actions"><h3>研究数据</h3>{verified()&&<a className="study-data-link" href={studyDataAiHref({studyId,subjectId})}>到岐研AI上传</a>}<Button disabled={!verified()||shown.busy} onClick={()=>void load(selection)}>重新读取研究数据</Button></div>
  {shown.busy&&<p role="status">正在读取研究数据…</p>}{shown.error&&<p role="alert">{shown.error} 旧数据已停止展示，请重新读取。</p>}
  {page&&clinical.status==='restricted'&&<p>当前账号可查看被试记录，尚无临床数据读取权限。请联系研究负责人核对。</p>}
  {page&&clinical.status==='available'&&<>
   <details open><summary>档案</summary><dl className="subject-data-fields">{[['group','研究分组'],['syndrome','证型'],['sex','性别'],['age','年龄']].map(([k,label])=><div key={k}><dt>{label}</dt><dd>{value(clinical.subject[k])}</dd></div>)}{Object.entries(clinical.profile.values).map(([k,v])=><div key={k}><dt>{fields[k]}</dt><dd>{value(v)}</dd></div>)}</dl>{clinical.profile.status==='missing'&&<p>尚未登记补充档案。</p>}</details>
   <details open><summary>量表与指标</summary>{visits.length?<ul>{visits.filter(v=>id(v.id)&&typeof v.visitPlan?.name==='string').map(v=><li key={v.id}><a className="study-data-link" href={captureUrl('s09',studyId,{visitId:v.id})}>{v.visitPlan.name} · 查看本次记录</a></li>)}</ul>:<p>尚无可回看的访视记录。</p>}<p>按访视回看原表单、计分与处理指标；是否可用于分析由原分析核对决定。</p></details>
   <details open><summary>原始资料及来源</summary><p>以下原件尚未关联访视；已关联的资料请从对应访视回看。</p>
    {data.section!=='files'&&<div className="subject-data-actions"><Button disabled={shown.busy} onClick={()=>choose(initial())}>返回原始资料</Button>{data.section==='features'&&<Button disabled={shown.busy} onClick={()=>choose({section:'tasks',fileId:data.fileId,taskId:null})}>返回处理记录</Button>}</div>}
    {data.items.length?<ul className="subject-data-records">{data.items.map(x=><li key={x.id}>{data.section==='files'?<><strong>{x.filename||'未命名原件'}</strong><p>{x.kind==='raw'?'原始文件':'资料文件'} · {statuses[x.status]||'状态待核对'} · {x.taskCount}条处理记录</p>{x.sourceRef?<p>原件来源已核验。</p>:<p>原件来源尚不可核验。</p>}{x.taskCount>0&&<Button disabled={shown.busy} onClick={()=>choose({section:'tasks',fileId:x.id,taskId:null})}>查看处理记录</Button>}</>:data.section==='tasks'?<><strong>{x.skillKey==='preprocessed-feature-import'?'预处理特征导入':'已有处理任务'}</strong><p>{statuses[x.status]||'状态待核对'} · {x.featureCount}项特征记录</p>{x.featureCount>0&&<Button disabled={shown.busy} onClick={()=>choose({section:'features',fileId:data.fileId,taskId:x.id})}>查看特征来源</Button>}</>:<><strong>{x.featureKey}</strong><p>未关联访视，仅回看来源，不作为本次访视的指标值。</p><p>提取版本：{value(x.extractionVersion)}</p>{!x.sourceRef&&<p>特征来源尚不可核验。</p>}</>}</li>)}</ul>:<p>{data.section==='files'?'暂无未关联访视的原始资料。':data.section==='tasks'?'暂无可核验的处理记录。':'暂无可核验的特征来源。'}</p>}
    {data.nextCursor&&<Button disabled={shown.busy} onClick={()=>void load(selection,data.nextCursor)}>{data.section==='files'?'读取更多原始资料':data.section==='tasks'?'读取更多处理记录':'读取更多特征来源'}</Button>}
   </details>
  </>}
 </section>;
}
