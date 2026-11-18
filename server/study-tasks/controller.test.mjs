import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTaskRequest,taskReadRoutes,normalizeTaskFailure} from './controller.mjs';
const req={method:'GET',headers:{host:'127.0.0.1:19502','x-study-group-id':'group','x-research-project-id':'main'},originalUrl:'/api/study-tasks?limit=2'};
test('task_scope_requires_exact_headers_and_rejects_forwarded_scope',()=>{
 assert.deepEqual(validateTaskRequest(req,'tenant').scope,{tenantId:'tenant',studyGroupId:'group',researchProjectId:'main'});
 for(const headers of [{...req.headers,'x-study-group-id':undefined},{...req.headers,'x-study-group-id':['group','other']},{...req.headers,'x-research-project-id':'main,other'},{...req.headers,'x-forwarded-host':'evil.invalid'}])assert.throws(()=>validateTaskRequest({...req,headers},'tenant'));
});
test('task_writes_require_same_origin_json_and_no_cross_site',()=>{
 const write={...req,method:'POST',headers:{...req.headers,origin:'http://127.0.0.1:19501','content-type':'application/json'}};
 assert(validateTaskRequest(write,'tenant'));
 for(const headers of [{...write.headers,origin:undefined},{...write.headers,origin:'https://evil.invalid'},{...write.headers,'content-type':'text/plain'},{...write.headers,'sec-fetch-site':'cross-site'}])assert.throws(()=>validateTaskRequest({...write,headers},'tenant'));
});
test('fixed_task_routes_are_registered_before_identifier_route',()=>{
 assert(taskReadRoutes.indexOf('operations/:requestKey')<taskReadRoutes.indexOf(':id'));
 assert(taskReadRoutes.indexOf('participants')<taskReadRoutes.indexOf(':id'));
 assert(taskReadRoutes.includes('studies'));assert(taskReadRoutes.includes('context'));
});

test('hub_state_conflict_is_409_without_changing_legacy_input_errors',()=>{
 const legacy={getStatus:()=>400,getResponse:()=>({code:'INVALID_TASK_TRANSITION',message:'任务状态不允许该流转'})};
 const mapped=normalizeTaskFailure(legacy);assert.equal(mapped.status,409);assert.equal(mapped.code,'STUDY_TASK_STATE_CONFLICT');
 const input={getStatus:()=>400,getResponse:()=>({code:'INVALID_TASK_TYPE'})};assert.equal(normalizeTaskFailure(input),input);
});
