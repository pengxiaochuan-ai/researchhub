import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {requireWindow, checkedInputs, checkWait, forceRollback, readOutreach} from './full-study-compute-tail-locked-metadata-pg.mjs';
const {Prisma}=createRequire(new URL('../../app/server/package.json',import.meta.url))('@prisma/client');

test('activation requires the exact diagnostic stage and explicit local window',()=>{
 assert.doesNotThrow(()=>requireWindow(['--local-synthetic','after-2'],'explicit'));
 for(const [args,window] of [[[],'explicit'],[['--local-synthetic','after'],'explicit'],[['--local-synthetic','after-2','again'],'explicit'],[['--local-synthetic','after-2'],'']])assert.throws(()=>requireWindow(args,window));
});
test('frozen scope contains the six subjects, 234 plus four distinct original runs, full revisions, child snapshots and scientific files',()=>{
 const x=checkedInputs();assert.equal(x.subjects.length,6);assert.equal(x.oldRuns.length,238);assert.equal(x.revisions.length,48);assert.equal(x.children.length,39);assert.equal(x.files.length,36);
});
test('outreach protection uses both generated Prisma models and all 46 original assignment IDs',async()=>{
 const {c,revisions}=checkedInputs();
 const ids=[...new Set(revisions.map(r=>r.assignmentId))];
 assert.equal(ids.length,46);
 const calls=[];
 function delegate(model){
  const fields=Prisma.dmmf.datamodel.models.find(m=>m.name===model).fields;
  return {findMany:async ({where})=>{
   for(const filter of where.OR??[where])for(const key of Object.keys(filter)){
    assert(fields.some(f=>f.name===key&&f.kind==='scalar'),model+' unknown scalar '+key);
   }
   assert.deepEqual(where,{...c.scope,assignmentId:{in:ids}});
   calls.push(model);
   return [{id:model}];
  }};
 }
 const tx={questionnaireInvitation:delegate('QuestionnaireInvitation'),questionnaireSession:delegate('QuestionnaireSession')};
 const protectedRows=await readOutreach(tx,ids);
 assert.deepEqual(calls,['QuestionnaireInvitation','QuestionnaireSession']);
 assert.deepEqual(protectedRows,{invitations:[{id:'QuestionnaireInvitation'}],sessions:[{id:'QuestionnaireSession'}]});
 await assert.rejects(readOutreach(tx,ids.slice(1)));
 await assert.rejects(readOutreach(tx,Array(46).fill(ids[0])));
});
test('only a proven blocker on the intended statement is accepted',()=>{
 for(const [operation,sql] of [['enrollment','UPDATE public.study_enrollment SET status=status'],['visit','UPDATE public.subject_visit SET "scheduleState"=$1'],['withdraw','SELECT pg_advisory_xact_lock(hashtextextended($1,0))'],['direct-insert','INSERT INTO public.study_participation_event (id) VALUES ($1)']]){
  const row={pid:25,blockers:[26],wait_event_type:'Lock',query:sql};checkWait(operation,row,25,26);
  for(const bad of [{pid:26},{blockers:[27]},{wait_event_type:'Client'},{query:'SELECT 1'}])assert.throws(()=>checkWait(operation,{...row,...bad},25,26));
 }
});
test('QA transaction forces rollback on success and on unexpected body errors',async()=>{
 const records=[],fails=Error('original failure');let committed=0,aborted=0;
 async function transaction(fn){try{const value=await fn({});committed++;return value;}catch(e){aborted++;throw e;}}
 assert.equal(await forceRollback(transaction,'first',records,async()=>7),7);
 await assert.rejects(forceRollback(transaction,'second',records,async()=>{throw fails;}),e=>e===fails);
 assert.equal(committed,0);assert.equal(aborted,2);assert(records.every(e=>e.rolledBack));
});
