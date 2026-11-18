import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudyTaskClient,readStudyTaskLocation,studyTasksUrl} from '../src/study-tasks-session.js';
const scope={studyGroupId:'group',researchProjectId:'main'};
test('task_client_reads_same_origin_scoped_backend_and_does_not_store_demo_data',async()=>{
 let request;
 const client=createStudyTaskClient({fetchImpl:async(path,init)=>{request={path,init};return new Response(JSON.stringify({items:[],nextCursor:null}));}});
 assert.deepEqual(await client.loadTaskPage(scope,{limit:2}),{items:[],nextCursor:null});
 assert.equal(request.path,'/api/study-tasks?limit=2');assert.equal(request.init.credentials,'same-origin');assert.equal(request.init.cache,'no-store');assert.equal(request.init.redirect,'error');assert.equal(request.init.headers['X-Research-Project-Id'],'main');
});
test('late_response_after_identity_change_never_restores_body',async()=>{
 let resolve;
 const client=createStudyTaskClient({fetchImpl:()=>new Promise(ok=>{resolve=ok;})});
 const pending=client.loadTaskPage(scope);client.invalidate();resolve(new Response(JSON.stringify({items:[],nextCursor:null})));
 await assert.rejects(()=>pending,{name:'AbortError'});
});
test('task_client_rejects_invalid_response_and_unauthorized_read',async()=>{
 const client=createStudyTaskClient({fetchImpl:async()=>new Response(JSON.stringify({items:[{passwordHash:'should-not-use'}],nextCursor:null}))});
 await assert.rejects(()=>client.loadTaskPage(scope),{code:'STUDY_TASK_INVALID_RESPONSE'});
 const denied=createStudyTaskClient({fetchImpl:async()=>new Response('{}',{status:403})});
 await assert.rejects(()=>denied.loadTaskPage(scope),{status:403});
});
test('task_route_requires_explicit_single_study_and_preserves_safe_return',()=>{
 const url=studyTasksUrl(scope,'task-1');assert.equal(readStudyTaskLocation(new URL(url,'http://local').search).taskId,'task-1');
 for(const search of ['','?studyGroupId=group&researchProjectId=main&researchProjectId=other','?studyGroupId=group&researchProjectId=main&taskId=https://evil.invalid'])assert.throws(()=>readStudyTaskLocation(search));
});

test('unknown_commit_is_not_automatically_retried_and_reuses_request_key',async()=>{
 let calls=0;const client=createStudyTaskClient({fetchImpl:async()=>{calls++;throw new Error('offline');}});
 await assert.rejects(()=>client.mutateTask(scope,'create',{requestKey:'same-request-1',name:'任务'}),e=>e.code==='STUDY_TASK_RESULT_UNKNOWN'&&e.requestKey==='same-request-1');
 assert.equal(calls,1);
});

test('reminder_transport_sends_only_scoped_explicit_command_once',async()=>{
 let request;
 const client=createStudyTaskClient({fetchImpl:async(path,init)=>{request={path,init};return new Response(JSON.stringify({operationId:'notice-1',taskId:'task-1',version:3}));}});
 await client.mutateTask(scope,'remind',{requestKey:'reminder-0001',expectedVersion:2},'task-1');
 assert.equal(request.path,'/api/study-tasks/task-1/reminders');assert.equal(request.init.method,'POST');
 assert.deepEqual(JSON.parse(request.init.body),{requestKey:'reminder-0001',expectedVersion:2});
});

test('context_transport_keeps_link_commands_out_of_formal_visit_routes',async()=>{
 const requests=[];const client=createStudyTaskClient({fetchImpl:async(path,init)=>{requests.push({path,method:init.method});return new Response(JSON.stringify(path.includes('link-options')?{items:[],nextCursor:null,availability:'available'}:{operationId:'link-1',taskId:'task-1',version:4}));}});
 await client.loadLinkOptions(scope,{kind:'synthetic_crf_record'});
 await client.mutateTask(scope,'link',{requestKey:'task-context-1',expectedVersion:3,context:{kind:'none'}},'task-1');
 assert.deepEqual(requests,[{path:'/api/study-tasks/link-options?kind=synthetic_crf_record',method:'GET'},{path:'/api/study-tasks/task-1/context',method:'PUT'}]);
});
