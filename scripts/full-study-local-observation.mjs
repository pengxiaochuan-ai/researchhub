// Temporary metadata diagnostics for one registered synthetic study only.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const scope={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-full-study-b230c34b-group',researchProjectId:'cmweunjpe001iluicrmxl5ii5'};
const studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25';
const sources=['../server/research-analysis/full-study-core.mjs','../server/research-analysis/full-study-analysis.mjs','../server/research-analysis/full-study-source-pair.mjs','../server/research-analysis/full-study-visit-reads.mjs','./local-full-study-simulation.mjs','./full-study-project-observer.mjs','./full-study-local-observation.mjs'];
export function observationSourceHash(){return createHash('sha256').update(JSON.stringify(sources.map(path=>[path,createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex')]))).digest('hex');}
export function loadFullStudyObservation({root,tenantId,targets}){
 const dir=root+'.tmp/full-study-compute-tail-2026-11-16/',file=dir+'observer-enable.json';
 if(!existsSync(file))return undefined;
 const c=JSON.parse(readFileSync(file,'utf8'));
 assert.deepEqual(Object.keys(c).sort(),['schemaVersion','scope','sourceHash','studyId']);
 assert.equal(c.schemaVersion,'full-study-project-observer-v1');assert.equal(c.studyId,studyId);assert.deepEqual(c.scope,scope);
 assert.equal(tenantId,scope.tenantId);assert(targets.some(t=>t.studyId===studyId&&Object.keys(scope).every(k=>t.scope?.[k]===scope[k])),'OBSERVER_REGISTERED_SYNTHETIC_STUDY_REQUIRED');
 assert.equal(c.sourceHash,observationSourceHash(),'OBSERVER_SOURCE_DRIFT');
 return{scope:{...scope},studyId,sourceHash:c.sourceHash,emit:row=>appendFileSync(dir+'server-profile.jsonl',JSON.stringify({...row,observedAt:new Date().toISOString()})+'\n',{mode:0o600})};
}
