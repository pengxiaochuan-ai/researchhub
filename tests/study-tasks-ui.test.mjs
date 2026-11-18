import test,{after} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';import {fileURLToPath} from 'node:url';
import {realModeRouteState} from '../src/real-mode-route.js';
import {studyOverviewNavUrl} from '../src/study-overview-route.js';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
after(()=>server.close());
test('scoped_s08_is_live_and_s01_execution_entry_preserves_exact_scope',()=>{
 const search='?studyGroupId=group&researchProjectId=study';
 assert.equal(realModeRouteState('s08',search,{configured:true,explicitDemo:false}),'live');
 assert.equal(studyOverviewNavUrl('研究执行',search),'/pages/s08/'+search);
});
test('task_page_retains_two_panels_three_fields_and_database_only_copy_while_loading',async()=>{
 const {StudyTasksLayout}=await server.ssrLoadModule('/pages/shared/StudyTasks.jsx');
 const html=renderToStaticMarkup(React.createElement(StudyTasksLayout,{loading:true}));
 assert.equal((html.match(/class="wf-panel"/g)??[]).length,2);
 for(const label of ['执行任务与进度','任务标题','负责人','截止日期','受试者与访视','创建时关联记录（可选）'])assert(html.includes(label),label);
 assert.doesNotMatch(html,/演示研究者|保存演示任务|录入演示访视/);
 assert(html.indexOf('执行任务与进度')<html.indexOf('受试者与访视'));
});
test('saving_does_not_display_previous_success_notice',async()=>{
 const {StudyTasksLayout}=await server.ssrLoadModule('/pages/shared/StudyTasks.jsx');
 const html=renderToStaticMarkup(React.createElement(StudyTasksLayout,{busy:true,notice:'旧操作已经成功'}));
 assert(!html.includes('旧操作已经成功'));
});
test('relation_fields_use_real_members_and_visible_task_ids_without_free_text_roles',async()=>{
 const {StudyTaskAssignments}=await server.ssrLoadModule('/pages/shared/StudyTaskForm.jsx');
 const html=renderToStaticMarkup(React.createElement(StudyTaskAssignments,{task:{id:'task',version:0,assignee:{id:'owner'},collaborators:[],dependencies:[]},participants:[{id:'owner',displayName:'合成科研人员'},{id:'admin',displayName:'合成管理员'}],dependencies:[{id:'dependency',name:'当前可读前置任务'}]}));
 for(const label of ['分派负责人','协作者','前置任务','合成管理员','当前可读前置任务','保存分派'])assert(html.includes(label),label);
 assert(!html.includes('type="email"'));assert(!html.includes('演示'));
});
test('task_transition_requires_explicit_confirmation_and_reasons_not_instant_state_change',async()=>{
 const {TaskTransitionForm,validateTaskTransitionForm}=await server.ssrLoadModule('/pages/shared/StudyTaskRow.jsx');
 const task={id:'task',version:1,capabilities:{transitions:['in_progress','blocked','completed','cancelled'],requiresActingReason:true}};
 const html=renderToStaticMarkup(React.createElement(TaskTransitionForm,{task}));assert(html.includes('任务状态操作'));assert(html.includes('确认状态变更'));
 assert(validateTaskTransitionForm({status:'cancelled',reason:'',blockedReason:'',completionNote:'',evidenceRefs:[]},task).reason);
 assert(validateTaskTransitionForm({status:'completed',reason:'代办核对',blockedReason:'',completionNote:'',evidenceRefs:[]},task).completionNote);
});
test('task_review_form_has_explicit_decision_and_warns_about_self_review',async()=>{
 const {TaskReviewForm,validateTaskReviewForm}=await server.ssrLoadModule('/pages/shared/StudyTaskRow.jsx');
 const html=renderToStaticMarkup(React.createElement(TaskReviewForm,{task:{id:'task',version:4,submission:{actor:{id:'admin'}}},actorId:'admin'}));
 for(const label of ['任务验收操作','验收备注／退回原因','确认任务验收','不是独立复核'])assert(html.includes(label),label);
 assert(validateTaskReviewForm({decision:'return',note:''}).note);assert.deepEqual(validateTaskReviewForm({decision:'accept',note:''}),{});
});

test('reminder_action_and_received_record_never_claim_external_delivery_or_read_receipt',async()=>{
 const {default:Row}=await server.ssrLoadModule('/pages/shared/StudyTaskRow.jsx');
 const task={id:'task',name:'真实任务',status:'open',reviewStatus:'not_submitted',version:3,capabilities:{canRemind:true,transitions:[]},history:[{id:'notice',action:'remind',actor:{id:'admin',displayName:'真实管理员'},resultVersion:3,createdAt:'2026-11-03T01:00:00Z',notice:'任务提醒：请核对当前任务及待办状态。'}]};
 const html=renderToStaticMarkup(React.createElement(Row,{task,selected:task,actorId:'owner'}));
 assert(html.includes('记录站内提醒'));assert(html.includes('任务提醒：请核对当前任务及待办状态。'));
 assert(html.includes('未证明已读或站外送达'));assert(!html.includes('已发送邮件'));
});

test('context_panel_shows_fixed_source_version_and_never_renders_crf_answers',async()=>{
 const {StudyTaskContext}=await server.ssrLoadModule('/pages/shared/StudyTaskContext.jsx');
 const html=renderToStaticMarkup(React.createElement(StudyTaskContext,{task:{id:'task',version:2,capabilities:{canLink:true},context:{kind:'synthetic_crf_record',status:'current',label:'已授权记录包',subjectLabel:'合成被试 1',visitLabel:'基线访视',sourceVersion:4,responseRevision:2,sourceHash:'a'.repeat(64),navigation:{href:null,reason:'不支持固定版本回链'}}}}));
 for(const text of ['已授权记录包','合成被试 1','基线访视','v4','不支持固定版本回链','确认关联'])assert(html.includes(text),text);
 assert(!html.includes('录入演示访视'));assert(!html.includes('answers'));
});

test('task_list_exposes_apply_filters_and_bounded_previous_next_controls_in_original_panel',async()=>{
 const {StudyTasksLayout}=await server.ssrLoadModule('/pages/shared/StudyTasks.jsx');
 const html=renderToStaticMarkup(React.createElement(StudyTasksLayout,{}));
 for(const label of ['搜索任务','任务状态筛选','验收状态筛选','负责人筛选','仅逾期','每页条数','应用任务筛选','上一页','下一页'])assert(html.includes(label),label);
 assert.equal((html.match(/class="wf-panel"/g)??[]).length,2);
});
