import test from 'node:test';import assert from 'node:assert/strict';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createSimulationVisitProjection} from './visit-projection.mjs';
const deps=runtimeDependencies(),s={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},u={tenantId:'tenant',accountId:'actor',authVersion:1};
const readVisit=deps.load('study-operations/formal-response-visits','readFormalVisitInTransaction'),Service=deps.load('study-operations/study-operations.service','StudyOperationsService');
function fixture(){
 const date='2026-11-13T00:00:00.000Z',sections=Object.fromEntries(['ethics','screening','researchConsent','dataUse','withdrawal','safety','site','blinding','captureReview'].map(k=>[k,{status:'not_applicable',source:'合成来源',reason:'软件验证',decidedBy:'admin',decidedAt:date}]));
 sections.site={...sections.site,status:'configured',mode:'study_wide'};sections.captureReview={...sections.captureReview,status:'configured',rules:{correction:'versioned',locking:'review',unlocking:'reason',reviewResponsibility:'admin',reviewIndependence:'not_required'}};
 const policyHash=deps.load('study-operations/execution-policy-gate','policyContentHash')(sections),protocol={...s,id:'protocol',status:'executing',approvedPolicyVersionId:'policy',approvedPolicyHash:policyHash};
 const req={id:'requirement',kind:'modality_file',required:true,config:{modality:'eye'}},visit={...s,id:'visit',subjectId:'subject',enrollmentId:'enrollment',protocolVersionId:'protocol',visitPlanId:'plan',acceptanceFixture:false,status:'in_progress',version:1,scheduleState:'scheduled',evidenceRefs:[],subject:{subjectId:'synthetic-subject'},visitPlan:{id:'plan',name:'基线',code:'V1_PATIENT',requirements:[req]},requirementFulfillments:[{id:'fulfillment',subjectVisitId:'visit',visitRequirementId:req.id,status:'missing',evidenceRefs:[]}]};
 const file={id:'file',status:'uploaded',meta:{sha256:'a'.repeat(64),storageVerifiedSha256:'a'.repeat(64)}};
 const state={upserts:0,verified:true,reviewAllowed:true};
 const tx={account:{findFirst:async()=>({id:'actor',tenantId:'tenant',role:'tenant_admin',isTenantAdmin:true,status:'active',authVersion:1,tenant:{status:'active'}})},studyGroup:{findFirst:async()=>({id:'group',status:'active'})},researchProject:{findFirst:async()=>({id:'project',status:'active'})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},subjectVisit:{findFirst:async()=>structuredClone(visit)},studyEnrollment:{findFirst:async()=>({id:'enrollment',subjectId:'subject',protocolVersionId:'protocol',status:'enrolled'})},studyProtocolVersion:{findFirst:async()=>protocol},studyExecutionPolicyVersion:{findFirst:async()=>({id:'policy',status:'approved',sections,contentHash:policyHash,createdBy:'maker',reviewedBy:'admin',reviewedAt:new Date(date)})},formAssignment:{findMany:async()=>[]},visitRequirementFulfillment:{upsert:async()=>{state.upserts++;throw Error('GET must never persist');}},modalityFile:{findMany:async()=>state.verified?[file]:[],findFirst:async()=>state.verified?file:null},$executeRaw:async()=>0,$queryRaw:async(strings)=>strings.join('').includes('study_participation_event')?['screening','research_consent','data_use_consent'].map(kind=>({kind,decision:'not_applicable',evidence:'合成证据',reason:'软件验证'})):[]};
 const c={schemaVersion:'full-study-simulation-case-v1',scope:s,studyId:'study',protocolVersionId:'protocol',subjects:[{id:'subject',armCode:'MDD_TARGET'}],visitPlans:[{id:'plan',armCodes:['MDD_TARGET']}]};
 return{tx,state,visit,c,operations:new Service({},{})};
}
test('native current verified file becomes completable through memory-only native refresh',async()=>{
 const f=fixture();assert.equal((await readVisit(f.tx,u,s,'visit')).capabilities.canComplete,false);
 const read=createSimulationVisitProjection({operations:f.operations,readVisit,resolveCase:async()=>f.c});const projected=await read(f.tx,u,s,'visit');
 assert.equal(projected.capabilities.canComplete,true);assert.equal(projected.fulfillments[0].status,'satisfied');assert.equal(projected.previewOnly,true);assert.equal(f.state.upserts,0);assert.equal(f.visit.requirementFulfillments[0].status,'missing');assert.equal(deps.load('study-operations/formal-response-visits','readFormalVisitInTransaction'),readVisit);
});
test('missing verified source remains missing and original anchor/forms restrictions remain native',async()=>{
 const f=fixture(),read=createSimulationVisitProjection({operations:f.operations,readVisit,resolveCase:async()=>f.c});f.state.verified=false;assert.equal((await read(f.tx,u,s,'visit')).capabilities.canComplete,false);
 f.state.verified=true;f.visit.scheduleState='pending_anchor';assert.equal((await read(f.tx,u,s,'visit')).capabilities.canComplete,false);
 f.visit.scheduleState='scheduled';f.visit.visitPlan.requirements.push({id:'form-req',kind:'form_response',required:true,config:{formVersionId:'form'}});assert.equal((await read(f.tx,u,s,'visit')).capabilities.canComplete,false);assert.equal(f.state.upserts,0);
});
test('ordinary and completed visits keep the exact original projection and never invoke refresh',async()=>{
 for(const ordinary of [true,false]){const f=fixture();if(!ordinary)f.visit.status='completed';let calls=0;const original={...await readVisit(f.tx,u,s,'visit')};const read=createSimulationVisitProjection({operations:{refreshSystemVisitRequirements:async()=>{calls++;throw Error('unexpected refresh');}},readVisit:async()=>original,resolveCase:async()=>ordinary?null:f.c});assert.equal(await read(f.tx,u,s,'visit'),original);assert.equal(calls,0);assert.equal(f.state.upserts,0);}
});
test('only the registered parent chain gets a preview, and an unexpected refresh write is rejected',async()=>{
 for(const patch of [{protocolVersionId:'other'},{subjects:[]},{scope:{...s,researchProjectId:'other'}}]){
  const f=fixture();let calls=0;const read=createSimulationVisitProjection({operations:{refreshSystemVisitRequirements:async()=>{calls++;}},readVisit,resolveCase:async()=>({...f.c,...patch})});
  assert.equal((await read(f.tx,u,s,'visit')).previewOnly,undefined);assert.equal(calls,0);assert.equal(f.state.upserts,0);
 }
 const f=fixture();f.tx.auditLog={create:async()=>{throw Error('must not reach DB');}};
 const read=createSimulationVisitProjection({operations:{refreshSystemVisitRequirements:async tx=>tx.auditLog.create({data:{action:'unexpected'}})},readVisit,resolveCase:async()=>f.c});
 await assert.rejects(read(f.tx,u,s,'visit'),/SIMULATION_VISIT_PREVIEW_WRITE_FORBIDDEN/);assert.equal(f.state.upserts,0);
});
