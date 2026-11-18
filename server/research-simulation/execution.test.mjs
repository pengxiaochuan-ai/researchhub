import test from 'node:test';import assert from 'node:assert/strict';
import {createResearchSimulation} from './execution.mjs';import {ARM_VISITS} from './policy.mjs';import {requestHash} from '../research-studies/contract.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
function fixture(){
 const subjects=['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE'].flatMap(armCode=>[1,2].map(n=>({id:armCode+n,armCode})));
 const plans=['V1_PATIENT','V1_HEALTHY','V2','V3','V4'].map(code=>({id:code,code,anchor:'enrollment',logicalVisit:code.startsWith('V1')?'V1':code,armCodes:Object.keys(ARM_VISITS).filter(arm=>ARM_VISITS[arm].includes(code)),targetDayOffset:code.startsWith('V1')?0:code==='V2'?14:code==='V3'?28:56,windowBeforeDays:3,windowAfterDays:3}));
 const sections={populationSchedule:{status:'configured',rules:{schemaVersion:'population-schedule-v1',armVisitCodes:ARM_VISITS}},simulation:{status:'configured',rules:{schemaVersion:'study-simulation-clock-v1',stageDays:[0,14,28,56],timezone:'Asia/Shanghai'}}};
 const protocol={id:'protocol',status:'executing',approvedPolicyVersionId:'policy',approvedPolicyHash:requestHash(sections),approvedPolicyVersion:{id:'policy',status:'approved',contentHash:requestHash(sections),sections},visitPlans:plans};
 const c={schemaVersion:'full-study-simulation-case-v1',caseId:'case',studyId:'study',scope,protocolVersionId:'protocol',protocolHash:'hash',policyId:'policy',policyHash:requestHash(sections),baseDate:'2026-11-13T00:00:00.000Z',subjects,visitPlans:plans,forms:[{id:'form',schemaHash:requestHash({fields:[]}),scoringHash:requestHash(null)}]};
 const events=[],writes=[];let complete=false;
 const visits=subjects.flatMap(s=>plans.filter(p=>p.armCodes.includes(s.armCode)).map(p=>({...scope,id:s.id+'-'+p.code,subjectId:s.id,protocolVersionId:'protocol',visitPlanId:p.id,visitPlan:p,status:'completed',scheduleState:'scheduled',windowStart:new Date('2026-11-10'),windowEnd:new Date('2027-01-20')})));
 const tx={$queryRaw:async()=>[{id:'project'}],auditLog:{findMany:async()=>events,create:async({data})=>{events.push(data);return data;}},studyProtocolVersion:{findFirst:async()=>protocol},formVersion:{findMany:async()=>[{id:'form',schema:{fields:[]},scoring:null}]},subjectVisit:{findFirst:async({where})=>visits.find(v=>v.id===where.id),findMany:async()=>visits.filter(v=>v.visitPlan.code.startsWith('V1')),create:async arg=>{writes.push(arg);return arg.data;},updateMany:async arg=>{writes.push(arg);return {count:1};}},studyEnrollment:{create:async arg=>{writes.push(arg);return arg.data;}},studyEnrollmentAnchor:{create:async arg=>{writes.push(arg);return arg.data;}}};
 const options={resolveCase:async()=>c,resolveApprovedPlan:async()=>({id:'plan',version:'full-study-simulation-v2',status:'approved',contentHash:'planhash',protocolVersionId:'protocol'}),protocolHash:()=> 'hash',authorizeAdvance:async()=>{},lockAuthorization:async()=>{},completionIntegrity:async()=>complete?'current':'requires_review'};
 return {c,tx,options,events,writes,visits,setComplete:()=>{complete=true;}};
}
test('unregistered new policy cannot silently delegate; registered missing plan is explicitly not_ready',async()=>{
 const f=fixture(),a=createResearchSimulation({...f.options,resolveCase:async()=>null});
 assert.equal((await a.context(f.tx,scope)).ready,false);await assert.rejects(a.withExecutionTx(f.tx,{},scope,()=>{}),e=>e.code==='SIMULATION_NOT_READY');
 const b=createResearchSimulation({...f.options,resolveApprovedPlan:async()=>null});assert.equal((await b.context(f.tx,scope)).status,'not_ready');
});
test('native unapproved-plan rejection becomes explicit not_ready without swallowing other failures',async()=>{
 const f=fixture(),sim=createResearchSimulation({...f.options,resolveApprovedPlan:async()=>{throw Object.assign(Error('pending'),{code:'FULL_STUDY_PLAN_NOT_APPROVED',status:409});}});
 assert.equal((await sim.context(f.tx,scope)).reason,'SIMULATION_APPROVED_PLAN_REQUIRED');
 const broken=createResearchSimulation({...f.options,resolveApprovedPlan:async()=>{throw Error('database failure');}});await assert.rejects(broken.context(f.tx,scope),/database failure/);
});
test('enrollment filters patient/healthy branches and rewrites domain dates only',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options),subject=f.c.subjects.at(-1),wall=new Date();
 await sim.withExecutionTx(f.tx,{accountId:'actor'},scope,async tx=>{
  const p=await tx.studyProtocolVersion.findFirst({include:{taskTemplates:true,visitPlans:true}});assert.deepEqual(p.visitPlans.map(x=>x.code),['V1_HEALTHY']);
  const enrollment=await tx.studyEnrollment.create({data:{...scope,subjectId:subject.id,armCode:subject.armCode,enrolledAt:wall,createdAt:wall}});assert.equal(enrollment.enrolledAt.toISOString(),f.c.baseDate);assert.equal(enrollment.createdAt,wall);
  const visit=await tx.subjectVisit.create({data:{...scope,subjectId:subject.id,visitPlanId:'V1_HEALTHY',targetDate:wall,createdAt:wall}});assert.equal(visit.targetDate.toISOString(),f.c.baseDate);assert.equal(visit.createdAt,wall);
 },{operation:'enroll',subjectId:subject.id,armCode:subject.armCode});
 await assert.rejects(sim.withExecutionTx(f.tx,{},scope,()=>{},{operation:'enroll',subjectId:'unregistered',armCode:subject.armCode}),e=>e.code==='SIMULATION_SUBJECT_UNREGISTERED');
});
test('advance requires current completion, is sequential/CAS, and same-key replay survives stage change',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options),body={requestKey:'advance-123',expectedStage:0};
 await assert.rejects(sim.advance(f.tx,{accountId:'actor'},scope,body),e=>e.code==='SIMULATION_STAGE_INCOMPLETE');f.setComplete();
 const done=await sim.advance(f.tx,{accountId:'actor'},scope,body);assert.equal(done.stageIndex,1);assert.equal(f.events.length,1);assert.deepEqual(await sim.advance(f.tx,{accountId:'actor'},scope,body),done);
 await assert.rejects(sim.advance(f.tx,{accountId:'actor'},scope,{requestKey:'other-key',expectedStage:0}),e=>e.code==='SIMULATION_STAGE_CONFLICT');
 await assert.rejects(sim.guardVisitSchedule(f.tx,scope,f.visits[0].id,{operation:'submit'}),e=>e.code==='SIMULATION_VISIT_OUTSIDE_STAGE');
 await sim.guardVisitSchedule(f.tx,scope,f.visits[0].id,{operation:'correct'});
});
test('ordinary protocol delegates unchanged and does not lock or wrap its transaction',async()=>{
 const f=fixture();f.tx.studyProtocolVersion.findFirst=async()=>null;const sim=createResearchSimulation({...f.options,resolveCase:async()=>null});
 assert.equal(await sim.context(f.tx,scope),null);let received;await sim.withExecutionTx(f.tx,{},scope,tx=>{received=tx;});assert.equal(received,f.tx);
});
test('date proxy rejects updates to an unregistered visit rather than rewriting unrelated domain time',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options);
 await assert.rejects(sim.withExecutionTx(f.tx,{},scope,tx=>tx.subjectVisit.updateMany({where:{id:'foreign-visit'},data:{actualStartedAt:new Date()}})),e=>e.code==='SIMULATION_VISIT_UNREGISTERED');
 assert.equal(f.writes.length,0);
});
test('profile changes and missing configured population rules explicitly block execution',async()=>{
 const f=fixture();f.tx.formVersion.findMany=async()=>[];const sim=createResearchSimulation(f.options);assert.equal((await sim.context(f.tx,scope)).reason,'SIMULATION_SOURCE_PROFILE_CHANGED');
});
test('presentation disables future visit writes while retaining historical reverify capability',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options),v={...f.visits[1],capabilities:{canStart:true,canAssign:true,canComplete:true,canReverify:true}};
 const shown=await sim.presentVisit(f.tx,scope,v);assert.equal(shown.capabilities.canStart,false);assert.equal(shown.capabilities.canAssign,false);assert.equal(shown.capabilities.canComplete,false);assert.equal(shown.capabilities.canReverify,true);
});
test('patient enrollment keeps four original offsets and actual date proxy preserves real verification/audit timestamps',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options),who=f.c.subjects[0],wall=new Date();
 await sim.withExecutionTx(f.tx,{},scope,async tx=>{const p=await tx.studyProtocolVersion.findFirst({include:{taskTemplates:true,visitPlans:true}});assert.deepEqual(p.visitPlans.map(v=>v.targetDayOffset),[0,14,28,56]);},{operation:'enroll',subjectId:who.id,armCode:who.armCode});
 await sim.withExecutionTx(f.tx,{},scope,tx=>tx.subjectVisit.updateMany({where:{id:f.visits[0].id},data:{actualStartedAt:wall,actualCompletedAt:wall,verifiedAt:wall,updatedAt:wall}}));
 const data=f.writes[0].data;assert.equal(data.actualStartedAt.toISOString(),f.c.baseDate);assert.equal(data.actualCompletedAt.toISOString(),f.c.baseDate);assert.equal(data.verifiedAt,wall);assert.equal(data.updatedAt,wall);
});
test('active-stage collection outside its fixed window is rejected; ordinary guard stays delegated',async()=>{
 const f=fixture(),sim=createResearchSimulation(f.options);f.visits[0].windowEnd=new Date('2026-01-01');await assert.rejects(sim.guardVisitSchedule(f.tx,scope,f.visits[0].id),e=>e.code==='SIMULATION_VISIT_OUTSIDE_WINDOW');
 f.tx.studyProtocolVersion.findFirst=async()=>null;const ordinary=createResearchSimulation({...f.options,resolveCase:async()=>null});f.tx.$queryRaw=()=>{throw Error('ordinary must not acquire simulation lock');};assert.equal(await ordinary.guardVisitSchedule(f.tx,scope,'ordinary'),null);
});
