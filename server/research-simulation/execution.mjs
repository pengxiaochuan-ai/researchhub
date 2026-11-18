import {researchError,requestHash,only,validateMutation} from '../research-studies/contract.mjs';
import {presentProtocol} from '../research-execution/protocols.mjs';
import {ARMS,ARM_VISITS,STAGES,DAYS,hasSimulationPolicy} from './policy.mjs';
const fail=(code,message='模拟执行条件尚未满足，请核对当前阶段与研究配置。')=>{throw researchError(409,code,message);};
const action='researchhub.simulation.advance';
const sameScope=(a,b)=>['tenantId','studyGroupId','researchProjectId'].every(key=>a?.[key]===b?.[key]);
const day=(base,n)=>new Date(new Date(base).getTime()+n*86400000);
const scoped=s=>({tenantId:s.tenantId,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId});
function checkCase(c,s){
 if(c.schemaVersion!=='full-study-simulation-case-v1'||!sameScope(c.scope,s)||!c.caseId||!c.studyId||!c.protocolVersionId||!c.protocolHash||!c.policyId||!c.policyHash||typeof c.baseDate!=='string'||!Number.isFinite(new Date(c.baseDate).getTime())||new Date(c.baseDate).toISOString()!==c.baseDate)fail('SIMULATION_CASE_INVALID');
 if(!Array.isArray(c.subjects)||c.subjects.length!==6||new Set(c.subjects.map(x=>x.id)).size!==6||ARMS.some(arm=>c.subjects.filter(x=>x.armCode===arm).length!==2))fail('SIMULATION_CASE_INVALID');
 if(!Array.isArray(c.visitPlans)||c.visitPlans.length!==5||new Set(c.visitPlans.map(p=>p.id)).size!==5)fail('SIMULATION_CASE_INVALID');
 for(const code of ['V1_PATIENT','V1_HEALTHY','V2','V3','V4']){
  const p=c.visitPlans.find(p=>p.code===code),arms=ARMS.filter(arm=>ARM_VISITS[arm].includes(code));
  if(!p||p.logicalVisit!==(code.startsWith('V1')?'V1':code)||requestHash([...(p.armCodes??[])].sort())!==requestHash(arms.sort()))fail('SIMULATION_CASE_INVALID');
 }
 if(!Array.isArray(c.forms)||!c.forms.length||c.forms.some(x=>!x.id||!x.schemaHash||!x.scoringHash))fail('SIMULATION_CASE_INVALID');
}
/** All methods receive the caller's existing authorized transaction; none starts one. */
export function createResearchSimulation({resolveCase,resolveApprovedPlan,authorizeAdvance,lockAuthorization,completionIntegrity,protocolHash=p=>presentProtocol(p).revision}){
 if(typeof resolveCase!=='function'||typeof lockAuthorization!=='function')throw Error('SIMULATION_DEPENDENCIES_REQUIRED');
 async function lock(tx,s){await lockAuthorization(tx,s.tenantId);const rows=await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${s.researchProjectId} AND "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} FOR UPDATE`;if(!rows[0])fail('SIMULATION_SCOPE_UNAVAILABLE');}
 async function current(tx,s){
  const c=await resolveCase(tx,scoped(s));
  const p=await tx.studyProtocolVersion.findFirst({where:{...scoped(s),acceptanceFixture:false,...(c?{id:c.protocolVersionId}:{status:'executing'})},include:{approvedPolicyVersion:true,visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}}});
  if(!c)return hasSimulationPolicy(p?.approvedPolicyVersion?.sections)?{enabled:true,ready:false,status:'not_ready',reason:'SIMULATION_CASE_UNREGISTERED'}:null;
  checkCase(c,s);
  const notReady=reason=>({enabled:true,ready:false,status:'not_ready',reason,caseId:c.caseId,studyId:c.studyId});
  const policy=p?.approvedPolicyVersion;
  if(!p||p.status!=='executing'||protocolHash(p)!==c.protocolHash||policy?.id!==c.policyId||policy.status!=='approved'||policy.contentHash!==c.policyHash||p.approvedPolicyVersionId!==policy.id||p.approvedPolicyHash!==policy.contentHash||requestHash(policy.sections)!==policy.contentHash)return notReady('SIMULATION_APPROVED_POLICY_REQUIRED');
  if(policy.sections.populationSchedule?.status!=='configured'||requestHash(policy.sections.populationSchedule.rules)!==requestHash({schemaVersion:'population-schedule-v1',armVisitCodes:ARM_VISITS})||policy.sections.simulation?.status!=='configured'||requestHash(policy.sections.simulation.rules)!==requestHash({schemaVersion:'study-simulation-clock-v1',stageDays:DAYS,timezone:'Asia/Shanghai'}))return notReady('SIMULATION_POLICY_MISMATCH');
  if(p.visitPlans.length!==5||p.visitPlans.some(v=>!c.visitPlans.some(q=>q.id===v.id&&q.code===v.code)||v.anchor!=='enrollment'||v.targetDayOffset!==DAYS[STAGES.indexOf(c.visitPlans.find(q=>q.id===v.id)?.logicalVisit)]||![v.windowBeforeDays,v.windowAfterDays].every(x=>Number.isSafeInteger(x)&&x>=0)))return notReady('SIMULATION_VISIT_PLAN_MISMATCH');
  let plan;try{plan=resolveApprovedPlan?await resolveApprovedPlan(tx,scoped(s),{studyId:c.studyId,protocolVersionId:c.protocolVersionId}):c.approvedPlan;}
  catch(error){if(error?.code==='FULL_STUDY_PLAN_NOT_APPROVED')return notReady('SIMULATION_APPROVED_PLAN_REQUIRED');throw error;}
  if(!plan||plan.status!=='approved'||plan.version!=='full-study-simulation-v2'||!plan.id||!plan.contentHash||plan.protocolVersionId&&plan.protocolVersionId!==c.protocolVersionId)return notReady('SIMULATION_APPROVED_PLAN_REQUIRED');
  const forms=await tx.formVersion.findMany({where:{...scoped(s),id:{in:c.forms.map(x=>x.id)},status:{in:['published','locked']}},select:{id:true,schema:true,scoring:true}});
  if(forms.length!==c.forms.length||c.forms.some(f=>{const row=forms.find(x=>x.id===f.id);return !row||requestHash(row.schema)!==f.schemaHash||requestHash(row.scoring??null)!==f.scoringHash;}))return notReady('SIMULATION_SOURCE_PROFILE_CHANGED');
  const events=await tx.auditLog.findMany({where:{...scoped(s),action,target:c.caseId},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  let stageIndex=0;
  events.sort((a,b)=>(a.meta?.fromStage??-1)-(b.meta?.fromStage??-1));
  for(const event of events){const m=event.meta;if(m?.caseId!==c.caseId||m.fromStage!==stageIndex||m.toStage!==stageIndex+1||m.toStage>3||m.protocolHash!==c.protocolHash||m.policyHash!==c.policyHash)fail('SIMULATION_CLOCK_INTEGRITY_INVALID');if(m.planHash!==plan.contentHash)return notReady('SIMULATION_APPROVED_PLAN_CHANGED');stageIndex=m.toStage;}
  return {enabled:true,ready:true,status:'ready',caseId:c.caseId,studyId:c.studyId,stageIndex,stage:STAGES[stageIndex],day:DAYS[stageIndex],logicalDate:day(c.baseDate,DAYS[stageIndex]).toISOString(),timezone:'Asia/Shanghai',planId:plan.id,planHash:plan.contentHash,_case:c,_protocol:p,_events:events};
 }
 const publicState=c=>{if(!c)return null;const {_case,_protocol,_events,...value}=c;return value;};
 const requireReady=c=>{if(c&&!c.ready)fail('SIMULATION_NOT_READY',c.reason);return c;};
 async function guardVisitSchedule(tx,s,visitId,{operation='submit'}={}){
  if(!await current(tx,s))return null;
  await lock(tx,s);const c=requireReady(await current(tx,s));if(!c)fail('SIMULATION_CASE_CHANGED');
  const v=await tx.subjectVisit.findFirst({where:{...scoped(s),id:visitId,acceptanceFixture:false},include:{visitPlan:true}});
  const subject=c._case.subjects.find(x=>x.id===v?.subjectId),p=c._case.visitPlans.find(x=>x.id===v?.visitPlanId);
  if(!v||v.protocolVersionId!==c._case.protocolVersionId||!subject||!p||!p.armCodes.includes(subject.armCode))fail('SIMULATION_VISIT_UNREGISTERED');
  const index=STAGES.indexOf(p.logicalVisit);
  if(index!==c.stageIndex&&!(operation==='correct'&&index<c.stageIndex))fail('SIMULATION_VISIT_OUTSIDE_STAGE');
  if(v.scheduleState==='pending_anchor')fail('SIMULATION_VISIT_ANCHOR_UNRESOLVED');
  const at=new Date(c.logicalDate);
  if(operation!=='correct'&&(!v.windowStart||!v.windowEnd||at<new Date(v.windowStart)||at>new Date(v.windowEnd)))fail('SIMULATION_VISIT_OUTSIDE_WINDOW');
  return publicState(c);
 }
 async function withExecutionTx(tx,user,s,fn,options={}){
  // Read before acquiring locks so ordinary protocols preserve their existing path.
  let c=await current(tx,s);if(!c)return fn(tx);await lock(tx,s);c=requireReady(await current(tx,s));
  if(!c)fail('SIMULATION_CASE_CHANGED');
  const subject=options.subjectId?c._case.subjects.find(x=>x.id===options.subjectId):null;
  if(options.operation==='enroll'&&(!subject||subject.armCode!==options.armCode))fail('SIMULATION_SUBJECT_UNREGISTERED');
  if(options.operation==='enroll'&&c.stageIndex!==0)fail('SIMULATION_ENROLLMENT_STAGE_CLOSED');
  const logicalDate=new Date(c.logicalDate),baseDate=new Date(c._case.baseDate),cache=new Map();
  const allowedSubject=id=>c._case.subjects.find(x=>x.id===id);
  const patchData=(model,method,args)=>{
   const data={...args.data};
   if(model==='studyEnrollment'&&method==='create'){
    if(options.operation!=='enroll'||data.subjectId!==subject.id||data.armCode!==subject.armCode||!sameScope(data,s))fail('SIMULATION_SUBJECT_UNREGISTERED');data.enrolledAt=baseDate;
   }
   if(model==='studyEnrollmentAnchor'&&method==='create'&&data.kind==='enrollment'){if(options.operation!=='enroll'||!sameScope(data,s))fail('SIMULATION_ENROLLMENT_CONTEXT_REQUIRED');data.occurredAt=baseDate;}
   if(model==='subjectVisit'&&method==='create'){
    const who=allowedSubject(data.subjectId),p=c._protocol.visitPlans.find(x=>x.id===data.visitPlanId),registered=c._case.visitPlans.find(x=>x.id===data.visitPlanId);
    if(options.operation!=='enroll'||data.subjectId!==subject?.id||!who||!p||!registered?.armCodes.includes(who.armCode)||!sameScope(data,s))fail('SIMULATION_VISIT_UNREGISTERED');
    data.anchorAt=baseDate;data.targetDate=day(c._case.baseDate,p.targetDayOffset);data.windowStart=day(data.targetDate,-p.windowBeforeDays);data.windowEnd=day(data.targetDate,p.windowAfterDays);
   }
   if(model==='subjectVisit'&&['update','updateMany'].includes(method))for(const field of ['actualStartedAt','actualCompletedAt'])if(data[field] instanceof Date)data[field]=logicalDate;
   return {...args,data};
  };
  const wrapped=new Proxy(tx,{get(target,name){
   if(!['studyProtocolVersion','studyEnrollment','studyEnrollmentAnchor','subjectVisit'].includes(name)){const value=target[name];return typeof value==='function'?value.bind(target):value;}
   if(cache.has(name))return cache.get(name);
   const model=target[name],proxy=new Proxy(model,{get(m,method){const value=m[method];if(typeof value!=='function')return value;
    return async(args,...rest)=>{
     if(name==='studyProtocolVersion'&&method==='findFirst'){
      const result=await value.call(m,args,...rest);
      if(options.operation==='enroll'&&result?.id===c._case.protocolVersionId&&args?.include?.taskTemplates&&Array.isArray(result.visitPlans))return {...result,visitPlans:result.visitPlans.filter(p=>ARM_VISITS[subject.armCode].includes(p.code))};
      return result;
     }
     if(name==='subjectVisit'&&['update','updateMany'].includes(method)&&args?.data&&['actualStartedAt','actualCompletedAt'].some(key=>args.data[key] instanceof Date)){
      if(typeof args.where?.id!=='string')fail('SIMULATION_VISIT_UNREGISTERED');
      const v=await target.subjectVisit.findFirst({where:{...scoped(s),id:args.where.id,acceptanceFixture:false},select:{subjectId:true,protocolVersionId:true,visitPlanId:true}}),who=allowedSubject(v?.subjectId);
      if(!v||v.protocolVersionId!==c._case.protocolVersionId||!who||!c._case.visitPlans.some(p=>p.id===v.visitPlanId&&p.armCodes.includes(who.armCode)))fail('SIMULATION_VISIT_UNREGISTERED');
     }
     if(['create','update','updateMany'].includes(method)&&args?.data)return value.call(m,patchData(name,method,args),...rest);
     return value.call(m,args,...rest);
    };
   }});cache.set(name,proxy);return proxy;
  }});
  return fn(wrapped);
 }
 async function advance(tx,user,s,body){
  only(body,['requestKey','expectedStage']);validateMutation(body);if(!Number.isInteger(body.expectedStage)||body.expectedStage<0||body.expectedStage>3)fail('SIMULATION_STAGE_INVALID');
  if(typeof authorizeAdvance!=='function'||typeof completionIntegrity!=='function')fail('SIMULATION_ADVANCE_UNAVAILABLE');
  await authorizeAdvance(tx,user,scoped(s));await lock(tx,s);const c=requireReady(await current(tx,s));if(!c)fail('SIMULATION_CASE_UNREGISTERED');
  const replay=c._events.find(e=>e.accountId===user.accountId&&e.meta?.requestKey===body.requestKey);
  if(replay){if(replay.meta.requestHash!==requestHash(body))fail('SIMULATION_REQUEST_KEY_CONFLICT');const value=replay.meta.result;if(!value||value.caseId!==c.caseId||value.stageIndex!==replay.meta.toStage||value.logicalDate!==day(c._case.baseDate,DAYS[replay.meta.toStage]).toISOString()||value.receipt?.requestKey!==body.requestKey||value.receipt?.action!==action||value.receipt?.targetId!==c.caseId)fail('SIMULATION_CLOCK_INTEGRITY_INVALID');return value;}
  if(body.expectedStage!==c.stageIndex)fail('SIMULATION_STAGE_CONFLICT');if(c.stageIndex===3)fail('SIMULATION_FINAL_STAGE');
  const plans=c._case.visitPlans.filter(p=>p.logicalVisit===c.stage),expected=c._case.subjects.flatMap(who=>plans.filter(p=>p.armCodes.includes(who.armCode)).map(p=>({subjectId:who.id,visitPlanId:p.id})));
  const visits=await tx.subjectVisit.findMany({where:{...scoped(s),protocolVersionId:c._case.protocolVersionId,subjectId:{in:c._case.subjects.map(x=>x.id)},visitPlanId:{in:plans.map(p=>p.id)},acceptanceFixture:false}});
  if(visits.length!==expected.length||expected.some(e=>visits.filter(v=>v.subjectId===e.subjectId&&v.visitPlanId===e.visitPlanId).length!==1)||visits.some(v=>v.status!=='completed'))fail('SIMULATION_STAGE_INCOMPLETE');
  for(const visit of visits)if(await completionIntegrity(tx,visit)!=='current')fail('SIMULATION_STAGE_INCOMPLETE');
  const result={...publicState(c),stageIndex:c.stageIndex+1,stage:STAGES[c.stageIndex+1],day:DAYS[c.stageIndex+1],logicalDate:day(c._case.baseDate,DAYS[c.stageIndex+1]).toISOString(),receipt:{requestKey:body.requestKey,action,targetId:c.caseId}};
  await tx.auditLog.create({data:{...scoped(s),accountId:user.accountId,action,target:c.caseId,meta:{caseId:c.caseId,fromStage:c.stageIndex,toStage:c.stageIndex+1,protocolHash:c._case.protocolHash,policyHash:c._case.policyHash,planHash:c.planHash,requestKey:body.requestKey,requestHash:requestHash(body),result}}});return result;
 }
 return {context:async(tx,s)=>publicState(await current(tx,s)),withExecutionTx,guardVisitSchedule,advance,presentVisit:async(tx,s,visit)=>{
  const internal=await current(tx,s),c=publicState(internal);if(!c)return visit;
  const p=internal._case?.visitPlans.find(p=>p.id===visit.visitPlanId||p.id===visit.visitPlan?.id),inCurrentStage=Boolean(c.ready&&p?.logicalVisit===c.stage);
  return {...visit,simulation:{...c,visitStage:p?.logicalVisit??null,inCurrentStage},capabilities:{...visit.capabilities,...Object.fromEntries(['canStart','canAssign','canComplete'].map(key=>[key,Boolean(visit.capabilities?.[key]&&inCurrentStage)]))}};
 }};
}
