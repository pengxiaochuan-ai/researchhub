import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createT15FormalProjectionReader,assertT15ProjectionCurrent} from './t15-formal-projection.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {canonicalManifestHash}=require('./src/research-methods/data-quality-release-policy.ts');
const {normalizeFormSchema}=require('./src/study-operations/study-forms-policy.ts');
function setup(){
 const calls=[],scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},user={tenantId:'tenant',accountId:'actor'};
 const ref={responseId:'response',assignmentId:'assignment',revisionNo:1,contentHash:'a'.repeat(64)};
 const fields=[['zero','number'],['false','boolean'],['null','number'],['absent','number']].map(([key,type])=>({key,label:key,type}));
 const input={studyId:'study',purposeKey:'descriptive_statistics',protocolVersionId:'protocol',sapVersion:'sap1',variableMapVersion:'map1',statisticalUnit:'subject',variables:fields.map(f=>({key:f.key,fieldKey:f.key,formVersionId:'form',valueType:f.type,unit:null})),observations:[{subjectId:'subject',enrollmentId:'enrollment',visitId:'visit',sources:[ref]}]};
 const current={assignment:{id:'assignment',subjectId:'subject',enrollmentId:'enrollment',subjectVisitId:'visit',formVersion:{id:'form',schema:{fields}}},response:{status:'submitted',version:3,ref,locked:true,review:'review_approved'}};
 const revision={ref,formVersionId:'form',answers:{zero:0,false:false,null:null}};
 const visit={id:'visit',subject:{id:'subject'},enrollmentId:'enrollment',protocolVersionId:'protocol',scheduleState:'scheduled',status:'completed',version:4,completionIntegrity:'current'};
 const use={decision:'allowed',executionPolicyVersionId:'policy',consentViewHash:'c'.repeat(64),blindingViewHash:'d'.repeat(64)};
 const deps={lockSources:async()=>{calls.push('lock');},authorizeUse:async()=>{calls.push('use');return use;},readVisit:async()=>{calls.push('visit');return visit;},readResponse:async()=>{calls.push('response');return current;},readRevision:async()=>{calls.push('revision');return revision;},normalizeSchema:normalizeFormSchema,canonicalManifestHash};
 const read=(options={})=>createT15FormalProjectionReader(deps).read({},user,scope,input,options);
 return {calls,scope,user,input,current,revision,visit,use,deps,read};
}
test('reads formal revisions after current usage guard and preserves zero false null and absent separately',async()=>{
 const f=setup(),result=await f.read();assert.deepEqual(f.calls.slice(0,2),['lock','use']);
 const cells=Object.fromEntries(result.manifest.rows[0].cells.map(c=>[c.key,c]));assert.equal(cells.zero.value,0);assert.equal(cells.zero.missing,null);assert.equal(cells.false.value,false);assert.equal(cells.null.missing,'null');assert.equal(cells.absent.missing,'not_recorded');assert.equal(cells.zero.source.ref.assignmentId,'assignment');assert.equal(cells.zero.source.responseVersion,3);assert.equal(result.manifest.subjectCount,1);
 assert.equal(result.manifestHash,canonicalManifestHash(result.manifest));assert(Object.isFrozen(result.manifest.rows[0].cells[0].source.ref));f.revision.answers.zero=9;assert.equal(cells.zero.value,0);assert(!Object.isFrozen(f.revision));
});
test('mapping and selection order do not change the manifest, a policy view change does',async()=>{
 const f=setup(),first=await f.read();f.input.variables.reverse();assert.equal((await f.read()).manifestHash,first.manifestHash);f.use.consentViewHash='e'.repeat(64);const changed=await f.read({phase:'publish'});assert.throws(()=>assertT15ProjectionCurrent(first.manifestHash,changed),e=>e.code==='ANALYSIS_BASIS_STALE');assert.doesNotThrow(()=>assertT15ProjectionCurrent(changed.manifestHash,changed));
});
test('missing policy or denied current use exposes no source rows',async()=>{
 const f=setup();f.use.decision='missing';await assert.rejects(f.read,e=>e.code==='ANALYSIS_USE_POLICY_UNAVAILABLE');assert.deepEqual(f.calls,['lock','use']);assert.throws(()=>createT15FormalProjectionReader({}),/T15_DEPENDENCY_REQUIRED/);
});
test('stale correction, unlock and review return invalidate the selected source',async()=>{
 for(const mutate of [f=>{f.current.response.ref={...f.current.response.ref,revisionNo:2};},f=>{f.current.response.locked=false;},f=>{f.current.response.review='review_returned';}]){const f=setup();mutate(f);await assert.rejects(f.read,e=>['ANALYSIS_SOURCE_CHANGED','ANALYSIS_SOURCE_NOT_REVIEWED'].includes(e.code));}
});
test('duplicate observations and repeated subjects cannot become independent participants',async()=>{
 const f=setup();f.input.observations.push({...f.input.observations[0]});await assert.rejects(f.read,e=>e.code==='ANALYSIS_DUPLICATE_OBSERVATION');f.input.observations[1].visitId='visit2';await assert.rejects(f.read,e=>e.code==='ANALYSIS_REPEATED_SUBJECT');
 f.input.statisticalUnit='subject_visit';f.deps.readVisit=async(_tx,_u,_s,id)=>({...f.visit,id});f.deps.readResponse=async()=>({...f.current,assignment:{...f.current.assignment,subjectVisitId:f.calls.length?'visit2':'visit'}});
 // The same response cannot be reused for another visit: exact parent validation remains mandatory.
 await assert.rejects(f.read,e=>e.code==='ANALYSIS_SOURCE_CHANGED');
});
test('fixed fields, visit lineage, missing historical basis and nonfinite values fail closed',async()=>{
 for(const [mutate,code] of [[f=>{f.input.variables[0].fieldKey='unknown';},'ANALYSIS_FIELD_MAPPING_INVALID'],[f=>{f.visit.enrollmentId='foreign';},'ANALYSIS_VISIT_CHANGED'],[f=>{f.visit.completionIntegrity='legacy_unversioned';},'ANALYSIS_VISIT_CHANGED'],[f=>{f.revision.answers.zero=Infinity;},'ANALYSIS_VALUE_INVALID']]){const f=setup();mutate(f);await assert.rejects(f.read,e=>e.code===code);}
});

test('subject_visit retains two real visit sources while counting only one subject',async()=>{
 const f=setup(),ref2={responseId:'response2',assignmentId:'assignment2',revisionNo:1,contentHash:'b'.repeat(64)};
 f.input.statisticalUnit='subject_visit';f.input.observations.push({subjectId:'subject',enrollmentId:'enrollment',visitId:'visit2',sources:[ref2]});
 f.deps.readVisit=async(_tx,_u,_s,id)=>({...f.visit,id});
 f.deps.readResponse=async(_tx,_u,_s,id)=>id==='assignment'?f.current:{...f.current,assignment:{...f.current.assignment,id:'assignment2',subjectVisitId:'visit2'},response:{...f.current.response,ref:ref2}};
 f.deps.readRevision=async(_tx,_u,_s,id)=>id==='assignment'?f.revision:{...f.revision,ref:ref2,answers:{zero:2,false:false,null:null}};
 const result=await f.read();assert.equal(result.manifest.rowCount,2);assert.equal(result.manifest.subjectCount,1);assert.equal(result.manifest.rows[1].cells.find(c=>c.key==='zero').source.ref.assignmentId,'assignment2');
 f.input.observations.reverse();assert.equal((await f.read()).manifestHash,result.manifestHash);
});
test('fixed definition change invalidates the manifest even if selected numeric values stay equal',async()=>{
 const f=setup(),first=await f.read();f.current.assignment.formVersion.schema.fields[0].label='Changed label';const next=await f.read();assert.notEqual(first.manifestHash,next.manifestHash);
});
test('unknown fixed-source unit remains null and a plan cannot invent a unit',async()=>{
 const f=setup();assert((await f.read()).manifest.rows[0].cells.every(c=>c.unit===null));f.input.variables[0].unit='kg';await assert.rejects(f.read,e=>e.code==='ANALYSIS_FIELD_MAPPING_INVALID');
 f.current.assignment.formVersion.schema.fields[0].unit='kg';assert.equal((await f.read()).manifest.rows[0].cells.find(c=>c.key==='zero').unit,'kg');
 f.current.assignment.formVersion.schema.fields[0].unit='';await assert.rejects(f.read,e=>e.code==='ANALYSIS_FIELD_MAPPING_INVALID');
});
