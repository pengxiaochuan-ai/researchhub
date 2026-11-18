import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskCommand} from './contract.mjs';
import {createTaskCommands} from './commands.mjs';
const base={requestKey:'transition-1',expectedVersion:0,status:'completed'};
test('completion_requires_note_or_controlled_evidence_and_rejects_urls',()=>{
 assert.throws(()=>parseTaskCommand('transition',base,'task'));
 assert.equal(parseTaskCommand('transition',{...base,completionNote:'本人已完成核对'},'task').input.completionNote,'本人已完成核对');
 assert.throws(()=>parseTaskCommand('transition',{...base,evidenceRefs:['https://example.org/file']},'task'));
 const ref={kind:'artifact_version',artifactId:'artifact',version:1,contentHash:'a'.repeat(64),sourceSnapshotHash:'b'.repeat(64)};
 assert.equal(parseTaskCommand('transition',{...base,evidenceRefs:[ref]},'task').input.evidenceRefs.length,1);
 for(const input of [{...base,completionNote:'a'.repeat(2001)},{...base,evidenceRefs:Array(11).fill(ref)},{...base,evidenceRefs:[{...ref,url:'https://evil.invalid'}]}])assert.throws(()=>parseTaskCommand('transition',input,'task'));
});
test('blocked_and_cancellation_require_real_reason_and_do_not_mix_completion_fields',()=>{
 for(const value of [{status:'blocked'},{status:'cancelled'},{status:'in_progress',completionNote:'不允许顺带写完成事实'}])assert.throws(()=>parseTaskCommand('transition',{requestKey:'transition-1',expectedVersion:0,...value},'task'));
 assert.equal(parseTaskCommand('transition',{requestKey:'transition-1',expectedVersion:0,status:'cancelled',reason:'研究任务不再需要'},'task').reason,'研究任务不再需要');
});
test('manager_cancellation_uses_cancel_authority_not_impersonated_execution',async()=>{
 let actionSeen;const scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'};
 const task={id:'task',...scope,assigneeAccountId:'other',collaborators:[]};let inserted;
 let audit;const tx={auditLog:{create:async input=>{audit=input.data;}},studyTask:{findFirst:async()=>task},$queryRaw:async strings=>strings.join('').includes("action='create'")?[{id:'receipt'}]:[],$executeRaw:async(strings,...values)=>{inserted=values;}};
 const execute=createTaskCommands({boundary:{ids:{owner:'owner',admin:'admin'}},transact:async(_s,fn)=>fn(tx),authorize:async(_db,_p,_s,action)=>{if(action!=='read')actionSeen=action;return {...scope,actorAccountId:'owner'};},studyOperations:{executeHubTaskCommandInTransaction:async()=>({id:'task',version:1})}});
 await execute({accountId:'owner'},scope,parseTaskCommand('transition',{requestKey:'cancel-task-1',expectedVersion:0,status:'cancelled',reason:'本人以管理权限取消'},'task'));
 assert.equal(actionSeen,'cancel');assert(inserted.includes('本人以管理权限取消'));
 assert.equal(audit.accountId,'owner');assert.equal(audit.meta.reason,'本人以管理权限取消');
});
test('completion_audit_keeps_reference_fingerprints_without_copying_request_body',async()=>{
 const scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'};let audit;
 const tx={auditLog:{create:async input=>{audit=input.data;}},studyTask:{findFirst:async()=>({id:'task',...scope,status:'in_progress',assigneeAccountId:'owner',collaborators:[]})},$queryRaw:async strings=>strings.join('').includes("action='create'")?[{id:'receipt'}]:[],$executeRaw:async()=>0};
 const execute=createTaskCommands({boundary:{},transact:async(_scope,fn)=>fn(tx),authorize:async()=>({...scope,actorAccountId:'owner'}),studyOperations:{executeHubTaskCommandInTransaction:async()=>({id:'task',version:1,status:'completed'})}});
 await execute({accountId:'owner'},scope,parseTaskCommand('transition',{requestKey:'completion-hash-1',expectedVersion:0,status:'completed',completionNote:'本人完整完成说明仅保存在任务中'},'task'));
 assert(/^[a-f0-9]{64}$/.test(audit.meta.completionNoteHash));assert.deepEqual(audit.meta.submittedEvidence,[]);assert(!JSON.stringify(audit).includes('本人完整完成说明仅保存在任务中'));
});
