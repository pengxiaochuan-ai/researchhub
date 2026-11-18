// One fresh synthetic-fixture read-only readback; no HTTP, Worker or business writes.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const root=workspaceRoot,repo=root+'researchhub/',previous=repo+'docs/testing/evidence/full-study-batch-performance-2026-11-16/',task='full-study-compute-tail-2026-11-16';
const json=p=>JSON.parse(readFileSync(p,'utf8')),normalize=x=>JSON.parse(JSON.stringify(x)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const prior=json(previous+'native-audit/final-e1b4d77f/native-proof.json'),expected=[...prior.oldRuns,...prior.runs].sort((a,b)=>a.id.localeCompare(b.id)),ids=expected.map(r=>r.id),scope={tenantId:prior.header.tenantId,studyGroupId:prior.header.studyGroupId,researchProjectId:prior.header.researchProjectId};
assert.equal(ids.length,156);assert.equal(new Set(ids).size,156);const study='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25';assert(expected.every(r=>r.inputSummary.studyId===study));
const raw=json(repo+'docs/testing/evidence/real-study-full-simulation-2026-11-13/oracle-corrected-source/raw-revisions-48.json'),aids=[...new Set(raw.revisions.map(r=>r.ref.assignmentId))];assert.equal(aids.length,46);
const out=repo+'docs/testing/evidence/'+task+'/live-freeze/run-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const nativeVerify=runtimeDependencies().load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
const progress={};let data;
try{data=await withFixtureTransaction(env,'direct',async tx=>{
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${'rh-full-study-b230c34b'}`;assert(marker?.manifest?.syntheticOnly===true&&marker.manifest.studyId===study&&marker.manifest.scope.researchProjectId===scope.researchProjectId);
 const runs=normalize(await tx.researchMethodRun.findMany({where:{...scope,id:{in:ids}},orderBy:{id:'asc'}}));assert.deepEqual(runs,expected,'OLD_156_NATIVE_ROWS_CHANGED');progress.native156Compared=true;
 const revisions=await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:aids}},orderBy:[{responseId:'asc'},{revisionNo:'asc'}]});assert.equal(revisions.length,48);const dtos=normalize(revisions.map(nativeVerify));progress.native48EnvelopesVerified=true;
 const immutableKeys=['ref','formVersionId','answers','score','scoreAlgorithm','source','actorKind','actorId','reason','changes','sourceSubmittedAt','createdAt'],displayFields=[];
 for(const old of raw.revisions){const current=dtos.find(x=>x.ref.responseId===old.ref.responseId&&x.ref.revisionNo===old.ref.revisionNo);assert(current);for(const key of immutableKeys){assert(Object.hasOwn(old,key));assert.deepEqual(current[key],old[key],'REVISION_CHANGED:'+key);}for(const key of Object.keys(old).filter(k=>!immutableKeys.includes(k))){assert.equal(key,'actorDisplayName','UNKNOWN_REVISION_DTO_FIELD');displayFields.push({ref:old.ref,field:key,oldValue:old[key],source:'presentation field outside native immutable envelope; not synthesized into native DTO'});}}
 progress.immutableDtoFieldsCompared=true;progress.presentationFields=displayFields;
 const childIds=prior.runs.map(r=>r.inputSummary.snapshotId),children=normalize(await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE tenant_id=${scope.tenantId} AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND study_id=${study} AND id=ANY(${childIds}::text[]) ORDER BY id`);assert.deepEqual(children,prior.childSnapshots,'CHILD_SNAPSHOTS_CHANGED');
 return{runs,revisions:normalize(revisions),revisionDtos:dtos,childSnapshots:children};
},{readOnly:true});}catch(error){save('result.json',{passed:false,readOnly:true,httpCalls:0,workerCalls:0,businessWrites:0,scope,studyId:study,progress,error:{name:error.name,code:error.code??null,message:error.message.slice(0,1400)}});throw error;}
save('native-runs-156.json',{syntheticOnly:true,studyId:study,runs:data.runs});save('raw-revisions-48.json',{...raw,at:new Date().toISOString(),revisions:data.revisionDtos});save('native-revisions-full-48.json',data.revisions);save('child-snapshots-39.json',data.childSnapshots);
const result={schemaVersion:'full-study-compute-tail-live-freeze-v1',at:new Date().toISOString(),passed:true,syntheticOnly:true,studyId:study,scope,database:'wp01_test_full_baseline',readOnly:true,old156NativeRowsUnchanged:true,raw48VerifiedAndUnchanged:true,child39SnapshotsUnchanged:true,progress,counts:{nativeRows:data.runs.length,revisions:data.revisions.length,childSnapshots:data.childSnapshots.length},httpCalls:0,workerCalls:0,businessWrites:0,sourceFiles:{profileOriginal:sha(repo+'scripts/full-study-profile.mjs'),script:sha(repo+'scripts/full-study-compute-tail-freeze-readonly.mjs')},scopeNote:'Shared asset window granted; data workspace had not yet confirmed pause, so no exclusive/no-interference claim.'};save('result.json',result);console.log(JSON.stringify({...result,evidence:out}));
