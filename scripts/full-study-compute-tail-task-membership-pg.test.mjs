import test from 'node:test';
import assert from 'node:assert/strict';
import {inputs,requireMembershipWindow,checkBlockedInsert,assertLockOrder} from './full-study-compute-tail-task-membership-pg.mjs';
test('only the specific after-3 rollback window can start the probe',()=>{
 requireMembershipWindow(['--local-synthetic','after-3'],'explicit');
 for(const [args,flag] of [[['--local-synthetic','after-2'],'explicit'],[['--local-synthetic','after-3'],''],[[],'explicit']])assert.throws(()=>requireMembershipWindow(args,flag));
});
test('fixture binds 277 whole rows and the selected same-subject file to the original quality manifest',()=>{
 const d=inputs();assert.equal(d.runs.length,277);assert.equal(d.revisions.length,48);assert.equal(d.children.length,39);assert.equal(d.files.length,36);
 assert.equal(d.modalities.length,38);assert(d.subjects.includes(d.target.subjectId));assert(d.modalities.some(x=>x.id===d.target.id&&x.visitId===d.target.visitId));
});
test('only a real blocker on the intended task insert at the file-only barrier counts',()=>{
 const valid={pid:11,query:'INSERT INTO public.processing_task (id) VALUES ($1)',wait_event_type:'Lock',blockers:[10]};
 checkBlockedInsert(valid,11,10);
 for(const bad of [{pid:12},{query:'SELECT id FROM public.subject FOR KEY SHARE'},{query:'INSERT INTO public.processing_task_extra (id)'},{wait_event_type:'Client'},{blockers:[99]}])assert.throws(()=>checkBlockedInsert({...valid,...bad},11,10));
 assertLockOrder(['task-share','file-update']);
 for(const wrong of [[],['task-share'],['file-update','task-share'],['task-share','file-update','subject-update']])assert.throws(()=>assertLockOrder(wrong));
});
