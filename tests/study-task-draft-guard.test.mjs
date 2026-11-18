import test from 'node:test';import assert from 'node:assert/strict';
import {canApplyTaskRead,rebaseTaskSubmission} from '../src/study-task-draft-guard.js';
test('late_same_task_read_cannot_apply_after_typing_or_a_new_selection',()=>{
 assert.equal(canApplyTaskRead({startedRevision:1,currentRevision:2,startedSelection:4,currentSelection:4}),false);
 assert.equal(canApplyTaskRead({startedRevision:1,currentRevision:1,startedSelection:4,currentSelection:5}),false);
 assert.equal(canApplyTaskRead({startedRevision:1,currentRevision:1,startedSelection:4,currentSelection:4}),true);
});
test('explicit_rebase_keeps_exact_draft_but_uses_current_version_and_new_receipt_key',()=>{
 const pending={taskId:'task',action:'edit',input:{expectedVersion:1,requestKey:'old',name:'我的草稿'}};
 const next=rebaseTaskSubmission(pending,{id:'task',version:2});assert.equal(next.input.name,'我的草稿');assert.equal(next.input.expectedVersion,2);assert.notEqual(next.input.requestKey,'old');assert.equal(pending.input.expectedVersion,1);
 assert.throws(()=>rebaseTaskSubmission(pending,{id:'another',version:2}));
});
