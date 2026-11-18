import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadFullStudyObservation,observationSourceHash} from './full-study-local-observation.mjs';

const scope={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-full-study-b230c34b-group',researchProjectId:'cmweunjpe001iluicrmxl5ii5'};
const studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25';
const setup=()=>{const root=mkdtempSync(join(tmpdir(),'full-study-observer-'))+'/';const dir=root+'.tmp/full-study-compute-tail-2026-11-16/';mkdirSync(dir,{recursive:true});return{root,dir,close:()=>rmSync(root,{recursive:true,force:true})};};
const config=()=>({schemaVersion:'full-study-project-observer-v1',studyId,scope,sourceHash:observationSourceHash()});
const load=root=>loadFullStudyObservation({root,tenantId:scope.tenantId,targets:[{studyId,scope}]});
test('no private enable file leaves ordinary composition untouched',()=>{const f=setup();try{assert.equal(load(f.root),undefined);}finally{f.close();}});
test('only fixed registered scope and frozen sources enable private metadata output',()=>{const f=setup();try{writeFileSync(f.dir+'observer-enable.json',JSON.stringify(config()));const o=load(f.root);assert.deepEqual(o.scope,scope);assert.equal(o.studyId,studyId);assert.equal(o.sourceHash,observationSourceHash());o.emit({phase:'snapshot',wallMs:2});const row=JSON.parse(readFileSync(f.dir+'server-profile.jsonl','utf8'));assert.equal(row.phase,'snapshot');assert.equal(row.wallMs,2);assert.equal(typeof row.observedAt,'string');}finally{f.close();}});
test('source drift, extra fields, unregistered scope or other tenant cannot enable diagnostics',()=>{const f=setup();try{for(const bad of [{...config(),sourceHash:'0'.repeat(64)},{...config(),output:'/tmp/leak'}, {...config(),scope:{...scope,researchProjectId:'other'}}]){writeFileSync(f.dir+'observer-enable.json',JSON.stringify(bad));assert.throws(()=>load(f.root));}writeFileSync(f.dir+'observer-enable.json',JSON.stringify(config()));assert.throws(()=>loadFullStudyObservation({root:f.root,tenantId:'other',targets:[{studyId,scope}]}));assert.throws(()=>loadFullStudyObservation({root:f.root,tenantId:scope.tenantId,targets:[]}));}finally{f.close();}});
