// Identity branding only; no source data or cached values survive callbacks.
const visitViews=new WeakSet();
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const enrollmentFields=['id','subjectId','protocolVersionId','status'];
const readMethods=new Set(['findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','findMany','count','aggregate','groupBy']);
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const selected=(s,keys)=>exact(s,keys)&&keys.every(k=>s[k]===true);
const text=x=>typeof x==='string'&&x.length>0;

// Frozen original native SQL tuples, not a general SELECT parser. SQL and locks
// always execute; only these exact same-scope read templates preserve scalar memo.
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
const tenantLock=['SELECT pg_advisory_xact_lock(hashtextextended(', ',0))'];
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function preservesRaw(method,args,s,f){
 const strings=args[0];
 if(!['$queryRaw','$executeRaw'].includes(method)||!Array.isArray(strings)||!Object.isFrozen(strings)||!Array.isArray(strings.raw)||!Object.isFrozen(strings.raw)||strings.length!==args.length||strings.raw.length!==strings.length||!strings.every((x,i)=>typeof x==='string'&&strings.raw[i]===x))return false;
 const sameTuple=parts=>parts.length===strings.length&&parts.every((x,i)=>strings[i]===x),v=args.slice(1),same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]),scope=[s.tenantId,s.studyGroupId,s.researchProjectId];
 if(method==='$executeRaw')return sameTuple(tenantLock)&&same(v,['wp01:tenant:'+s.tenantId]);
 const type=rawTemplates.find(([,parts])=>sameTuple(parts))?.[0];
 switch(type){
  case'project':return same(v,[s.researchProjectId,s.tenantId,s.studyGroupId]);
  case'protocol':return same(v.slice(0,3),scope)&&Array.isArray(v[3])&&Object.getPrototypeOf(v[3])===Array.prototype&&v[3].length===1&&v[3][0]===f.protocolVersionId;
  case'subject':return same(v,[f.subjectId,...scope]);
  case'enrollment':return same(v,[f.enrollmentId,...scope]);
  case'visit':return same(v,[f.visitId,...scope]);
  case'consent':return same(v.slice(0,5),[...scope,f.subjectId,f.protocolVersionId])&&identifier(v[5]);
  case'current':return identifier(v[0])&&same(v.slice(1),scope);
  case'reviews':return same(v.slice(0,3),scope)&&identifier(v[3])&&identifier(v[4]);
  case'policy':return same(v.slice(0,4),[f.protocolVersionId,...scope])&&identifier(v[4])&&same(v.slice(5,8),scope)&&digest(v[8]);
  case'revision':return same(v.slice(0,3),scope)&&identifier(v[3])&&identifier(v[4])&&Number.isSafeInteger(v[5])&&v[5]>0&&digest(v[6]);
  default:return false;
 }
}

/** Only call after the real native parent lock and current consent check.
 * One visit callback, on the same physical transaction. No pre-read seeds,
 * pending-promise sharing, raw SQL caching or result/authority shortcuts. */
export async function withFullStudyVisitReads(tx,scope,binding,callback){
 if(visitViews.has(tx))throw Error('FULL_STUDY_VISIT_READS_NESTED');
 if(!tx||typeof tx!=='object'||typeof callback!=='function'||!scopeKeys.every(k=>identifier(scope?.[k]))||!['subjectId','enrollmentId','visitId','visitPlanId','protocolVersionId'].every(k=>identifier(binding?.[k])))throw Error('FULL_STUDY_VISIT_READS_SCOPE_REQUIRED');
 const s=Object.fromEntries(scopeKeys.map(k=>[k,scope[k]])),fixed=Object.fromEntries(['subjectId','enrollmentId','visitId','visitPlanId','protocolVersionId'].map(k=>[k,binding[k]])),memo=new Map(),delegates=new Map();
 let active=true,epoch=0,writers=0;
 const assertActive=()=>{if(!active)throw Error('FULL_STUDY_VISIT_READS_EXPIRED');};
 const clear=()=>{epoch++;memo.clear();};
 async function invoke(fn,target,args,invalidates=false){
  assertActive();if(invalidates){clear();writers++;}
  try{const value=await fn.apply(target,args);assertActive();return value;}
  finally{if(invalidates){writers--;clear();}}
 }
 function shape(model,args){
  if(args.length!==1||!exact(args[0],['where','select']))return null;
  const {where:w,select}=args[0];if(!plain(w)||!scopeKeys.every(k=>w[k]===s[k]))return null;
  if(model==='studyEnrollment'&&w.id===fixed.enrollmentId&&w.acceptanceFixture===false){
   const e1=exact(w,[...scopeKeys,'id','acceptanceFixture']),e2=exact(w,[...scopeKeys,'id','subjectId','acceptanceFixture'])&&w.subjectId===fixed.subjectId;
   if(e1&&selected(select,enrollmentFields))return'E1';
   if(e2&&selected(select,enrollmentFields))return'E2';
   if(e2&&selected(select,['protocolVersionId']))return'E3';
  }
  if(model==='subjectVisit'&&w.id===fixed.visitId){
   if(exact(w,[...scopeKeys,'id'])&&selected(select,['status','scheduleState']))return'V1';
   if(exact(w,[...scopeKeys,'id','acceptanceFixture'])&&w.acceptanceFixture===false&&selected(select,['visitPlanId']))return'V2';
  }
  return null;
 }
 function successful(type,row){
  if(type==='E1'||type==='E2')return exact(row,enrollmentFields)&&row.id===fixed.enrollmentId&&row.subjectId===fixed.subjectId&&row.protocolVersionId===fixed.protocolVersionId&&text(row.status);
  if(type==='E3')return exact(row,['protocolVersionId'])&&row.protocolVersionId===fixed.protocolVersionId;
  if(type==='V1')return exact(row,['status','scheduleState'])&&text(row.status)&&text(row.scheduleState);
  return type==='V2'&&exact(row,['visitPlanId'])&&row.visitPlanId===fixed.visitPlanId;
 }
 const view=new Proxy(tx,{get(target,key){
  assertActive();const value=Reflect.get(target,key,target);
  if(typeof value==='function')return(...args)=>{assertActive();return invoke(value,target,args,!preservesRaw(key,args,s,fixed));};
  if(!value||typeof value!=='object')return value;
  if(!delegates.has(key))delegates.set(key,new Proxy(value,{get(model,method){
   assertActive();const fn=Reflect.get(model,method,model);if(typeof fn!=='function')return fn;
   if(method!=='findFirst')return(...args)=>invoke(fn,model,args,!readMethods.has(method));
   return async(...args)=>{
    assertActive();const type=shape(key,args);if(!type)return invoke(fn,model,args);
    const query=structuredClone(args[0]),identity=type;
    if(!writers&&memo.has(identity))return structuredClone(memo.get(identity));
    const started=epoch,result=await invoke(fn,model,[query]);
    if(!successful(type,result))return result;
    const witness=structuredClone(result);if(!writers&&epoch===started)memo.set(identity,witness);
    return structuredClone(witness);
   };
  }}));
  return delegates.get(key);
 }});
 visitViews.add(view);
 try{return await callback(view);}finally{active=false;clear();}
}
