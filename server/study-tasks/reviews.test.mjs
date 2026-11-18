import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskCommand} from './contract.mjs';
import {createTaskCommands} from './commands.mjs';
import {readTaskReviewSummary} from './repository.mjs';
const input={requestKey:'review-task-1',expectedVersion:4,decision:'return',note:'补齐本轮核对说明'};
test('return_requires_reason_and_review_note_is_bounded',()=>{
 assert.equal(parseTaskCommand('review',input,'task').input.decision,'return');
 for(const extra of [{note:''},{note:'研'.repeat(1001)},{decision:'approve'},{expectedVersion:undefined},{status:'completed'}])assert.throws(()=>parseTaskCommand('review',{...input,...extra},'task'));
 assert.equal(parseTaskCommand('review',{...input,decision:'accept',note:''},'task').input.decision,'accept');
});
test('executor_cannot_review_even_if_assigned_or_collaborating',async()=>{
 let written=false;const execute=createTaskCommands({boundary:{},transact:async(_scope,fn)=>fn({$queryRaw:async()=>[],studyTask:{findFirst:async()=>({id:'task',assigneeAccountId:'owner',collaborators:[]})}}),
  authorize:async(_db,_principal,_scope,action)=>{if(action==='review')throw Object.assign(new Error('denied'),{code:'STUDY_TASK_AUTH_REQUIRED'});return {actorAccountId:'owner'};},
  studyOperations:{executeHubTaskCommandInTransaction:()=>{written=true;}}});
 await assert.rejects(()=>execute({accountId:'owner'},{},parseTaskCommand('review',input,'task')),{code:'STUDY_TASK_AUTH_REQUIRED'});assert.equal(written,false);
});
test('same_account_submission_and_review_is_explicit_not_invented_independence',async()=>{
 const authority={tenantId:'t',studyGroupId:'g',researchProjectId:'p'};
 const db={auditLog:{findFirst:async()=>({accountId:'owner',createdAt:new Date('2026-11-02'),meta:{version:4}})},account:{findFirst:async()=>({id:'owner',displayName:'合成科研人员'})}};
 const summary=await readTaskReviewSummary(db,authority,{id:'task',status:'completed',reviewedBy:'owner'});assert.equal(summary.sameActorReview,true);assert.equal(summary.submission.actor.id,'owner');
 db.auditLog.findFirst=async()=>null;const unknown=await readTaskReviewSummary(db,authority,{id:'task',status:'completed',reviewedBy:'owner'});assert.equal(unknown.submission,null);assert.equal(unknown.sameActorReview,null);
});
