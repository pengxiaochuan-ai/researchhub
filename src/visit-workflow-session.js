import {schemaFields,sameValue} from './formal-capture-session.js';
import {captureModes} from './questionnaire-h5-session.js';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const scoped=(v,s)=>v?.schemaVersion==='visit-workflow-v1'&&v.studyId===s.studyId&&v.visitId===s.visitId;
const fixedRef=(v,assignmentId)=>v?.assignmentId===assignmentId&&id(v.responseId)&&Number.isSafeInteger(v.revisionNo)&&v.revisionNo>0&&digest(v.contentHash);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const projectItems=items=>items.map(v=>({assignmentId:v.assignmentId,expectedVersion:v.initialVersion??v.expectedVersion,expectedRef:v.expectedRef}));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export async function visitReviewInputHash(v){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v))));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function reviewItemEligible(item){const r=item?.response,c=item?.capabilities;return !!r&&r.status==='submitted'&&!r.locked&&fixedRef(r.ref,item.assignmentId)&&integer(r.version)&&!!schemaFields(item.formVersion?.schema)&&((item.action==='review_lock'&&c?.canReview===true)||(item.action==='lock'&&c?.canLock===true&&r.review==='review_approved'));}
export const visitReviewAwaitingIndependent=item=>item?.response?.status==='submitted'&&item.response.locked===false&&item.response.review!=='review_approved'&&item.capabilities?.disableReasons?.review==='FORM_INDEPENDENT_REVIEW_REQUIRED';
export function visitReviewAttention(item,visit){
 if(item.unavailable)return['暂不可核对'];const reasons=[],score=item.response?.score;
 const required=visit?.visitPlan?.requirements?.some(r=>id(r.id)&&r.kind==='form_response'&&r.required===true&&r.config?.formVersionId===item.formVersionId&&visit.fulfillments?.some(f=>f.visitRequirementId===r.id&&['missing','pending','satisfied'].includes(f.status)));
 if(required&&item.response?.status!=='submitted')reasons.push('必采尚未提交');
 if(score&&typeof score==='object'&&!Array.isArray(score)){
  const labels={incomplete_data:'资料待补齐',awaiting_policy:'待规则确认',review_required:'评分依据待复核'},label=Object.hasOwn(labels,score.processingStatus)?labels[score.processingStatus]:score.scoreComplete===false?'评分尚未完成':Number.isSafeInteger(score.missingRequired)&&score.missingRequired>0||Array.isArray(score.unresolvedItems)&&score.unresolvedItems.length?'有待核条目':null;
  if(label)reasons.push(label);
 }return reasons;
}
export function visitReviewRows(summary,filter='all'){
 const rows=summary.items.map(item=>({item,reasons:visitReviewAttention(item,summary.visit)}));
 return filter==='attention'?rows.filter(x=>x.reasons.length):[...rows.filter(x=>x.reasons.length),...rows.filter(x=>!x.reasons.length)];
}
export function visitReviewViewBinding(summary,scope,session,route,url){
 if(!scope||!id(scope.tenantId)||!id(scope.actor)||!integer(scope.authVersion)||session?.verified!==true||session.actor!==scope.actor||session.authVersion!==scope.authVersion||scope.studyId!==route.studyId||scope.visitId!==route.visitId||!scoped(summary,scope)||summary.visit?.id!==route.visitId||!Array.isArray(summary.items))return null;
 let parsed;try{parsed=new URL(url,'http://local.invalid');}catch{return null;}
 if(parsed.pathname.replace(/\/$/,'')!=='/pages/s09'||parsed.searchParams.get('formalCapture')!=='1'||parsed.searchParams.get('studyId')!==route.studyId||parsed.searchParams.get('visitId')!==route.visitId)return null;
 return JSON.stringify(canonical({scope,url,hash:summary.summaryHash,canStartBatch:summary.canStartBatch,requirements:summary.visit.visitPlan?.requirements,fulfillments:summary.visit.fulfillments?.map(f=>({visitRequirementId:f.visitRequirementId,status:f.status})),items:summary.items.map(x=>({assignmentId:x.assignmentId,formVersionId:x.formVersionId,formVersion:x.formVersion,required:x.required,mode:x.mode,action:x.action,capabilities:x.capabilities,unavailable:x.unavailable,response:x.response&&{status:x.response.status,version:x.response.version,ref:x.response.ref,review:x.response.review,locked:x.response.locked,hasScore:Object.hasOwn(x.response,'score'),score:x.response.score}}))}));
}
export function validVisitWorkflowSummary(v,s){return scoped(v,s)&&v.visit?.id===s.visitId&&digest(v.summaryHash)&&v.maxBatchItems===20&&typeof v.canStartBatch==='boolean'&&Array.isArray(v.items)&&v.items.length<=100&&new Set(v.items.map(x=>x.assignmentId)).size===v.items.length&&v.items.every(x=>id(x.assignmentId)&&id(x.formVersionId)&&typeof x.title==='string'&&typeof x.required==='boolean'&&['researcher','patient_h5'].includes(x.mode)&&[null,'review_lock','lock'].includes(x.action)&&x.capabilities&&(x.unavailable?typeof x.unavailable.code==='string'&&typeof x.unavailable.message==='string'&&x.action===null&&!x.response:x.formVersion?.id===x.formVersionId&&!!schemaFields(x.formVersion.schema)&&(!x.response||integer(x.response.version)&&['draft','submitted'].includes(x.response.status)&&(!x.response.ref||fixedRef(x.response.ref,x.assignmentId)))));}
export function visitReviewSelection(summary,ids){if(!summary.canStartBatch||!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length)throw Error('请先逐份核对并选择本次表单。');return ids.map(assignmentId=>{const item=summary.items.find(x=>x.assignmentId===assignmentId);if(!reviewItemEligible(item))throw Error('所选表单当前不能集中处理，请重新核对。');return{assignmentId,expectedVersion:item.response.version,expectedRef:structuredClone(item.response.ref)};});}
export function validVisitReviewBatch(v,s){
 if(!scoped(v,s)||!id(v.batchId)||!digest(v.stateHash)||!['ready','processing','completed','blocked'].includes(v.status)||typeof v.canContinue!=='boolean'||!Array.isArray(v.items)||!v.items.length||v.items.length>20||new Set(v.items.map(x=>x.assignmentId)).size!==v.items.length||!Array.isArray(v.advanceReceipts)||v.advanceReceipts.length>20||!id(v.receipt?.requestKey)||v.receipt.action!=='visit.review.batch.create'||v.receipt.targetId!==s.visitId)return false;
 if(!v.items.every(x=>id(x.assignmentId)&&typeof x.title==='string'&&integer(x.initialVersion)&&fixedRef(x.expectedRef,x.assignmentId)&&['review_lock','lock'].includes(x.action)&&['pending','unknown','completed','blocked'].includes(x.status)&&(x.status!=='completed'||x.result?.locked===true&&integer(x.result.version)&&sameValue(x.result.ref,x.expectedRef))))return false;
 const done=v.items.filter(x=>x.status==='completed').length;if(v.completedCount!==done||v.remainingCount!==v.items.length-done||v.status==='completed'&&done!==v.items.length||v.canContinue&&(!['ready','blocked'].includes(v.status)||v.items.some(x=>x.status==='unknown')||!v.items.some(x=>x.status==='pending')))return false;
 return v.advanceReceipts.every(x=>id(x.requestKey)&&digest(x.expectedStateHash)&&id(x.assignmentId)&&id(x.claimId)&&['unknown','completed','blocked'].includes(x.status)&&x.receipt?.requestKey===x.requestKey&&x.receipt.action==='visit.review.batch.advance'&&x.receipt.targetId===v.batchId);
}
export const visitWorkflowRoot=s=>'/research-studies/'+s.studyId+'/visits/'+s.visitId+'/workflow';
export const visitReviewMarkerKey=s=>'rh-visit-review:'+s.tenantId+':'+s.actor+':'+s.authVersion+':'+s.studyId+':'+s.visitId;
export const visitReviewParentKey=s=>visitReviewMarkerKey(s)+':batch';
export function validVisitReviewMarker(m,s){const keys=['version','tenantId','actor','authVersion','studyId','visitId','action','requestKey','membersHash',...(m?.action==='advance'?['batchId','expectedStateHash','assignmentId']:[])];return exact(m,keys)&&m.version===1&&id(s.tenantId)&&id(s.actor)&&integer(s.authVersion)&&['tenantId','actor','authVersion','studyId','visitId'].every(k=>m[k]===s[k])&&['create','advance'].includes(m.action)&&id(m.requestKey)&&digest(m.membersHash)&&(m.action!=='advance'||id(m.batchId)&&digest(m.expectedStateHash)&&id(m.assignmentId));}
export async function makeVisitReviewMarker(s,action,{requestKey,items,batch}){
 const projection=items??projectItems(batch.items),m={version:1,...s,action,requestKey,membersHash:await visitReviewInputHash(projection)};
 if(action==='advance'){if(!validVisitReviewBatch(batch,s)||!batch.canContinue)throw Error('当前批次不能继续。');m.batchId=batch.batchId;m.expectedStateHash=batch.stateHash;m.assignmentId=batch.items.find(x=>x.status==='pending').assignmentId;}
 if(!validVisitReviewMarker(m,s))throw Error('无法保留当前处理标记。');return m;
}
export function visitReviewRecoveryPath(m){const root=visitWorkflowRoot(m);return m.action==='create'?root+'/batch-receipts/'+m.requestKey:root+'/batches/'+m.batchId;}
async function exactAdvanceProof(batch,m){
 const step=batch.advanceReceipts.find(x=>x.requestKey===m.requestKey&&x.expectedStateHash===m.expectedStateHash&&x.assignmentId===m.assignmentId),member=batch.items.find(x=>x.assignmentId===m.assignmentId);if(!step||!member||step.initialVersion!==member.initialVersion||step.action!==member.action||!sameValue(step.expectedRef,member.expectedRef))return null;
 const commandDigest=await visitReviewInputHash({studyId:m.studyId,visitId:m.visitId,batchId:m.batchId,body:{requestKey:m.requestKey,expectedStateHash:m.expectedStateHash}});if(step.commandDigest!==commandDigest)return null;
 for(const kind of ['review','lock'])if(step.nativeKeys?.[kind]!=='visit-'+kind+'-'+await visitReviewInputHash({requestKey:m.requestKey,assignmentId:m.assignmentId,kind}))return null;
 return{step,member};
}
export async function visitReviewResultProved(batch,m){
 if(!validVisitReviewBatch(batch,m)||await visitReviewInputHash(projectItems(batch.items))!==m.membersHash)return false;
 if(m.action==='create')return batch.receipt.requestKey===m.requestKey;
 if(batch.batchId!==m.batchId)return false;
 const proof=await exactAdvanceProof(batch,m);if(!proof)return false;const{step,member}=proof;
 return step.status==='completed'&&step.executionConfirmed===true&&step.failureConfirmed===false&&step.result?.locked===true&&integer(step.result.version)&&sameValue(step.result.ref,member.expectedRef)&&member.status==='completed'&&sameValue(step.result,member.result);
}
export async function visitReviewBlockedProved(batch,m){
 if(m.action!=='advance'||!validVisitReviewBatch(batch,m)||batch.batchId!==m.batchId||await visitReviewInputHash(projectItems(batch.items))!==m.membersHash)return false;
 const proof=await exactAdvanceProof(batch,m);return !!proof&&proof.step.status==='blocked'&&proof.step.failureConfirmed===true&&proof.step.executionConfirmed===false&&proof.member.status==='blocked';
}
export function validVisitReviewParent(p,s){return exact(p,['version','tenantId','actor','authVersion','studyId','visitId','batchId','membersHash'])&&p.version===1&&id(s.tenantId)&&['tenantId','actor','authVersion','studyId','visitId'].every(k=>p[k]===s[k])&&id(p.batchId)&&digest(p.membersHash);}
export function visitReviewRejectedBeforeAcceptance(error,marker){return error?.status===409&&error.rejectedBeforeAcceptance===true&&(marker?.action==='create'&&['VISIT_WORKFLOW_SUMMARY_CHANGED','VISIT_WORKFLOW_MEMBER_CHANGED'].includes(error.code)||marker?.action==='advance'&&error.code==='VISIT_WORKFLOW_BATCH_CHANGED');}
export function readVisitReviewStorage(storage,scope){
 const rawPending=storage.getItem(visitReviewMarkerKey(scope)),rawParent=storage.getItem(visitReviewParentKey(scope));let pending=null,parent=null;try{if(rawPending)pending=JSON.parse(rawPending);if(rawParent)parent=JSON.parse(rawParent);}catch{throw Error('原处理标记暂不可核对，请保留记录。');}
 if(pending&&!validVisitReviewMarker(pending,scope)||parent&&!validVisitReviewParent(parent,scope))throw Error('原处理标记与当前身份或访视不符，请核对原账号。');return{pending,parent};
}
export function persistVisitReviewMarker(storage,marker){const stored=readVisitReviewStorage(storage,marker).pending;if(stored&&!sameValue(stored,marker))throw Error('另一页面已有待核对操作，请先核对原结果。');storage.setItem(visitReviewMarkerKey(marker),JSON.stringify(marker));if(!sameValue(readVisitReviewStorage(storage,marker).pending,marker))throw Error('另一页面正在处理本次访视，请核对原结果。');}
export function clearVisitReviewMarker(storage,scope,marker){const stored=readVisitReviewStorage(storage,scope).pending;if(!stored||!sameValue(stored,marker))return false;storage.removeItem(visitReviewMarkerKey(scope));return true;}
export async function withVisitReviewLock(locks,name,task,onBusy){if(!locks?.request)return task();return locks.request(name,{mode:'exclusive',ifAvailable:true},lock=>lock?task():onBusy());}
export async function readStoredVisitReview({storage,scope,request,fallbackBatch=null}){
 const{pending,parent:storedParent}=readVisitReviewStorage(storage,scope);let parent=storedParent;
 if(!pending&&!parent&&fallbackBatch){if(!validVisitReviewBatch(fallbackBatch,scope))throw Error('原批次身份无法核对。');parent={batchId:fallbackBatch.batchId,membersHash:await visitReviewInputHash(projectItems(fallbackBatch.items))};}
 if(!pending&&!parent)return{pending:null,parent:null,batch:null};
 const batch=await request(pending?visitReviewRecoveryPath(pending):visitWorkflowRoot(scope)+'/batches/'+parent.batchId);
 if(!validVisitReviewBatch(batch,scope)||await visitReviewInputHash(projectItems(batch.items))!==(pending?.membersHash??parent.membersHash))throw Error('原处理范围无法核对，请保留原记录。');
 return{pending,parent,batch};
}
export async function processVisitReviewBatch(batch,advance,onUpdate=()=>{},isCurrent=()=>true,explicit=false){
 const scope={studyId:batch.studyId,visitId:batch.visitId},original=projectItems(batch.items),actions=batch.items.map(x=>x.action),batchId=batch.batchId,createKey=batch.receipt.requestKey;let value=batch,first=true;
 if(!validVisitReviewBatch(value,scope))throw Error('本次处理记录无法核对。');
 while(isCurrent()&&value.canContinue&&(value.status==='ready'||first&&explicit&&value.status==='blocked')){
  first=false;const previous=value;value=await advance(previous);if(!value)return null;if(!isCurrent())return null;
  if(!validVisitReviewBatch(value,scope)||value.batchId!==batchId||value.receipt.requestKey!==createKey||!sameValue(projectItems(value.items),original)||!sameValue(value.items.map(x=>x.action),actions)||value.stateHash===previous.stateHash||value.completedCount<previous.completedCount)throw Object.assign(Error('本次处理范围或进度已变化，请先核对。'),{unknown:true});
  onUpdate(value);
 }
 return value;
}
export function nextVisitCapture(visit){
 if(!visit||visit.status==='completed'||visit.status==='cancelled')return{kind:'review'};
 for(const r of visit.visitPlan?.requirements??[]){if(!r.required)continue;const fulfillment=visit.fulfillments?.find(f=>f.visitRequirementId===r.id);if(['waived','not_applicable'].includes(fulfillment?.status))continue;
  if(r.kind!=='form_response'){if(fulfillment?.status!=='satisfied')return{kind:'requirement',requirementId:r.id};continue;}
  const assignment=visit.assignments?.find(a=>a.formVersionId===r.config?.formVersionId);
  if(assignment){if(assignment.response?.status==='submitted')continue;return assignment.mode==='researcher'?{kind:'open',assignmentId:assignment.id,requirementId:r.id}:{kind:'requirement',requirementId:r.id};}
  const modes=captureModes(r.config);if(visit.capabilities?.canAssign&&modes.length===1&&modes[0]==='researcher'&&id(r.config?.formVersionId))return{kind:'assign',requirementId:r.id,formVersionId:r.config.formVersionId};
  return{kind:'requirement',requirementId:r.id};
 }
 return{kind:'review'};
}
