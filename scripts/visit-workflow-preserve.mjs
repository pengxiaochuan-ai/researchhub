// Synthetic scope protection only. Fixture transactions are READ ONLY; no business POST, mail or Worker.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {purpose,workspace,repo,privateDir,evidenceDir,json,sha,normalize,save,requireQAWindow} from './visit-workflow-qa.mjs';
const oldBase=repo+'docs/testing/evidence/full-study-compute-tail-2026-11-16/';
const expectedScope={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-full-study-b230c34b-group',researchProjectId:'cmweunjpe001iluicrmxl5ii5'},studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25';
const snapshotPath=privateDir+'old-protection-before.json';
export function compareProtection(before,after){
 assert.equal(before.nativeRuns.length,316);assert.equal(after.nativeRuns.length,316);assert.equal(before.revisions.length,48);assert.equal(before.childSnapshots.length,39);
 for(const k of ['scope','studyId','nativeRuns','nativeAudits','revisions','childSnapshots','scientificFiles','word'])assert.deepEqual(after[k],before[k],k+'_CHANGED');return true;
}
export async function readProtection(h){
 requireQAWindow(['--local-synthetic','--preserve']);
 const old277=json(oldBase+'candidates/old-native-runs-277.json'),latest=json(oldBase+'native-audit/after-3/pre-review-5a35f435/native-proof.json');assert.equal(old277.runs.length,277);assert.equal(latest.runs.length,39);assert.equal(old277.studyId,studyId);assert.deepEqual(old277.scope,expectedScope);
 const expectedRuns=[...old277.runs,...latest.runs].sort((a,b)=>a.id.localeCompare(b.id)),ids=expectedRuns.map(r=>r.id);assert.equal(new Set(ids).size,316);
 const expectedRevisions=json(oldBase+'live-freeze/run-9fb87de0/native-revisions-full-48.json'),children=json(oldBase+'live-freeze/run-9fb87de0/child-snapshots-39.json');assert.equal(expectedRevisions.length,48);assert.equal(children.length,39);
 const data=await h.read(async tx=>{
  const[marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${'rh-full-study-b230c34b'}`;assert(marker?.manifest?.syntheticOnly===true&&marker.manifest.studyId===studyId);assert.deepEqual(marker.manifest.scope,expectedScope);
  const nativeRuns=normalize(await tx.researchMethodRun.findMany({where:{...expectedScope,id:{in:ids}},orderBy:{id:'asc'}}));assert.deepEqual(nativeRuns,expectedRuns,'REGISTERED_OLD_316_CHANGED_BEFORE_QA');
  const nativeAudits=normalize(await tx.auditLog.findMany({where:{...expectedScope,target:{in:ids}},orderBy:{id:'asc'}}));
  const revisions=normalize(await tx.formResponseRevision.findMany({where:{...expectedScope,id:{in:expectedRevisions.map(r=>r.id)}},orderBy:[{responseId:'asc'},{revisionNo:'asc'}]}));assert.deepEqual(revisions,expectedRevisions);
  const childSnapshots=normalize(await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE tenant_id=${expectedScope.tenantId} AND study_group_id=${expectedScope.studyGroupId} AND research_project_id=${expectedScope.researchProjectId} AND study_id=${studyId} AND id=ANY(${children.map(c=>c.id)}::text[]) ORDER BY id`);assert.deepEqual(childSnapshots,children);
  return{nativeRuns,nativeAudits,revisions,childSnapshots};
 });
 const baseline=json(repo+'docs/testing/evidence/full-study-performance-2026-11-13/baseline/baseline.json'),scientificFiles={};
 for(const[k,v]of Object.entries(baseline.immutableInputs)){if(k==='profile_script')continue;const digest=sha(readFileSync(workspace+v.path));assert.equal(digest,v.sha256,k);scientificFiles[k]={path:v.path,sha256:digest};}assert.equal(Object.keys(scientificFiles).length,36);
 const wordPath=repo+'docs/testing/evidence/real-study-full-simulation-2026-11-13/report-corrected/report.docx',bytes=readFileSync(wordPath);assert.equal(bytes.length,22581);assert.equal(sha(bytes),'e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7');
 return{scope:expectedScope,studyId,...data,scientificFiles,word:{sizeBytes:bytes.length,sha256:sha(bytes)}};
}
export async function preserveOld(h,phase){
 assert.match(phase,/^[a-z0-9-]{1,80}$/);const current=await readProtection(h);let initialized=false;
 if(!existsSync(snapshotPath)){assert.equal(phase,'before','PROTECTION_BASELINE_REQUIRED_BEFORE_WRITES');save(snapshotPath,current,true);initialized=true;}else compareProtection(json(snapshotPath),current);
 const evidence=evidenceDir+'preservation/'+phase+'-'+randomUUID().slice(0,8)+'.json';save(evidence,{at:new Date().toISOString(),passed:true,purpose,phase,initialized,scope:expectedScope,studyId,nativeRows:316,nativeAudits:current.nativeAudits.length,nativeRowsHash:sha(JSON.stringify(current.nativeRuns)),nativeAuditsHash:sha(JSON.stringify(current.nativeAudits)),rawRevisions:48,childSnapshots:39,scientificFiles:36,word:current.word,readOnly:true,businessWrites:0,workerExecutions:0,externalEmailSent:false});return{passed:true,evidence,rows:316};
}
async function main(){assert.equal(requireQAWindow(process.argv.slice(2)),'preserve');const{openHarness}=await import('./full-study-runtime.mjs');const h=await openHarness({privateOutputDir:privateDir+'preservation-auth/'});console.log(JSON.stringify(await preserveOld(h,existsSync(snapshotPath)?'fresh-check':'before')));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
