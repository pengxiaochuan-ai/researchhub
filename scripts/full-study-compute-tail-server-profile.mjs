// Read-only actual API probe; never a performance acceptance sample.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openHarness,json,sha} from './full-study-runtime.mjs';
import {observationSourceHash} from './full-study-local-observation.mjs';
const task='full-study-compute-tail-2026-11-16',root=new URL('../../',import.meta.url).pathname;
assert.equal(process.argv[2],'--registered-synthetic-read-only');
const config=json(root+'.tmp/'+task+'/observer-enable.json');assert.equal(config.sourceHash,observationSourceHash());
const prefix=root+'.tmp/'+task+'/',file=prefix+'server-profile.jsonl',startBytes=(()=>{try{return readFileSync(file).length;}catch(e){if(e.code==='ENOENT')return 0;throw e;}})();
const label='api-'+randomUUID(),dir=prefix+'diagnostics/'+label+'/',out=root+'researchhub/docs/testing/evidence/'+task+'/profile/'+label+'/';
mkdirSync(out,{recursive:true});const h=await openHarness({privateOutputDir:dir}),snapshotId='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',times=[];
for(let i=0;i<2;i++){
 const start=performance.now(),r=await h.get('/research-studies/'+config.studyId+'/analysis/snapshots/'+snapshotId);times.push(performance.now()-start);
 assert.equal(r.basis.manifestHash,'8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7');
}
assert.equal(observationSourceHash(),config.sourceHash);
const rows=readFileSync(file).subarray(startBytes).toString('utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));assert.equal(rows.length,2,'ACTUAL_SERVER_PROFILE_NOT_OBSERVED');assert(rows.every(r=>r.sourceHash===config.sourceHash));
assert(rows.every(r=>r.outcome==='success'&&r.phase==='snapshot'&&r.projectedHash==='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7'&&r.studyId===config.studyId&&Object.keys(config.scope).every(k=>r.scope[k]===config.scope[k])&&r.pendingCalls===0),'ACTUAL_SERVER_METADATA_PROOF_INVALID');
assert.equal(rows[1].projectSequence,rows[0].projectSequence+1);assert(rows.every(r=>r.calls.every(c=>c.unobserved===0)),'ACTUAL_SERVER_CALL_DURATION_NOT_OBSERVED');
const result={diagnosticsOnly:true,acceptanceTiming:false,syntheticOnly:true,at:new Date().toISOString(),sourceHash:config.sourceHash,httpMs:times,sourceFileSha:sha(readFileSync(file)),rows,network:h.network};
writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({evidence:out+'result.json',httpMs:times,rows:rows.map(r=>({phase:r.phase,wallMs:r.wallMs,calls:r.calls}))}));
