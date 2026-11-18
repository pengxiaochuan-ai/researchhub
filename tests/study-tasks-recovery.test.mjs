import test from 'node:test';import assert from 'node:assert/strict';
import {newTaskListState,applyTaskFilters,taskListQuery,moveTaskPage,taskListSnapshot,restoreTaskList} from '../src/study-task-list-state.js';
const scope={studyGroupId:'g',researchProjectId:'p'};
test('pagination_survives_selection_and_filter_return_without_mixing_cursors',()=>{
 const first=applyTaskFilters({q:'研究',status:'in_progress',reviewStatus:'',assigneeAccountId:'owner',overdue:true,limit:2});
 assert.deepEqual(taskListQuery(first),{q:'研究',status:'in_progress',assigneeAccountId:'owner',overdue:'true',limit:2});
 const second=moveTaskPage(first,'next','cursor.signature');assert.equal(taskListQuery(second).cursor,'cursor.signature');
 const saved=taskListSnapshot(second,scope,'owner');assert.deepEqual(restoreTaskList(saved,scope,'owner'),second);
 assert.deepEqual(taskListQuery(moveTaskPage(second,'previous')),taskListQuery(first));
 assert.equal(moveTaskPage(second,'previous').index,0);
 const changed=applyTaskFilters({...first.filters,status:'blocked'});assert.equal(changed.index,0);assert.deepEqual(changed.cursors,[null]);
});
test('identity_or_study_change_drops_old_filter_cursor_state_and_unknown_fields',()=>{
 const saved=taskListSnapshot(newTaskListState(),scope,'owner');
 for(const [target,actor] of [[scope,'admin'],[{...scope,researchProjectId:'other'},'owner']])assert.deepEqual(restoreTaskList(saved,target,actor),newTaskListState());
 assert.deepEqual(restoreTaskList({...saved,state:{...saved.state,index:999}},scope,'owner'),newTaskListState());
 assert.throws(()=>applyTaskFilters({q:'字'.repeat(121)}));assert.throws(()=>applyTaskFilters({limit:21}));assert.throws(()=>applyTaskFilters({status:'invented'}));
 assert.throws(()=>moveTaskPage(newTaskListState(),'next','tampered'));
});
