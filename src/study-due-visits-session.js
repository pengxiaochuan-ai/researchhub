import {captureUrl} from './formal-capture-session.js';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const same=(a,b)=>!!a&&!!b&&['accountId','authVersion','studyId','url'].every(k=>a[k]===b[k]);
const validScope=s=>!!s&&id(s.accountId)&&Number.isSafeInteger(s.authVersion)&&s.authVersion>=0&&id(s.studyId)&&typeof s.url==='string';
const empty=kind=>({kind,busy:false,loadingMore:false,items:[],nextCursor:null,day:null,timeZone:'Asia/Shanghai',message:''});
const badResult=()=>Error('待访视结果暂时无法核对，请重新读取。');
function validate(result,studyId,requestLimit){
 if(result?.studyId!==studyId||result.timeZone!=='Asia/Shanghai'||!validDay(result.day)||!Array.isArray(result.items)||result.items.length>requestLimit||result.nextCursor!==null&&(typeof result.nextCursor!=='string'||!result.nextCursor.length||result.nextCursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(result.nextCursor)))throw badResult();
 const seen=new Set();for(const row of result.items){if(!id(row?.visitId)||seen.has(row.visitId)||!id(row.subject?.id)||typeof row.subject.subjectId!=='string'||!row.subject.subjectId.length||!id(row.enrollmentId)||!id(row.protocolVersionId)||!id(row.visitPlan?.id)||typeof row.visitPlan.name!=='string'||typeof row.visitPlan.code!=='string'||!['due','overdue','in_progress'].includes(row.attention)||!['planned','due_soon','overdue','in_progress','deviation'].includes(row.status)||row.scheduleState!=='scheduled'||['targetDate','windowStart','windowEnd'].some(k=>row[k]!==null&&(typeof row[k]!=='string'||!Number.isFinite(Date.parse(row[k])))))throw badResult();seen.add(row.visitId);}
 return result;
}
export function dueVisitUrl(studyId,visitId){if(!id(studyId)||!id(visitId))throw badResult();return captureUrl('s09',studyId,{visitId});}
export function formatDueVisitDate(value){if(!value||!Number.isFinite(Date.parse(value)))return'日期待核对';const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
export function createStudyDueVisitsSession({request,scope,onChange=()=>{}}){
 let context=null,epoch=0,controller=null,state=empty('restricted');
 const snapshot=()=>({...state,scope:context?{...context}:null,items:state.items.map(row=>structuredClone(row))});
 const emit=()=>onChange(snapshot());
 function setContext(value){const next=validScope(value)?{accountId:value.accountId,authVersion:value.authVersion,studyId:value.studyId,url:value.url}:null;if(same(next,context)||!next&&!context)return false;epoch++;controller?.abort();controller=null;context=next;state=empty(next?'idle':'restricted');emit();return true;}
 async function read(more=false){
  if(!context||state.busy||more&&(state.kind!=='ready'||!state.nextCursor))return false;
  if(scope&&!same(scope(),context)){setContext(null);return false;}
  const bound={...context},token=++epoch;controller=new AbortController();const signal=controller.signal;let previous=more?state:null,cursor=previous?.nextCursor??null;
  const current=()=>{if(token!==epoch)return false;if(scope&&!same(scope(),bound)){setContext(null);return false;}return same(context,bound);};
  state={...(previous??empty('loading')),kind:'loading',busy:true,loadingMore:more,message:''};emit();
  try{
   for(let attempt=0;attempt<2;attempt++){
    const requestLimit=cursor?20:5;let result;try{result=await request('/research-studies/'+bound.studyId+'/due-visits?'+new URLSearchParams({limit:String(requestLimit),...(cursor?{cursor}:{})}),{method:'GET',signal});}
    catch(error){if(!current())return false;if(cursor&&attempt===0&&error.status===409&&error.code==='DUE_VISIT_DAY_CHANGED'){cursor=null;previous=null;state={...empty('loading'),busy:true,message:'北京时间日期已更新，正在读取今天的安排…'};emit();continue;}throw error;}
    if(!current())return false;validate(result,bound.studyId,requestLimit);
    if(previous&&(result.day!==previous.day||result.nextCursor===cursor||result.items.some(row=>previous.items.some(old=>old.visitId===row.visitId))))throw badResult();
    state={kind:'ready',busy:false,loadingMore:false,items:[...(previous?.items??[]),...result.items],nextCursor:result.nextCursor,day:result.day,timeZone:result.timeZone,message:''};emit();return true;
   }
  }catch(error){if(current()){state={...empty('error'),message:error.message||'暂时无法读取待访视，请重新读取。'};emit();}}
  finally{if(current()){controller=null;if(state.busy){state={...state,busy:false,loadingMore:false};emit();}}}
  return false;
 }
 return{setContext,snapshot,load:()=>read(false),more:()=>read(true),invalidate(){epoch++;controller?.abort();controller=null;context=null;state=empty('restricted');emit();}};
}
