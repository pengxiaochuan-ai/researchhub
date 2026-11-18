import {fileIssue} from './capture-file-session.js';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const operations={visit:['assign','start','complete','reverify'],assignment:['draft','submit','correct','review','lock','unlock'],query:['create','reply','close'],email:['send'],import:['commit'],file:['upload']};
function taskProblemMessage(path,data){
 if(data?.code==='PARTICIPATION_CAPTURE_BLOCKED'&&/^\/research-studies\/[^/?]+\/analysis(?:\/|\?|$)/.test(path))return /\/analysis\/report/.test(path)?'研究参与、同意或执行政策尚未满足，当前报告暂不可用；请核对参与记录与研究政策。':'研究参与、同意或执行政策尚未满足，当前不能继续分析；请核对参与记录与研究政策。';
 return data?.message;
}
export const isCaptureRoute=(page,search='')=>['s05','s09'].includes(page)&&new URLSearchParams(search).has('formalCapture');
export function readCaptureRoute(page,search=''){
 const p=new URLSearchParams(search),allowed=['formalCapture','studyId','assignmentId','queryId',...(page==='s09'?['visitId','revisionNo','responseId','contentHash']:[])];
 if(!isCaptureRoute(page,search)||p.get('formalCapture')!=='1'||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1)||!id(p.get('studyId'))||['visitId','assignmentId','queryId'].some(k=>p.has(k)&&!id(p.get(k)))||page==='s09'&&p.has('queryId')&&!p.has('assignmentId'))throw Error('采集链接无效，请从研究或受试者重新进入。');
 const fixed=['revisionNo','responseId','contentHash'],hasFixed=fixed.some(k=>p.has(k));if(hasFixed&&(page!=='s09'||!p.has('assignmentId')||p.has('queryId')||!fixed.every(k=>p.has(k))||!id(p.get('responseId'))||!/^([1-9][0-9]*)$/.test(p.get('revisionNo'))||!Number.isSafeInteger(Number(p.get('revisionNo')))||!/^[a-f0-9]{64}$/.test(p.get('contentHash'))))throw Error('修订链接无效，请从原记录重新进入。');
 return {page,studyId:p.get('studyId'),visitId:p.get('visitId'),assignmentId:p.get('assignmentId'),queryId:p.get('queryId'),fixedRef:hasFixed?{assignmentId:p.get('assignmentId'),responseId:p.get('responseId'),revisionNo:Number(p.get('revisionNo')),contentHash:p.get('contentHash')}:null};
}
export function captureUrl(page,studyId,context={}){
 const p=new URLSearchParams({formalCapture:'1',studyId,...Object.fromEntries(Object.entries(context).filter(([,v])=>v!=null))});readCaptureRoute(page,p.toString());return '/pages/'+page+'/?'+p;
}
export function captureHeader(config,page,search){
 if(!isCaptureRoute(page,search))return config;let route;try{route=readCaptureRoute(page,search);}catch{}
 return {...config,title:page==='s09'?'访视与数据录入':'数据质量详情',description:'',meta:'',actions:[],nav:undefined,crumbs:[['我的工作台','p01'],...(route?[['研究概览','s01',{researchStudy:'1',studyId:route.studyId}]]:[]),[page==='s09'?'访视与数据录入':'数据质量详情']]};
}
function unacceptedVisitWorkflow(method,path,status,data){
 if(method!=='POST'||status!==409||data?.rejectedBeforeAcceptance!==true)return false;
 if(/^\/research-studies\/[^/?]+\/visits\/[^/?]+\/workflow\/batches$/.test(path))return ['VISIT_WORKFLOW_SUMMARY_CHANGED','VISIT_WORKFLOW_MEMBER_CHANGED'].includes(data.code);
 return /^\/research-studies\/[^/?]+\/visits\/[^/?]+\/workflow\/batches\/[^/?]+\/advance$/.test(path)&&data.code==='VISIT_WORKFLOW_BATCH_CHANGED';
}
export function createCaptureClient({fetchImpl=globalThis.fetch,onAccessLost=()=>{},requestTimeoutMs=20000}={}){
 if(!Number.isInteger(requestTimeoutMs)||requestTimeoutMs<1000||requestTimeoutMs>600000)throw new RangeError('requestTimeoutMs must be an integer from 1000 to 600000.');
 let epoch=0,controller=new AbortController();return {invalidate(){epoch++;controller.abort();controller=new AbortController();},async request(path,{method='GET',body}={}){
  const token=epoch;let response;
  try{response=await fetchImpl('/api'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(requestTimeoutMs)]),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
  catch(cause){if(token!==epoch)throw Object.assign(Error('登录或研究范围已变化。'),{stale:true});throw Object.assign(Error('连接中断，输入仍保留，请重新核对。'),{unknown:method!=='GET',cause});}
  const data=await response.json().catch(()=>null);if(token!==epoch)throw Object.assign(Error('旧请求已丢弃。'),{stale:true});
 if(!response.ok){const error=Object.assign(Error(data?.code==='FORMAL_FEATURE_INVALID'?fileIssue(data):taskProblemMessage(path,data)||({401:'登录已失效，请重新登录。',403:'当前账号无权继续此操作。',404:'对象不存在或当前不可访问。',409:'对象已有变化，输入已保留，请核对当前状态。'})[response.status]||'服务暂不可用，输入已保留，请稍后核对。'),{status:response.status,code:data?.code,...(unacceptedVisitWorkflow(method,path,response.status,data)?{rejectedBeforeAcceptance:true}:{}),unknown:method!=='GET'&&response.status>=500&&!['OUTREACH_CHANNEL_UNAVAILABLE','FILE_SERVICE_UNAVAILABLE'].includes(data?.code)});if([401,403].includes(response.status)||['PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','FORM_ASSIGNMENT_CHANGED','FILE_BINDING_CHANGED','FILE_SOURCE_CHANGED'].includes(error.code))onAccessLost(error);throw error;}
  if(!data||typeof data!=='object')throw Object.assign(Error('未能确认结果，请核对上次操作。'),{unknown:method!=='GET'});return data;
 }};
}
export function validCaptureMarker(p,scope){
 const keys=['actor','authVersion','studyId','visitId','assignmentId','queryId','domain','action','requestKey'];
 return !!p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===keys.length&&Object.keys(p).every(k=>keys.includes(k))&&p.actor===scope.actor&&p.authVersion===scope.authVersion&&p.studyId===scope.studyId&&Number.isSafeInteger(p.authVersion)&&p.authVersion>=0&&id(p.actor)&&id(p.requestKey)&&operations[p.domain]?.includes(p.action)&&['visitId','assignmentId','queryId'].every(k=>p[k]===null||id(p[k]))&&(!['visit','email','file'].includes(p.domain)||id(p.visitId))&&(p.domain!=='assignment'||id(p.assignmentId))&&(p.domain!=='query'||id(p.assignmentId)&&(p.action==='create'||id(p.queryId)))&&(p.domain!=='file'||p.assignmentId===null&&p.queryId===null)&&(p.domain!=='import'||['visitId','assignmentId','queryId'].every(k=>p[k]===null));
}
export function captureCommandPath(p){const base='/research-studies/'+encodeURIComponent(p.studyId);return p.domain==='file'?base+'/visits/'+p.visitId+'/files/preprocessed':p.domain==='import'?base+'/imports':p.domain==='email'?base+'/visits/'+p.visitId+'/email-invitations':p.domain==='visit'?base+'/visits/'+p.visitId+'/'+(p.action==='assign'?'assignments':p.action):p.domain==='assignment'?base+'/assignments/'+p.assignmentId+'/'+p.action:base+'/data-queries'+(p.action==='create'?'':'/'+p.queryId+'/'+p.action);}
export function captureReceiptPath(p){const base='/research-studies/'+encodeURIComponent(p.studyId);return p.domain==='file'?base+'/visits/'+p.visitId+'/files/receipts/'+p.requestKey:p.domain==='import'?base+'/imports/receipts/'+p.requestKey:p.domain==='email'?base+'/visits/'+p.visitId+'/email-invitation-receipts/'+p.requestKey:p.domain==='visit'?base+'/visits/'+p.visitId+(p.action==='assign'?'/assignment-receipts/':'/receipts/')+p.requestKey+(p.action==='assign'?'':'?operation='+p.action):p.domain==='assignment'?base+'/assignments/'+p.assignmentId+'/receipts/'+p.requestKey+'?operation='+p.action:base+'/data-queries/receipts/'+p.requestKey+'?'+new URLSearchParams({action:p.action,assignmentId:p.assignmentId,...(p.queryId?{queryId:p.queryId}:{})});}
export function validCaptureResult(result,p){
 if(result?.studyId!==p.studyId)return false;
 if(p.domain==='file')return result.visitId===p.visitId&&id(result.fileId)&&id(result.taskId)&&/^[a-f0-9]{64}$/.test(result.sourceSha256)&&['inserted','alerts','missing'].every(k=>Number.isSafeInteger(result[k])&&result[k]>=0&&result[k]<=1000)&&result.inserted+result.missing>0&&result.inserted+result.missing<=1000&&result.alerts<=result.inserted&&['verified','unknown','mismatch'].includes(result.storageIntegrity?.status)&&typeof result.storageIntegrity.recorded==='boolean'&&result.receipt?.requestKey===p.requestKey&&result.receipt.action==='file.preprocessed'&&result.receipt.targetId===p.visitId&&result.receipt.studyId===p.studyId;
 if(p.domain==='import')return id(result.formVersionId)&&result.source?.kind==='csv_import'&&/^[a-f0-9]{64}$/.test(result.source.csvSha256)&&Array.isArray(result.rows)&&result.rows.length>0&&result.rows.length<=100&&new Set(result.rows.map(r=>r.assignmentId)).size===result.rows.length&&new Set(result.rows.map(r=>r.rowNumber)).size===result.rows.length&&result.rows.every(r=>Number.isSafeInteger(r.rowNumber)&&r.rowNumber>=2&&['subjectId','visitId','assignmentId'].every(k=>id(r[k]))&&r.ref?.assignmentId===r.assignmentId&&id(r.ref.responseId)&&Number.isSafeInteger(r.ref.revisionNo)&&r.ref.revisionNo>=1&&/^[a-f0-9]{64}$/.test(r.ref.contentHash))&&result.receipt?.requestKey===p.requestKey&&result.receipt.action==='form.import'&&result.receipt.targetId===p.studyId;
 if(p.domain==='email')return result.visitId===p.visitId&&id(result.assignmentId)&&id(result.invitationId)&&result.receipt?.requestKey===p.requestKey&&result.receipt.action==='outreach.email'&&result.receipt.targetId===p.visitId&&result.receipt.studyId===p.studyId;
 if(p.domain==='query')return id(result.result?.id)&&Number.isSafeInteger(result.result.version)&&result.result.version>=1&&(p.action==='create'||result.result.id===p.queryId)&&result.receipt?.requestKey===p.requestKey&&result.receipt.action==='data_query.'+p.action&&result.receipt.targetId===result.result.id&&result.receipt.assignmentId===p.assignmentId;
 const target=p.domain==='visit'?p.visitId:p.assignmentId,action=(p.domain==='visit'&&p.action!=='assign'?'visit.':'form.')+p.action;
 return result.receipt?.requestKey===p.requestKey&&result.receipt.action===action&&result.receipt.targetId===target&&(p.action!=='assign'||id(result.result?.id));
}
export function schemaFields(schema){
 if(!schema||schema.schemaVersion!==undefined&&schema.schemaVersion!=='form-schema.v1'||!Array.isArray(schema.fields)||schema.fields.length===0)return null;const seen=new Set();
 for(const f of schema.fields){if(!f||typeof f.key!=='string'||!f.key.trim()||seen.has(f.key)||typeof f.label!=='string'||!['text','number','integer','boolean','select'].includes(f.type)||f.type==='select'&&(!Array.isArray(f.options)||f.options.length===0||f.options.some(v=>typeof v!=='string'&&(!v||typeof v!=='object'||typeof v.value!=='string'||typeof v.label!=='string'))))return null;
  if(f.choices!==undefined&&(!['number','integer'].includes(f.type)||!Array.isArray(f.choices)||!f.choices.length||f.choices.some(c=>!c||!Number.isFinite(c.value)||f.type==='integer'&&!Number.isInteger(c.value)||typeof c.label!=='string'||typeof f.min==='number'&&c.value<f.min||typeof f.max==='number'&&c.value>f.max)||new Set(f.choices.map(c=>c.value)).size!==f.choices.length))return null;
  seen.add(f.key);}
 return schema.fields;
}
export function answerInput(answers,field,value){const next={...answers};if(value===''){delete next[field.key];return next;}next[field.key]=field.type==='boolean'?value==='true':['number','integer'].includes(field.type)?Number(value):value;return next;}
export function fieldErrors(fields,answers){const issues=[];for(const f of fields??[]){const v=answers[f.key];if(f.required&&(v===undefined||v===null||v===''))issues.push({key:f.key,message:f.label+'尚未填写。'});else if(v!==undefined&&v!==null&&v!==''&&['number','integer'].includes(f.type)&&(!Number.isFinite(v)||f.type==='integer'&&!Number.isInteger(v)||typeof f.min==='number'&&v<f.min||typeof f.max==='number'&&v>f.max||Array.isArray(f.choices)&&!f.choices.some(c=>c.value===v)))issues.push({key:f.key,message:f.label+'格式或范围不正确。'});}return issues;}
export function displayAnswer(value,field){
 if(value===undefined||value==='')return '未填写';if(value===null)return '缺失';
 const choice=field?.choices?.find(c=>c.value===value)??field?.options?.find(c=>typeof c==='string'?c===value:c.value===value);
 if(choice!==undefined)return typeof choice==='string'?choice:choice.label;
 return value===false?'否':value===true?'是':typeof value==='object'?JSON.stringify(value):String(value);
}
export function sameValue(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&sameValue(a[k],b[k]));}

export function displayScore(score,fields=[]){
 if(score===null||score===undefined)return '未计分';
 if(score.algorithm==='hamd17-simulation-sum-v1'){
  if(score.simulationOnly!==true||score.classification!==null||score.diagnosis!==null)return '计分结果暂不可核验';
  if(score.processingStatus==='incomplete_data'&&score.scoreComplete===false&&score.total===null){
   const fixedFields=Array.isArray(fields)?fields:[],labels={missing:'未填写',source_code_9:'原件代码9：不能肯定或不适合，不计入总分'};
   const details=(Array.isArray(score.unresolvedItems)?score.unresolvedItems:[]).flatMap(item=>{if(!item||!Object.hasOwn(labels,item.status))return [];const field=fixedFields.find(f=>f.key===item.key);return field?[field.label+'：'+labels[item.status]]:item.status==='source_code_9'?['第14项：'+labels[item.status]]:[];});
   return 'HAMD-17模拟：资料不完整，未计算总分'+(details.length?'；'+details.join('；'):'');
  }
  if(score.processingStatus!=='scored'||score.complete!==true||score.scoreComplete!==true||!Number.isInteger(score.total)||score.total<0)return '计分结果暂不可核验';
  return 'HAMD-17模拟合计：'+score.total;
 }
 if(score.algorithm==='fang-2023-table5-v1'){
  const pendingLabels={awaiting_policy:'待规则确认，未计算总分',incomplete_data:'资料不完整，未计算总分',review_required:'脉象需复核，未计算总分'},pending=Object.hasOwn(pendingLabels,score.processingStatus)?pendingLabels[score.processingStatus]:null;
  if(pending){const labels={missing:'未填写',not_applicable:'不适用',uncertain:'无法判断'},fixedFields=Array.isArray(fields)?fields:[],details=(Array.isArray(score.unresolvedItems)?score.unresolvedItems:[]).flatMap(item=>{if(!item)return [];const field=fixedFields.find(f=>f.key===item.key),label=Object.hasOwn(labels,item.status)?labels[item.status]:null;return field&&label?[field.label+'：'+label]:[];});return pending+(details.length?'；'+details.join('；'):'');}
  if(score.processingStatus!=='scored'||score.complete!==true||score.scoreComplete!==true||!Number.isInteger(score.total)||score.total<0||!['positive','negative'].includes(score.classification)||score.diagnosis!==(score.classification==='positive')||typeof score.thresholdMet!=='boolean'||!score.composition||!['primary','secondary','tongueOrPulse'].every(key=>typeof score.composition[key]==='boolean'))return '计分结果暂不可核验';
  return '总分'+score.total+'；'+(score.thresholdMet?'达到':'未达到')+'20分阈值；'+[['primary','主症组合'],['secondary','次症组合'],['tongueOrPulse','舌/脉类别']].map(([key,label])=>label+'：'+(score.composition[key]?'满足':'未满足')).join('；')+'；本量表判定：'+(score.classification==='positive'?'符合':'不符合');
 }
 if(typeof score==='object'&&!Array.isArray(score)&&typeof score.total==='number'&&Number.isFinite(score.total))return String(score.total);return '计分结果暂不可核验';
}
