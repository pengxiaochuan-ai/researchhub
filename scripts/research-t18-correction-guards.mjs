import assert from 'node:assert/strict';
const changed=new Set(['ANALYSIS_VISIT_CHANGED','ANALYSIS_SOURCE_NOT_REVIEWED','ANALYSIS_SOURCE_CHANGED','ANALYSIS_BASIS_STALE']);
const forbidden=new Set(['answers','rows','manifest','numericEvidence','contentMd','sourceHash','sourceSnapshotHash']);
export function assertNoSensitive(value){
 function walk(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){assert(!forbidden.has(k),'STALE_VALUES_DISCLOSED');if(k==='outputs')assert(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===0,'STALE_VALUES_DISCLOSED');else walk(x);}}
 walk(value);
}
export function assertSourceError(value,finalSnapshot=false){assert(value&&typeof value==='object'&&changed.has(value.code));if(finalSnapshot)assert.equal(value.code,'ANALYSIS_BASIS_STALE');assertNoSensitive(value);}
export function assertOriginalCapture(actual,original){
 assert.equal(actual.assignment.id,original.assignment.id);assert.equal(actual.assignment.subjectId,original.assignment.subjectId);assert.equal(actual.assignment.subjectVisitId,original.assignment.subjectVisitId);
 for(const k of ['id','status','version','ref','answers','locked','review'])assert.deepEqual(actual.response[k],original.response[k]);
}
export function assertVisitEvidence(before,after,ref2,responseVersion){
 assert(Array.isArray(before)&&Array.isArray(after));assert.deepEqual(after.slice(0,before.length),before);
 assert(after.slice(before.length).some(e=>e.type==='formal_response_revision'&&Object.entries(ref2).every(([k,v])=>e[k]===v)&&e.responseVersion===responseVersion));
}
export function assertPreviewRows(manifest,expectations){
 assert.equal(manifest.rows.length,expectations.length);
 for(const x of expectations){const row=manifest.rows.find(r=>r.subjectId===x.subjectId);assert(row);assert.equal(row.visitId,x.visitId);assert.equal(row.enrollmentId,x.enrollmentId);assert.equal(row.visitStatus,'completed');assert.equal(row.completionIntegrity,'current');assert.equal(row.visitVersion,x.visitVersion);for(const c of row.cells)assert.equal(c.source.responseVersion,x.responseVersion);}
}

export function assertBlockedRunMetadata(run){
 assert(run&&run.analysisState==='blocked'&&run.stage==='basis-invalid'&&run.errorCode==='ANALYSIS_BASIS_STALE','UNEXPECTED_BLOCKED_RUN_STATE');
 assertNoSensitive(run);
 const keys=['id','skillKey','status','reviewStatus','createdAt','updatedAt','analysisState','stage','errorCode','errorMessage','outputs','limitations','nextActions','idempotent','reviews'];
 assert(Object.keys(run).every(k=>keys.includes(k)),'UNEXPECTED_RUN_METADATA');
 assert.deepEqual(run.outputs,{});for(const key of ['limitations','nextActions','reviews'])assert.deepEqual(run[key],[],'NONEMPTY_BLOCKED_RUN_METADATA');assert.equal(run.idempotent,false);
}
