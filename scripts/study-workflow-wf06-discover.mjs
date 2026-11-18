// Root-only discovery; no fixture creation, batch replay, product mutation or import-time I/O.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {json,save} from './study-workflow-wf01-qa.mjs';
import {requireWF05Window,captureWF05Protection,compareWF05Protection} from './study-workflow-wf05-preserve.mjs';
import {assertWF05PostAdmissionContinuity} from './study-workflow-wf05-post-admission.mjs';
const labelsByMode=Object.freeze({discover:Object.freeze(['MAIN','SELF','H5']),'discover-attention':Object.freeze(['CONCURRENT','RECOVERY','UX01'])}),pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v&&Object.hasOwn(v,k)).map(k=>[k,v[k]]));
const id=v=>assert.match(v??'',/^[A-Za-z0-9_-]{1,160}$/,'CANONICAL_ID_REQUIRED');
export function requireWF06Discovery(env=process.env){assert.equal(env.STUDY_WORKFLOW_WF06_QA_WINDOW,'explicit','ROOT_WF06_IO_WINDOW_REQUIRED');assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','SHARED_HELPER_WINDOW_REQUIRED');requireWF05Window(env);}
export function selectWF06DiscoveryVisits(due,studyId,mode='discover'){
 assert(Object.hasOwn(labelsByMode,mode),'EXPLICIT_DISCOVERY_MODE_REQUIRED');assert.equal(due?.studyId,studyId);assert(Array.isArray(due.items));return labelsByMode[mode].flatMap(label=>{const row=due.items.find(r=>r.visitPlan?.code==='BASELINE'&&new RegExp('^SYNTHETIC-[A-Za-z0-9_-]+-'+label+'$').test(r.subject?.subjectId??''));if(!row)return[];for(const value of [row.visitId,row.subject.id,row.enrollmentId,row.protocolVersionId,row.visitPlan.id])id(value);return[{label,role:mode==='discover'&&label==='SELF'?'reviewer':'admin',row}];});
}
function scoreFlags(response){
 const score=response.score,presence=!Object.hasOwn(response,'score')?'absent':score===null?'null':Array.isArray(score)?'array':typeof score,result={presence};
 if(score&&typeof score==='object'&&!Array.isArray(score)){for(const k of ['processingStatus','scoreComplete','missingRequired'])if(Object.hasOwn(score,k)&&(score[k]===null||['boolean','number','string'].includes(typeof score[k])))result[k]=score[k];result.unresolvedItemsState=!Object.hasOwn(score,'unresolvedItems')?'absent':Array.isArray(score.unresolvedItems)?'array':score.unresolvedItems===null?'null':typeof score.unresolvedItems;if(Array.isArray(score.unresolvedItems))result.unresolvedItemsLength=score.unresolvedItems.length;}return result;
}
export function projectWF06DiscoverySummary(summary,row,studyId){
 assert.equal(summary.studyId,studyId);assert.equal(summary.visitId,row.visitId);const v=summary.visit;assert.equal(v.id,row.visitId);assert.equal(v.subject?.id,row.subject.id);assert.equal(v.subject?.subjectId,row.subject.subjectId);for(const k of ['enrollmentId','protocolVersionId'])assert.equal(v[k],row[k]);assert.equal(v.visitPlan?.id,row.visitPlan.id);assert.equal(v.visitPlan.code,'BASELINE');assert(Array.isArray(summary.items)&&summary.items.length<=100);
 return{studyId,visitId:row.visitId,visitStatus:v.status,subject:pick(v.subject,['id','subjectId']),...pick(v,['enrollmentId','protocolVersionId','version','scheduleState']),visitPlan:pick(v.visitPlan,['id','code','name']),requirements:(v.visitPlan.requirements??[]).map(r=>({...pick(r,['id','kind','name','required']),formVersionId:r.config?.formVersionId})),fulfillments:(v.fulfillments??[]).map(f=>pick(f,['id','visitRequirementId','status'])),visitCapabilities:pick(v.capabilities,['canStart','canAssign','canComplete','canReverify']),summary:pick(summary,['summaryHash','canStartBatch','maxBatchItems']),threeFormItems:summary.items.length===3,items:summary.items.map(item=>({
  ...pick(item,['assignmentId','formVersionId','title','required','mode','action']),unavailable:item.unavailable?pick(item.unavailable,['code']):null,
  response:item.response?{...pick(item.response,['id','status','version','review','locked']),ref:item.response.ref?pick(item.response.ref,['responseId','assignmentId','revisionNo','contentHash']):null,score:scoreFlags(item.response)}:null,
  capabilities:{...pick(item.capabilities,['canSaveDraft','canSubmit','canCorrect','canReview','canLock','canUnlock']),disableReasons:pick(item.capabilities?.disableReasons,['capture','review','correct'])},independentReviewReason:item.capabilities?.disableReasons?.review==='FORM_INDEPENDENT_REVIEW_REQUIRED'?'FORM_INDEPENDENT_REVIEW_REQUIRED':undefined,
 }))};
}
function wf05Accepted(evidence){
 const manifest=json(evidence+'final-manifest.json');assert.equal(manifest.task,'WF05');assert.equal(manifest.status,'complete-local-synthetic');
 const path=p=>p.startsWith('/')?p:new URL('../'+p,import.meta.url).pathname,sha=p=>createHash('sha256').update(readFileSync(path(p))).digest('hex');for(const [p,hash]of Object.entries(manifest.files))assert.equal(sha(p),hash,'ACCEPTED_WF05_SOURCE_CHANGED:'+p);assert.equal(sha(manifest.finalAudit),manifest.finalAuditHash,'ACCEPTED_WF05_FINAL_AUDIT_CHANGED');const audit=json(path(manifest.finalAudit));assert.equal(audit.passed,true);assert(audit.after?.tables);return{old:{...audit.after,phase:'before'},finalAudit:manifest.finalAudit,finalAuditHash:manifest.finalAuditHash};
}
export async function runWF06Discovery({env=process.env,args=process.argv.slice(2)}={}){
 requireWF06Discovery(env);assert(args.length===2&&args[0]==='--local-synthetic'&&['--discover','--discover-attention'].includes(args[1]),'EXACT_DISCOVERY_COMMAND_REQUIRED');const mode=args[1].slice(2),labels=labelsByMode[mode],phase='readonly-discovery';
 const {openWF05Context,wf05Private,wf05Evidence}=await import('./study-workflow-wf05-root-context.mjs'),accepted=wf05Accepted(wf05Evidence),out=wf05Evidence.replace('/wf05/','/wf06/')+'root/'+mode+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'/';let root,capture,before,result,failure;
 try{
  root=await openWF05Context();const [{readProtection,compareProtection},{captureWF04Protection}]=await Promise.all([import('./visit-workflow-preserve.mjs'),import('./study-workflow-wf04-preserve.mjs')]);
  const originalScience=json(wf05Private.replace('/wf05/','/wf04/')+'protection-before-v2.json').science;
  capture=phase=>captureWF05Protection({h:root.h,cases:root.cases,originalScience,readProtection,compareProtection,registeredActors:root.registeredActors,phase,clock:()=>new Date(),dependencies:{captureWF04Protection},env});before=await capture('before');save(out+'before.json',before,{exclusive:true});
  const continuity=assertWF05PostAdmissionContinuity(accepted.old,before);save(out+'cross-period-continuity.json',{phase,mode,...continuity,countMeaning:'all cross-period audit additions, including native auth; not WF06 business writes',finalAudit:accepted.finalAudit,finalAuditHash:accepted.finalAuditHash},{exclusive:true});
  const c=root.cases.A;await root.login('admin');const due=await root.h.get('/research-studies/'+c.studyId+'/due-visits?limit=100'),selected=selectWF06DiscoveryVisits(due,c.studyId,mode),samples=[];
  for(const {label,role,row}of selected){const me=await root.login(role);if(role==='reviewer')assert.equal(me.authVersion,0);const response=await root.h.request('/research-studies/'+c.studyId+'/visits/'+row.visitId+'/workflow',{method:'GET',status:[200,403,404,409]}),httpStatus=root.h.network.at(-1).status;samples.push({label,role,actorId:me.accountId,authVersion:me.authVersion,httpStatus,...(httpStatus===200?projectWF06DiscoverySummary(response.value,row,c.studyId):{visitId:row.visitId,errorCode:response.value?.code})});}
  result={passed:true,phase,mode,readOnly:true,businessWrites:0,runtimePid:root.h.runtime.pid,scope:{tenantId:root.h.runtime.ids.tenant,studyId:c.studyId,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId},dueList:{returned:due.items.length,truncated:due.nextCursor!==null,timeZone:due.timeZone,day:due.day},workflowGetCount:samples.length,missingLabels:labels.filter(label=>!selected.some(s=>s.label===label)),samples,fixturesCreated:false,oldBaselinesReplaced:false};save(out+'discovery.json',result,{exclusive:true});wf05Accepted(wf05Evidence);
 }catch(e){failure=e;}
 finally{if(root){try{await root.close();}catch(e){failure??=e;}if(before&&capture)try{const after=await capture('after');save(out+'after.json',after,{exclusive:true});save(out+'fresh-protection.json',compareWF05Protection(before,after),{exclusive:true});}catch(e){failure??=e;}}}
 save(out+'root-result.json',failure?{passed:false,phase,mode,errorName:failure.name,code:failure.code,oldBaselinesReplaced:false}:{passed:true,phase,mode,readOnly:true,businessWrites:0,workflowGetCount:result.workflowGetCount,oldBaselinesReplaced:false},{exclusive:true});if(failure)throw Object.assign(Error('WF06_DISCOVERY_FAILED'),{name:'WF06DiscoveryError',evidence:out});return{passed:true,phase,mode,evidence:out,workflowGetCount:result.workflowGetCount};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)runWF06Discovery().then(r=>process.stdout.write(JSON.stringify(r)+'\n')).catch(e=>{process.stderr.write(JSON.stringify({passed:false,errorName:e.name,evidence:e.evidence})+'\n');process.exitCode=1;});
