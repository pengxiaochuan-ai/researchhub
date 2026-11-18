import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskCommand} from './contract.mjs';
import {readTaskContext,verifyTaskContext} from './links.mjs';
const authority={tenantId:'t',studyGroupId:'g',researchProjectId:'p',actorAccountId:'owner'};
const context={kind:'synthetic_crf_record',sourceId:'record-1',parentId:'collection',rootId:'plan',sourceVersion:4,sourceHash:'a'.repeat(64)};
test('synthetic_context_never_accepts_formal_visit_fk_or_free_answer_fields',()=>{
 const command=parseTaskCommand('link',{requestKey:'task-context-1',expectedVersion:2,context},'task');
 assert.deepEqual(command.input.context,context);assert.equal(command.input.subjectVisitId,undefined);
 for(const extra of [{subjectVisitId:'record-1'},{answers:{score:5}}])assert.throws(()=>parseTaskCommand('link',{requestKey:'task-context-1',expectedVersion:2,context:{...context,...extra}},'task'));
 assert.deepEqual(parseTaskCommand('link',{requestKey:'task-context-1',expectedVersion:2,context:{kind:'none'}},'task').input.context,{kind:'none'});
 const create=parseTaskCommand('create',{requestKey:'create-linked-task',name:'带关联任务',assigneeAccountId:'owner',dueDate:'2026-11-13',context});
 assert.deepEqual(create.input.context,context);
});
test('stale_or_unreadable_link_hides_identifiers_and_content',async()=>{
 const db={$queryRaw:async()=>[],account:{findFirst:async()=>({role:'researcher',authVersion:1})},studyGroupMembership:{findFirst:async()=>({role:{menuPermissions:['artifacts'],buttonPermissions:['artifact.read']}})},researchProjectMembership:{findFirst:async()=>({id:'member'})}};
 const deps={readSynthetic:async()=>{throw Object.assign(new Error('hidden'),{code:'EDC_FORBIDDEN',status:403});}};
 const hidden=await readTaskContext(db,authority,context,deps);
 assert.deepEqual(hidden,{kind:'synthetic_crf_record',status:'restricted',message:'关联来源当前不可读或已变化，请重新核对；不交付旧摘要。'});
 await assert.rejects(()=>verifyTaskContext(db,authority,context,deps),{code:'STUDY_TASK_CONTEXT_RESTRICTED'});
 const none=await readTaskContext(db,authority,{kind:'none'},deps);assert.deepEqual(none,{kind:'none',status:'unlinked'});
});
