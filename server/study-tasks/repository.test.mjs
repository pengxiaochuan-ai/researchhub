import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskQuery,createTaskCursor,readTaskPage,readTaskDetail,readTaskReceipt} from './repository.mjs';
const authority={tenantId:'tenant',studyGroupId:'group',researchProjectId:'main',actorAccountId:'owner',readAll:false,canConfigure:false,canExecute:true,canReview:false,isTenantAdmin:false};
const cursor=createTaskCursor('a'.repeat(48));
const task=(id)=>({id,tenantId:'tenant',studyGroupId:'group',researchProjectId:'main',name:'任务'+id,status:'open',reviewStatus:'not_submitted',priority:'normal',version:0,assigneeAccountId:'owner',assignee:{id:'owner',displayName:'科研人员'},collaborators:[],dependencies:[],createdAt:new Date('2026-11-01'),dueAt:null});
test('task_query_rejects_duplicate_unknown_and_unbounded_inputs',()=>{
 for(const q of ['limit=21','limit=0','limit=2&limit=2','include=password','q='+('a'.repeat(121)),'status=anything','overdue=1'])assert.throws(()=>parseTaskQuery(new URLSearchParams(q)),{code:'STUDY_TASK_QUERY_INVALID'});
 assert.equal(parseTaskQuery(new URLSearchParams('limit=2')).limit,2);
});
test('signed_cursor_binds_actor_scope_filters_and_rejects_tampering',()=>{
 const query=parseTaskQuery(new URLSearchParams('limit=2&q=任务'));
 const token=cursor.encode(authority,query,task('t1'));
 assert.equal(cursor.decode(authority,query,token).id,'t1');
 for(const [auth,q,t] of [[{...authority,actorAccountId:'admin'},query,token],[{...authority,researchProjectId:'aux'},query,token],[authority,{...query,q:'other'},token],[authority,query,token+'x']])assert.throws(()=>cursor.decode(auth,q,t),{code:'STUDY_TASK_CURSOR_INVALID'});
});
test('task_page_limits_and_forces_assigned_or_collaborator_visibility',async()=>{
 let args;const rows=[task('c'),task('b'),task('a')];
 const db={studyTask:{findMany:async input=>{args=input;return rows;}}};
 const result=await readTaskPage(db,authority,parseTaskQuery(new URLSearchParams('limit=2')),cursor);
 assert.equal(result.items.length,2);assert(result.nextCursor);assert.equal(args.take,3);assert.equal(args.where.tenantId,'tenant');assert.equal(args.where.acceptanceFixture,false);
 assert.deepEqual(args.where.AND[0].OR,[{assigneeAccountId:'owner'},{collaborators:{some:{accountId:'owner'}}}]);
 assert(!JSON.stringify(result).includes('evidenceRefs'));assert.equal(result.items[0].capabilities.canConfigure,false);
});
test('unreadable_dependency_title_is_not_exposed',async()=>{
 const t={...task('a'),dependencies:[{dependsOnTaskId:'private'}]};
 const db={studyTask:{findFirst:async()=>t,findMany:async()=>[]},$queryRaw:async()=>[]};
 const result=await readTaskDetail(db,authority,'a');
 assert.deepEqual(result.item.dependencies,[{readable:false}]);assert(!JSON.stringify(result).includes('private'));
});
test('operation_receipt_is_actor_bound_and_rechecks_current_task_visibility',async()=>{
 let query;const db={$queryRaw:async(strings,...values)=>{query=values;return[{task_id:'a',receipt:{operationId:'op',taskId:'a',version:1}}];},studyTask:{findFirst:async()=>null}};
 await assert.rejects(()=>readTaskReceipt(db,authority,'request-key'),{code:'STUDY_TASK_AUTH_REQUIRED'});
 assert(query.includes('owner'));
});

test('historical_tasks_remain_read_only_in_local_synthetic_run',async()=>{
 const db={studyTask:{findMany:async()=>[task('historical')]}};
 const result=await readTaskPage(db,{...authority,canConfigure:true,isTenantAdmin:true,writableTaskIds:[]},parseTaskQuery(new URLSearchParams()),cursor);
 assert.equal(result.items[0].capabilities.canConfigure,false);assert.deepEqual(result.items[0].capabilities.transitions,[]);
 assert.equal(result.items[0].capabilities.canRemind,false);
});
test('unmet_or_missing_dependency_hides_start_action_without_revealing_private_parent',async()=>{
 const t={...task('a'),dependencies:[{dependsOnTaskId:'private'}]};
 const db={studyTask:{findFirst:async()=>t,findMany:async()=>[]},$queryRaw:async()=>[]};
 const value=await readTaskDetail(db,authority,'a');assert.equal(value.item.dependenciesReady,false);assert(!value.item.capabilities.transitions.includes('in_progress'));
});
