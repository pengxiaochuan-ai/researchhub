import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationBlockers, equivalentPolicySections } from './protocol-migration.mjs';
const policy=Object.fromEntries(['ethics','screening','researchConsent','dataUse','withdrawal','safety','site','blinding','captureReview'].map(k=>[k,{status:'configured',source:'a',decidedBy:'one',decidedAt:'2026-01-01'}]));
const base=()=>({enrollment:{status:'enrolled',enrolledAt:'2026-01-01',withdrawnAt:null,protocolVersionId:'old'},targetProtocolId:'new',sourcePolicy:policy,targetPolicy:policy,visits:[{id:'v',status:'planned',protocolVersionId:'old',evidenceRefs:[]}],tasks:[{id:'t',status:'open',reviewStatus:'not_required',evidenceRefs:[]}],evidence:[]});
test('allows only an enrolled untouched case with compatible policy',()=>{assert.deepEqual(migrationBlockers(base()),[]);assert.equal(equivalentPolicySections(policy,{...policy,ethics:{...policy.ethics,decidedBy:'two',decidedAt:'2026-02-01'}}),true);});
test('blocks changed or missing policies, evidence and progressed work',()=>{for(const mutate of [x=>x.enrollment.status='in_progress',x=>x.enrollment.withdrawnAt='now',x=>x.sourcePolicy=null,x=>x.targetPolicy.ethics.source='b',x=>x.visits[0].actualStartedAt='now',x=>x.visits[0].status='completed',x=>x.visits[0].evidenceRefs=['ref'],x=>x.tasks[0].status='in_progress',x=>x.tasks[0].reviewedAt='now',x=>x.tasks[0].reviewStatus='pending',x=>x.evidence.push({kind:'scale'})]){const x=base();x.sourcePolicy=structuredClone(policy);x.targetPolicy=structuredClone(policy);mutate(x);assert.ok(migrationBlockers(x).length);}});
test('fails closed for absent collections, invalid evidence and unrecognized states',()=>{for(const mutate of [x=>delete x.evidence,x=>x.visits[0].evidenceRefs=null,x=>x.tasks[0].status='cancelled',x=>x.visits[0].status='unknown',x=>x.enrollment.protocolVersionId='new']){const x=base();mutate(x);assert.ok(migrationBlockers(x).length);}});

test('preview denies revoked release authority before receipt lookup',async()=>{
 const {createProtocolMigrationService}=await import('./protocol-migration.mjs');
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({tenantId:'t',role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 await assert.rejects(createProtocolMigrationService({studies,core:{}}).preview({tenantId:'t',accountId:'u'},'s','p',{requestKey:'test-key-123',expectedRevision:'a'.repeat(64),enrollmentIds:['e']}),e=>e.code==='RESEARCH_FORBIDDEN');
});

test('execute denies revoked authority before receipt lookup',async()=>{
 const {createProtocolMigrationService}=await import('./protocol-migration.mjs');
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({tenantId:'t',role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 await assert.rejects(createProtocolMigrationService({studies,core:{}}).execute({tenantId:'t',accountId:'u'},'s','p',{requestKey:'execute-key-123',expectedRevision:'a'.repeat(64),migrateExisting:true,previewRequestKey:'preview-key-123',previewToken:'x'.repeat(43),reason:'合成转版'}),e=>e.code==='RESEARCH_FORBIDDEN');
});
