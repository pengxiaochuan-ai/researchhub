// Project callback only. Original native functions still perform every rule check.
const views=new WeakSet();
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const selected=(x,keys)=>exact(x,keys)&&keys.every(k=>x[k]===true);
const text=x=>typeof x==='string'&&x.length>0;
const readMethods=new Set(['findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','findMany','count','aggregate','groupBy']);
const enrollmentFields=['id','subjectId','protocolVersionId','status'];
const visitFields=['id','subjectId','enrollmentId','protocolVersionId','status'];
const eventFields=['kind','decision','method','evidence','reason','signer','textVersion','scope'];
const bulk=['SELECT id FROM public.subject WHERE "tenantId"=',' AND "studyGroupId"=',' AND "researchProjectId"=',' AND id=ANY(','::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE'];
const rawTemplates=[
 [
  "project",
  [
   "SELECT id FROM public.research_project WHERE id=",
   " AND \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " FOR SHARE"
  ]
 ],
 [
  "protocol",
  [
   "SELECT id FROM public.study_protocol_version WHERE \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " AND id=ANY(",
   "::text[]) ORDER BY id FOR SHARE"
  ]
 ],
 [
  "subject",
  [
   "SELECT id FROM public.subject WHERE id=",
   " AND \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " AND \"deletedAt\" IS NULL FOR UPDATE"
  ]
 ],
 [
  "enrollment",
  [
   "SELECT id,\"subjectId\",\"protocolVersionId\",status FROM public.study_enrollment WHERE id=",
   " AND \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " FOR UPDATE"
  ]
 ],
 [
  "visit",
  [
   "SELECT id,\"subjectId\",\"enrollmentId\",\"protocolVersionId\",status FROM public.subject_visit WHERE id=",
   " AND \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " FOR UPDATE"
  ]
 ],
 [
  "consent",
  [
   "SELECT kind,decision,method,evidence,reason,signer,\"textVersion\",scope FROM public.study_participation_event WHERE \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " AND \"subjectId\"=",
   " AND \"protocolVersionId\"=",
   " AND \"policyVersionId\"=",
   " ORDER BY sequence"
  ]
 ],
 [
  "current",
  [
   "SELECT r.id,r.status,r.version,r.\"currentRevisionId\",r.\"lockedRevisionId\",r.answers,r.score,rev.\"revisionNo\",rev.\"contentHash\",rev.\"actorKind\",rev.\"actorId\",ep.sections FROM public.form_response r LEFT JOIN public.form_response_revision rev ON rev.id=r.\"currentRevisionId\" AND rev.\"responseId\"=r.id LEFT JOIN public.study_execution_policy_version ep ON ep.id=rev.\"policyVersionId\" AND ep.\"contentHash\"=rev.\"policyHash\" WHERE r.\"assignmentId\"=",
   " AND r.\"tenantId\"=",
   " AND r.\"studyGroupId\"=",
   " AND r.\"researchProjectId\"=",
   ""
  ]
 ],
 [
  "reviews",
  [
   "SELECT action FROM public.form_response_review_event WHERE \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " AND \"responseId\"=",
   " AND \"revisionId\"=",
   " AND action IN ('review_approved','review_returned') ORDER BY id DESC LIMIT 1"
  ]
 ],
 [
  "policy",
  [
   "SELECT ep.id FROM public.study_execution_policy_version ep JOIN public.study_protocol_version p ON p.id=ep.\"protocolVersionId\" WHERE p.id=",
   " AND p.\"tenantId\"=",
   " AND p.\"studyGroupId\"=",
   " AND p.\"researchProjectId\"=",
   " AND p.status IN ('executing','superseded') AND ep.id=",
   " AND ep.\"tenantId\"=",
   " AND ep.\"studyGroupId\"=",
   " AND ep.\"researchProjectId\"=",
   " AND ep.status='approved' AND ep.\"contentHash\"=",
   " AND p.\"approvedPolicyVersionId\"=ep.id AND p.\"approvedPolicyHash\"=ep.\"contentHash\""
  ]
 ],
 [
  "revision",
  [
   "SELECT * FROM public.form_response_revision WHERE \"tenantId\"=",
   " AND \"studyGroupId\"=",
   " AND \"researchProjectId\"=",
   " AND \"assignmentId\"=",
   " AND \"responseId\"=",
   " AND \"revisionNo\"=",
   " AND \"contentHash\"=",
   ""
  ]
 ]
];
// Native visit integrity queries always run; no source/file/review result cache.
rawTemplates.push(...[
 [
  "integrityFile",
  [
   "SELECT id FROM public.modality_file WHERE \"tenantId\"=",
   " AND id=",
   " FOR SHARE"
  ]
 ],
 [
  "integrityResponse",
  [
   "SELECT r.id FROM public.form_response r JOIN public.form_response_revision rev ON rev.id=r.\"currentRevisionId\" AND rev.\"responseId\"=r.id JOIN public.form_assignment a ON a.id=r.\"assignmentId\" WHERE r.id=",
   " AND a.id=",
   " AND a.\"tenantId\"=",
   " AND a.\"studyGroupId\"=",
   " AND a.\"researchProjectId\"=",
   " AND a.\"subjectVisitId\"=",
   " AND rev.\"revisionNo\"=",
   " AND rev.\"contentHash\"=",
   " AND r.version=",
   " AND r.\"lockedRevisionId\"=rev.id AND (SELECT ev.action FROM public.form_response_review_event ev WHERE ev.\"responseId\"=r.id AND ev.\"revisionId\"=rev.id AND ev.action IN ('review_approved','review_returned') ORDER BY ev.id DESC LIMIT 1)='review_approved'"
  ]
 ]
]);
rawTemplates.push([
 "requiredFormRevision",
 [
  "SELECT r.version AS \"responseVersion\", (SELECT ev.action FROM public.form_response_review_event ev WHERE ev.\"tenantId\"=",
  " AND ev.\"studyGroupId\"=",
  " AND ev.\"researchProjectId\"=",
  " AND ev.\"responseId\"=r.id AND ev.\"revisionId\"=rev.id AND ev.action IN ('review_approved','review_returned') ORDER BY ev.id DESC LIMIT 1) AS \"reviewAction\" FROM public.form_response r JOIN public.form_response_revision rev ON rev.id=r.\"currentRevisionId\" AND rev.\"responseId\"=r.id JOIN public.form_assignment a ON a.id=r.\"assignmentId\" WHERE r.id=",
  " AND a.id=",
  " AND rev.\"revisionNo\"=",
  " AND rev.\"contentHash\"=",
  " AND r.status='submitted' AND r.\"lockedRevisionId\"=rev.id AND a.\"tenantId\"=",
  " AND a.\"studyGroupId\"=",
  " AND a.\"researchProjectId\"=",
  " AND a.\"subjectId\"=",
  " AND a.\"enrollmentId\"=",
  " AND a.\"subjectVisitId\"=",
  " AND a.\"formVersionId\"=",
  " AND rev.\"protocolVersionId\"=",
  ""
 ]
]);
const tenantLock=['SELECT pg_advisory_xact_lock(hashtextextended(', ',0))'];
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function template(method,args){
 const t=args[0];
 if(!['$queryRaw','$executeRaw'].includes(method)||!Array.isArray(t)||!Object.isFrozen(t)||!Array.isArray(t.raw)||!Object.isFrozen(t.raw)||t.length!==args.length||t.raw.length!==t.length||!t.every((x,i)=>typeof x==='string'&&t.raw[i]===x))return null;
 const matches=p=>same(t,p);
 if(method==='$executeRaw')return matches(tenantLock)?'tenant':null;
 if(matches(bulk))return'bulk';
 return rawTemplates.find(([,p])=>matches(p))?.[0]??null;
}
/** Install immediately after real validateCase/P lock, on the same physical tx.
 * No source values may be supplied as seeds. All original checks still run.
 * Every operation in this callback must use the returned view. */
export async function withFullStudyLockedMetadataReads(tx,scope,c,callback){
 if(views.has(tx))throw Error('FULL_STUDY_LOCKED_METADATA_NESTED');
 if(!tx||typeof tx.$queryRaw!=='function'||typeof callback!=='function'||!scopeKeys.every(k=>identifier(scope?.[k])&&c?.scope?.[k]===scope[k])||!identifier(c.protocolVersionId)||!identifier(c.policyId)||!digest(c.policyHash)||!Array.isArray(c.subjects)||!c.subjects.length||!c.subjects.every(x=>identifier(x.id))||new Set(c.subjects.map(x=>x.id)).size!==c.subjects.length||!Array.isArray(c.visitPlans)||!c.visitPlans.every(x=>identifier(x.id)))throw Error('FULL_STUDY_LOCKED_METADATA_SCOPE_REQUIRED');
 const s=Object.fromEntries(scopeKeys.map(k=>[k,scope[k]])),sv=scopeKeys.map(k=>s[k]),P=c.protocolVersionId,policyId=c.policyId,policyHash=c.policyHash,subjectIds=c.subjects.map(x=>x.id).sort(),subjects=new Set(subjectIds),plans=new Set(c.visitPlans.map(x=>x.id));
 const lockedSubjects=new Set(),enrollments=new Map(),visits=new Map(),memo=new Map(),delegates=new Map();
 let active=true,epoch=0,writers=0,protocolProtected=true;
 const check=()=>{if(!active)throw Error('FULL_STUDY_LOCKED_METADATA_EXPIRED');};
 const clear=()=>{epoch++;protocolProtected=false;lockedSubjects.clear();enrollments.clear();visits.clear();memo.clear();};
 const key=(type,id)=>type+':'+id;
 const one=(rows,fields)=>Array.isArray(rows)&&rows.length===1&&exact(rows[0],fields);
 function rawType(method,args){
  const type=template(method,args),v=args.slice(1),scopeAt=i=>same(v.slice(i,i+3),sv);
  switch(type){
   case'tenant':return same(v,['wp01:tenant:'+s.tenantId])?type:null;
   case'project':return same(v,[s.researchProjectId,s.tenantId,s.studyGroupId])?type:null;
   case'protocol':return v.length===4&&scopeAt(0)&&Array.isArray(v[3])&&Object.getPrototypeOf(v[3])===Array.prototype&&same(v[3],[P])?type:null;
   case'bulk':return v.length===4&&scopeAt(0)&&Array.isArray(v[3])&&Object.getPrototypeOf(v[3])===Array.prototype&&same(v[3],subjectIds)?type:null;
   case'subject':return v.length===4&&scopeAt(1)&&subjects.has(v[0])?type:null;
   case'enrollment':case'visit':return v.length===4&&scopeAt(1)&&identifier(v[0])?type:null;
   case'consent':return v.length===6&&scopeAt(0)&&subjects.has(v[3])&&v[4]===P&&v[5]===policyId?type:null;
   case'policy':return same(v,[P,...sv,policyId,...sv,policyHash])?type:null;
   case'requiredFormRevision':{
    const e=enrollments.get(v[11]),visit=visits.get(v[12]);
    return v.length===15&&scopeAt(0)&&identifier(v[3])&&identifier(v[4])&&Number.isSafeInteger(v[5])&&v[5]>0&&digest(v[6])&&scopeAt(7)&&lockedSubjects.has(v[10])&&e?.subjectId===v[10]&&e.protocolVersionId===P&&visit?.subjectId===v[10]&&visit.enrollmentId===v[11]&&visit.protocolVersionId===P&&identifier(v[13])&&v[14]===P?type:null;
   }
   case'integrityFile':return v.length===2&&v[0]===s.tenantId&&identifier(v[1])?type:null;
   case'integrityResponse':return v.length===9&&identifier(v[0])&&identifier(v[1])&&scopeAt(2)&&identifier(v[5])&&Number.isSafeInteger(v[6])&&v[6]>0&&digest(v[7])&&Number.isSafeInteger(v[8])&&v[8]>0?type:null;
   case'current':return v.length===4&&identifier(v[0])&&scopeAt(1)?type:null;
   case'reviews':return v.length===5&&scopeAt(0)&&identifier(v[3])&&identifier(v[4])?type:null;
   case'revision':return v.length===7&&scopeAt(0)&&identifier(v[3])&&identifier(v[4])&&Number.isSafeInteger(v[5])&&v[5]>0&&digest(v[6])?type:null;
   default:return null;
  }
 }
 function cachedRaw(type,v){
  if(!protocolProtected||writers)return null;
  if(type==='enrollment'&&enrollments.has(v[0]))return key(type,v[0]);
  if(type==='visit'&&visits.has(v[0]))return key(type,v[0]);
  if(type==='consent'&&lockedSubjects.has(v[3]))return key(type,v[3]);
  if(type==='policy')return key(type,policyId);
  return null;
 }
 function observeRaw(type,v,result){
  if(type==='protocol'){if(one(result,['id'])&&result[0].id===P)protocolProtected=true;return;}
  if(!protocolProtected)return;
  if(type==='bulk'&&Array.isArray(result)&&result.length===subjectIds.length&&result.every(x=>exact(x,['id'])&&subjects.has(x.id))&&new Set(result.map(x=>x.id)).size===subjectIds.length){for(const id of subjectIds)lockedSubjects.add(id);return;}
  if(type==='subject'&&one(result,['id'])&&result[0].id===v[0]){lockedSubjects.add(v[0]);return;}
  if(type==='enrollment'&&one(result,enrollmentFields)){
   const e=result[0];if(e.id===v[0]&&lockedSubjects.has(e.subjectId)&&e.protocolVersionId===P&&text(e.status)){enrollments.set(e.id,structuredClone(e));memo.set(key(type,e.id),structuredClone(result));}return;
  }
  if(type==='visit'&&one(result,visitFields)){
   const row=result[0],e=enrollments.get(row.enrollmentId);if(row.id===v[0]&&e&&row.subjectId===e.subjectId&&row.protocolVersionId===P&&lockedSubjects.has(row.subjectId)&&text(row.status)){visits.set(row.id,structuredClone(row));memo.set(key(type,row.id),structuredClone(result));}return;
  }
  if(type==='consent'&&lockedSubjects.has(v[3])&&Array.isArray(result)&&result.length>0&&result.every(row=>exact(row,eventFields)&&text(row.kind)&&text(row.decision)&&eventFields.slice(2).every(k=>row[k]===null||typeof row[k]==='string'))){memo.set(key(type,v[3]),structuredClone(result));return;}
  if(type==='policy'&&one(result,['id'])&&result[0].id===policyId)memo.set(key(type,policyId),structuredClone(result));
 }
 async function invoke(fn,target,args,invalidates=false){
  check();if(invalidates){clear();writers++;}
  try{const result=await fn.apply(target,args);check();return result;}
  finally{if(invalidates){writers--;clear();}}
 }
 function scalar(model,args){
  if(!protocolProtected||writers||args.length!==1||!exact(args[0],['where','select']))return null;
  const{where:w,select}=args[0];if(!plain(w)||!scopeKeys.every(k=>w[k]===s[k]))return null;
  if(model==='studyEnrollment'){
   const e=enrollments.get(w.id);if(!e||!lockedSubjects.has(e.subjectId)||w.acceptanceFixture!==false)return null;
   const e1=exact(w,[...scopeKeys,'id','acceptanceFixture']),e2=exact(w,[...scopeKeys,'id','subjectId','acceptanceFixture'])&&w.subjectId===e.subjectId;
   if((e1||e2)&&selected(select,enrollmentFields))return{type:e1?'E1':'E2',id:e.id,valid:r=>exact(r,enrollmentFields)&&r.id===e.id&&r.subjectId===e.subjectId&&r.protocolVersionId===P&&text(r.status)};
   if(e2&&selected(select,['protocolVersionId']))return{type:'E3',id:e.id,valid:r=>exact(r,['protocolVersionId'])&&r.protocolVersionId===P};
  }
  if(model==='subjectVisit'){
   const v=visits.get(w.id);if(!v||!lockedSubjects.has(v.subjectId))return null;
   if(exact(w,[...scopeKeys,'id'])&&selected(select,['status','scheduleState']))return{type:'V1',id:v.id,valid:r=>exact(r,['status','scheduleState'])&&text(r.status)&&text(r.scheduleState)};
   if(exact(w,[...scopeKeys,'id','acceptanceFixture'])&&w.acceptanceFixture===false&&selected(select,['visitPlanId']))return{type:'V2',id:v.id,valid:r=>exact(r,['visitPlanId'])&&plans.has(r.visitPlanId)};
  }
  if(model==='studyProtocolVersion'&&exact(w,[...scopeKeys,'id','acceptanceFixture','status'])&&w.id===P&&w.acceptanceFixture===false&&exact(w.status,['in'])&&Array.isArray(w.status.in)&&same(w.status.in,['executing','superseded'])&&selected(select,['id']))return{type:'P',id:P,valid:r=>exact(r,['id'])&&r.id===P};
  return null;
 }
 const view=new Proxy(tx,{get(target,method){
  check();const fn=Reflect.get(target,method,target);
  if(typeof fn==='function')return async(...args)=>{
   check();const type=rawType(method,args);
   if(!type)return invoke(fn,target,args,true);
   const v=args.slice(1),identity=cachedRaw(type,v);if(identity&&memo.has(identity))return structuredClone(memo.get(identity));
   const start=epoch,result=await invoke(fn,target,args);
   if(!writers&&start===epoch)observeRaw(type,v,result);
   // A late read must return its own database result, never a newer epoch's value.
   return !writers&&start===epoch&&cachedRaw(type,v)&&memo.has(cachedRaw(type,v))?structuredClone(result):result;
  };
  if(!fn||typeof fn!=='object')return fn;
  if(!delegates.has(method))delegates.set(method,new Proxy(fn,{get(model,op){
   check();const f=Reflect.get(model,op,model);if(typeof f!=='function')return f;
   if(op!=='findFirst')return(...args)=>invoke(f,model,args,!readMethods.has(op));
   return async(...args)=>{
    check();const item=scalar(method,args);if(!item)return invoke(f,model,args);
    const identity=key(item.type,item.id);if(memo.has(identity))return structuredClone(memo.get(identity));
    const start=epoch,result=await invoke(f,model,[structuredClone(args[0])]);
    if(!item.valid(result))return result;
    const copy=structuredClone(result);if(!writers&&start===epoch&&protocolProtected)memo.set(identity,copy);
    return structuredClone(copy);
   };
  }}));
  return delegates.get(method);
 }});
 views.add(view);
 try{return await callback(view);}finally{active=false;clear();}
}
