import {taskError} from './authorization.mjs';
const invalid=(field,message='任务内容无效，请核对后再提交')=>{
 const error=taskError('STUDY_TASK_INPUT_INVALID',400,message);error.fieldErrors={[field]:message};throw error;
};
const text=(value,field,max,required=true)=>{
 if(typeof value!=='string'||[...value.trim()].length>max||required&&!value.trim())invalid(field);
 return value.trim();
};
export function taskDueAt(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid('dueDate','请选择有效的截止日期');
 const date=new Date(value+'T15:59:59.999Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)invalid('dueDate','截止日期不存在');
 return date.toISOString();
}
const id=(value,field)=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))invalid(field);return value;};
export function parseTaskCommand(action,body,taskId) {
 if(!body||typeof body!=='object'||Array.isArray(body))invalid('form');
 const fields=action==='create'?['requestKey','name','assigneeAccountId','dueDate','priority','collaboratorAccountIds','dependencyTaskIds','context']:
  action==='edit'?['requestKey','expectedVersion','name','dueDate','priority']:
  action==='assign'?['requestKey','expectedVersion','assigneeAccountId','collaboratorAccountIds','dependencyTaskIds']:
  action==='transition'?['requestKey','expectedVersion','status','reason','blockedReason','completionNote','evidenceRefs']:
  action==='review'?['requestKey','expectedVersion','decision','note']:
  action==='remind'?['requestKey','expectedVersion']:
  action==='link'?['requestKey','expectedVersion','context']:null;
 if(!fields||Object.keys(body).some(k=>!fields.includes(k)))invalid('form','包含此操作不允许修改的字段');
 const requestKey=body.requestKey;
 if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))invalid('requestKey');
 const input={};
 if(action!=='create'){
  id(taskId,'taskId');if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)invalid('expectedVersion','请先读取任务的当前版本');
  input.expectedVersion=body.expectedVersion;
 }
 if(action==='remind')return {action,requestKey,taskId,input};
 if(action==='link'){input.context=parseTaskContext(body.context);return {action,requestKey,taskId,input};}
 if(action==='review'){
  if(!['accept','return'].includes(body.decision))invalid('decision');input.decision=body.decision;
  input.note=body.note===undefined?'':text(body.note,'note',1000,false);
  if(input.decision==='return'&&!input.note)invalid('note','退回任务必须说明原因');
  return {action,requestKey,taskId,input};
 }
 if(action==='transition'){
  if(!['in_progress','blocked','completed','cancelled'].includes(body.status))invalid('status');input.status=body.status;
  const reason=body.reason===undefined?undefined:text(body.reason,'reason',2000,false);
  if(body.status==='cancelled'&&!reason)invalid('reason','取消任务须填写原因');
  if(body.status==='blocked')input.blockedReason=text(body.blockedReason,'blockedReason',2000);
  else if(Object.hasOwn(body,'blockedReason'))invalid('blockedReason');
  if(body.status==='completed'){
   input.completionNote=body.completionNote===undefined?'':text(body.completionNote,'completionNote',2000,false);
   const refs=body.evidenceRefs??[];if(!Array.isArray(refs)||refs.length>10)invalid('evidenceRefs');
   input.evidenceRefs=refs.map(parseTaskEvidenceRef);
   if(!input.completionNote&&!refs.length)invalid('completionNote','请填写完成说明或选择有效的固定版本证据');
  }else if(Object.hasOwn(body,'completionNote')||Object.hasOwn(body,'evidenceRefs'))invalid('form','此状态操作不能顺带写完成事实');
  return {action,requestKey,taskId,input,...(reason?{reason}:{})};
 }
 if(action==='assign'){
  input.assigneeAccountId=id(body.assigneeAccountId,'assigneeAccountId');
  for(const field of ['collaboratorAccountIds','dependencyTaskIds']){
   const values=body[field];if(!Array.isArray(values)||values.length>100||new Set(values).size!==values.length)invalid(field);
   input[field]=values.map(value=>id(value,field));
  }
  return {action,requestKey,taskId,input};
 }
 if(action==='create'||Object.hasOwn(body,'name'))input.name=text(body.name,'name',120);
 if(action==='create'||Object.hasOwn(body,'dueDate'))input.dueAt=taskDueAt(body.dueDate);
 if(Object.hasOwn(body,'priority')){if(!['low','normal','high','urgent'].includes(body.priority))invalid('priority');input.priority=body.priority;}
 if(action==='create'){
  if(Object.hasOwn(body,'context'))input.context=parseTaskContext(body.context);
  input.taskType='custom';input.assigneeAccountId=id(body.assigneeAccountId,'assigneeAccountId');input.priority??='normal';
  for(const field of ['collaboratorAccountIds','dependencyTaskIds']){
   const values=body[field]??[];
   if(!Array.isArray(values)||values.length>100||new Set(values).size!==values.length)invalid(field);
   input[field]=values.map(v=>id(v,field));
  }
 }else if(Object.keys(input).length===1)invalid('form','请至少修改一个任务字段');
 return {action,requestKey,...(taskId?{taskId}:{}),input};
}

export function parseTaskContext(value){
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('context');
 if(value.kind==='none'){if(Object.keys(value).length!==1)invalid('context');return {kind:'none'};}
 const keys=['kind','sourceId','parentId','rootId','sourceVersion','sourceHash'];
 if(!['formal_visit','synthetic_crf_record'].includes(value.kind)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k))||!Number.isSafeInteger(value.sourceVersion)||value.sourceVersion<0||typeof value.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceHash))invalid('context');
 for(const key of ['sourceId','parentId','rootId'])id(value[key],'context');
 return Object.fromEntries(keys.map(key=>[key,value[key]]));
}

export function parseTaskEvidenceRef(value){
 const fields=['kind','artifactId','version','contentHash','sourceSnapshotHash'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||value.kind!=='artifact_version'||!Number.isSafeInteger(value.version)||value.version<1||value.version>2147483647||!['contentHash','sourceSnapshotHash'].every(k=>typeof value[k]==='string'&&/^[a-f0-9]{64}$/.test(value[k])))invalid('evidenceRefs','证据必须是当前可读资料的固定版本引用，不接受自由URL或附件地址');
 id(value.artifactId,'evidenceRefs');return {...value};
}
