import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskCommand,taskDueAt} from './contract.mjs';
const input={requestKey:'task-create-1',name:'测试任务',assigneeAccountId:'owner',dueDate:'2026-11-13'};
test('due_date_rejects_impossible_day_and_uses_shanghai_day_end',()=>{
 assert.equal(taskDueAt('2026-11-13'),'2026-11-13T15:59:59.999Z');
 for(const date of ['2026-02-29','2026-02-30','2026-13-01','2026-1-1','2026-11-13T00:00:00Z'])assert.throws(()=>taskDueAt(date));
 assert.equal(taskDueAt('2028-02-29'),'2028-02-29T15:59:59.999Z');
});
test('task_create_limits_title_and_rejects_scope_status_or_admin_injection',()=>{
 assert.equal(parseTaskCommand('create',{...input,name:'研'.repeat(120)}).input.name.length,120);
 for(const extra of [{name:'研'.repeat(121)},{name:'   '},{tenantId:'foreign'},{status:'completed'},{isTenantAdmin:true},{taskType:'visit'}])assert.throws(()=>parseTaskCommand('create',{...input,...extra}));
});
test('task_edit_requires_version_and_only_whitelisted_metadata',()=>{
 const command=parseTaskCommand('edit',{requestKey:'task-edit-1',expectedVersion:0,name:' 修改后 '},'task');
 assert.deepEqual(command.input,{expectedVersion:0,name:'修改后'});
 for(const extra of [{expectedVersion:undefined},{expectedVersion:-1},{assigneeAccountId:'other'},{status:'completed'}])assert.throws(()=>parseTaskCommand('edit',{requestKey:'task-edit-1',expectedVersion:0,name:'新题名',...extra},'task'));
});
