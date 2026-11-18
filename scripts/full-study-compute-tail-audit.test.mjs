import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAuditInvocation,bindAfterJournal,compareRevisionDtos,checkNativeAudit} from './full-study-compute-tail-audit.mjs';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const proof=load('../docs/testing/evidence/full-study-batch-performance-2026-11-16/native-audit/final-e1b4d77f/native-proof.json');
const scope=Object.fromEntries(['tenantId','studyGroupId','researchProjectId'].map(k=>[k,proof.header[k]]));
const actor={id:proof.header.accountId,authVersion:proof.header.meta.authVersion};
const journal=()=>({task:'full-study-compute-tail-2026-11-16',stage:'after',studyId:proof.studyId,runGroupId:'full-run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',snapshotId:proof.header.meta.snapshotId,manifestHash:proof.header.meta.manifestHash,steps:{create:{status:'done',body:{snapshotId:proof.header.meta.snapshotId,requestKey:'fresh-create-key'},value:{id:'full-run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}}});
test('CLI only permits explicit after and pre-review/final, with no implicit live mode',()=>{
 assert.deepEqual(parseAuditInvocation(['--local-synthetic','after','pre-review']),{stage:'after',mode:'pre-review'});
 for(const args of [[],['--local-synthetic'],['--local-synthetic','baseline','final'],['--local-synthetic','after','inspect'],['--local-synthetic','after','final','extra']])assert.throws(()=>parseAuditInvocation(args));
});
test('future UUID is strictly journal/create/root bound; old baseline is not a new after run',()=>{
 assert.equal(bindAfterJournal(journal()).groupId,journal().runGroupId);
 for(const change of [j=>j.stage='baseline',j=>j.runGroupId='full-run-b45d1768-8f72-406a-9da5-cb083aead9db',j=>j.steps.create.value.id='other',j=>j.manifestHash='0'.repeat(64),j=>delete j.steps.create.body.requestKey]){const j=journal();change(j);assert.throws(()=>bindAfterJournal(j));}
});
test('complete existing native audit proof remains checkable without hardcoded current group',()=>{
 assert.equal(checkNativeAudit({...proof,scope,actor,createKey:proof.header.meta.requestKey,mode:'final',groupId:proof.runGroupId}).nativeAudits,156);
 assert.throws(()=>checkNativeAudit({...proof,scope,actor,createKey:proof.header.meta.requestKey,mode:'final',groupId:'full-run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}));
});
test('raw48 full immutable DTO fields stay exact; only named presentation field may differ',()=>{
 const raw=load('../docs/testing/evidence/full-study-compute-tail-2026-11-16/live-freeze/run-9fb87de0/raw-revisions-48.json').revisions;
 const previous=structuredClone(raw);previous[0].actorDisplayName='presentation only';
 assert.equal(compareRevisionDtos(previous,raw).length,1);
 const changed=structuredClone(raw);changed[0].answers.extra=0;assert.throws(()=>compareRevisionDtos(previous,changed));
 const extra=structuredClone(previous);extra[0].unknownField=1;assert.throws(()=>compareRevisionDtos(extra,raw));
 const missing=structuredClone(previous);delete missing[0].score;assert.throws(()=>compareRevisionDtos(missing,raw));
});

test('creation must be proved done and earliest accepted group cannot be rebound as after',()=>{for(const change of [j=>j.steps.create.status='pending',j=>{j.runGroupId='full-run-f1506b69-44aa-4c8c-a5cf-230cc398efbe';j.steps.create.value.id=j.runGroupId;}]){const j=journal();change(j);assert.throws(()=>bindAfterJournal(j));}});
